import { describe, expect, it } from 'vitest';
import { EXIT_PUZZLES, exitPuzzleForLevel } from './ExitPuzzles';
import { LEVELS } from './Levels';
import { Simulation } from './Simulation';
import { DIRECTIONS, neighbour, same } from './types';
import type { LevelDefinition } from './types';

/** Closes the gallery entrance and adds one pickup on the approach for an isolated real-physics test. */
function fixture(index: number): LevelDefinition {
  const puzzle = EXIT_PUZZLES[index];
  const rows = puzzle.rows.map((row, y) => (y === 5 ? `#${row.slice(1, 2)}O${row.slice(3)}` : row));
  return {
    id: 1,
    title: puzzle.name,
    hint: puzzle.hint,
    biome: 0,
    rows,
    quota: 1,
    solution: puzzle.solution,
  };
}

describe('mandatory exit puzzles', () => {
  it.each([0, 1, 2, 3, 4, 5])('lets the player stop and think between vault %s moves', (index) => {
    const level = fixture(index),
      game = new Simulation(level);
    for (const direction of level.solution) {
      for (let tick = 0; tick < 30; tick++) game.step();
      const target = neighbour(game.world.player, direction);
      game.step(direction);
      expect(game.world.player).toMatchObject(target);
      expect(game.world.status).not.toBe('lost');
    }
    expect(game.world.status).toBe('won');
  });

  it.each([0, 1, 2, 3, 4, 5])('solves vault %s using only actual moves and physics', (index) => {
    const level = fixture(index),
      game = new Simulation(level);
    for (const direction of level.solution) {
      const target = neighbour(game.world.player, direction);
      game.step(direction);
      expect(game.world.player).toMatchObject(target);
      expect(game.world.status).not.toBe('lost');
    }
    expect(game.world.status).toBe('won');
  });

  it.each([0, 1, 2, 3, 4, 5])('has no dig-only bypass around the rock gate in vault %s', (index) => {
    const game = new Simulation(fixture(index));
    const queue = [{ ...game.world.player }];
    const seen = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i];
      expect(same(point, EXIT_PUZZLES[index].exit)).toBe(false);
      for (const direction of DIRECTIONS) {
        const next = neighbour(point, direction),
          key = `${next.x},${next.y}`;
        if (seen.has(key) || game.cell(next) === 'wall' || game.object(next)?.kind === 'rock') continue;
        seen.add(key);
        queue.push({ ...game.world.player, ...next });
      }
    }
  });

  it('rejects a push into uncleared soil without silently moving the player', () => {
    const game = new Simulation(fixture(0));
    for (let i = 0; i < 3; i++) game.step('right');
    const before = { x: game.world.player.x, y: game.world.player.y };
    game.step('right');
    expect(game.world.player).toMatchObject(before);
    expect(game.drainSounds()).not.toContain('push');
    expect(game.world.status).toBe('playing');
  });

  it('requires an opposite-side approach and a cleared second pocket in the reference-inspired maze', () => {
    const game = new Simulation(fixture(5));
    const pushes: string[] = [];
    for (const direction of game.level.solution) {
      game.step(direction);
      if (game.drainSounds().includes('push')) pushes.push(direction);
    }
    expect(pushes).toEqual(['right', 'left']);
    expect(game.world.status).toBe('won');

    const unprepared = new Simulation(fixture(5));
    for (const direction of unprepared.level.solution.slice(0, 26)) unprepared.step(direction);
    for (const direction of ['right', 'right', 'down', 'down', 'left'] as const) unprepared.step(direction);
    expect(unprepared.world.player).toMatchObject({ x: 6, y: 9 });
    unprepared.step('left');
    expect(unprepared.world.player).toMatchObject({ x: 6, y: 9 });
    expect(unprepared.object({ x: 5, y: 9 })?.kind).toBe('rock');
    expect(unprepared.cell({ x: 4, y: 9 })).toBe('soil');
    expect(unprepared.world.status).toBe('playing');
  });

  it('blocks reentry into a moving rock until the chute has fallen clear', () => {
    const game = new Simulation(fixture(1));
    for (const direction of EXIT_PUZZLES[1].solution.slice(0, 6)) game.step(direction);
    expect(game.world.status).toBe('playing');
    expect(game.object({ x: 5, y: 6 })?.falling).toBe(true);
    game.step('right');
    expect(game.world.player).toMatchObject({ x: 4, y: 6 });
    expect(game.object({ x: 5, y: 7 })?.kind).toBe('rock');
    expect(game.world.status).toBe('playing');
  });

  it.each(LEVELS)('keeps level $id exit in a sealed puzzle wing even with excess pickups', (level) => {
    const game = new Simulation(level);
    const puzzle = exitPuzzleForLevel(level.id - 1);
    const approach = level.solution.slice(0, -puzzle.solution.length);
    for (const direction of approach) game.step(direction);
    expect(game.world.collected).toBeGreaterThanOrEqual(level.quota);
    expect(game.world.status).toBe('playing');
    expect(game.world.player).toMatchObject(level.vault!.entry);
    for (const direction of puzzle.solution) game.step(direction);
    expect(game.world.status).toBe('won');
  });

  it('makes premature excavation visibly jam both rocks, while the correct order remains solvable', () => {
    const game = new Simulation(fixture(4));
    const wrong = [
      'right',
      'up',
      'up',
      'up',
      'right',
      'right',
      'right',
      'right',
      'down',
      'down',
      'down',
      'down',
      'up',
      'up',
    ] as const;
    for (const direction of wrong) game.step(direction);
    for (let tick = 0; tick < 3; tick++) game.step();
    expect(game.object({ x: 5, y: 6 })?.kind).toBe('rock');
    expect(game.object({ x: 6, y: 6 })?.kind).toBe('rock');
    expect(game.cell({ x: 5, y: 7 })).toBe('exit');
    expect(game.cell({ x: 6, y: 7 })).toBe('wall');
    // Adjacent grounded rocks cannot be pushed together or lifted vertically under existing physics.
    expect(game.world.status).toBe('playing');
    expect(game.exitOpen).toBe(true);
    const restarted = new Simulation(fixture(4));
    for (const direction of restarted.level.solution) restarted.step(direction);
    expect(restarted.world.status).toBe('won');
  });
});
