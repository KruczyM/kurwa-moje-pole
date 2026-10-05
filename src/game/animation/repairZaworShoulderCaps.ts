import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function refitZaworCapPivots(model: GLTF) {
  model.scene.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  model.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) {
      o.skeleton.update();
      meshes.push(o);
    }
  });
  const height = new THREE.Box3().setFromObject(model.scene).getSize(new THREE.Vector3()).y;
  const bones = meshes[0].skeleton.bones;
  for (const side of ['Left', 'Right']) {
    const arm = bones.find((b) => b.name.endsWith(side + 'Arm'))!;
    const elbow = bones.find((b) => b.name.endsWith(side + 'ForeArm'))!;
    const hand = bones.find((b) => b.name.endsWith(side + 'Hand'))!;
    const e = elbow.getWorldPosition(new THREE.Vector3()),
      w = hand.getWorldPosition(new THREE.Vector3());
    const a = arm.getWorldPosition(new THREE.Vector3());
    a.x -= Math.sign(a.x) * height * 0.025;
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

/** Zawor-only offline cap profile. Keep neck/face and lower poncho untouched. */
export function repairZaworShoulderCaps(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
  });
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.max.y - bounds.min.y;
  const center = (bounds.min.x + bounds.max.x) / 2;
  let changed = 0;
  root.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    const spine = mesh.skeleton.bones.findIndex((b) => /Spine2$/.test(b.name));
    const positions = Array.from({ length: mesh.geometry.getAttribute('position').count }, (_, i) =>
      mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
    );
    const indices = mesh.geometry.getAttribute('skinIndex'),
      weights = mesh.geometry.getAttribute('skinWeight');
    positions.forEach((p, i) => {
      const x = Math.abs(p.x - center) / height,
        y = (p.y - bounds.min.y) / height;
      const mask =
        THREE.MathUtils.smoothstep(x, 0.12, 0.16) *
        (1 - THREE.MathUtils.smoothstep(x, 0.28, 0.32)) *
        THREE.MathUtils.smoothstep(y, 0.57, 0.62) *
        (1 - THREE.MathUtils.smoothstep(y, 0.7, 0.75));
      if (mask <= 0) return;
      const arm = mesh.skeleton.bones.findIndex((b) =>
        b.name.endsWith((p.x >= center ? 'Left' : 'Right') + 'Arm'),
      );
      if (arm < 0 || spine < 0) throw new Error('Incomplete Zawor skeleton');
      const armWeight = THREE.MathUtils.smoothstep(x, 0.13, 0.25);
      const values = new Map<number, number>();
      for (let c = 0; c < 4; c++) {
        const j = indices.getComponent(i, c);
        values.set(j, (values.get(j) ?? 0) + weights.getComponent(i, c) * (1 - mask));
      }
      values.set(arm, (values.get(arm) ?? 0) + armWeight * mask);
      values.set(spine, (values.get(spine) ?? 0) + (1 - armWeight) * mask);
      const packed = [...values].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = packed.reduce((s, [, w]) => s + w, 0);
      for (let c = 0; c < 4; c++) {
        indices.setComponent(i, c, packed[c]?.[0] ?? 0);
        weights.setComponent(i, c, (packed[c]?.[1] ?? 0) / sum);
      }
      changed++;
    });
    indices.needsUpdate = weights.needsUpdate = true;
  });
  return changed;
}
