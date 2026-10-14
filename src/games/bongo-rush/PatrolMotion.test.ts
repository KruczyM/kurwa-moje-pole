import { describe, expect, it } from 'vitest';
import { PatrolMotion } from './PatrolMotion';
import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import { PatrolAnimator } from './PatrolAnimator';
import type { Enemy } from './types';

describe('continuous presentation over discrete patrol steps', () => {
  it('presents the same path at 30, 60 and 120 Hz', () => {
    for (const hz of [30, 60, 120]) {
      const motion = new PatrolMotion();
      const enemy: Enemy = {
        id: 4,
        kind: 'blue',
        direction: 'right',
        chasing: false,
        x: 2,
        y: 1,
        previous: { x: 1, y: 1 },
      };
      motion.position(enemy, 0, 0);
      for (let frame = 0; frame <= hz; frame++) {
        const ticks = frame / hz / 0.2;
        const p = motion.position(enemy, Math.floor(ticks), ticks % 1);
        expect(p.x).toBeCloseTo(1 + Math.min(1, ticks / 2));
      }
    }
  });
  it('advances throughout the three-tick cadence and never overshoots the logical tile', () => {
    const motion = new PatrolMotion();
    const enemy: Enemy = {
      id: 1,
      kind: 'red',
      direction: 'right',
      chasing: false,
      x: 4,
      y: 2,
      previous: { x: 3, y: 2 },
    };
    expect(motion.position(enemy, 3, 0).x).toBe(3);
    expect(motion.position(enemy, 4, 0.5).x).toBe(3.5);
    expect(motion.position(enemy, 5, 0.9).x).toBeCloseTo(3 + 2.9 / 3);
    expect(motion.position(enemy, 8, 0).x).toBe(4);
    motion.clear();
    enemy.previous = { x: 4, y: 2 };
    expect(motion.position(enemy, 8, 0).x).toBe(4);
  });

  it('keeps walk phase across turns and idle transitions when the Bongo timing option is enabled', () => {
    const meta = {
      frameWidth: 128,
      frameHeight: 128,
      framesPerDirection: 10,
      rows: { down: 0, right: 1, up: 2, left: 3 },
      animationColumns: { idle: [0, 1], walk: [2, 3, 4, 5, 6, 7, 8, 9] },
    };
    const animator = new SpriteAnimator(meta, { preservePhase: true, walkFps: 10, idleFps: 2 });
    expect(animator.update(0.15, 'east', true).x).toBe(3 * 128);
    expect(animator.update(0, 'north', false).x).toBe(0);
    expect(animator.update(0, 'west', true).x).toBe(3 * 128);
    expect(animator.update(10, 'west', true, false, true).x).toBe(3 * 128);
  });
  it('stops the gait immediately when continuous presentation reaches a blocked tile', () => {
    const meta = {
      frameWidth: 128,
      frameHeight: 128,
      framesPerDirection: 10,
      rows: { down: 0, right: 1, up: 2, left: 3 },
      animationColumns: { idle: [0, 1], walk: [2, 3, 4, 5, 6, 7, 8, 9] },
    };
    const animator = new PatrolAnimator(meta);
    expect(animator.update(0.1, 'east', true, false, false, false, true).x).toBeGreaterThanOrEqual(256);
    expect(animator.update(0.01, 'east', false, false, false, false, true).x).toBeLessThan(256);
  });
});
