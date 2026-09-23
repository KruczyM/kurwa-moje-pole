import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { environmentAssets } from '../assets/assetManifest';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { allTentLayout, tentColliderBounds } from './campLayout';
import { ROCK_SHOP_SITE } from './festivalLandmarks';
import { FESTIVAL_WHEEL_SITE } from './festivalWheel';
import {
  createMarketGrassMask,
  MARKET_LANE,
  MARKET_STALL_LAYOUT,
  MARKET_VARIANTS,
  marketColliderBounds,
  marketLaneMaterial,
  marketTemplates,
  placeFestivalMarket,
} from './festivalMarket';
import { terrainHeight } from './terrainHeight';

async function load() {
  const data = readFileSync(
    new URL(`../../../public/game-assets/${catalog.environment.marketStalls}`, import.meta.url),
  );
  expect(data.length).toBeLessThan(6500000);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}
function materialMesh(root: THREE.Object3D, materialName: string) {
  let result: THREE.Mesh | undefined;
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      !Array.isArray(object.material) &&
      object.material.name === materialName
    )
      result = object;
  });
  return result!;
}
const overlaps = (a: ReturnType<typeof marketColliderBounds>, b: ReturnType<typeof marketColliderBounds>) =>
  a.maxX > b.minX && a.minX < b.maxX && a.maxZ > b.minZ && a.minZ < b.maxZ;

