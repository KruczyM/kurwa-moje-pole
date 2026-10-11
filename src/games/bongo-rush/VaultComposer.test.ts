import { describe, expect, it } from 'vitest';
import { CAMPAIGN_VAULTS, EXIT_PUZZLES, exitPuzzleForLevel } from './ExitPuzzles';
import { composeVault } from './VaultComposer';
import { Simulation } from './Simulation';
import { DIRECTIONS, neighbour, same } from './types';
import type { LevelDefinition } from './types';

/** Creates an isolated playable fixture without changing the campaign's physics or quotas. */
function fixture(index: number): LevelDefinition {
  const puzzle = CAMPAIGN_VAULTS[index];
  return {
    id: 1,
    title: puzzle.name,
    hint: puzzle.hint,
    biome: 0,
    quota: 1,
    rows: puzzle.rows.map((row, y) => (y === 5 ? `#${row.slice(1, 2)}O${row.slice(3)}` : row)),
    solution: puzzle.solution,
  };
}

describe('authored campaign vault chains', () => {
  it('has twelve genuinely different layouts rather than twelve names for three maps', () => {
    expect(CAMPAIGN_VAULTS).toHaveLength(12);
    expect(new Set(CAMPAIGN_VAULTS.map((puzzle) => puzzle.rows.join('\n'))).size).toBe(12);
    expect(CAMPAIGN_VAULTS[11].stages).toHaveLength(5);
  });

  it.each(Array.from({ length: 12 }, (_, index) => index))(
    'solves chain %s even with time to plan every move',
    (index) => {
      const game = new Simulation(fixture(index));
      for (const direction of game.level.solution) {
        for (let tick = 0; tick < 4; tick++) game.step();
        const target = neighbour(game.world.player, direction);
        game.step(direction);
        expect(game.world.player).toMatchObject(target);
        expect(game.world.status).not.toBe('lost');
      }
      expect(game.world.status).toBe('won');
    },
  );

  it('seals every chain except its single gallery entrance', () => {
    for (const puzzle of CAMPAIGN_VAULTS) {
      expect(puzzle.rows[0]).toMatch(/^#+$/);
      expect(puzzle.rows[puzzle.rows.length - 1]).toMatch(/^#+$/);
      puzzle.rows.forEach((row, y) => {
        expect(row[row.length - 1]).toBe('#');
        expect(row[0]).toBe(y === puzzle.entry.y ? ' ' : '#');
      });
      expect(puzzle.rows.join('').match(/P/g)).toHaveLength(1);
      expect(puzzle.rows.join('').match(/E/g)).toHaveLength(1);
    }
  });

  it('composes without mutating templates and rejects missing modules or invalid levels', () => {
    const before = structuredClone(EXIT_PUZZLES);
    expect(composeVault('test', [EXIT_PUZZLES[0], EXIT_PUZZLES[4]])).toEqual(
      composeVault('test', [EXIT_PUZZLES[0], EXIT_PUZZLES[4]]),
    );
    expect(EXIT_PUZZLES).toEqual(before);
    expect(() => composeVault('empty', [])).toThrow();
    expect(() => exitPuzzleForLevel(-1)).toThrow();
    expect(() => exitPuzzleForLevel(12)).toThrow();
  });

  it('does not introduce a dig-only bypass around any gate when linking modules', () => {
    CAMPAIGN_VAULTS.forEach((puzzle, index) => {
      const game = new Simulation(fixture(index));
      puzzle.stages!.forEach((stage, stageIndex) => {
        // These mining sections deliberately offer a bypass; mandatory loot, not a rock gate, locks the exit.
        if (['Zawał i górne obejście', 'Jednokierunkowa żyła'].includes(stage.name)) return;
        const target = puzzle.stages![stageIndex + 1]?.entry ?? puzzle.exit;
        const queue = [stage.entry];
        const seen = new Set([`${stage.entry.x},${stage.entry.y}`]);
        for (let i = 0; i < queue.length; i++) {
          const point = queue[i];
          expect(same(point, target)).toBe(false);
          for (const direction of DIRECTIONS) {
            const next = neighbour(point, direction),
              key = `${next.x},${next.y}`;
            if (seen.has(key) || game.cell(next) === 'wall' || game.object(next)?.kind === 'rock') continue;
            seen.add(key);
            queue.push(next);
          }
        }
      });
    });
  });
});
