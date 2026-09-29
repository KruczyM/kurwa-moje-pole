import * as THREE from 'three';

/** Apply Idle before measuring or rendering so no T-pose is ever presented. */
export function startPreviewIdle(model: THREE.Object3D, clips: THREE.AnimationClip[]) {
  const idle =
    clips.find((clip) => /^idle(?: neutral)?$/i.test(clip.name)) ??
    clips.find((clip) => /idle/i.test(clip.name));
  if (!idle) throw new Error('Podgląd postaci nie zawiera animacji Idle');
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(idle).reset().play();
  mixer.update(0);
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox();
  });
  return mixer;
}
