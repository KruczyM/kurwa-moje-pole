import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const key = (name: string) => name.replace(/^mixamorig[:_]?/i, '');
type Motion = {
  name: string;
  duration: number;
  times: Float32Array;
  rotations: Map<string, Float32Array>;
  displacement: Float32Array;
};

/** Samples the shared donor once; binds its world-space motion to each model's
 * existing rest skeleton. Geometry, weights and cached input clips stay intact. */
export class FestivalMotionBank {
  private motions: Motion[] = [];
  private sourceLegHeight: number;
  private bound = new WeakSet<GLTF>();

  constructor(source: GLTF) {
    source.scene.updateMatrixWorld(true);
    const bones = source.scene.getObjectsByProperty('isBone', true) as THREE.Bone[];
    const hips = bones.find((bone) => key(bone.name) === 'Hips');
    if (!hips) throw new Error('Motion bank has no Hips bone');
    const restPositions = new Map(
      bones.map((bone) => [key(bone.name), bone.getWorldPosition(new THREE.Vector3())]),
    );
    const restRotations = new Map(
      bones.map((bone) => [key(bone.name), bone.getWorldQuaternion(new THREE.Quaternion()).invert()]),
    );
    const restHips = restPositions.get('Hips')!;
    const foot = restPositions.get('LeftFoot') ?? restPositions.get('RightFoot');
    this.sourceLegHeight = Math.max(1e-6, foot ? Math.abs(restHips.y - foot.y) : 1);
    const mixer = new THREE.AnimationMixer(source.scene);
    const rotation = new THREE.Quaternion(),
      position = new THREE.Vector3(),
      scale = new THREE.Vector3();
    for (const clip of source.animations) {
      if (clip.duration <= 0) continue;
      const count = Math.ceil(clip.duration * 30) + 1;
      const times = Float32Array.from({ length: count }, (_, index) => Math.min(index / 30, clip.duration));
      const rotations = new Map(bones.map((bone) => [key(bone.name), new Float32Array(count * 4)]));
      const displacement = new Float32Array(count * 3);
      const action = mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      for (let frame = 0; frame < count; frame++) {
        mixer.setTime(times[frame]);
        source.scene.updateMatrixWorld(true);
        for (const bone of bones) {
          bone.matrixWorld.decompose(position, rotation, scale);
          rotation.multiply(restRotations.get(key(bone.name))!).normalize();
          rotation.toArray(rotations.get(key(bone.name))!, frame * 4);
        }
        hips
          .getWorldPosition(position)
          .sub(restHips)
          .toArray(displacement, frame * 3);
      }
      action.stop();
      this.motions.push({
        name: clip.name === 'Walking' ? 'WalkingVariant' : clip.name,
        duration: clip.duration,
        times,
        rotations,
        displacement,
      });
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(source.scene);
  }

  apply(model: GLTF) {
    if (this.bound.has(model)) return model;
    model.scene.updateMatrixWorld(true);
    // Object traversal visits parents before children.
    const bones = model.scene.getObjectsByProperty('isBone', true) as THREE.Bone[];
    const hips = bones.find((bone) => key(bone.name) === 'Hips');
    if (!hips) return model;
    const rest = new Map(bones.map((bone) => [bone, bone.getWorldQuaternion(new THREE.Quaternion())]));
    const foot = bones.find((bone) => key(bone.name) === 'LeftFoot');
    const hipWorld = hips.getWorldPosition(new THREE.Vector3());
    const legHeight = foot
      ? Math.abs(hipWorld.y - foot.getWorldPosition(new THREE.Vector3()).y)
      : this.sourceLegHeight;
    const ratio = legHeight / this.sourceLegHeight;
    const parentInverse = new THREE.Matrix3().setFromMatrix4(hips.parent!.matrixWorld.clone().invert());
    const generated: THREE.AnimationClip[] = [];
    // Explicit asset metadata for Ambona's A-pose mesh with a horizontal rig.
    // Do not infer this from bone count: most 22-joint assets are true T-poses.
    const armPose = model.scene.userData.armPoseCorrectionRadians === Math.PI / 6 ? Math.PI / 6 : 0;
    for (const motion of this.motions) {
      const outputs = new Map(bones.map((bone) => [bone, new Float32Array(motion.times.length * 4)]));
      const positions = new Float32Array(motion.times.length * 3);
      const world = new Map<THREE.Object3D, THREE.Quaternion>();
      const local = new THREE.Quaternion();
      const delta = new THREE.Vector3();
      for (let frame = 0; frame < motion.times.length; frame++) {
        for (const bone of bones) {
          const track = motion.rotations.get(key(bone.name));
          let desired = world.get(bone);
          if (!desired) {
            desired = new THREE.Quaternion();
            world.set(bone, desired);
          }
          if (track) {
            desired.fromArray(track, frame * 4);
            if (armPose && /^(Left|Right)(Arm|ForeArm|Hand)$/.test(key(bone.name)))
              desired.multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(0, 0, 1),
                  key(bone.name).startsWith('Left') ? armPose : -armPose,
                ),
              );
            desired.multiply(rest.get(bone)!);
          } else
            desired
              .copy(world.get(bone.parent!) ?? bone.parent!.getWorldQuaternion(local))
              .multiply(bone.quaternion);
          const parent = world.get(bone.parent!) ?? bone.parent!.getWorldQuaternion(local);
          local
            .copy(parent)
            .invert()
            .multiply(desired)
            .normalize()
            .toArray(outputs.get(bone)!, frame * 4);
        }
        delta.fromArray(motion.displacement, frame * 3).multiplyScalar(ratio);
        // World navigation owns translation. Keep vertical displacement for
        // crouching, sitting, lying and jumps; all clips stay at their anchor.
        delta.x = 0;
        delta.z = 0;
        delta
          .applyMatrix3(parentInverse)
          .add(hips.position)
          .toArray(positions, frame * 3);
      }
      const tracks: THREE.KeyframeTrack[] = bones.map(
        (bone) =>
          new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, motion.times, outputs.get(bone)!),
      );
      tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, motion.times, positions));
      generated.push(new THREE.AnimationClip(motion.name, motion.duration, tracks));
    }
    const merged = new Map(model.animations.map((clip) => [clip.name, clip]));
    for (const clip of generated) merged.set(clip.name, clip);
    const getUp = merged.get('StandUpFromLaying');
    if (getUp) {
      const reverse = getUp.clone();
      reverse.name = 'LieDown';
      for (const track of reverse.tracks) {
        const size = track.getValueSize();
        const values = track.values.slice();
        const times = track.times.slice();
        for (let index = 0; index < times.length; index++) {
          const from = times.length - 1 - index;
          track.times[index] = Math.max(0, getUp.duration - times[from]);
          for (let channel = 0; channel < size; channel++)
            track.values[index * size + channel] = values[from * size + channel];
        }
      }
      merged.set(reverse.name, reverse);
    }
    model.animations = [...merged.values()];
    this.bound.add(model);
    return model;
  }
}
