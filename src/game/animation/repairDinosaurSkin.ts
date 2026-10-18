import * as THREE from 'three';

/** Offline candidate for the lowered-arm dinosaur stored as NPC 019 only. */
export function repairDinosaurSkin(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
  });
  const bounds = new THREE.Box3().setFromObject(root),
    height = bounds.max.y - bounds.min.y;
  root.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    const joints = mesh.geometry.getAttribute('skinIndex'),
      weights = mesh.geometry.getAttribute('skinWeight');
    const pos = mesh.geometry.getAttribute('position');
    const points = Array.from({ length: pos.count }, (_, i) =>
      mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
    );
    const bone = (name: string) => {
      const i = mesh.skeleton.bones.findIndex((b) => b.name.replace(/^mixamorig[:_]?/, '') === name);
      if (i < 0) throw new Error(`Missing dinosaur bone: ${name}`);
      return i;
    };
    const head = bone('Head'),
      spine = bone('Spine2'),
      hips = bone('Hips');
    points.forEach((p, i) => {
      const y = (p.y - bounds.min.y) / height,
        x = (p.x - (bounds.min.x + bounds.max.x) / 2) / height;
      const side = x > 0 ? 'Left' : 'Right';
      const influences = new Map<number, number>();
      const add = (b: number, w: number) => influences.set(b, (influences.get(b) ?? 0) + w);
      const headWeight = THREE.MathUtils.smoothstep(y, 0.6, 0.67);
      const legWeight =
        (1 - THREE.MathUtils.smoothstep(y, 0.25, 0.32)) *
        THREE.MathUtils.smoothstep(p.z / height, -0.16, -0.04);
      const armBoundary = THREE.MathUtils.lerp(0.24, 0.145, THREE.MathUtils.smoothstep(y, 0.38, 0.61));
      const armWeight =
        THREE.MathUtils.smoothstep(Math.abs(x), armBoundary, armBoundary + 0.035) *
        (1 - headWeight) *
        (1 - legWeight);
      add(head, headWeight);
      const leg = legWeight * (1 - headWeight);
      const shin = 1 - THREE.MathUtils.smoothstep(y, 0.13, 0.23);
      const foot = 1 - THREE.MathUtils.smoothstep(y, 0.07, 0.12);
      add(bone(side + 'UpLeg'), leg * (1 - shin));
      add(bone(side + 'Leg'), leg * shin * (1 - foot));
      add(bone(side + 'Foot'), leg * shin * foot);
      const hand = 1 - THREE.MathUtils.smoothstep(y, 0.32, 0.39);
      const elbow = 1 - THREE.MathUtils.smoothstep(y, 0.41, 0.53);
      add(bone(side + 'Arm'), armWeight * (1 - elbow));
      add(bone(side + 'ForeArm'), armWeight * elbow * (1 - hand));
      add(bone(side + 'Hand'), armWeight * elbow * hand);
      const torso = (1 - headWeight) * (1 - legWeight) - armWeight;
      const chest = THREE.MathUtils.smoothstep(y, 0.33, 0.45);
      add(spine, torso * chest);
      add(hips, torso * (1 - chest));
      const packed = [...influences].sort((a, b) => b[1] - a[1]).slice(0, 4),
        sum = packed.reduce((s, v) => s + v[1], 0);
      for (let c = 0; c < 4; c++) {
        joints.setComponent(i, c, packed[c]?.[0] ?? 0);
        weights.setComponent(i, c, (packed[c]?.[1] ?? 0) / sum);
      }
    });
    joints.needsUpdate = weights.needsUpdate = true;
  });
}
