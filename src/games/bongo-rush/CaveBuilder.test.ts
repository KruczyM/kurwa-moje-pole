import { describe, expect, it } from 'vitest';
import { CAVE_SKETCHES, LEGACY_LEVELS as LEVELS } from './Levels';
import { buildCave } from './CaveBuilder';
import { createWorld, Simulation } from './Simulation';
import { DIRECTIONS, neighbour } from './types';
const CORE_LEVELS = LEVELS.filter((level) => !level.bonus);

describe('expanded original caves', () => {
  it('uses fixed authored sketches and never varies geology across restarts', () => {
    CAVE_SKETCHES.forEach((sketch, index) => expect(buildCave(sketch, index)).toEqual(LEVELS[index]));
  });

  it('alternates large optional mining networks and compact puzzle wings without a length-based difficulty claim', () => {
    for (const level of CORE_LEVELS) {
      const w = createWorld(level);
      expect(level.style).toBe(level.id % 2 ? 'exploration' : 'puzzle');
      if (level.style === 'exploration') {
        expect(w.width * w.height).toBeGreaterThan(3000);
        expect(w.objects.filter((o) => o.kind === 'pickup').length).toBeGreaterThan(level.quota);
        expect(level.alternatives).toHaveLength(1);
        expect(level.requiredPickups).toHaveLength(0);
      } else {
        expect(w.height).toBeLessThanOrEqual(16);
        expect(level.solution.length).toBeLessThan(200);
        expect(level.requiredPickups!.length).toBeGreaterThan(0);
      }
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

  it.each(CORE_LEVELS.filter((level) => level.style === 'puzzle' && level.id !== 4))(
    'requires real pushes on puzzle $id rather than just a longer corridor',
    (level) => {
      const game = new Simulation(level);
      let pushes = 0;
      for (const input of level.solution) {
        game.step(input);
        pushes += game.drainSounds().filter((sound) => sound === 'push').length;
      }
      expect(pushes, `no push puzzle in ${level.id}`).toBeGreaterThanOrEqual(2);
      expect(game.world.status).toBe('won');
    },
  );
});
