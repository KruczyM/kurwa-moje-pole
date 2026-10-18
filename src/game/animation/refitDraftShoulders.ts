import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Reposition the draft shoulder pivot inside the upper torso, keeping the
 * bind mesh unchanged. Call only on an unanimated, owned GLTF instance. */
export function refitDraftShoulders(model: GLTF, shoulderLift = 0, reviewedLegacy = false) {
  model.scene.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  model.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh && (o.skeleton.bones.length === 22 || reviewedLegacy)) meshes.push(o);
  });
  if (!meshes.length) return;
  const bones = meshes[0].skeleton.bones;
  const height = new THREE.Box3().setFromObject(model.scene).getSize(new THREE.Vector3()).y;
  for (const side of ['Left', 'Right']) {
    const arm = bones.find((b) => b.name.endsWith(side + 'Arm'))!,
      elbow = bones.find((b) => b.name.endsWith(side + 'ForeArm'))!,
      hand = bones.find((b) => b.name.endsWith(side + 'Hand'))!;
    const a = arm.getWorldPosition(new THREE.Vector3()),
      e = elbow.getWorldPosition(new THREE.Vector3()),
      w = hand.getWorldPosition(new THREE.Vector3());
    a.x *= reviewedLegacy ? 0.85 : 0.75;
    a.y += height * shoulderLift;
    e.x *= reviewedLegacy ? 1 : 0.9;
    arm.position.copy(arm.parent!.worldToLocal(a));
    model.scene.updateMatrixWorld(true);
    elbow.position.copy(elbow.parent!.worldToLocal(e));
    model.scene.updateMatrixWorld(true);
    hand.position.copy(hand.parent!.worldToLocal(w));
    model.scene.updateMatrixWorld(true);
    for (const bone of [arm, elbow, hand])
      for (const clip of model.animations)
        for (const track of clip.tracks)
          if (track.name === bone.name + '.position')
            for (let i = 0; i < track.values.length; i += 3) bone.position.toArray(track.values, i);
  }
  for (const mesh of meshes) {
    mesh.skeleton.calculateInverses();
    mesh.skeleton.update();
  }
}
