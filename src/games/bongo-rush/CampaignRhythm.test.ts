import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels';
import { Simulation } from './Simulation';
import { neighbour, same } from './types';
import type { Direction, LevelDefinition } from './types';
import { patrolEncounter, trapInputs, trapLoops } from './PatrolEncounter';
import { auditPatrols } from './DifficultyAudit';

/** Replays only real inputs; no injected counters, enemy poses, object positions or teleporting. */
function replay(level: LevelDefinition, inputs: readonly Direction[], initialWait = 0) {
  const game = new Simulation(level);
  for (let tick = 0; tick < initialWait; tick++) game.step();
  let dropped = new Set<number>();
  let recovered = 0;
  for (const input of inputs) {
    const target = neighbour(game.world.player, input);
    const pickup = game.object(target);
    if (pickup && dropped.has(pickup.id)) recovered++;
    const enemies = new Set(game.world.enemies.map((enemy) => enemy.id));
    game.step(input);
    expect(game.world.status, `${level.id}: ${game.world.reason}`).not.toBe('lost');
    expect(same(game.world.player, target), `${level.id}: blocked ${input}`).toBe(true);
    dropped = new Set([
      ...dropped,
      ...game.world.objects
        .filter((body) => body.kind === 'pickup' && enemies.has(body.id))
        .map((body) => body.id),
    ]);
  }
  expect(game.world.status).toBe('won');
  return { game, recovered };
}

describe('authored campaign rhythm and meaningful patrols', () => {
  it('preserves twelve alternating campaign identities and four separate bonus challenges', () => {
    expect(LEVELS.slice(0, 12).map((level) => level.style)).toEqual(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? 'puzzle' : 'exploration')),
    );
    expect(LEVELS.filter((level) => level.bonus).map((level) => level.id)).toEqual([13, 14, 15, 16]);
    expect(LEVELS.slice(0, 12).map((level) => level.biome)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });

  it.each(LEVELS.filter((level) => level.style === 'exploration'))(
    'supports avoidance and actual recovered kill loot on $id',
    (level) => {
      const avoiding = replay(level, level.solution);
      expect(avoiding.game.world.kills).toBe(0);
      expect(level.requiredKills ?? 0).toBe(0);
      const hunting = replay(level, level.alternatives![0].inputs);
      expect(hunting.game.world.kills).toBe(1);
      expect(hunting.recovered).toBe(1);
      expect(auditPatrols(level, level.alternatives![0].inputs).recoveredDrops).toBe(1);
      expect(hunting.game.world.collected).toBeGreaterThanOrEqual(level.quota);
      expect(level.alternatives![0].inputs).not.toEqual(level.solution);
    },
  );

  it.each(LEVELS.slice(0, 12))(
    'gives every enemy in $id a real non-overlapping circuit and a documented objective',
    (level) => {
      const game = new Simulation(level);
      const ids = game.world.enemies.map((enemy) => enemy.id);
      expect(level.encounters).toHaveLength(ids.length);
      const positions = new Map(ids.map((id) => [id, new Set<string>()]));
      const minimum = new Map(
        game.world.enemies.map((enemy) => {
          const plan = level.encounters!.find((encounter) => same(encounter.spawn, enemy));
          expect(plan?.role.length).toBeGreaterThan(20);
          expect(
            Math.abs(enemy.x - game.world.player.x) + Math.abs(enemy.y - game.world.player.y),
          ).toBeGreaterThanOrEqual(5);
          return [enemy.id, plan!.minimumCircuit];
        }),
      );
      for (let tick = 0; tick < 120; tick++) {
        game.step();
        expect(game.world.status).toBe('playing');
        expect(new Set(game.world.enemies.map((enemy) => `${enemy.x},${enemy.y}`)).size).toBe(ids.length);
        for (const enemy of game.world.enemies) positions.get(enemy.id)!.add(`${enemy.x},${enemy.y}`);
      }
      for (const id of ids) expect(positions.get(id)!.size).toBeGreaterThanOrEqual(minimum.get(id)!);
    },
  );

  it.each([0, 2, 4])('allows %s safe initial planning ticks on all avoidance routes', (wait) => {
    for (const level of LEVELS.slice(0, 12)) replay(level, level.solution, wait);
  });

  it.each(LEVELS.filter((level) => level.style === 'puzzle'))(
    'makes the guarded shortcut useful without skipping the puzzle on $id',
    (level) => {
      const shortcut: Direction[] = [
        ...Array<Direction>(9).fill('right'),
        ...Array<Direction>(4).fill('up'),
        ...Array<Direction>(3).fill('right'),
      ];
      const route = [...shortcut, ...level.solution.slice(24)];
      expect(route.length).toBe(level.solution.length - 8);
      let wins = 0;
      for (let phase = 0; phase < 48; phase++) {
        const game = new Simulation(level);
        for (let tick = 0; tick < phase; tick++) game.step();
        for (const direction of route) game.step(direction);
        if (game.world.status === 'won') wins++;
      }
      expect(wins).toBeGreaterThan(0);
    },
  );

  it('validates the trap at multiple patrol phases, including Undercover sight reactions', () => {
    for (const symbol of ['C', 'B', 'U'] as const) {
      const puzzle = patrolEncounter(symbol);
      for (let phase = 0; phase < 96; phase++) {
        // Undercover has two sight-reaction parities: wait one tick before opening on the other.
        const opening = symbol === 'U' && phase % 2 === 0 ? phase + 1 : phase;
        const rows = puzzle.rows.map((row) => `#${row.slice(1)}`);
        const result = replay(
          { id: 1, title: '', hint: '', biome: 0, quota: 2, rows, solution: [] },
          trapInputs(trapLoops(symbol, opening)),
          opening,
        );
        expect(result.game.world.kills).toBe(1);
        expect(result.recovered).toBe(1);
      }
    }
  });
});
