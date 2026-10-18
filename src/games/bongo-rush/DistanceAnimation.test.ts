import { describe, expect, it } from 'vitest';
import { SpriteAnimator, type SpriteMetadata } from '../after/presentation/SpriteAnimator';
import { PatrolAnimator } from './PatrolAnimator';
const metadata: SpriteMetadata = {
  frameWidth: 128,
  frameHeight: 128,
  framesPerDirection: 12,
  rows: { down: 0, right: 1, up: 2, left: 3 },
  animationColumns: { idle: [0, 1, 2, 3], walk: [4, 5, 6, 7, 8, 9, 10, 11] },
  pivot: { x: 64, y: 116 },
  walkTilesPerCycle: 4,
  idleFps: 3,
};
describe('distance-driven illustrated gait', () => {
  it.each([-1, 64, Number.NaN])('rejects unusable atlas margin %s', (margin) => {
    expect(() => new SpriteAnimator({ ...metadata, margin })).toThrow('Invalid After sprite metadata');
  });
  it('rejects a zero-height feet pivot before the renderer divides by it', () => {
    expect(() => new SpriteAnimator({ ...metadata, pivot: { x: 64, y: 0 } })).toThrow();
  });
  it('uses presented patrol distance and rests when trapped regardless of scheduled steps', () => {
    const patrol = new PatrolAnimator(metadata);
    expect(patrol.update(1, 'east', true, false, false, false, false, 0.5).x).toBe(5 * 128);
    expect(patrol.update(0.01, 'north', false, false, false, false, false, 0.5)).toMatchObject({
      x: 6 * 128,
      y: 256,
    });
    const paused = patrol.update(2, 'north', true, false, true, false, false, 1);
    expect(paused.x).toBe(6 * 128);
    expect(patrol.update(0.2, 'north', true, false, false, true, false, 1).x).toBe(0);
    expect(patrol.update(0, 'south', true, false, false, false, false, 0.5).x).toBe(7 * 128);
  });
  it('completes eight walk frames per four tiles independently of dt and running', () => {
    const slow = new SpriteAnimator(metadata, { preservePhase: true }),
      fast = new SpriteAnimator(metadata, { preservePhase: true });
    for (let i = 1; i <= 8; i++) {
      const expected = (4 + (i % 8)) * 128;
      expect(slow.update(0.2, 'south', true, false, false, 0.5).x).toBe(expected);
      expect(fast.update(0.001, 'east', true, true, false, 0.5).x).toBe(expected);
    }
  });
  it('preserves walking phase on turns and a stop, while a blocked player uses idle at three fps', () => {
    const animator = new SpriteAnimator(metadata, { preservePhase: true });
    expect(animator.update(0, 'south', true, false, false, 0.75).x).toBe(5 * 128);
    const idle = animator.update(0.2, 'west', false, false, false, 0);
    expect(idle.x).toBe(0);
    expect(animator.update(0.2, 'west', false, false, false, 0).x).toBe(128);
    const resumed = animator.update(0, 'north', true, false, false, 0.25);
    expect(resumed.x).toBe(6 * 128);
    expect(resumed.y).toBe(256);
  });
  it('freezes phase on pause and snaps a restart or teleport without a gait jump', () => {
    const animator = new SpriteAnimator(metadata, { preservePhase: true });
    const before = animator.update(0.1, 'east', true, false, false, 1);
    expect(animator.update(1, 'east', false, false, true, 10)).toEqual(before);
    animator.reset();
    expect(animator.update(0, 'east', false, false, false, 0)).toMatchObject({ x: 0, y: 128 });
    expect(animator.update(0, 'east', true, false, false, 0.5).x).toBe(5 * 128);
  });
});
