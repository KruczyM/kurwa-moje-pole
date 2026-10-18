import * as THREE from 'three';

/** Authored lower-face regions, measured in each model's neutral, normalized
 * bounds. Depth excludes the neck/chest behind a protruding beard. */
export const BEARD_REGIONS: Record<string, { bottom: number; width: number; depth: number }> = {
  gruczol: { bottom: 0.62, width: 0.155, depth: 0.08 },
  pierscien: { bottom: 0.65, width: 0.15, depth: 0.065 },
  kobra: { bottom: 0.65, width: 0.125, depth: 0.075 },
  antena: { bottom: 0.7, width: 0.12, depth: 0.065 },
  krwiak: { bottom: 0.68, width: 0.12, depth: 0.065 },
  pien: { bottom: 0.68, width: 0.13, depth: 0.065 },
  zawor: { bottom: 0.67, width: 0.14, depth: 0.065 },
  hemoroid: { bottom: 0.68, width: 0.13, depth: 0.065 },
};

/** Run on the unanimated cached GLTF. Face/beard vertices follow Head rigidly;
 * the existing Neck -> Head chain still supplies the neck articulation. */
export function repairBeardSkin(root: THREE.Object3D, id: string) {
  const region = BEARD_REGIONS[id];
  const selected = new Map<THREE.SkinnedMesh, number[]>();
  if (!region) return selected;
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
  });
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.max.y - bounds.min.y;
  if (!(height > 0)) return selected;
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const head = object.skeleton.bones.findIndex((bone) => /(?:^|mixamorig[:_]?)Head$/i.test(bone.name));
    if (head < 0) return;
    const origin = object.skeleton.bones[head].getWorldPosition(new THREE.Vector3());
    const p = object.geometry.getAttribute('position');
    const j = object.geometry.getAttribute('skinIndex'),
      w = object.geometry.getAttribute('skinWeight');
    const point = new THREE.Vector3(),
      vertices: number[] = [];
    for (let i = 0; i < p.count; i++) {
      object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld);
      const y = (point.y - bounds.min.y) / height;
      const x = Math.abs(point.x - origin.x) / height;
      const depth = (point.z - origin.z) / height;
      if (y < region.bottom || y > 0.88 || x > region.width || depth < region.depth) continue;
      vertices.push(i);
    }
    // Select everything first: do not measure positions after changing weights.
    for (const i of vertices)
      for (let c = 0; c < 4; c++) {
        j.setComponent(i, c, c === 0 ? head : 0);
        w.setComponent(i, c, c === 0 ? 1 : 0);
      }
    if (vertices.length) {
      j.needsUpdate = true;
      w.needsUpdate = true;
      selected.set(object, vertices);
    }
  });
  return selected;
}
