import { describe, expect, it } from 'vitest';
import { CAVE_SKETCHES, LEVELS } from './Levels';
import { buildCave } from './CaveBuilder';
import { createWorld, Simulation } from './Simulation';
import { DIRECTIONS, neighbour } from './types';

describe('expanded original caves', () => {
  it('uses fixed authored sketches and never varies geology across restarts', () => {
    CAVE_SKETCHES.forEach((sketch, index) => expect(buildCave(sketch, index)).toEqual(LEVELS[index]));
  });

  it('grows from 63x34 to 77x44 including the exit vault, with larger objectives and optional deposits', () => {
    expect(LEVELS[0].rows[0].length).toBe(63);
    expect(LEVELS[0].rows).toHaveLength(34);
    expect(LEVELS[11].rows[0].length).toBe(77);
    expect(LEVELS[11].rows).toHaveLength(44);
    for (const level of LEVELS) {
      const w = createWorld(level);
      expect(w.width * w.height).toBeGreaterThan(24 * 18 * 3.5);
      expect(level.quota).toBeGreaterThanOrEqual(18);
      expect(w.objects.filter((o) => o.kind === 'pickup').length).toBeGreaterThan(level.quota + 8);
      expect(w.objects.filter((o) => o.kind === 'rock').length).toBeGreaterThan(30);
      expect(level.solution.length).toBeGreaterThan(250);
    }
  });

  it('connects every chamber, branch, deposit and exit through terrain and provides actual loops', () => {
    for (const level of LEVELS) {
      const game = new Simulation(level),
        w = game.world;
      const queue = [{ x: w.player.x, y: w.player.y }];
      const seen = new Set<number>([w.player.y * w.width + w.player.x]);
      let edges = 0;
      for (let index = 0; index < queue.length; index++) {
        for (const direction of DIRECTIONS) {
          const p = neighbour(queue[index], direction);
          if (game.cell(p) === 'wall') continue;
          edges++;
          const key = p.y * w.width + p.x;
          if (!seen.has(key)) {
            seen.add(key);
            queue.push(p);
          }
        }
      }
      expect(seen.size, `disconnected terrain in cave ${level.id}`).toBe(
        w.cells.filter((c) => c !== 'wall').length,
      );
      expect(edges / 2).toBeGreaterThan(seen.size); // More than a tree: real alternative routes.
    }
  });

  it('requires using real pushes on every recorded solution, not just walking a longer corridor', () => {
    for (const level of LEVELS) {
      const game = new Simulation(level);
      let pushes = 0;
      for (const input of level.solution) {
        game.step(input);
        pushes += game.drainSounds().filter((sound) => sound === 'push').length;
      }
      expect(pushes, `no push puzzle in ${level.id}`).toBeGreaterThanOrEqual(3);
      expect(game.world.status).toBe('won');
    }
  });
});
