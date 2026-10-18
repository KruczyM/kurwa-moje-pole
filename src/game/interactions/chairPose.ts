import * as THREE from 'three';

// Floor sitting clips are not interchangeable with a camping-chair pose.
export const CHAIR_POSE_CLIPS = [
  'MaleSittingPose',
  'MaleSittingPoseVariant1',
  'SittingLaughing',
  'SittingIdle',
] as const;

/** Place the pelvis over the fabric instead of grounding raised feet or using standing bounds. */
export function alignChairPelvis(root: THREE.Object3D, visual: THREE.Object3D): boolean {
  let hips: THREE.Object3D | undefined;
  visual.traverse((object) => {
    if (object instanceof THREE.Bone && /hips$/i.test(object.name)) hips = object;
  });
  if (!hips) return false;
  root.updateWorldMatrix(true, true);
  const pelvis = root.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
  visual.position.y += 0.65 - pelvis.y;
  visual.position.z += -0.1 - pelvis.z;
  root.updateWorldMatrix(true, true);
  return true;
}
