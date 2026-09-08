import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { NpcAnimator, stabilizeLocomotionRoot } from './NpcAnimator';

/** Tworzy klipy o różnych długościach, aby dało się sprawdzić zachowanie fazy przejścia. */
function animationSet() {
  return [
    new THREE.AnimationClip('Idle', 2, []),
    new THREE.AnimationClip('Walk', 4, []),
    new THREE.AnimationClip('Run', 1, []),
    new THREE.AnimationClip('HipHopDancing', 0.5, []),
    new THREE.AnimationClip('Capoeira', 0.4, []),
  ];
}

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

describe('NpcAnimator state machine', () => {
  it('does not restart an action when the same state is requested every frame', () => {
    const clips = animationSet();
    const animator = new NpcAnimator(new THREE.Group(), clips);
    const walk = animator.mixer.existingAction(clips[1])!;
    const reset = vi.spyOn(walk, 'reset');

    animator.update(0.4);
    animator.play('Walk');
    for (let frame = 0; frame < 20; frame += 1) {
      animator.play('Walk');
      animator.update(1 / 60);
    }

    expect(reset).toHaveBeenCalledTimes(1);
    expect(animator.getDiagnostics().locomotionState).toBe('Walk');
    animator.dispose();
  });

  it('uses hysteresis to discard a brief collision-driven Idle and avoids a restart', () => {
    const clips = animationSet();
    const animator = new NpcAnimator(new THREE.Group(), clips);
    const walk = animator.mixer.existingAction(clips[1])!;
    const reset = vi.spyOn(walk, 'reset');

    animator.update(0.4);
    animator.play('Walk');
    animator.update(0.1);
    animator.play('Idle');
    expect(animator.getDiagnostics().pendingLocomotion).toBe('Idle');
    animator.play('Walk');

    expect(animator.getDiagnostics().pendingLocomotion).toBeNull();
    expect(animator.getDiagnostics().locomotionState).toBe('Walk');
    expect(reset).toHaveBeenCalledTimes(1);
    animator.dispose();
  });

  it('crossfades with time warping and transfers normalized locomotion phase', () => {
    const clips = animationSet();
    const animator = new NpcAnimator(new THREE.Group(), clips, { fadeSeconds: 0.3 });
    const idle = animator.mixer.existingAction(clips[0])!;
    const walk = animator.mixer.existingAction(clips[1])!;
    const crossFade = vi.spyOn(walk, 'crossFadeFrom');

    animator.update(1);
    animator.play('Walk');

    expect(crossFade).toHaveBeenCalledWith(idle, 0.3, true);
    expect(walk.time).toBeCloseTo(2, 5);
    expect(animator.getDiagnostics()).toMatchObject({
      currentClip: 'Walk',
      locomotionState: 'Walk',
      transitionCount: 1,
      lastTransition: { from: 'Idle', to: 'Walk', duration: 0.3 },
    });
    animator.dispose();
  });

  it('plays queued one-shots in order and returns to requested locomotion after finished', () => {
    const clips = animationSet();
    const animator = new NpcAnimator(new THREE.Group(), clips, {
      fadeSeconds: 0,
      minimumStateSeconds: { Idle: 0, Walk: 0, Run: 0 },
    });
    animator.play('Walk');

    expect(animator.queueOneShot('HipHopDancing')).toBe(true);
    expect(animator.queueOneShot('Capoeira')).toBe(true);
    animator.play('Run');
    expect(animator.getDiagnostics()).toMatchObject({
      currentClip: 'HipHopDancing',
      requestedLocomotion: 'Run',
      queuedOneShots: 1,
    });

    animator.update(0.6);
    expect(animator.getDiagnostics()).toMatchObject({ currentClip: 'Capoeira', oneShot: 'Capoeira' });
    animator.update(0.5);
    expect(animator.getDiagnostics()).toMatchObject({
      currentClip: 'Run',
      locomotionState: 'Run',
      oneShot: null,
      queuedOneShots: 0,
    });
    animator.dispose();
  });
});
