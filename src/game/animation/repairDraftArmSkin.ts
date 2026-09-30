import * as THREE from 'three';
export const DRAFT_ARM_MODELS = [
  'korba',
  'chlebak',
  'dziaslo',
  'hemoroid',
  'jeczmien',
  'kobra',
  'szerszen',
] as const;

/** Offline correction for the 22-bone draft T-pose rig only. Its geometric
 * fallback mixed head/torso and hand weights over entire sleeves. Use a local
 * shoulder/elbow/wrist chain instead; never alter an authored Mixamo rig. */
export function repairDraftArmSkin(
  root: THREE.Object3D,
  preserveUpperChest = false,
  cleanClavicle = false,
  reviewedLegacy = false,
) {
  root.updateMatrixWorld(true);
  let changed = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh) || (object.skeleton.bones.length !== 22 && !reviewedLegacy))
      return;
    const { bones } = object.skeleton;
    const names = bones.map((b) => b.name.replace(/^mixamorig[:_]?/, ''));
    const joint = (name: string) => names.indexOf(name);
    const points = object.skeleton.boneInverses.map((m) =>
      new THREE.Vector3().setFromMatrixPosition(m.clone().invert()),
    );
    const torso = joint('Spine2'),
      neck = joint('Neck'),
      foot = joint('LeftFoot');
    if (torso < 0 || neck < 0 || foot < 0) return;
    const scale = points[neck].distanceTo(points[foot]);
    const pos = object.geometry.getAttribute('position'),
      indices = object.geometry.getAttribute('skinIndex'),
      weights = object.geometry.getAttribute('skinWeight');
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(object.bindMatrix);
      const side = p.x >= points[neck].x ? 'Left' : 'Right';
      const arm = joint(side + 'Arm'),
        elbow = joint(side + 'ForeArm'),
        hand = joint(side + 'Hand');
      if (arm < 0 || elbow < 0 || hand < 0) continue;
      const x = Math.abs(p.x - points[neck].x),
        a = Math.abs(points[arm].x - points[neck].x);
      const e = Math.abs(points[elbow].x - points[neck].x),
        w = Math.abs(points[hand].x - points[neck].x);
      const outer = THREE.MathUtils.smoothstep(x, e * 0.9, e * 1.1);
      const band =
        THREE.MathUtils.smoothstep(p.y, points[neck].y - scale * 0.18, points[neck].y - scale * 0.08) *
        (1 -
          THREE.MathUtils.smoothstep(
            p.y,
            points[neck].y + scale * (preserveUpperChest ? 0.2 : 0.1),
            points[neck].y + scale * (preserveUpperChest ? 0.3 : 0.2),
          ));
      const blend =
        THREE.MathUtils.smoothstep(x, a * (cleanClavicle ? 0.1 : 0.5), a * (cleanClavicle ? 0.45 : 0.85)) *
        Math.max(outer, band);
      if (blend <= 0) continue;
      // Keep the clavicle/upper chest attached to the torso. The old transition
      // started inside the chest and pulled its outer edge down with the arm.
      const shoulderBlend = THREE.MathUtils.smoothstep(
        x,
        a * (preserveUpperChest ? 0.95 : 0.55),
        a * (preserveUpperChest ? 1.85 : 1.12),
      );
      const elbowBlend = THREE.MathUtils.smoothstep(x, e - scale * 0.07, e + scale * 0.07);
      const wristBlend = THREE.MathUtils.smoothstep(x, w - scale * 0.045, w + scale * 0.045);
      const values = [
        1 - shoulderBlend,
        shoulderBlend * (1 - elbowBlend),
        shoulderBlend * elbowBlend * (1 - wristBlend),
        shoulderBlend * elbowBlend * wristBlend,
      ];
      const merged = new Map<number, number>();
      for (let c = 0; c < 4; c++)
        merged.set(
          indices.getComponent(i, c),
          (merged.get(indices.getComponent(i, c)) ?? 0) + weights.getComponent(i, c) * (1 - blend),
        );
      [torso, arm, elbow, hand].forEach((bone, c) =>
        merged.set(bone, (merged.get(bone) ?? 0) + values[c] * blend),
      );
      const packed = [...merged].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
      const total = packed.reduce((sum, pair) => sum + pair[1], 0);
      for (let c = 0; c < 4; c++) {
        indices.setComponent(i, c, packed[c]?.[0] ?? 0);
        weights.setComponent(i, c, (packed[c]?.[1] ?? 0) / total);
      }
      changed++;
    }
    indices.needsUpdate = true;
    weights.needsUpdate = true;
  });
  return changed;
}
