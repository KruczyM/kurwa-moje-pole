import { describe, expect, it } from 'vitest';
import { LOOT_PUZZLES } from './LootPuzzles';
import { LEGACY_LEVELS as LEVELS } from './Levels';
import { Simulation } from './Simulation';
import { neighbour, same } from './types';
import type { LevelDefinition } from './types';

/** Closes a chamber entrance and marks original loot positions without altering its solution. */
function fixture(index: number): LevelDefinition {
  const puzzle = LOOT_PUZZLES[index];
  const rows = puzzle.rows.map((row) => `#${row.slice(1)}`);
  const requiredPickups = rows.flatMap((row, y) =>
    [...row].flatMap((tile, x) => (tile === 'O' ? [{ x, y }] : [])),
  );
  return {
    id: 1,
    title: puzzle.name,
    hint: puzzle.hint,
    biome: 0,
    quota: requiredPickups.length,
    rows,
    requiredPickups,
    solution: puzzle.solution,
  };
}

describe('mandatory mining chambers', () => {
  for (let index = 0; index < LOOT_PUZZLES.length; index++) {
    it.each([0, 4, 30])(`solves mining chamber ${index + 1} with %s planning ticks between moves`, (wait) => {
      const level = fixture(index),
        game = new Simulation(level);
      let falls = 0;
      for (const input of level.solution) {
        for (let tick = 0; tick < wait; tick++) game.step();
        const target = neighbour(game.world.player, input);
        game.step(input);
        expect(game.world.status, game.world.reason).not.toBe('lost');
        expect(game.world.player).toMatchObject(target);
        falls += game.world.objects.filter((body) => body.kind === 'rock' && body.y > body.previous.y).length;
      }
      expect(game.world.status).toBe('won');
      expect(game.requiredRemaining).toBe(0);
      expect(game.world.collected).toBe(level.requiredPickups!.length);
      if (index < 4) expect(falls).toBeGreaterThan(0);
    });
  }

  it.each(LEVELS.filter((level) => level.style !== 'exploration'))(
    'requires marked loot on level $id even after exceeding the normal quota',
    (level) => {
      const game = new Simulation(level);
      game.world.collected = 1000;
      game.world.trapped = true;
      expect(level.requiredPickups!.length).toBeGreaterThan(0);
      expect(game.exitOpen).toBe(false);
      for (const input of level.solution) game.step(input);
      expect(game.world.status).toBe('won');
      expect(game.requiredRemaining).toBe(0);
    },
  );

  it('keeps the required marker attached to a falling collectible rather than its original tile', () => {
    const game = new Simulation({
      id: 1,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['#######', '#PO..E#', '#.....#', '#######'],
      requiredPickups: [{ x: 2, y: 1 }],
    });
    // Dig a receiving tile, then step away. The original marked bottle lands on the newly dug tile.
    for (const direction of ['down', 'right', 'left', 'up'] as const) game.step(direction);
    const body = game.world.objects.find((object) => object.required)!;
    expect(body).toMatchObject({ x: 2, y: 2, required: true });
    expect(game.requiredRemaining).toBe(1);
    for (const direction of ['down', 'right', 'left', 'up', 'right', 'right', 'right', 'right'] as const)
      game.step(direction);
    expect(game.world.status).toBe('won');
    expect(game.requiredRemaining).toBe(0);
  });

  it('cannot reverse along the mined one-way vein after the rock doors close', () => {
    const game = new Simulation(fixture(3));
    for (let move = 0; move < 4; move++) game.step('right');
    for (let tick = 0; tick < 8; tick++) game.step();
    const before = { ...game.world.player };
    game.step('left');
    expect(same(game.world.player, before)).toBe(true);
    expect(game.world.status).toBe('playing');
    for (let move = 0; move < 6; move++) game.step('right');
    expect(game.world.status).toBe('won');
  });

  it('rejects a required-loot coordinate which does not identify a collectible', () => {
    expect(() => new Simulation({ ...fixture(0), requiredPickups: [{ x: 0, y: 0 }] })).toThrow(
      'Wymagany łup',
    );
  });

  it('keeps the exit physically closed when the player bypasses the tower without harvesting', () => {
    const game = new Simulation(fixture(2));
    game.world.collected = 1000;
    for (const [direction, count] of [
      ['right', 2],
      ['up', 4],
      ['right', 6],
      ['down', 4],
      ['right', 2],
    ] as const) {
      for (let step = 0; step < count; step++) game.step(direction);
    }
    expect(game.world.player).toMatchObject({ x: 10, y: 5 });
    expect(game.requiredRemaining).toBe(1);
    expect(game.world.status).toBe('playing');
    expect(game.exitOpen).toBe(false);
  });
});
