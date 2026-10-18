import { describe, expect, it } from 'vitest';
import { LEGACY_LEVELS } from './Levels';
import { buildCampaignV5, deepDeposit, puzzleLevel } from './CampaignV5';
import { createWorld, Simulation } from './Simulation';
import { buildTerrainLayout } from './TerrainLayout';
import { loadProgress } from './Progress';
import type { LevelDefinition, ReplayInput } from './types';

const play = (level: LevelDefinition, route: readonly ReplayInput[] = level.replay ?? level.solution) => {
  const game = new Simulation(level);
  for (const input of route) game.step(input);
  return game;
};
const LEVELS = buildCampaignV5();

describe('authored twenty-four cave campaign', () => {
  it('includes twenty main caves, four recognisable challenges and only two portal networks', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(LEVELS.filter((l) => l.bonus).map((l) => l.id)).toEqual([21, 22, 23, 24]);
    expect(LEVELS.filter((l) => l.portals?.length).map((l) => l.id)).toEqual([12, 18]);
    expect(LEVELS[11].portals).toHaveLength(2);
    expect(LEVELS[17].portals).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect(LEVELS[i + 20].rows).toEqual(LEGACY_LEVELS[i + 12].rows);
  });

  it.each(LEVELS)('completes $id with real rules and all mandatory objects', (level) => {
    const game = new Simulation(level);
    for (const input of level.replay ?? level.solution) {
      game.step(input);
      expect(game.world.status, `${level.id}:${game.ticks} ${game.world.reason}`).not.toBe('lost');
      const occupied = game.world.objects.map((o) => `${o.x},${o.y}`);
      expect(new Set(occupied).size).toBe(occupied.length);
    }
    expect(game.world.status).toBe('won');
    expect(game.requiredRemaining).toBe(0);
    expect(game.world.kills).toBeGreaterThanOrEqual(level.requiredKills ?? 0);
    if (level.id === 20) expect(game.world.trapped).toBe(true);
  });

  it('makes early reversal under a released layer fatal, instead of rewarding a blind sweep', () => {
    for (const id of [1, 2, 6]) {
      const level = LEVELS[id - 1];
      const game = play(level, ['right', 'right', 'right', 'right', 'left', 'right']);
      expect(game.world.status, `${id}`).toBe('lost');
    }
  });
  it('allows the formerly fatal sideways catch on the legacy funnel', () => {
    const game = play(LEVELS[4], ['right', 'right', 'right', 'right', 'left', 'right']);
    expect(game.world.status).toBe('playing');
    expect(game.world.collected).toBeGreaterThan(0);
  });

  it('requires the deep prize and a descending escape from its collapsing return', () => {
    const level = puzzleLevel(deepDeposit(), 1);
    expect(play(level).world.status).toBe('won');
    const wrong = play(level, [...Array<ReplayInput>(8).fill('right'), 'left']);
    expect(wrong.world.status).toBe('lost');
    expect(wrong.world.collected).toBeGreaterThan(level.quota);
  });

  it('allows growth from the start and closes a passage when the player waits too long', () => {
    const level = LEVELS[7];
    const delayed = play(level, [...Array<undefined>(100).fill(undefined), ...level.replay!]);
    expect(delayed.world.status).not.toBe('won');
    expect(delayed.world.cells.filter((c) => c === 'bush').length).toBeGreaterThan(1);
    expect(play(level).world.status).toBe('won');
  });

  it('keeps background time running and never bounces from a portal without leaving it', () => {
    const game = new Simulation(LEVELS[11]),
      main = game.world;
    game.step('up');
    const room = game.world,
      landing = { ...room.player };
    for (let n = 0; n < 30; n++) game.step();
    expect(game.chamberId).toBe('vault-1');
    expect(room.player.x).toBe(landing.x);
    expect(room.player.y).toBe(landing.y);
    expect(main.tick).toBe(game.ticks);
    expect(room.tick).toBe(game.ticks);
    expect(game.exitOpen).toBe(false);
    const reset = new Simulation(LEVELS[11]);
    expect(reset.world.collected).toBe(0);
    expect(reset.ticks).toBe(0);
  });

  it('advances gravity and exposed colonies in an abandoned room, without a phantom player', () => {
    const level: LevelDefinition = {
      id: 1,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      bushGrowthSeconds: 0.4,
      rows: ['#########', '#P O...E#', '#######R#', '# V     #', '#########'],
      chambers: [{ id: 'side', name: '', hint: '', rows: ['#####', '#P  #', '#####'] }],
      portals: [{ name: '', a: { chamber: 'main', x: 2, y: 1 }, b: { chamber: 'side', x: 1, y: 1 } }],
    };
    const game = new Simulation(level),
      main = game.world;
    game.step('right');
    game.step();
    expect(main.objects.find((o) => o.kind === 'rock')!.y).toBe(3);
    expect(main.cells[3 * main.width + 1]).toBe('bush');
    expect(main.tick).toBe(game.ticks);
  });

  it('advances both rooms exactly once on the portal entry tick', () => {
    const rows = ['#########', '#P    OE#', '#    R  #', '#       #', '# V     #', '#########'];
    const level: LevelDefinition = {
      id: 1,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      bushGrowthSeconds: 0.4,
      rows,
      chambers: [{ id: 'side', name: '', hint: '', rows: rows.map((row) => row.replace('E', ' ')) }],
      portals: [{ name: '', a: { chamber: 'main', x: 2, y: 1 }, b: { chamber: 'side', x: 2, y: 1 } }],
    };
    const game = new Simulation(level),
      main = game.world;
    game.step('right');
    const side = game.world;
    expect(game.chamberId).toBe('side');
    for (const room of [main, side]) {
      expect(room.tick).toBe(1);
      expect(room.objects.find((o) => o.kind === 'rock')!.y).toBe(3);
    }
    game.step('right');
    game.step('left');
    expect(game.chamberId).toBe('main');
    for (const room of [main, side]) {
      expect(room.tick).toBe(3);
      expect(room.cells[4 * room.width + 1]).toBe('bush');
    }
  });

  it('places no random architecture in an undecorated room', () => {
    const world = createWorld(LEVELS[0]);
    for (const seed of [0, 1, 66]) {
      const art = buildTerrainLayout(world, seed);
      expect(art.directional).toBe(0);
      expect(art.accents).toBe(0);
      expect(new Set([...art.cells].filter((_, i) => world.cells[i] === 'wall')).size).toBeLessThanOrEqual(2);
    }
  });

  it('migrates old bonus unlocks without claiming the new campaign was completed', () => {
    for (const [unlocked, expected] of [
      [13, 21],
      [14, 22],
      [15, 23],
      [16, 24],
    ]) {
      const progress = loadProgress({
        getItem: () => JSON.stringify({ version: 1, unlocked, completed: true, hero: 'antena' }),
      });
      expect(progress.unlocked).toBe(expected);
      expect(progress.completed).toBe(false);
      expect(progress.hero).toBe('antena');
    }
  });
});

