import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Temporary asset-review location, NOT the georeferenced 2026 festival plan. */
export const ROCK_SHOP_SITE = {
  x: 0,
  z: -38,
  halfWidth: 12.15,
  halfDepth: 9.15,
  frontApron: 2,
} as const;

export function sampleRockShopGrassMask(x: number, z: number) {
  const site = ROCK_SHOP_SITE;
  const distance = Math.max(
    Math.abs(x - site.x) - site.halfWidth,
    site.z - site.halfDepth - z,
    z - (site.z + site.halfDepth + site.frontApron),
  );
  return THREE.MathUtils.smoothstep(distance, 0, 0.3);
}

/** Reuses the cached GLB and scene disposal. No renderer, listener or update loop. */
export function placeRockShop(
  parent: THREE.Object3D,
  source: GLTF | null | undefined,
  heightAt: (x: number, z: number) => number,
): THREE.Box3 | null {
  if (!source) return null;
  const site = ROCK_SHOP_SITE;
  const root = clone(source.scene);
  root.name = 'Festival_Lidl_Rock_Shop';
  root.userData.campObject = { id: 'lidlRockShop', label: 'Lidl Rock Shop — prototyp' };
  root.userData.exteriorOnly = true;
  // Native GLB coordinates are metres; retain the portal spacing and roof pitch.
  const bounds = new THREE.Box3().setFromObject(root);
  let ground = -Infinity;
  for (let x = bounds.min.x; x <= bounds.max.x + 0.25; x += 0.25) {
    for (let z = bounds.min.z; z <= bounds.max.z + 0.25; z += 0.25) {
      ground = Math.max(ground, heightAt(site.x + x, site.z + z));
    }
  }
  root.position.set(site.x, ground + 0.025 - bounds.min.y, site.z);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  parent.add(root);
  root.updateMatrixWorld(true);
  // Ground-following character movement does not yet support raised shop floors.
  // Keep the whole building solid until indoor navigation is implemented/tested.
  return new THREE.Box3(
    new THREE.Vector3(site.x - site.halfWidth, -2, site.z - site.halfDepth),
    new THREE.Vector3(site.x + site.halfWidth, ground + 8, site.z + site.halfDepth),
  );
}
