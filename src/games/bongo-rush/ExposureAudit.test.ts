import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import type { LevelDefinition } from './types';
import { advanceOpeningHistory, openings } from '../../../scripts/bongo-v6/exposure';

const fixture: LevelDefinition = {
  id: 1,
  title: '',
  hint: '',
  biome: 0,
  quota: 1,
  solution: [],
  bushGrowthSeconds: 0.2,
  rows: ['#########', '###V#####', '#P.O...E#', '#########'],
  requiredPickups: [{ x: 3, y: 2 }],
};

describe('all-room first exposure observer', () => {
  it('retains first opening across resealed and reopened checkpoint states', () => {
    const game = new Simulation({
      ...fixture,
      quota: 2,
      bushGrowthSeconds: 100,
      rows: ['#########', '###V#####', '#P.O.Q.E#', '#########'],
    });
    game.step('right');
    game.step('right');
    game.step('right');
    const first = advanceOpeningHistory(new Set(), game);
    expect(first.valid).toBe(true);
    expect([...first.seen]).toEqual(['main:3,1']);
    // A checkpoint with a resealed physical gate must retain its earlier event.
    game.world.objects.push({
      id: 1000,
      x: 3,
      y: 2,
      previous: { x: 3, y: 2 },
      kind: 'rock',
      falling: false,
      required: false,
      variant: 0,
    });
    game.world.collected = 2;
    expect(openings(game)).toEqual([]);
    const closed = advanceOpeningHistory(first.seen, game);
    expect(closed.valid).toBe(true);
    expect(closed.seen).toEqual(first.seen);
    game.world.objects = game.world.objects.filter((o) => o.id !== 1000);
    expect(advanceOpeningHistory(closed.seen, game).valid).toBe(true);
    expect(advanceOpeningHistory(new Set(), game).valid).toBe(false);
    expect(first.seen).toEqual(new Set(['main:3,1']));
  });
  it('detects an opening filled by growth in the same production step', () => {
    const game = new Simulation(fixture);
    expect(openings(game)).toEqual([]);
    game.step('right');
    game.step('right');
    expect(openings(game)).toEqual([]); // The player still occupies the support tile.
    game.step('right');
    expect(game.cell({ x: 3, y: 2 })).toBe('bush');
    expect(game.canSpreadFrom({ x: 3, y: 1 })).toBe(false);
    expect(openings(game)).toMatchObject([{ chamber: 'main', x: 3, y: 1, tick: 3, collected: 1 }]);
  });
  it('observes the abandoned chamber on the teleport entry tick', () => {
    const game = new Simulation({
      ...fixture,
      rows: ['#########', '#P  VQ.E#', '#########'],
      chambers: [{ id: 'side', name: '', hint: '', rows: ['#####', '#P  #', '#####'] }],
      portals: [{ name: '', a: { chamber: 'main', x: 2, y: 1 }, b: { chamber: 'side', x: 1, y: 1 } }],
      requiredPickups: [],
    });
    game.step('right');
    expect(game.chamberId).toBe('side');
    expect(openings(game)).toMatchObject([{ chamber: 'main', x: 4, y: 1, tick: 1 }]);
  });
});
