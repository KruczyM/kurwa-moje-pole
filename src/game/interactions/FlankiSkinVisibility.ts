import * as THREE from 'three';

/** Cached skin bounds may describe Idle, not Run. Only participating skins bypass culling. */
export function keepFlankiSkinsVisible(root: THREE.Object3D) {
  const original = new Map<THREE.SkinnedMesh, boolean>();
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    original.set(object, object.frustumCulled);
    object.frustumCulled = false;
  });
  return () => {
    for (const [mesh, culled] of original) mesh.frustumCulled = culled;
    original.clear();
  };
}
