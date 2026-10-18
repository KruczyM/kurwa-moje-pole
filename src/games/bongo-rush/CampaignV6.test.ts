import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import proofs from './data/campaign-v6-proofs.json';
import failures from './data/campaign-v6-failures.json';
import alternates from './data/campaign-v6-alternates.json';
import { LEVELS } from './Levels';
import { openings } from '../../../scripts/bongo-v6/exposure';
import { adaptGrid, availableLoot, buildCampaignV6 } from './CampaignV6';
import { createWorld, Simulation } from './Simulation';
import { DIRECTIONS, neighbour } from './types';
import type { Direction, LevelDefinition, ReplayInput } from './types';

const levels = buildCampaignV6();
const input = (value: string | null): ReplayInput => {
  if (value === null) return undefined;
  if (!DIRECTIONS.includes(value as Direction)) throw new Error(`Invalid recorded input ${value}`);
  return value as Direction;
};

// Full dense-cave replays can exceed 5 seconds on loaded CI workers; keep their assertions intact.
describe('recorded v6 production proofs', { timeout: 30_000 }, () => {
  it('covers all twenty-four levels with a victory and a fatal decision', () => {
    const ids = levels.map((level) => String(level.id));
    expect(Object.keys(proofs)).toEqual(ids);
    expect(Object.keys(failures)).toEqual(ids);
    expect(
      Object.keys(alternates)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([1, 9, 14, 19]);
  });
  it('catches the falling eastern pickup and reverses the final outlet order on alternate 9', () => {
    const observe = (inputs: readonly (string | null)[]) => {
      const game = new Simulation(levels[8]);
      const times = new Map<number, number>();
      let catchPosition: { x: number; y: number } | undefined;
      let easternFall = false;
      for (const d of inputs) {
        const objectBefore = game.world.objects.find((o) => o.id === 304);
        const before = objectBefore ? { ...objectBefore } : undefined;
        game.step(input(d));
        const after = game.world.objects.find((o) => o.id === 304);
        if (before && after && before.y < after.y) easternFall = true;
        if (before && !after) catchPosition = { x: game.world.player.x, y: game.world.player.y };
        for (const id of [234, 235])
          if (!times.has(id) && !game.world.objects.some((o) => o.id === id)) times.set(id, game.ticks);
      }
      expect(game.world.status).toBe('won');
      return { catchPosition, easternFall, times };
    };
    const primary = observe(proofs['9'].inputs),
      alternate = observe(alternates['9'].inputs);
    expect(primary.catchPosition).toEqual({ x: 38, y: 12 });
    expect(primary.easternFall).toBe(false);
    expect(alternate.catchPosition).toEqual({ x: 38, y: 13 });
    expect(alternate.easternFall).toBe(true);
    expect(primary.times.get(234)).toBeLessThan(primary.times.get(235)!);
    expect(alternate.times.get(235)).toBeLessThan(alternate.times.get(234)!);
  });
  it('uses the western crossing and lower return before collecting the central goal on alternate 14', () => {
    const level = levels[13];
    const checkpoints = (inputs: readonly (string | null)[]) => {
      const game = new Simulation(level);
      const west = game.object({ x: 6, y: 6 })!.id,
        central = game.object({ x: 14, y: 13 })!.id;
      const times = new Map<number, number>();
      let crossing = -1,
        lower = -1;
      inputs.forEach((d, tick) => {
        game.step(input(d));
        for (const id of [west, central])
          if (!times.has(id) && !game.world.objects.some((o) => o.id === id)) times.set(id, tick);
        if (crossing < 0 && game.world.player.x === 12 && game.world.player.y === 12) crossing = tick;
        if (lower < 0 && game.world.player.x === 15 && game.world.player.y === 15) lower = tick;
      });
      expect(game.world.status).toBe('won');
      expect(times.size).toBe(2);
      return { west: times.get(west)!, central: times.get(central)!, crossing, lower };
    };
    const primary = checkpoints(proofs['14'].inputs),
      alternate = checkpoints(alternates['14'].inputs);
    expect(primary.central).toBeLessThan(primary.west);
    expect(alternate.crossing).toBeGreaterThanOrEqual(0);
    expect(alternate.crossing).toBeLessThan(alternate.west);
    expect(alternate.west).toBeLessThan(alternate.lower);
    expect(alternate.lower).toBeLessThan(alternate.central);
  });
  it('collects the eastern upper goal before the western one on the level 19 alternate', () => {
    const level = levels[18];
    const collectionTicks = (inputs: readonly (string | null)[]) => {
      const game = new Simulation(level);
      const west = game.object({ x: 14, y: 5 })!.id;
      const east = game.object({ x: 24, y: 8 })!.id;
      const times = new Map<number, number>();
      const nests = new Set<string>();
      inputs.forEach((d, tick) => {
        game.step(input(d));
        for (const id of [west, east])
          if (!times.has(id) && !game.world.objects.some((o) => o.id === id)) times.set(id, tick);
        for (const e of openings(game)) {
          const key = `${e.chamber}:${e.x},${e.y}`;
          if (nests.has(key)) continue;
          expect(e.fractionOfQuota).toBeGreaterThanOrEqual(0.45);
          expect(e.fractionOfQuota).toBeLessThanOrEqual(0.6);
          nests.add(key);
        }
      });
      expect(nests.size).toBe(1);
      expect(game.world.status).toBe('won');
      expect(times.size).toBe(2);
      return { west: times.get(west)!, east: times.get(east)! };
    };
    const main = collectionTicks(proofs['19'].inputs);
    const alternate = collectionTicks(alternates['19'].inputs);
    expect(main.west).toBeLessThan(main.east);
    expect(alternate.east).toBeLessThan(alternate.west);
  });
  it('approaches the central goal from the east on the level 1 alternate', () => {
    const game = new Simulation(levels[0]);
    const central = game.object({ x: 17, y: 10 })!.id;
    let east = -1,
      collected = -1;
    alternates['1'].inputs.forEach((d, index) => {
      game.step(input(d));
      if (east < 0 && game.world.player.x === 24 && game.world.player.y === 10) east = index;
      if (collected < 0 && !game.world.objects.some((o) => o.id === central)) collected = index;
    });
    expect(east).toBeGreaterThanOrEqual(0);
    expect(collected).toBeGreaterThan(east);
    expect(game.world.status).toBe('won');
  });
  it.each([6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 19, 20])(
    'opens every colony in the reference window on level %s',
    (id) => {
      const level = levels[id - 1];
      const proof = proofs[String(id) as keyof typeof proofs];
      const game = new Simulation(level),
        seen = new Set<string>();
      for (const d of proof.inputs) {
        game.step(input(d));
        for (const e of openings(game)) {
          const key = `${e.chamber}:${e.x},${e.y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          expect(e.fractionOfQuota).toBeGreaterThanOrEqual(0.45);
          expect(e.fractionOfQuota).toBeLessThanOrEqual(0.6);
        }
      }
      expect(game.world.status).toBe('won');
      expect(seen.size).toBe(
        [level, ...(level.chambers ?? [])].reduce(
          (n, r) => n + [...r.rows.join('')].filter((c) => c === 'V').length,
          0,
        ),
      );
    },
  );
  it.each(Object.entries(alternates))('wins an alternate collection order on level %s', (id, proof) => {
    const level = levels[Number(id) - 1];
    expect(
      createHash('sha256')
        .update(JSON.stringify({ ...level, solution: [], replay: [] }))
        .digest('hex'),
    ).toBe(proof.sha256);
    const order = (inputs: readonly (string | null)[]) => {
      const game = new Simulation(level),
        collected: number[] = [];
      for (const d of inputs) {
        const before = game.world.objects.filter((o) => o.kind === 'pickup').map((o) => o.id);
        game.step(input(d));
        for (const id of before) if (!game.world.objects.some((o) => o.id === id)) collected.push(id);
      }
      expect(game.world.status).toBe('won');
      expect(game.requiredRemaining).toBe(0);
      return collected;
    };
    expect(order(proof.inputs)).not.toEqual(order(proofs[id as keyof typeof proofs].inputs));
  });
  it.each(Object.entries(proofs))(
    'freshly wins recorded level %s without mutating game state',
    (id, proof) => {
      const level = levels[Number(id) - 1];
      const geometry = { ...level, solution: [], replay: [] };
      expect(createHash('sha256').update(JSON.stringify(geometry)).digest('hex')).toBe(proof.sha256);
      const game = new Simulation(level);
      for (const recorded of proof.inputs) {
        game.step(input(recorded));
        expect(game.world.status).not.toBe('lost');
      }
      expect(game.world.status).toBe('won');
      expect(game.requiredRemaining).toBe(0);
      expect(game.world.collected).toBeGreaterThanOrEqual(level.quota);
      expect(game.world.kills).toBeGreaterThanOrEqual(level.requiredKills ?? 0);
      if (level.gate) expect(game.world.trapped).toBe(true);
    },
  );

  it.each(Object.entries(failures))('records a concrete fatal decision on level %s', (id, failure) => {
    const game = new Simulation(levels[Number(id) - 1]);
    for (const recorded of failure.inputs) game.step(input(recorded));
    expect(game.world.status).toBe('lost');
    expect(game.world.reason).toBe(failure.reason);
  });
});

describe('v6 candidate campaign data', () => {
  it('selects the verified authored v6 campaign in the actual game host', () => {
    expect(LEVELS).toEqual(levels);
  });
  it('loads twenty main caves and four challenges, with exactly the two planned portal networks', () => {
    expect(levels.map((l) => l.id)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(levels.filter((l) => l.bonus).map((l) => l.id)).toEqual([21, 22, 23, 24]);
    expect(levels.filter((l) => l.portals?.length).map((l) => l.id)).toEqual([12, 18]);
    for (const level of levels) expect(() => new Simulation(level)).not.toThrow();
  });

  it('adapts empty fields and derives mandatory pickup identities from O', () => {
    const adapted = adaptGrid(['#######', '#P_OQE#', '#######']);
    expect(adapted.requiredPickups).toEqual([{ x: 3, y: 1 }]);
    expect(adapted.rows[1]).toBe('#P OQE#');
    expect(createWorld({ ...levels[0], ...adapted, quota: 1 }).objects[0].required).toBe(true);
  });

  it.each(levels)('uses exact 85% quota and sealed colonies on level $id', (level) => {
    expect(level.quota).toBe(Math.ceil((85 * availableLoot(level)) / 100));
    const rooms = [level, ...(level.chambers ?? [])];
    for (const room of rooms) {
      const width = room.rows[0].length;
      room.rows.forEach((row, y) => {
        expect(row.length).toBe(width);
        [...row].forEach((c, x) => {
          if (c !== 'V') return;
          const adjacent = DIRECTIONS.map((d) => neighbour({ x, y }, d)).map((p) => room.rows[p.y][p.x]);
          expect(adjacent.filter((v) => v === '#')).toHaveLength(3);
          expect(adjacent.filter((v) => 'OQR'.includes(v))).toHaveLength(1);
        });
      });
      for (const view of room.scenery?.views ?? []) {
        expect(view.mask.length).toBeGreaterThan(0);
        for (const p of view.mask) {
          expect(room.rows[p.y]?.[p.x]).toBe('#');
          expect(p.x).toBeGreaterThanOrEqual(view.bounds.x);
          expect(p.y).toBeGreaterThanOrEqual(view.bounds.y);
          expect(p.x).toBeLessThan(view.bounds.x + view.bounds.width);
          expect(p.y).toBeLessThan(view.bounds.y + view.bounds.height);
        }
      }
    }
    // Gravity can run, but no nest is released by the initial layout itself.
    const game = new Simulation(level);
    const before = game.world.cells.filter((c) => c === 'bush').length;
    for (let tick = 0; tick < 100; tick++) game.step();
    expect(game.world.cells.filter((c) => c === 'bush')).toHaveLength(before);
  });

  it('preserves reference dimensions, counts, elimination requirements and boss architecture', () => {
    for (const id of [1, 4, 9, 13, 14, 16, 19]) {
      expect(levels[id - 1].rows).toHaveLength(22);
      expect(levels[id - 1].rows.every((row) => row.length === 40)).toBe(true);
    }
    expect(levels[6].requiredPickups).toHaveLength(5);
    expect(levels[21].requiredKills).toBe(6);
    expect(levels[23].requiredPickups).toHaveLength(18);
    const final = levels[19];
    expect(final.rows).toHaveLength(20);
    expect(final.rows[1][34]).toBe('J');
    expect(final.rows[5][31]).toBe('R');
    expect(final.rows[6][32]).toBe('E');
    expect(final.gate).toEqual({ x: 33, y: 5 });
    expect(final.pen).toHaveLength(8);
  });
});

describe('v6 simulation compatibility', () => {
  it('counts ordinary chamber pickups and chamber enemy loot when validating quota', () => {
    const level: LevelDefinition = {
      id: 1,
      title: '',
      hint: '',
      biome: 0,
      quota: 4,
      solution: [],
      rows: ['#######', '#P.Q.E#', '#######'],
      chambers: [{ id: 'side', name: '', hint: '', rows: ['#######', '#P.QQC#', '#######'] }],
    };
    expect(() => new Simulation(level)).not.toThrow();
    expect(() => new Simulation({ ...level, quota: 5 })).toThrow(/wystarczającą/);
  });

  it('requires loot from the first required elimination but keeps extra kill loot optional', () => {
    const game = new Simulation({
      id: 1,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      requiredKills: 1,
      rows: [
        '#########',
        '#R#R#####',
        '# # #####',
        '#C#S#####',
        '# # #####',
        '#########',
        '#PQE#####',
        '#########',
      ],
    });
    game.step();
    game.step();
    expect(game.world.kills).toBe(2);
    const loot = game.world.objects.filter((o) => o.kind === 'pickup' && o.y === 2);
    expect(loot).toHaveLength(2);
    expect(loot.filter((o) => o.required)).toHaveLength(1);
  });
});
