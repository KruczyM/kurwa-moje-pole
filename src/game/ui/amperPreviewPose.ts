import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Menu-only pose transfer by limb direction, not incompatible local rotations. */
export function amperPreviewPose(
  target: THREE.Object3D,
  reference: THREE.Object3D,
  clips: THREE.AnimationClip[],
  characterId?: string,
) {
  const donor = clone(reference);
  const idle = clips.find((c) => /^idle$/i.test(c.name));
  if (!idle) throw new Error('Brak pozy Idle Ampera');
  const mixer = new THREE.AnimationMixer(donor);
  mixer.clipAction(idle).play();
  mixer.update(0);
  donor.updateMatrixWorld(true);
  target.updateMatrixWorld(true);
  const bones = target.getObjectsByProperty('isBone', true) as THREE.Bone[];
  const restWorld = new Map(bones.map((b) => [b, b.getWorldQuaternion(new THREE.Quaternion())]));
  const find = (root: THREE.Object3D, name: string) =>
    root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
  const mappings: [string, string, string, string][] = [
    ['Hips', 'Spine', 'hips', 'spine'],
    ['Spine', 'Neck', 'spine', 'neck'],
    ['Neck', 'Head', 'neck', 'head'],
    ...['Left', 'Right'].flatMap((side, i): [string, string, string, string][] => {
      const suffix = i === 0 ? 'L' : 'R';
      return [
        [side + 'UpLeg', side + 'Leg', 'thigh.' + suffix, 'shin.' + suffix],
        [side + 'Leg', side + 'Foot', 'shin.' + suffix, 'foot.' + suffix],
      ];
    }),
  ];
  for (const [start, end, sourceStart, sourceEnd] of mappings) {
    const bone = bones.find((b) => b.name.replace(/^mixamorig[:_]?/, '') === start);
    const child = bones.find((b) => b.name.replace(/^mixamorig[:_]?/, '') === end);
    const a = find(donor, sourceStart),
      b = find(donor, sourceEnd);
    if (!bone || !child || !a || !b) throw new Error(`Niepełny szkielet podglądu: ${start}`);
    const from = child
      .getWorldPosition(new THREE.Vector3())
      .sub(bone.getWorldPosition(new THREE.Vector3()))
      .normalize();
    const to = b
      .getWorldPosition(new THREE.Vector3())
      .sub(a.getWorldPosition(new THREE.Vector3()))
      .normalize();
    const world = new THREE.Quaternion()
      .setFromUnitVectors(from, to)
      .multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    target.updateMatrixWorld(true);
  }
  // These two meshes were authored with horizontal arms. Their refitted
  // pivots are not aligned with the visible upper-arm axis; aiming those
  // pivots directly at Amper's elbows created the rejected bowed silhouette.
  // Apply the same 80-degree skin rotation to the entire arm chain instead.
  for (const side of ['Left', 'Right']) {
    const delta = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      (side === 'Left' ? -1 : 1) * THREE.MathUtils.degToRad(characterId === 'zawor' ? 85 : 80),
    );
    for (const part of ['Arm', 'ForeArm', 'Hand']) {
      const bone = bones.find((b) => b.name.endsWith(side + part))!;
      const world = delta.clone().multiply(restWorld.get(bone)!);
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
      target.updateMatrixWorld(true);
    }
  }
  if (characterId === 'zawor') {
    // Keep the soles in the authored neutral orientation after aiming the
    // short legacy leg chain; otherwise the toes tip up with the lower leg.
    for (const side of ['Left', 'Right']) {
      const foot = bones.find((b) => b.name.endsWith(side + 'Foot'))!;
      foot.quaternion.copy(
        foot.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(restWorld.get(foot)!),
      );
      target.updateMatrixWorld(true);
    }
  }
  const tracks = bones.flatMap((b) => [
    new THREE.QuaternionKeyframeTrack(
      b.name + '.quaternion',
      [0, 1],
      [...b.quaternion.toArray(), ...b.quaternion.toArray()],
    ),
    new THREE.VectorKeyframeTrack(
      b.name + '.position',
      [0, 1],
      [...b.position.toArray(), ...b.position.toArray()],
    ),
  ]);
  mixer.stopAllAction();
  mixer.uncacheRoot(donor);
  return new THREE.AnimationClip('Idle', 1, tracks);
}
