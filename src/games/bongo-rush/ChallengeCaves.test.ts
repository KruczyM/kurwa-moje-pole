import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels';
import { huntingPocket } from './ChallengeCaves';
import { Simulation } from './Simulation';
import type { LevelDefinition } from './types';
import { neighbour, same } from './types';

/** Isolates moving edge squares, rock impacts and loot without changing production rules. */
function fixture(rows: string[], quota = 1): LevelDefinition {
  return { id: 1, title: 'Fixture', hint: '', biome: 0, rows, quota, solution: [] };
}

describe('edge-following mesh squares', () => {
  it('reaches an edge from open space and repeats the room perimeter, not a tiny four-tile loop', () => {
    const game = new Simulation(
      fixture([
        '############',
        '#          #',
        '#          #',
        '#    S     #',
        '#          #',
        '#          #',
        '############',
        '#POE########',
        '############',
      ]),
    );
    const positions: string[] = [];
    for (let tick = 0; tick < 240; tick++) {
      game.step();
      if (game.world.tick % 2 === 0 && game.world.tick > 30) {
        const square = game.world.enemies[0];
        expect(square.wallAttached).toBe(true);
        expect(square.x === 1 || square.x === 10 || square.y === 1 || square.y === 5).toBe(true);
        positions.push(`${square.x},${square.y}`);
      }
    }
    expect(new Set(positions).size).toBe(26);
    expect(positions.slice(0, 26)).toEqual(positions.slice(26, 52));
  });

  it('loops around a nearby inner obstacle rather than abandoning it for the outer border', () => {
    const game = new Simulation(
      fixture([
        '############',
        '#          #',
        '#   ###    #',
        '#  S###    #',
        '#   ###    #',
        '#          #',
        '############',
        '#POE########',
        '############',
      ]),
    );
    const visited = new Set<string>();
    for (let tick = 0; tick < 160; tick++) {
      game.step();
      const square = game.world.enemies[0];
      visited.add(`${square.x},${square.y}`);
      expect(square.x).toBeGreaterThanOrEqual(3);
      expect(square.x).toBeLessThanOrEqual(7);
    }
    expect(visited.size).toBeGreaterThan(8);
    expect(game.world.status).toBe('playing');
  });
});

describe('rock eliminations and recoverable loot', () => {
  it.each(['C', 'B', 'U', 'S'])(
    'crushes %s once, emits a collectible above the rock and requires picking it up',
    (symbol) => {
      const game = new Simulation({
        ...fixture(
          [
            '########',
            '#R######',
            '# ######',
            `#${symbol}######`,
            '# ######',
            '########',
            '#POE####',
            '########',
          ],
          2,
        ),
        requiredKills: 1,
      });
      game.step();
      game.step();
      expect(game.world.kills).toBe(1);
      expect(game.world.enemies).toHaveLength(0);
      const drop = game.object({ x: 1, y: 2 });
      expect(drop).toMatchObject({ kind: 'pickup', required: true });
      expect(new Set(game.world.objects.map((body) => body.id)).size).toBe(game.world.objects.length);
      game.world.collected = 100;
      expect(game.exitOpen).toBe(false);
      for (let tick = 0; tick < 10; tick++) game.step();
      expect(game.world.kills).toBe(1);
      expect(game.world.objects.filter((body) => body.required)).toHaveLength(1);
    },
  );

  it('does not let a falling collectible kill an enemy or generate extra loot', () => {
    const game = new Simulation(
      fixture(['########', '#O######', '# ######', '#S######', '########', '#POE####', '########']),
    );
    game.step();
    game.step();
    expect(game.world.kills).toBe(0);
    expect(game.world.enemies).toHaveLength(1);
  });

  it('does not drop loot from the protected finale boss', () => {
    const game = new Simulation(
      fixture(['########', '#R######', '# ######', '#J######', '########', '#POE####', '########']),
    );
    game.step();
    game.step();
    expect(game.world.kills).toBe(0);
    expect(game.world.enemies[0].kind).toBe('boss');
  });

  it('requires timing: the same trap jams if released before the square returns', () => {
    const puzzle = huntingPocket(false, 0);
    const game = new Simulation({
      ...fixture(
        puzzle.rows.map((row) => `#${row.slice(1)}`),
        2,
      ),
      requiredKills: 1,
    });
    for (const input of puzzle.solution) game.step(input);
    expect(game.world.kills).toBe(0);
    expect(game.exitOpen).toBe(false);
    expect(game.world.status).toBe('playing');
    const correct = huntingPocket(false, 1);
    const restarted = new Simulation({
      ...fixture(
        correct.rows.map((row) => `#${row.slice(1)}`),
        2,
      ),
      requiredKills: 1,
    });
    for (const input of correct.solution) restarted.step(input);
    expect(restarted.world.status).toBe('won');
  });
});

describe('four new authored challenges', () => {
  it('keeps the original campaign and gives each bonus its own layout and puzzle structure', () => {
    expect(LEVELS.filter((level) => level.bonus).map((level) => level.id)).toEqual([13, 14, 15, 16]);
    expect(LEVELS[13].rows.filter((row) => row.includes('S'))).toHaveLength(2);
    expect(LEVELS[15].rows.flatMap((row) => [...row]).filter((tile) => tile === 'R').length).toBeGreaterThan(
      120,
    );
  });
  it.each(LEVELS.filter((level) => level.bonus))(
    'completes $id with real inputs, required loot and eliminations',
    (level) => {
      const game = new Simulation(level);
      for (const input of level.solution) {
        const target = neighbour(game.world.player, input);
        game.step(input);
        expect(same(game.world.player, target)).toBe(true);
        expect(game.world.status, game.world.reason).not.toBe('lost');
      }
      expect(game.world.status).toBe('won');
      expect(game.world.kills).toBeGreaterThanOrEqual(level.requiredKills!);
      expect(game.requiredRemaining).toBe(0);
    },
  );
});
