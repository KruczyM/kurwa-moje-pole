import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels';
import { stoneLetters } from './ChallengeCaves';
import { auditDifficulty, runGreedyProbe } from './DifficultyAudit';
import { Simulation } from './Simulation';
import type { Direction, LevelDefinition } from './types';

/** Keeps the rock lettering isolated so a later enemy chamber cannot hide an easy lettering bypass. */
function lettering(): LevelDefinition {
  const puzzle = stoneLetters();
  const rows = puzzle.rows.map((row) => `#${row.slice(1)}`);
  return {
    id: 16,
    title: puzzle.name,
    hint: puzzle.hint,
    biome: 3,
    rows,
    quota: 1,
    requiredPickups: rows.flatMap((row, y) =>
      [...row].flatMap((tile, x) => (tile === 'O' ? [{ x, y }] : [])),
    ),
    solution: puzzle.solution,
  };
}

describe('difficulty regression guards', () => {
  it('puts nine mandatory rewards inside or beside letters, not on the three sweep rows', () => {
    const level = lettering();
    expect(level.requiredPickups!.filter((point) => ![8, 16, 24].includes(point.y))).toHaveLength(9);
    expect(level.requiredPickups).toHaveLength(41);
    expect(auditDifficulty(level).requiredRows).toBeGreaterThanOrEqual(9);
  });

  it('rejects the old one-pass sweep even with an inflated ordinary loot counter', () => {
    const game = new Simulation(lettering());
    game.world.collected = 1000;
    const runs: [Direction, number][] = [
      ['down', 3],
      ['right', 22],
      ['down', 8],
      ['left', 22],
      ['down', 8],
      ['right', 22],
    ];
    for (const [direction, count] of runs) for (let i = 0; i < count; i++) game.step(direction);
    expect(game.world.status).not.toBe('won');
    expect(game.requiredRemaining).toBeGreaterThanOrEqual(9);
    expect(game.exitOpen).toBe(false);
  });

  it('requires push preparation after the spiral instead of treating a long corridor as a puzzle', () => {
    const result = auditDifficulty(LEVELS[14]);
    expect(result.pushes).toBeGreaterThanOrEqual(5);
    expect(result.reversals).toBeGreaterThanOrEqual(5);
    expect(LEVELS[14].vault!.stages).toHaveLength(3);
    expect(LEVELS[14].requiredPickups).toHaveLength(7);
  });

  it.each(LEVELS)('keeps $id solvable and requires more than walking past collectibles', (level) => {
    const result = auditDifficulty(level);
    expect(result.result).toBe('won');
    expect(result.pushes + result.harvests + result.kills).toBeGreaterThan(0);
    expect(result.reversals).toBeGreaterThan(0);
    if (level.style !== 'exploration') expect(runGreedyProbe(level, 1000).status).not.toBe('won');
  });
});