describe('autonomous visible Kobra', () => {
  const fixture: LevelDefinition = {
    id: 1,
    title: '',
    hint: '',
    biome: 0,
    quota: 1,
    solution: [],
    bushGrowthSeconds: 0.4,
    rows: ['#########', '#P.O...E#', '#########', '# V  ...#', '#  ######', '#########'],
  };
  it('expands simultaneous four-neighbour waves without digging its own tile', () => {
    const game = new Simulation(fixture);
    game.step();
    expect(game.cell({ x: 1, y: 3 })).toBe('air');
    game.step();
    expect(game.cell({ x: 1, y: 3 })).toBe('bush');
    expect(game.cell({ x: 4, y: 3 })).toBe('air');
    game.step();
    game.step();
    expect(game.cell({ x: 4, y: 3 })).toBe('bush');
    expect(game.cell({ x: 5, y: 3 })).toBe('soil');
  });
  it('does not grow through objects, soil or a player and rejects invalid periods', () => {
    const blocked = { ...fixture, rows: ['#########', '#P.O...E#', '#########', '##VQ#####', '#########'] };
    const game = new Simulation(blocked);
    for (let i = 0; i < 20; i++) game.step();
    expect(game.world.cells.filter((c) => c === 'bush')).toHaveLength(1);
    expect(() => new Simulation({ ...fixture, bushGrowthSeconds: 0 })).toThrow();
  });

  it('starts expansion when a collected neighbour becomes genuinely empty', () => {
    const level: LevelDefinition = { ...fixture, rows: ['#########', '###V#####', '#P.O...E#', '#########'] };
    const game = new Simulation(level);
    for (let i = 0; i < 6; i++) game.step();
    expect(game.world.cells.filter((c) => c === 'bush')).toHaveLength(1);
    game.step('right');
    game.step('right');
    game.step('right');
    game.step();
    expect(game.cell({ x: 3, y: 2 })).toBe('bush');
    expect(game.world.status).toBe('playing');
  });
});
