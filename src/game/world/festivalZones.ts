import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import vendors from './festivalVendors.json';

export type FestivalZoneId = 'pomorze' | 'redBull' | 'iqos';
export const FESTIVAL_ZONE_IDS: readonly FestivalZoneId[] = ['pomorze', 'redBull', 'iqos'];
/** Asset-review sites, not georeferenced festival positions. Native dimensions in metres. */
export const FESTIVAL_ZONE_SITES = [
  { id: 'pomorze', instanceId: 'pomorze', x: 0, z: 43, rotationY: Math.PI, halfWidth: 8.5, halfDepth: 3.2 },
  {
    id: 'redBull',
    instanceId: 'redBull_1',
    x: -22,
    z: 0,
    rotationY: -Math.PI / 2,
    halfWidth: 4.9,
    halfDepth: 5.65,
  },
  { id: 'iqos', instanceId: 'iqos', x: 23, z: 13, rotationY: Math.PI, halfWidth: 4.5, halfDepth: 2.85 },
  { id: 'redBull', instanceId: 'redBull_2', x: 0, z: -21, rotationY: 0, halfWidth: 5.65, halfDepth: 4.9 },
  {
    id: 'redBull',
    instanceId: 'redBull_3',
    x: 0,
    z: 33,
    rotationY: Math.PI,
    halfWidth: 5.65,
    halfDepth: 4.9,
  },
  {
    id: 'redBull',
    instanceId: 'redBull_4',
    x: 45,
    z: 13,
    rotationY: -Math.PI / 2,
    halfWidth: 4.9,
    halfDepth: 5.65,
  },
] as const;

export function zoneBounds(site: (typeof FESTIVAL_ZONE_SITES)[number]) {
  return {
    minX: site.x - site.halfWidth,
    maxX: site.x + site.halfWidth,
    minZ: site.z - site.halfDepth,
    maxZ: site.z + site.halfDepth,
  };
}

export function festivalZoneTemplates(source: GLTF | null | undefined) {
  const result = new Map<FestivalZoneId, THREE.Object3D>();
  source?.scene.traverse((object) => {
    const id = object.userData.festivalZone as FestivalZoneId;
    if (FESTIVAL_ZONE_IDS.includes(id)) result.set(id, object);
  });
  return result;
}

export function createZoneGrassMask(available: ReadonlySet<FestivalZoneId>) {
  const boxes = FESTIVAL_ZONE_SITES.filter((s) => available.has(s.id)).map(zoneBounds);
  return (x: number, z: number) => {
    let mask = 1;
    for (const b of boxes)
      mask = Math.min(
        mask,
        THREE.MathUtils.smoothstep(Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ), 0, 0.25),
      );
    return mask;
  };
}

/** Static scenery; all GPU resources remain shared and owned by the existing scene disposer. */
export function placeFestivalZones(
  parent: THREE.Object3D,
  templates: ReadonlyMap<FestivalZoneId, THREE.Object3D>,
  heightAt: (x: number, z: number) => number,
) {
  const colliders: THREE.Box3[] = [];
  for (const site of FESTIVAL_ZONE_SITES) {
    const source = templates.get(site.id);
    if (!source) continue;
    const root = clone(source);
    root.position.set(0, 0, 0);
    root.rotation.set(0, site.rotationY, 0);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    let ground = -Infinity;
    for (let x = bounds.min.x; x <= bounds.max.x + 0.25; x += 0.25)
      for (let z = bounds.min.z; z <= bounds.max.z + 0.25; z += 0.25)
        ground = Math.max(ground, heightAt(site.x + x, site.z + z));
    root.position.set(site.x, ground + 0.025 - bounds.min.y, site.z);
    root.name = `Festival_Zone_${site.instanceId}`;
    root.userData.vendor = vendors[site.id];
    root.userData.campObject = { id: site.instanceId, label: `${vendors[site.id].label} — prototyp` };
    root.userData.exteriorOnly = true;
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    parent.add(root);
    const b = zoneBounds(site);
    // Raised decks and sales counters are exterior-only until indoor movement is supported.
    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(b.minX, -2, b.minZ),
        new THREE.Vector3(b.maxX, ground + bounds.max.y - bounds.min.y + 0.1, b.maxZ),
      ),
    );
  }
  return colliders;
}
