import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import { LEGACY_LEVELS as LEVELS } from './Levels';
import { ambientPhrase, musicPhrase, musicCycleBeats } from './Music';
import { STEP_SECONDS } from './types';
import type { LevelDefinition } from './types';
const CORE_LEVELS = LEVELS.filter((level) => !level.bonus);

/** A safe sealed corridor isolates the active-time clock from gravity and patrols. */
function timed(seconds?: number): LevelDefinition {
  return {
    id: 1,
    title: 'Timer',
    hint: '',
    biome: 0,
    quota: 1,
    solution: [],
    rows: ['#####', '#POE#', '#####'],
    timeLimitSeconds: seconds,
  };
}

describe('active-time deadline', () => {
  it('allows at most five movement steps in one second while keeping the countdown in seconds', () => {
    const game = new Simulation({
      ...timed(180),
      rows: ['############', '#P       OE#', '############'],
    });
    const startX = game.world.player.x;
    for (let elapsed = STEP_SECONDS; elapsed <= 1 + 1e-9; elapsed += STEP_SECONDS) game.step('right');
    expect(game.world.player.x - startX).toBeLessThanOrEqual(5);
    expect(game.world.player.x - startX).toBeGreaterThanOrEqual(4);
    expect(game.remainingSeconds).toBeCloseTo(179);
  });
  it('expires only after the complete allotted simulation ticks', () => {
    const game = new Simulation(timed(STEP_SECONDS * 3));
    game.step();
    game.step();
    expect(game.world.status).toBe('playing');
    expect(game.remainingSeconds).toBeCloseTo(STEP_SECONDS);
    game.step();
    expect(game.world.status).toBe('lost');
    expect(game.remainingSeconds).toBe(0);
    expect(game.world.reason).toContain('Czas minął');
    game.step();
    expect(game.world.tick).toBe(3);
  });
  it('accepts a win on the final allowed tick and resets with a new run', () => {
    const level = timed(STEP_SECONDS * 2);
    const game = new Simulation(level);
    game.step('right');
    game.step('right');
    expect(game.world.status).toBe('won');
    expect(new Simulation(level).remainingSeconds).toBeCloseTo(STEP_SECONDS * 2);
  });
  it('does not count real elapsed time or time without simulation steps', () => {
    const game = new Simulation(timed(180));
    expect(game.remainingSeconds).toBeCloseTo(180, 0);
    for (let read = 0; read < 300; read++) expect(game.world.tick).toBe(0);
    expect(game.remainingSeconds).toBeCloseTo(180, 0);
  });
  it('supports untimed physics fixtures but rejects invalid configured limits', () => {
    expect(new Simulation(timed()).remainingSeconds).toBeUndefined();
    for (const value of [0, -1, NaN, Infinity]) expect(() => new Simulation(timed(value))).toThrow();
  });
  it('gives every authored cave at least four reference-route durations and three minutes', () => {
    for (const level of LEVELS) {
      expect(level.timeLimitSeconds).toBeGreaterThanOrEqual(180);
      expect(level.timeLimitSeconds).toBeGreaterThanOrEqual(level.solution.length * STEP_SECONDS * 4);
    }
  });
});

describe('deliberate Kobra roots', () => {
  it.each(CORE_LEVELS)('keeps level $id viable with short planning pauses at every turn', (level) => {
    const game = new Simulation(level);
    let previous;
    for (const direction of level.solution) {
      if (previous && previous !== direction) {
        game.step();
        game.step();
      }
      game.step(direction);
      previous = direction;
      expect(game.world.status, `${level.id}: ${game.world.reason}`).not.toBe('lost');
    }
    expect(game.world.status).toBe('won');
    expect(game.world.enemies.length).toBeGreaterThan(0);
  });
  for (const level of CORE_LEVELS) {
    it(`keeps spawn safe and authored root activation on level ${level.id}`, () => {
      const game = new Simulation(level);
      const spawn = game.world.player;
      expect(game.cell({ x: spawn.x + 1, y: spawn.y })).not.toBe('buried-bush');
      for (const direction of level.solution) game.step(direction);
      expect(game.world.status).toBe('won');
      expect(game.world.bushRoots.length > 0).toBe([4, 6].includes(level.id));
      if ([4, 6].includes(level.id)) {
        const root = game.world.bushRoots[0];
        expect(root.x).toBe(level.vault!.stages![1].entry.x - 1);
        expect(level.rows[root.y][root.x]).toBe('K');
        expect(level.rows[root.y - 1][root.x]).toBe('#');
        expect(level.rows[root.y + 1][root.x]).toBe('#');
      }
    });
  }
});

describe('ambient score', () => {
  it('repeats composed two-minute arrangements with bounded voices and audible frequencies', () => {
    for (let biome = 0; biome < 4; biome++)
      for (let beat = 0; beat < 16; beat++) {
        const phrase = ambientPhrase(biome, beat);
        expect(phrase).toEqual(ambientPhrase(biome, beat + musicCycleBeats(biome)));
        expect(phrase.length).toBeLessThanOrEqual(3);
        for (const note of phrase) expect(note).toBeGreaterThan(40);
      }
    expect(new Set([0, 1, 2, 3].map((b) => JSON.stringify(musicPhrase(b, 0)))).size).toBe(4);
  });
});
