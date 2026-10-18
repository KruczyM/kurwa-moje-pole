import { describe, expect, it } from 'vitest';
import { buildCampaignV5 } from './CampaignV5';
import { Simulation } from './Simulation';
import { bottleTower, cobraCache } from './CampaignV4';
import { neighbour } from './types';
import type { LevelDefinition, ReplayInput } from './types';
const LEVELS = buildCampaignV5();

function replay(level: LevelDefinition, inputs: readonly ReplayInput[]) {
  const game = new Simulation(level);
  for (const [tick, input] of inputs.entries()) {
    const chamber = game.chamberId;
    const target = input ? neighbour(game.world.player, input) : { ...game.world.player };
    game.step(input);
    expect(game.world.status, `${level.id} tick ${tick}: ${game.world.reason}`).not.toBe('lost');
    if (game.chamberId === chamber)
      expect({ x: game.world.player.x, y: game.world.player.y }, `blocked ${level.id}:${tick}`).toEqual({
        x: target.x,
        y: target.y,
      });
    expect(new Set(game.world.objects.map((body) => `${body.x},${body.y}`)).size).toBe(
      game.world.objects.length,
    );
    for (const portal of game.activePortals) {
      expect(game.cell(portal)).toBe('portal');
      expect(game.object(portal)).toBeUndefined();
      expect(game.enemy(portal)).toBeUndefined();
    }
  }
  return game;
}

describe('expanded authored campaign', () => {
  it('requires side retreat and a settling tick under a bottle tower', () => {
    const tower = bottleTower(5);
    const level: LevelDefinition = {
      id: 1,
      title: tower.name,
      hint: tower.hint,
      biome: 0,
      rows: tower.rows,
      quota: 5,
      solution: [],
    };
    const safe = replay(level, tower.solution);
    expect(safe.world.status).toBe('won');
    const unsafe = new Simulation(level);
    for (let n = 0; n < 7; n++) unsafe.step('right');
    unsafe.step('left');
    unsafe.step('right');
    expect(unsafe.world.status).toBe('lost');
  });

  it('emits bounded physical loot once and pauses while its outlet is occupied', () => {
    const cache = cobraCache(8);
    const game = new Simulation({
      id: 1,
      title: 'cache',
      hint: '',
      biome: 0,
      rows: cache.rows,
      quota: 8,
      solution: [],
      lootSources: cache.lootSources,
    });
    for (const input of ['right', 'right', 'right', 'down'] as const) game.step(input);
    expect(game.world.bushRoots).toHaveLength(1);
    const remaining = game.world.lootSources![0].remaining;
    game.step();
    expect(game.world.lootSources![0].remaining).toBe(remaining);
    expect(game.world.objects).toHaveLength(1);
    expect(game.world.nextBushGrowth).toBeGreaterThan(game.world.tick);
    const restarted = new Simulation(game.level);
    expect(restarted.world.lootSources![0]).toMatchObject({ activated: false, remaining: 8 });
    expect(restarted.world.bushRoots).toHaveLength(0);
  });

  it('rejects overlapping portals and out-of-range loot sources', () => {
    const level = LEVELS[11];
    expect(() => new Simulation({ ...level, portals: [...level.portals!, level.portals![0]] })).toThrow();
    expect(
      () =>
        new Simulation({
          ...LEVELS[9],
          lootSources: [{ ...LEVELS[9].lootSources![0], outlet: { x: -1, y: 0 } }],
        }),
    ).toThrow();
  });
});
