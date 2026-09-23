import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import vendors from './festivalVendors.json';

export type MarketVariant =
  'merch' | 'food' | 'coffee' | 'siemaShop' | 'antykwariat' | 'informacja' | 'kodano';
export const MARKET_VARIANTS: readonly MarketVariant[] = [
  'merch',
  'food',
  'coffee',
  'siemaShop',
  'antykwariat',
  'informacja',
  'kodano',
];
const STALL_ORDER: readonly MarketVariant[] = [
  'siemaShop',
  'food',
  'coffee',
  'antykwariat',
  'informacja',
  'kodano',
  'merch',
];
/** Review area only. Confirmed names do not imply surveyed shop positions or architecture. */
export const MARKET_STALL_LAYOUT = STALL_ORDER.map((variant, index) => ({
  id: `Market_${index + 1}`,
  variant,
  x: variant === 'siemaShop' ? -46 : -39,
  z: [0, -28, -22, -16, 16, 22, 28][index],
  rotationY: Math.PI / 2,
}));
export const MARKET_LANE = { minX: -36, maxX: -29, minZ: -32, maxZ: 32 } as const;

export function marketColliderBounds(stall: (typeof MARKET_STALL_LAYOUT)[number]) {
  if (stall.variant === 'siemaShop')
    return { minX: stall.x - 9.15, maxX: stall.x + 9.15, minZ: stall.z - 12.15, maxZ: stall.z + 12.15 };
  // Fixed +X-facing layout: depth across X, width across Z. Front canopy is overhead.
  return { minX: stall.x - 2.15, maxX: stall.x + 2.05, minZ: stall.z - 2.45, maxZ: stall.z + 2.45 };
}

export function marketTemplates(source: GLTF | null | undefined) {
  const templates = new Map<MarketVariant, THREE.Object3D>();
  source?.scene.traverse((object) => {
    const variant: unknown = object.userData.marketVariant;
    if (MARKET_VARIANTS.includes(variant as MarketVariant)) templates.set(variant as MarketVariant, object);
  });
  return templates;
}

export function marketLaneMaterial(source: GLTF | null | undefined): THREE.Material | undefined {
  let material: THREE.Material | undefined;
  source?.scene.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      object.userData.marketSurface === 'concrete' &&
      !Array.isArray(object.material)
    )
      material = object.material;
  });
  return material;
}

/** Single static strip, subdivided to follow the existing terrain; no separate renderer. */
function createLane(heightAt: (x: number, z: number) => number, material: THREE.Material) {
  const lane = MARKET_LANE;
  const geometry = new THREE.PlaneGeometry(lane.maxX - lane.minX, lane.maxZ - lane.minZ, 9, 72).rotateX(
    -Math.PI / 2,
  );
  const positions = geometry.attributes.position,
    uv = geometry.attributes.uv;
  const centerX = (lane.minX + lane.maxX) / 2,
    centerZ = (lane.minZ + lane.maxZ) / 2;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + centerX,
      z = positions.getZ(i) + centerZ;
    positions.setXYZ(i, x, heightAt(x, z) + 0.025, z);
    uv.setXY(i, x / 3.5, z / 4);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Market_Paved_Lane';
  mesh.receiveShadow = true;
  mesh.userData.excludeMushroomWireframe = true;
  return mesh;
}

/** Missing assets leave neither invisible walls nor bare building footprints. */
export function createMarketGrassMask(available: ReadonlySet<MarketVariant>) {
  const footprints: { minX: number; maxX: number; minZ: number; maxZ: number }[] = MARKET_STALL_LAYOUT.filter(
    (stall) => available.has(stall.variant),
  ).map((stall) => {
    const b = marketColliderBounds(stall);
    return { minX: b.minX - 0.25, maxX: MARKET_LANE.minX, minZ: b.minZ - 0.2, maxZ: b.maxZ + 0.2 };
  });
  if (footprints.length) footprints.push(MARKET_LANE);
  return (x: number, z: number) => {
    let mask = 1;
    for (const b of footprints) {
      const distance = Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ);
      mask = Math.min(mask, THREE.MathUtils.smoothstep(distance, 0, 0.25));
    }
    return mask;
  };
}

/** Reuses library meshes/materials and the existing scene disposer. */
export function placeFestivalMarket(
  parent: THREE.Object3D,
  templates: ReadonlyMap<MarketVariant, THREE.Object3D>,
  heightAt: (x: number, z: number) => number,
  laneMaterial?: THREE.Material,
) {
  const colliders: THREE.Box3[] = [];
  if (!templates.size) return colliders;
  const group = new THREE.Group();
  group.name = 'Festival_Shopping_Passage';
  if (laneMaterial) group.add(createLane(heightAt, laneMaterial));
  for (const stall of MARKET_STALL_LAYOUT) {
    const source = templates.get(stall.variant);
    if (!source) continue;
    const root = clone(source);
    // Remove the preview-library offset, retaining native metre scale.
    root.position.set(0, 0, 0);
    root.rotation.set(0, stall.rotationY, 0);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    let ground = -Infinity;
    for (let x = bounds.min.x; x <= bounds.max.x + 0.25; x += 0.25) {
      for (let z = bounds.min.z; z <= bounds.max.z + 0.25; z += 0.25) {
        ground = Math.max(ground, heightAt(stall.x + x, stall.z + z));
      }
    }
    root.position.set(stall.x, ground + 0.025 - bounds.min.y, stall.z);
    root.name = stall.id;
    root.userData.exteriorOnly = true;
    const vendor = stall.variant in vendors ? vendors[stall.variant as keyof typeof vendors] : undefined;
    root.userData.vendor = vendor;
    root.userData.campObject = { id: stall.id, label: vendor?.label ?? `Stoisko — ${stall.variant}` };
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    group.add(root);
    const b = marketColliderBounds(stall);
    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(b.minX, -2, b.minZ),
        new THREE.Vector3(b.maxX, ground + (stall.variant === 'siemaShop' ? 7.2 : 4.1), b.maxZ),
      ),
    );
  }
  parent.add(group);
  return colliders;
}
