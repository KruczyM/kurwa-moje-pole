import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Temporary sites in free eastern/southern grounds, not surveyed coordinates. */
export const FESTIVAL_STAGE_SITES = [
  {
    id: 'mainStage',
    label: 'Duża Scena — robocza',
    x: 216,
    z: 18,
    width: 80,
    depth: 44,
    height: 38,
    rotationY: -Math.PI / 2,
  },
  {
    id: 'smallStage',
    label: 'Mała Scena — robocza',
    x: 0,
    z: 97,
    width: 38,
    depth: 54,
    height: 19,
    rotationY: -Math.PI / 2,
  },
] as const;

export type StageModels = Partial<Record<(typeof FESTIVAL_STAGE_SITES)[number]['id'], GLTF | null>>;

export function stageBounds(site: (typeof FESTIVAL_STAGE_SITES)[number]) {
  const c = Math.abs(Math.cos(site.rotationY)),
    s = Math.abs(Math.sin(site.rotationY));
  const halfX = (site.width * c + site.depth * s) / 2;
  const halfZ = (site.width * s + site.depth * c) / 2;
  return { minX: site.x - halfX, maxX: site.x + halfX, minZ: site.z - halfZ, maxZ: site.z + halfZ };
}

export function createStageGrassMask(models: StageModels) {
  const bounds = FESTIVAL_STAGE_SITES.filter((s) => models[s.id]).map(stageBounds);
  return (x: number, z: number) =>
    bounds.reduce(
      (mask, b) =>
        Math.min(
          mask,
          THREE.MathUtils.smoothstep(Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ), 0, 0.3),
        ),
      1,
    );
}

export function placeFestivalStages(
  parent: THREE.Object3D,
  models: StageModels,
  heightAt: (x: number, z: number) => number,
) {
  const colliders: THREE.Box3[] = [];
  for (const site of FESTIVAL_STAGE_SITES) {
    const source = models[site.id];
    if (!source) continue;
    const visual = clone(source.scene);
    const authored = new THREE.Box3().setFromObject(visual);
    const size = authored.getSize(new THREE.Vector3());
    if (authored.isEmpty() || !size.toArray().every((v) => Number.isFinite(v) && v > 0)) continue;
    // Fit uniformly into the reserved volume; retain proportions of generated models.
    visual.scale.multiplyScalar(Math.min(site.width / size.x, site.height / size.y, site.depth / size.z));
    const fitted = new THREE.Box3().setFromObject(visual);
    const center = fitted.getCenter(new THREE.Vector3());
    visual.position.sub(new THREE.Vector3(center.x, fitted.min.y, center.z));
    const root = new THREE.Group();
    root.name = `Festival_${site.id}`;
    root.userData.campObject = { id: site.id, label: site.label };
    root.userData.exteriorOnly = site.id !== 'smallStage';
    root.add(visual);
    const b = stageBounds(site);
    let floor = -Infinity;
    for (let x = b.minX; x <= b.maxX; x += 1)
      for (let z = b.minZ; z <= b.maxZ; z += 1) floor = Math.max(floor, heightAt(x, z));
    root.position.set(site.x, floor + 0.025, site.z);
    root.rotation.y = site.rotationY;
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    parent.add(root);

    if (site.id === 'smallStage') {
      // Hollow marquee pavilion with accessible interior and open western portal.
      root.updateMatrixWorld(true);
      const canopy = root.getObjectByName('ASP_Tent_Canopy');
      const tentBox = new THREE.Box3().setFromObject(canopy ?? visual);
      const wallThick = 0.35;
      const stageDepth = 9.0;
      const tMinX = tentBox.min.x;
      const tMaxX = tentBox.max.x;
      const tMinZ = tentBox.min.z;
      const tMaxZ = tentBox.max.z;

      // 1. Rear Wall (East)
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(tMaxX - wallThick, -2, tMinZ),
          new THREE.Vector3(tMaxX, floor + site.height, tMaxZ),
        ),
      );
      // 2. North Wall
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(tMinX, -2, tMinZ),
          new THREE.Vector3(tMaxX, floor + site.height, tMinZ + wallThick),
        ),
      );
      // 3. South Wall
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(tMinX, -2, tMaxZ - wallThick),
          new THREE.Vector3(tMaxX, floor + site.height, tMaxZ),
        ),
      );
      // 4. Front Portal Wings (West) leaving wide central entrance opening
      const portalSpan = (tMaxZ - tMinZ) * 0.28;
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(tMinX, -2, tMinZ),
          new THREE.Vector3(tMinX + wallThick, floor + site.height, tMinZ + portalSpan),
        ),
      );
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(tMinX, -2, tMaxZ - portalSpan),
          new THREE.Vector3(tMinX + wallThick, floor + site.height, tMaxZ),
        ),
      );
      // 5. Raised Interior Stage at the rear (East)
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(tMaxX - wallThick - stageDepth, -2, tMinZ + 6.0),
          new THREE.Vector3(tMaxX - wallThick, floor + 1.8, tMaxZ - 6.0),
        ),
      );
    } else {
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(b.minX, -2, b.minZ),
          new THREE.Vector3(b.maxX, floor + site.height, b.maxZ),
        ),
      );
    }
  }
  return colliders;
}
