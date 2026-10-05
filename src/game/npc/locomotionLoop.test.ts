import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { closeLocomotionLoop } from './locomotionLoop';

describe('locomotion loop closure', () => {
  it('closes a position seam only in the tail without mutating the cached clip', () => {
    const track = new THREE.VectorKeyframeTrack('Foot.position', [0, 0.5, 1], [0, 1, 0, 1, 2, 0, 2, 1, 0]);
    const original = [...track.values];
    const clip = new THREE.AnimationClip('Run', 1, [track]);
    const result = closeLocomotionLoop(clip);
    expect(result).not.toBe(clip);
    expect(result.duration).toBe(1);
    const sample = result.tracks[0].InterpolantFactoryMethodLinear();
    expect(Array.from(sample.evaluate(0.5))).toEqual([1, 2, 0]);
    expect(Array.from(sample.evaluate(1))).toEqual([0, 1, 0]);
    expect([...track.values]).toEqual(original);
    expect([...track.times]).toEqual([0, 0.5, 1]);
  });

  it('closes joint rotation with normalized spherical interpolation', () => {
    const end = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.7);
    const track = new THREE.QuaternionKeyframeTrack('Arm.quaternion', [0, 1], [0, 0, 0, 1, ...end.toArray()]);
    const result = closeLocomotionLoop(new THREE.AnimationClip('Walk', 1, [track]));
    expect([...result.tracks[0].values.slice(-4)]).toEqual([0, 0, 0, 1]);
    for (let offset = 0; offset < result.tracks[0].values.length; offset += 4) {
      expect(new THREE.Quaternion().fromArray(result.tracks[0].values, offset).length()).toBeCloseTo(1);
    }
  });

  it('leaves one-shots and already closed or antipodal quaternion tracks unchanged', () => {
    const track = new THREE.QuaternionKeyframeTrack('Arm.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, -1]);
    for (const name of ['Walk', 'Idle', 'Capoeira']) {
      const clip = new THREE.AnimationClip(name, 1, [track]);
      expect(closeLocomotionLoop(clip)).toBe(clip);
    }
  });

  it('handles short clips without duplicate times or non-finite samples', () => {
    const track = new THREE.VectorKeyframeTrack('Foot.position', [0, 0.02], [0, 0, 0, 0, 0.1, 0]);
    const result = closeLocomotionLoop(new THREE.AnimationClip('Run', 0.02, [track]));
    const times = [...result.tracks[0].times];
    expect(times.every((time, index) => index === 0 || time > times[index - 1])).toBe(true);
    expect([...result.tracks[0].values].every(Number.isFinite)).toBe(true);
  });
});
