import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { stabilizeLocomotionRoot } from './NpcAnimator';

describe('stabilizeLocomotionRoot', () => {
  it('removes an extreme Hips translation while preserving other tracks', () => {
    const root = new THREE.Group(),
      hips = new THREE.Object3D();
    hips.name = 'mixamorig:Hips';
    hips.position.set(0, 0.8, 0.1);
    root.add(hips);
    const hipsTrack = new THREE.VectorKeyframeTrack(
      'mixamorig:Hips.position',
      [0, 1],
      [0, 0.8, 0.1, 1, 82, 28],
    );
    const rotation = new THREE.QuaternionKeyframeTrack(
      'mixamorig:Hips.quaternion',
      [0, 1],
      [0, 0, 0, 1, 0, 0.2, 0, 0.98],
    );
    const safe = stabilizeLocomotionRoot(root, new THREE.AnimationClip('Run', 1, [hipsTrack, rotation]));
    expect([...safe.tracks[0].values]).toEqual([
      0,
      expect.closeTo(0.8, 5),
      expect.closeTo(0.1, 5),
      0,
      expect.closeTo(0.8, 5),
      expect.closeTo(0.1, 5),
    ]);
    expect(safe.tracks[1]).toBe(rotation);
  });

  it('does not alter valid locomotion', () => {
    const root = new THREE.Group(),
      hips = new THREE.Object3D();
    hips.name = 'Hips';
    root.add(hips);
    const clip = new THREE.AnimationClip('Walk', 1, [
      new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 1, 0, 0, 1.1, 0.1]),
    ]);
    expect(stabilizeLocomotionRoot(root, clip)).toBe(clip);
  });

  it('also stabilizes an extreme Idle pose', () => {
    const root = new THREE.Group();
    const hips = new THREE.Object3D();
    hips.name = 'mixamorig:Hips';
    hips.position.set(-0.1, -0.7, 14.2);
    root.add(hips);
    const idle = new THREE.AnimationClip('Idle', 1, [
      new THREE.VectorKeyframeTrack('mixamorig:Hips.position', [0, 1], [-0.1, 28, 14.2, -0.1, 27, 14.2]),
    ]);
    const safe = stabilizeLocomotionRoot(root, idle);
    expect([...safe.tracks[0].values]).toEqual([
      expect.closeTo(-0.1, 5),
      expect.closeTo(-0.7, 5),
      expect.closeTo(14.2, 5),
      expect.closeTo(-0.1, 5),
      expect.closeTo(-0.7, 5),
      expect.closeTo(14.2, 5),
    ]);
  });
});
