import * as THREE from 'three';

/** Final offline pass for draft rigs. A rigid face must never blend with the
 * moving shoulder. The narrow neck transition is below the facial surface. */
export function repairDraftHeadSkin(root: THREE.Object3D, id?: string) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.max.y - bounds.min.y;
  if (!(height > 0)) return;
  root.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh) || mesh.skeleton.bones.length !== 22) return;
    const head = mesh.skeleton.bones.findIndex((bone) => /(?:^|mixamorig[:_]?)Head$/.test(bone.name));
    if (head < 0) return;
    const origin = new THREE.Vector3().setFromMatrixPosition(
      mesh.skeleton.boneInverses[head].clone().invert(),
    );
    const pos = mesh.geometry.getAttribute('position'),
      joints = mesh.geometry.getAttribute('skinIndex'),
      weights = mesh.geometry.getAttribute('skinWeight');
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
      const face = THREE.MathUtils.smoothstep(p.y, origin.y - height * 0.055, origin.y - height * 0.025);
      const width = 1 - THREE.MathUtils.smoothstep(Math.abs(p.x - origin.x), height * 0.12, height * 0.145);
      const crown = THREE.MathUtils.smoothstep(p.y, origin.y + height * 0.045, origin.y + height * 0.09);
      // The jaw protrudes in front of the shoulder cap. Height alone also
      // selects the shoulder surface and recreates the regression in reverse.
      const front = THREE.MathUtils.smoothstep(p.z - origin.z, height * 0.025, height * 0.065);
      // These two source heads have shallow side cheeks: the front-depth
      // mask misses them entirely. Their measured jaw sits above the sleeves.
      const jawFloor = origin.y - height * 0.04 + height * 0.1 * ((p.x - origin.x) / (height * 0.16)) ** 2;
      const fullSkull =
        id === 'hemoroid' || id === 'chlebak'
          ? THREE.MathUtils.smoothstep(p.y, jawFloor - height * 0.015, jawFloor + height * 0.012) *
            (1 - THREE.MathUtils.smoothstep(Math.abs(p.x - origin.x), height * 0.18, height * 0.21))
          : 0;
      const blend = Math.max(face * width * front, crown, fullSkull);
      if (blend <= 0) continue;
      const influences = new Map<number, number>();
      for (let c = 0; c < 4; c++)
        influences.set(
          joints.getComponent(i, c),
          (influences.get(joints.getComponent(i, c)) ?? 0) + weights.getComponent(i, c) * (1 - blend),
        );
      influences.set(head, (influences.get(head) ?? 0) + blend);
      const packed = [...influences].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
      const sum = packed.reduce((s, [, w]) => s + w, 0);
      for (let c = 0; c < 4; c++) {
        joints.setComponent(i, c, packed[c]?.[0] ?? 0);
        weights.setComponent(i, c, (packed[c]?.[1] ?? 0) / sum);
      }
    }
    joints.needsUpdate = true;
    weights.needsUpdate = true;
  });
}
