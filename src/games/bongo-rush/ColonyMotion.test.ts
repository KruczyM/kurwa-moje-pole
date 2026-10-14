import { describe, expect, it } from 'vitest';
import { colonyPose } from './ColonyMotion';
import { Simulation } from './Simulation';
import type { LevelDefinition } from './types';

describe('Kobra hatching and splitting', () => {
  const point = { x: 3, y: 2 };
  const resting = { x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, crack: 0 };
  it('rests early and when blocked, then visibly trembles and cracks before the wave', () => {
    expect(colonyPose(point, 10, 0, 25, true, undefined)).toEqual(resting);
    expect(colonyPose(point, 24, 0.5, 25, false, undefined)).toEqual(resting);
    const early = colonyPose(point, 22, 0.5, 25, true, undefined);
    const late = colonyPose(point, 24, 0.5, 25, true, undefined);
    expect(early).not.toEqual(resting);
    expect(late.scaleX).toBeGreaterThan(early.scaleX);
    expect(late.crack).toBeGreaterThan(0);
    expect(colonyPose(point, 24, 0.6, 25, true, undefined).x).not.toBe(late.x);
  });
  it.each([
    { x: 2, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 2 },
    { x: 3, y: 3 },
  ])('splits from the actual parent $x,$y and settles exactly in its own tile', (from) => {
    const birth = { at: point, from, tick: 25 };
    const first = colonyPose(point, 25, 0, 50, false, birth);
    expect(first.x).toBe((from.x - point.x) * 64);
    expect(first.y).toBe((from.y - point.y) * 64);
    const middle = colonyPose(point, 25, 0.6, 50, false, birth);
    expect(Math.abs(middle.x) + Math.abs(middle.y)).toBeLessThan(64);
    expect(colonyPose(point, 27, 0, 50, false, birth)).toEqual(resting);
  });
  it('respects reduced motion during both trembling and splitting', () => {
    const birth = { at: point, from: { x: 2, y: 2 }, tick: 25 };
    expect(colonyPose(point, 25, 0.3, 50, true, birth, true)).toEqual(resting);
    expect(colonyPose(point, 24, 0.8, 25, true, undefined, true)).toEqual(resting);
  });
  it('records real, non-overlapping parents and birth ticks, and clears births on restart', () => {
    const level: LevelDefinition = {
      id: 1,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      bushGrowthSeconds: 0.4,
      rows: ['#########', '#P.O...E#', '#########', '# V V   #', '#########'],
    };
    const game = new Simulation(level);
    game.step();
    game.step();
    const births = game.world.bushBirths!;
    expect(births.length).toBeGreaterThan(0);
    expect(new Set(births.map((b) => `${b.at.x},${b.at.y}`)).size).toBe(births.length);
    expect(
      births.every((b) => b.tick === 2 && Math.abs(b.at.x - b.from.x) + Math.abs(b.at.y - b.from.y) === 1),
    ).toBe(true);
    expect(births.find((b) => b.at.x === 3)?.from).toEqual({ x: 2, y: 3 });
    expect(new Simulation(level).world.bushBirths).toEqual([]);
  });
});
