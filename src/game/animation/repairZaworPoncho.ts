import * as THREE from 'three';

/** Offline, Zawor only. The hanging cloth must not inherit wrist motion. */
export function repairZaworPoncho(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y - box.min.y;
  root.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    const spine = mesh.skeleton.bones.findIndex((b) => /Spine2$/.test(b.name));
    if (spine < 0) throw new Error('Missing poncho attachment');
    const pos = mesh.geometry.getAttribute('position');
    const joints = mesh.geometry.getAttribute('skinIndex');
    const weights = mesh.geometry.getAttribute('skinWeight');
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld);
      const x = Math.abs(p.x - (box.min.x + box.max.x) / 2) / height;
      const y = (p.y - box.min.y) / height;
      const blend =
        THREE.MathUtils.smoothstep(y, 0.4, 0.44) *
        (1 - THREE.MathUtils.smoothstep(y, 0.54, 0.65)) *
        (1 - THREE.MathUtils.smoothstep(x, 0.23, 0.33));
      if (blend <= 0) continue;
      const values = new Map<number, number>();
      for (let c = 0; c < 4; c++) {
        const joint = joints.getComponent(i, c);
        values.set(joint, (values.get(joint) ?? 0) + weights.getComponent(i, c) * (1 - blend));
      }
      values.set(spine, (values.get(spine) ?? 0) + blend);
      const packed = [...values].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = packed.reduce((s, [, w]) => s + w, 0);
      for (let c = 0; c < 4; c++) {
        joints.setComponent(i, c, packed[c]?.[0] ?? 0);
        weights.setComponent(i, c, (packed[c]?.[1] ?? 0) / sum);
      }
    }
    joints.needsUpdate = weights.needsUpdate = true;
  });
}
