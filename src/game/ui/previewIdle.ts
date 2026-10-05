import * as THREE from 'three';

/** Apply Idle (or preferred preview clip) before measuring or rendering so no T-pose is ever presented. */
export function startPreviewIdle(
  model: THREE.Object3D,
  clips: THREE.AnimationClip[],
  preferredClipName?: string,
) {
  const target =
    (preferredClipName
      ? clips.find((clip) => new RegExp(`^${preferredClipName}$`, 'i').test(clip.name))
      : undefined) ??
    clips.find((clip) => /^idle(?: neutral)?$/i.test(clip.name)) ??
    clips.find((clip) => /idle/i.test(clip.name)) ??
    clips[0];
  if (!target) throw new Error('Podgląd postaci nie zawiera animacji');
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(target).reset().play();
  mixer.update(0);
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox();
  });
  return mixer;
}
