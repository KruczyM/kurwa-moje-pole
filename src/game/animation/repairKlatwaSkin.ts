import * as THREE from 'three';

/** Authored profile for the new Klątwa only, in its unanimated bind pose.
 * Keep jaw/glasses rigid with Head and the hanging braids/chest off arm bones. */
export function repairKlatwaSkin(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.max.y - bounds.min.y;
  let changed = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh) || object.skeleton.bones.length !== 22) return;
    const names = object.skeleton.bones.map((bone) => bone.name.replace(/^mixamorig[:_]?/, ''));
    const head = names.indexOf('Head'),
      torso = names.indexOf('Spine2');
    if (head < 0 || torso < 0 || height <= 0) return;
    const pos = object.geometry.getAttribute('position');
    const joints = object.geometry.getAttribute('skinIndex');
    const weights = object.geometry.getAttribute('skinWeight');
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(object.matrixWorld);
      const y = (p.y - bounds.min.y) / height;
      const x = Math.abs(p.x - (bounds.min.x + bounds.max.x) / 2) / height;
      const face = THREE.MathUtils.smoothstep(y, 0.65, 0.69) * (1 - THREE.MathUtils.smoothstep(x, 0.15, 0.2));
      const chest =
        (1 - THREE.MathUtils.smoothstep(x, 0.135, 0.19)) * THREE.MathUtils.smoothstep(y, 0.38, 0.43);
      const blend = Math.max(face, chest);
      if (blend <= 0) continue;
      const combined = new Map<number, number>();
      for (let c = 0; c < 4; c++)
        combined.set(
          joints.getComponent(i, c),
          (combined.get(joints.getComponent(i, c)) ?? 0) + weights.getComponent(i, c) * (1 - blend),
        );
      combined.set(head, (combined.get(head) ?? 0) + face * blend);
      combined.set(torso, (combined.get(torso) ?? 0) + (1 - face) * blend);
      const packed = [...combined].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
      const total = packed.reduce((sum, [, w]) => sum + w, 0);
      for (let c = 0; c < 4; c++) {
        joints.setComponent(i, c, packed[c]?.[0] ?? 0);
        weights.setComponent(i, c, (packed[c]?.[1] ?? 0) / total);
      }
      changed++;
    }
    joints.needsUpdate = true;
    weights.needsUpdate = true;
  });
  return changed;
}
