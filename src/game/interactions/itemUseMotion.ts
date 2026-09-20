import * as THREE from 'three';
import { findRigBone } from '../animation/rigBones';
import type { EffectId } from '../effects/EffectManager';
import { itemUseSequenceConfig } from './itemUseSequenceConfig';
import { handGripPosition } from './itemUseProp';

const point = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3());
const smooth = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);

/** Rotate a bone in world space without assuming the local axes of its exported rig. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  const origin = point(bone);
  const from = point(child).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  const rotation = new THREE.Quaternion()
    .setFromUnitVectors(from, to)
    .multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(rotation));
  bone.updateWorldMatrix(false, true);
}

/** Two-bone reach with a stable elbow pole; short stylized arms stop at their actual reach. */
function reach(
  arm: THREE.Object3D,
  forearm: THREE.Object3D,
  hand: THREE.Object3D,
  target: THREE.Vector3,
  pole: THREE.Vector3,
) {
  const shoulder = point(arm);
  const upper = shoulder.distanceTo(point(forearm));
  const lower = point(forearm).distanceTo(point(hand));
  if (upper < 1e-6 || lower < 1e-6) return;
  const direction = target.clone().sub(shoulder);
  const distance = THREE.MathUtils.clamp(
    direction.length(),
    Math.abs(upper - lower) + 1e-5,
    upper + lower - 1e-5,
  );
  direction.normalize();
  const bend = pole.clone().sub(shoulder);
  bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const elbow = shoulder
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
  aim(arm, forearm, elbow);
  aim(forearm, hand, shoulder.addScaledVector(direction, distance));
}

/** Find the face surface around the lips, including the large heads/beards of these stylized rigs. */
function faceContact(
  root: THREE.Object3D,
  head: THREE.Object3D,
  headHeight: number,
  basis: THREE.Quaternion,
) {
  const origin = point(head);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(basis);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(basis);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(basis);
  const mouthHeight = headHeight * 0.08;
  let depth = headHeight * 0.45;
  const vertex = new THREE.Vector3();
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.update();
    for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
      mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld).sub(origin);
      if (
        Math.abs(vertex.dot(up) - mouthHeight) < headHeight * 0.07 &&
        Math.abs(vertex.dot(side)) < headHeight * 0.14
      ) {
        depth = Math.max(depth, vertex.dot(forward));
      }
    }
  });
  return head.worldToLocal(origin.addScaledVector(up, mouthHeight).addScaledVector(forward, depth));
}

/** Bakes distinct use gestures on the current Idle pose; the existing mixer plays the clip. */
export function createProceduralUseClip(root: THREE.Object3D, effect: EffectId) {
  const arm = findRigBone(root, 'mixamorig:RightArm');
  const forearm = findRigBone(root, 'mixamorig:RightForeArm');
  const hand = findRigBone(root, 'mixamorig:RightHand');
  const head = findRigBone(root, 'mixamorig:Head');
  if (!arm || !forearm || !hand || !head) return undefined;
  const spine = findRigBone(root, 'mixamorig:Spine');
  const shoulder = findRigBone(root, 'mixamorig:RightShoulder');
  const config = itemUseSequenceConfig[effect];
  const bones = [spine, head, shoulder, arm, forearm, hand].filter((bone): bone is THREE.Object3D =>
    Boolean(bone),
  );
  const baseline = bones.map((bone) => bone.quaternion.clone());
  const values = bones.map(() => [] as number[]);
  const times: number[] = [];
  root.updateWorldMatrix(true, true);
  root.updateMatrixWorld(true);
  const basis = root.getWorldQuaternion(new THREE.Quaternion());
  const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(basis);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(basis);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(basis);
  const height = Math.max(0.01, new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y);
  const scale = height / 2.45;
  const headTop = findRigBone(root, 'mixamorig:HeadTop_End');
  const headHeight = headTop ? point(head).distanceTo(point(headTop)) : height * 0.16;
  const mouth = faceContact(root, head, headHeight, basis);
  const grip = handGripPosition(root, hand).multiply(hand.getWorldScale(new THREE.Vector3()));
  const sampleCount = Math.ceil(config.duration * 30);

  for (let sample = 0; sample <= sampleCount; sample++) {
    const time = (sample / sampleCount) * config.duration;
    const lift =
      smooth(0.2, config.effectMarker - 0.16, time) *
      (1 - smooth(config.effectMarker + 0.32, config.duration - 0.18, time));
    bones.forEach((bone, index) => bone.quaternion.copy(baseline[index]));
    root.updateWorldMatrix(true, true);
    // Kreska bows to the raised hand; smoking holds at the lips; food gets a small bite/nod.
    const bend = config.gesture === 'sniff' ? 0.36 : config.gesture === 'drink' ? -0.08 : 0.025;
    if (spine) {
      const parent = spine.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(basis).applyQuaternion(parent.invert());
      spine.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, bend * lift));
    }
    head.quaternion.multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (config.gesture === 'eat'
            ? 0.06 * Math.sin(time * 15)
            : config.gesture === 'sniff'
              ? 0.16
              : -0.035) * lift,
          0,
          0,
        ),
      ),
    );
    root.updateWorldMatrix(true, true);
    const desired = basis
      .clone()
      .multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            config.gesture === 'drink' ? -0.6 : 0.1,
            config.gesture === 'smoke' ? -0.6 : -0.25,
            -0.25,
          ),
        ),
      );
    const target = head
      .localToWorld(mouth.clone())
      .addScaledVector(up, config.gesture === 'sniff' ? headHeight * 0.1 : 0)
      .addScaledVector(forward, (config.gesture === 'sniff' ? 0.11 : 0.1) * scale)
      .addScaledVector(right, (config.gesture === 'sniff' ? 0.03 : 0.09) * scale)
      .sub(grip.clone().applyQuaternion(desired));
    if (shoulder) {
      // A modest clavicle lift lets short-armed characters reach their large faces.
      const rest = shoulder.quaternion.clone();
      aim(shoulder, arm, target);
      const angle = rest.angleTo(shoulder.quaternion);
      shoulder.quaternion.slerpQuaternions(
        rest,
        shoulder.quaternion.clone(),
        Math.min(1, 0.65 / Math.max(1e-6, angle)),
      );
      shoulder.updateWorldMatrix(false, true);
    }
    const pole = point(arm)
      .addScaledVector(right, 0.35 * scale)
      .addScaledVector(up, -0.55 * scale)
      .addScaledVector(forward, 0.2 * scale);
    reach(arm, forearm, hand, target, pole);
    for (const bone of [shoulder, arm, forearm]) {
      if (bone)
        bone.quaternion.slerpQuaternions(baseline[bones.indexOf(bone)], bone.quaternion.clone(), lift);
    }
    root.updateWorldMatrix(true, true);
    // Palm faces the viewer/face, independent of the armature's centimeter scale and rest axes.
    const parent = hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
    hand.quaternion.slerp(parent.multiply(desired), lift);
    bones.forEach((bone, index) => {
      // Additive deltas preserve Idle on the rest of the skeleton and return exactly to zero.
      const delta = baseline[index].clone().invert().multiply(bone.quaternion);
      if (sample === 0 || sample === sampleCount) delta.identity();
      values[index].push(...delta.toArray());
    });
    times.push(time);
  }
  bones.forEach((bone, index) => bone.quaternion.copy(baseline[index]));
  root.updateWorldMatrix(true, true);
  return new THREE.AnimationClip(
    `Use${effect}`,
    config.duration,
    bones.map(
      (bone, index) => new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, values[index]),
    ),
    THREE.AdditiveAnimationBlendMode,
  );
}
