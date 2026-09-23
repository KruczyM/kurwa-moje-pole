import * as THREE from 'three';

export const TENT_LOW_DETAIL_DISTANCE = 28;
export const TENT_LOD_HYSTERESIS = 0.12;

/** Attach only to an instance, never to the cached GLTF. The existing renderer updates THREE.LOD. */
export function attachTentLod(instance: THREE.Object3D): THREE.LOD | null {
  const existing = instance.getObjectByName('TentDistanceLOD');
  if (existing instanceof THREE.LOD) return existing;
  const high = instance.getObjectByName('Tent_LOD0');
  const low = instance.getObjectByName('Tent_LOD1');
  if (
    !high ||
    !low ||
    !high.parent ||
    high.parent !== low.parent ||
    high.userData.tentLodLevel !== 0 ||
    low.userData.tentLodLevel !== 1
  )
    return null;

  const parent = high.parent;
  const lod = new THREE.LOD();
  lod.name = 'TentDistanceLOD';
  parent.add(lod);
  lod.addLevel(high, 0);
  lod.addLevel(low, TENT_LOW_DETAIL_DISTANCE, TENT_LOD_HYSTERESIS);
  high.visible = true;
  low.visible = false;
  return lod;
}
