import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels';
import { Simulation } from './Simulation';
import { bottleTower, cobraCache } from './CampaignV4';
import { neighbour, STEP_SECONDS } from './types';
import type { LevelDefinition, ReplayInput } from './types';

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
  it('preserves progression identities while replacing long galleries with compact rooms', () => {
    expect(LEVELS.map((level) => level.id)).toEqual(Array.from({ length: 16 }, (_, n) => n + 1));
    expect(LEVELS.filter((level) => level.bonus).map((level) => level.id)).toEqual([13, 14, 15, 16]);
    for (let biome = 0; biome < 4; biome++)
      expect(LEVELS.filter((level) => level.biome === biome)).toHaveLength(4);
    expect(new Set(LEVELS.map((level) => JSON.stringify([level.rows, level.chambers]))).size).toBe(16);
    expect(LEVELS[0].replay!.length * STEP_SECONDS).toBeLessThan(10);
    expect(LEVELS.every((level) => level.rows[0].length <= 40)).toBe(true);
  });

  it.each(LEVELS)('completes every real input of level $id, including waits and portal returns', (level) => {
    const game = replay(level, level.replay!);
    expect(game.chamberId).toBe('main');
    expect(game.world.status).toBe('won');
    expect(game.requiredRemaining).toBe(0);
    if (level.id === 12) expect(game.world.trapped).toBe(true);
    for (const alternative of level.alternateReplays ?? [])
      expect(replay(level, alternative.inputs).world.status).toBe('won');
  });

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

  it('freezes inactive chambers, shares required loot, prevents portal bounce and resets the whole run', () => {
    const level = LEVELS[5];
    const game = new Simulation(level);
    const main = game.world;
    game.step('up');
    expect(game.chamberId).toBe('room-1');
    const landing = { ...game.world.player };
    game.step();
    expect(game.chamberId).toBe('room-1');
    expect(game.world.player.x).toBe(landing.x);
    expect(main.tick).toBe(1);
    expect(game.exitOpen).toBe(false);
    const completed = replay(level, level.replay!);
    expect(completed.world.collected).toBe(10);
    const restarted = new Simulation(level);
    expect(restarted.chamberId).toBe('main');
    expect(restarted.world.collected).toBe(0);
    expect(restarted.requiredRemaining).toBe(10);
  });

  it('rejects overlapping portals and out-of-range loot sources', () => {
    const level = LEVELS[5];
    expect(() => new Simulation({ ...level, portals: [...level.portals!, level.portals![0]] })).toThrow();
    expect(
      () =>
        new Simulation({
          ...LEVELS[2],
          lootSources: [{ ...LEVELS[2].lootSources![0], outlet: { x: -1, y: 0 } }],
        }),
    ).toThrow();
  });
});