describe('modular festival market', () => {
  it('builds a single terrain-following paved lane using the cached material, with no movement collider', async () => {
    const source = await load();
    const parent = new THREE.Group();
    try {
      const material = marketLaneMaterial(source) as THREE.MeshStandardMaterial;
      expect(material.map).toBeTruthy();
      expect(material.roughnessMap).toBeTruthy();
      // Node's image stub bypasses sampler setup: inspect the actual exported sampler.
      const data = readFileSync(
        new URL(`../../../public/game-assets/${catalog.environment.marketStalls}`, import.meta.url),
      );
      const json = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
      const exported = json.materials.find((m: { name: string }) => m.name === 'Market_Concrete');
      const sampler =
        json.samplers[json.textures[exported.pbrMetallicRoughness.baseColorTexture.index].sampler];
      expect(sampler.wrapS ?? 10497).toBe(10497);
      expect(sampler.wrapT ?? 10497).toBe(10497);
      const disposal = vi.spyOn(material, 'dispose');
      const colliders = placeFestivalMarket(parent, marketTemplates(source), terrainHeight, material);
      expect(colliders).toHaveLength(7);
      const lane = parent.getObjectByName('Market_Paved_Lane') as THREE.Mesh;
      expect(lane.material).toBe(material);
      expect(lane.receiveShadow).toBe(true);
      const positions = lane.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          z = positions.getZ(i);
        expect(positions.getY(i) - terrainHeight(x, z)).toBeCloseTo(0.025, 5);
        expect(x).toBeGreaterThanOrEqual(MARKET_LANE.minX - 0.00001);
        expect(x).toBeLessThanOrEqual(MARKET_LANE.maxX + 0.00001);
        expect(colliders.some((b) => b.containsPoint(new THREE.Vector3(x, 0, z)))).toBe(false);
      }
      expect(lane.geometry.index!.count / 3).toBe(1296);
      parent.add(source.scene);
      disposeObjectTree(parent);
      expect(disposal).toHaveBeenCalledTimes(1);
    } finally {
      if (parent.children.length) {
        parent.add(source.scene);
        disposeObjectTree(parent);
      }
    }
  });
  it('loads seven variants with two shared roof constructions, textures and bounded detail', async () => {
    expect(environmentAssets.marketStalls).toContain('game-assets/world/festival/marketStalls.glb');
    const source = await load();
    try {
      const templates = marketTemplates(source);
      expect([...templates.keys()].sort()).toEqual([...MARKET_VARIANTS].sort());
      const floors = new Set<THREE.BufferGeometry>();
      const roofs = new Set<THREE.BufferGeometry>();
      const fabrics = new Set<THREE.Material>();
      for (const template of templates.values()) {
        expect(template.userData.referenceStatus.toLowerCase()).toContain('provisional');
        const bounds = new THREE.Box3().setFromObject(template);
        const size = bounds.getSize(new THREE.Vector3());
        if (template.userData.marketVariant === 'siemaShop') {
          expect(template.userData.marketArchitecture).toBe('largeHall');
          expect(size.x).toBeGreaterThan(24);
          expect(size.x).toBeLessThan(24.5);
          expect(size.z).toBeGreaterThan(18);
          expect(size.z).toBeLessThan(18.5);
          expect(size.y).toBeGreaterThan(6.9);
          const materials = new Set<string>();
          let triangles = 0;
          template.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              materials.add((o.material as THREE.Material).name);
              triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
            }
          });
          expect([...materials].filter((name) => name.startsWith('SiemaShop_Pop_'))).toHaveLength(5);
          expect(triangles).toBeLessThan(150000);
          continue;
        }
        // 4.8 m canvas plus projecting structural tubes at the roof corners.
        expect(size.x).toBeGreaterThanOrEqual(4.8);
        expect(size.x).toBeLessThan(4.85);
        expect(size.y).toBeGreaterThan(3.9);
        expect(size.y).toBeLessThan(4);
        expect(size.z).toBeGreaterThan(5);
        expect(size.z).toBeLessThan(5.2);
        floors.add(materialMesh(template, 'Market_Floor').geometry);
        const roof = template.children.find(
          (o) =>
            o instanceof THREE.Mesh &&
            o.userData.marketRoof === template.userData.marketArchitecture &&
            (o.material as THREE.Material).name === 'Market_White_Canvas',
        ) as THREE.Mesh;
        expect(roof).toBeTruthy();
        roofs.add(roof.geometry);
        fabrics.add(roof.material as THREE.Material);
        const pbr = roof.material as THREE.MeshStandardMaterial;
        expect(pbr.map).toBeTruthy();
        expect(pbr.normalMap).toBeTruthy();
        expect(pbr.roughnessMap).toBeTruthy();
        expect(pbr.metalness).toBe(0);
        expect(pbr.color.r).toBeGreaterThan(0.7);
        expect(pbr.color.g).toBeGreaterThan(0.7);
        expect(pbr.color.b).toBeGreaterThan(0.7);
        let meshes = 0,
          triangles = 0;
        template.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          meshes++;
          triangles += (obj.geometry.index?.count ?? obj.geometry.attributes.position.count) / 3;
        });
        expect(meshes).toBeLessThanOrEqual(13);
        expect(triangles).toBeLessThan(12500);
      }
      expect(floors.size).toBe(1);
      expect(roofs.size).toBe(2);
      expect(fabrics.size).toBe(1);
    } finally {
      disposeObjectTree(source.scene);
    }
  });

  it('keeps the hall ridge long and high, distinct from a single-peaked pagoda', async () => {
    const source = await load();
    try {
      const templates = marketTemplates(source);
      for (const id of ['informacja', 'kodano', 'antykwariat'] as const) {
        const root = templates.get(id)!.clone(true);
        root.position.set(0, 0, 0);
        root.updateMatrixWorld(true);
        const ridge = new THREE.Box3();
        root.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || o.userData.marketRoof !== 'segmentHall') return;
          const p = o.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
            if (v.y > 3.93) ridge.expandByPoint(v);
          }
        });
        expect(ridge.max.x - ridge.min.x).toBeGreaterThan(4.7);
        expect(ridge.max.z - ridge.min.z).toBeLessThan(0.1);
        // Regression: rafters must stay below the sagging canvas, not cut through it.
        for (const x of [-2.2, 0, 2.2])
          for (const z of [-1.1, 1.1]) {
            const ray = new THREE.Raycaster(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0));
            const first = ray.intersectObject(root, true)[0]?.object as THREE.Mesh;
            expect(first).toBeTruthy();
            expect((first.material as THREE.Material).name).toBe('Market_White_Canvas');
          }
      }
    } finally {
      disposeObjectTree(source.scene);
    }
  });

  it('grounds six instances, keeps service openings clear and leaves the cached library unchanged', async () => {
    const source = await load();
    const parent = new THREE.Group();
    try {
      const templates = marketTemplates(source);
      const before = [...templates.values()].map((t) => t.matrix.toArray());
      const colliders = placeFestivalMarket(parent, templates, terrainHeight);
      const mask = createMarketGrassMask(new Set(templates.keys()));
      expect(colliders).toHaveLength(7);
      expect(parent.children).toHaveLength(1);
      const stalls = parent.children[0].children;
      expect(stalls).toHaveLength(7);
      parent.updateMatrixWorld(true);
      for (const [index, root] of stalls.entries()) {
        const config = MARKET_STALL_LAYOUT[index];
        expect(root.name).toBe(config.id);
        expect(root.position.x).toBe(config.x);
        expect(root.position.z).toBe(config.z);
        expect(root.userData.exteriorOnly).toBe(true);
        if (config.variant === 'siemaShop') {
          expect(root.userData.campObject.label).toBe('SiemaShop');
          expect(root.userData.vendor.presence).toBe('organizer-confirmed-2026');
          expect(root.userData.vendor.position).toBe('review-layout-not-surveyed');
          expect(root.userData.vendorSource).toBe(root.userData.vendor.source);
        } else if (['antykwariat', 'informacja', 'kodano'].includes(config.variant)) {
          expect(root.userData.marketArchitecture).toBe('segmentHall');
          expect(root.userData.vendor.presence).toBe('user-photo-year-not-independently-verified');
          expect(root.userData.vendorSource).toBe(root.userData.vendor.source);
        } else expect(root.userData.vendor).toBeUndefined();
        const floor = new THREE.Box3().setFromObject(materialMesh(root, 'Market_Floor'));
        for (let x = floor.min.x; x <= floor.max.x; x += 0.25) {
          for (let z = floor.min.z; z <= floor.max.z; z += 0.25) {
            expect(floor.min.y - terrainHeight(x, z)).toBeGreaterThan(0.02);
            expect(mask(x, z)).toBe(0);
          }
        }
        const ray = new THREE.Raycaster(
          new THREE.Vector3(
            config.x + (config.variant === 'siemaShop' ? 10 : 3.2),
            root.position.y + 1.6,
            config.z + (config.variant === 'siemaShop' ? 4.5 : 0),
          ),
          new THREE.Vector3(-1, 0, 0),
          0,
          1.5,
        );
        expect(ray.intersectObject(root, true)).toHaveLength(0);
        expect(materialMesh(root, 'Market_Floor').geometry).toBe(
          materialMesh(templates.get(config.variant)!, 'Market_Floor').geometry,
        );
      }
      expect([...templates.values()].map((t) => t.matrix.toArray())).toEqual(before);
      const geometry = materialMesh(stalls[0], 'Market_Floor').geometry;
      const disposal = vi.spyOn(geometry, 'dispose');
      parent.add(source.scene);
      disposeObjectTree(parent);
      expect(disposal).toHaveBeenCalledTimes(1);
    } finally {
      if (parent.children.length) {
        parent.add(source.scene);
        disposeObjectTree(parent);
      }
    }
  });

  it('keeps stalls separated from one another, tents, existing landmarks and a wide customer lane', () => {
    const fixed = [ROCK_SHOP_SITE, FESTIVAL_WHEEL_SITE].map((s) => ({
      minX: s.x - s.halfWidth,
      maxX: s.x + s.halfWidth,
      minZ: s.z - s.halfDepth,
      maxZ: s.z + s.halfDepth,
    }));
    for (const stall of MARKET_STALL_LAYOUT) {
      const b = marketColliderBounds(stall);
      for (const other of MARKET_STALL_LAYOUT)
        if (other.id !== stall.id) expect(overlaps(b, marketColliderBounds(other))).toBe(false);
      for (const tent of allTentLayout) expect(overlaps(b, tentColliderBounds(tent)), tent.id).toBe(false);
      for (const landmark of fixed) expect(overlaps(b, landmark)).toBe(false);
      expect(b.maxX + 0.45).toBeLessThan(MARKET_LANE.minX);
    }
    expect(MARKET_LANE.maxX - MARKET_LANE.minX).toBeGreaterThan(4);
    const mask = createMarketGrassMask(new Set(MARKET_VARIANTS));
    expect(mask(-32, 0)).toBe(0);
    expect(mask(MARKET_LANE.maxX + 0.125, 0)).toBeCloseTo(0.5);
    expect(mask(-28, 0)).toBe(1);
  });

  it('handles missing or partial libraries without invisible colliders or grass holes at absent stalls', async () => {
    const parent = new THREE.Group();
    expect(marketTemplates(null).size).toBe(0);
    expect(placeFestivalMarket(parent, new Map(), terrainHeight)).toEqual([]);
    expect(parent.children).toHaveLength(0);
    expect(createMarketGrassMask(new Set())(-37, -14)).toBe(1);
    const source = await load();
    try {
      const templates = marketTemplates(source);
      const partial = new Map([['coffee' as const, templates.get('coffee')!]]);
      expect(placeFestivalMarket(parent, partial, terrainHeight)).toHaveLength(1);
      const mask = createMarketGrassMask(new Set(partial.keys()));
      expect(mask(-37, -14)).toBe(1);
      expect(mask(MARKET_STALL_LAYOUT[2].x, MARKET_STALL_LAYOUT[2].z)).toBe(0);
    } finally {
      parent.add(source.scene);
      disposeObjectTree(parent);
    }
  });
});
