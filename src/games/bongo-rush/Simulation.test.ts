import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels';
import { createWorld, Simulation } from './Simulation';
import type { LevelDefinition } from './types';

/** Makes compact physics fixtures with a supported pickup and one exit. */
function fixture(rows: string[], quota = 1): LevelDefinition {
  return { id: 1, title: 'test', hint: '', biome: 0, rows, quota, solution: [] };
}

describe('Bongo Rush original campaign', () => {
  it('has twelve distinct closed caves and three levels in each biome', () => {
    expect(LEVELS).toHaveLength(12);
    expect(new Set(LEVELS.map((level) => level.rows.join('\n'))).size).toBe(12);
    for (let biome = 0; biome < 4; biome++)
      expect(LEVELS.filter((level) => level.biome === biome)).toHaveLength(3);
    LEVELS.forEach(createWorld);
  });
  for (const level of LEVELS) {
    it(`recorded solution completes ${level.id}: ${level.title} without teleporting`, () => {
      const game = new Simulation(level);
      for (const [tick, input] of level.solution.entries()) {
        game.step(input);
        expect(
          game.world.status,
          `input ${tick} ${input}; player ${game.world.player.x},${game.world.player.y}; ${game.world.reason}`,
        ).not.toBe('lost');
      }
      expect(
        game.world.status,
        `ended ${game.world.player.x},${game.world.player.y}, pickups ${game.world.collected}; objects ${JSON.stringify(game.world.objects)}`,
      ).toBe('won');
      expect(game.world.collected).toBeGreaterThanOrEqual(level.quota);
      if (level.id === 12) expect(game.world.trapped).toBe(true);
    });
  }
});

describe('deterministic grid physics', () => {
  it('gives newly opened passages one reaction tick before a patrol can enter', () => {
    const game = new Simulation(fixture(['########', '#  C   #', '#P.O E #', '########']));
    game.step('right');
    game.step('right');
    expect(game.world.status).toBe('playing');
  });
  it('undercover detects only unobstructed straight sight and stops chasing behind soil', () => {
    const game = new Simulation(fixture(['#########', '#U   P  #', '#  OE   #', '#########']));
    game.step();
    game.step();
    expect(game.world.enemies[0].chasing).toBe(true);
    game.world.cells[1 * game.world.width + 3] = 'soil';
    game.step();
    game.step();
    expect(game.world.enemies[0].chasing).toBe(false);
  });
  it('red and blue patrols follow opposite wall hands', () => {
    const red = new Simulation(fixture(['#########', '#       #', '#  C    #', '#P  OE  #', '#########']));
    const blue = new Simulation(fixture(['#########', '#       #', '#  B    #', '#P  OE  #', '#########']));
    red.step();
    red.step();
    red.step();
    blue.step();
    blue.step();
    expect(red.world.enemies[0].x).toBe(4);
    expect(blue.world.enemies[0].x).toBe(2);
  });
  it('object array order cannot alter gravity outcomes', () => {
    const level = fixture(['#########', '# R R   #', '#       #', '#       #', '#P  OE  #', '#########']);
    const a = new Simulation(level),
      b = new Simulation(level);
    b.world.objects.reverse();
    a.step();
    b.step();
    expect([...a.world.objects].sort((x, y) => x.id - y.id)).toEqual(
      [...b.world.objects].sort((x, y) => x.id - y.id),
    );
  });
  it('the final exit remains locked after quota until the pen is sealed', () => {
    const game = new Simulation(LEVELS[11]);
    game.world.collected = 5;
    expect(game.exitOpen).toBe(false);
    expect(game.world.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(1);
    expect(LEVELS.slice(0, 11).every((level) => !level.rows.some((row) => row.includes('J')))).toBe(true);
  });
  it('digs, collects, opens exit and stops after winning', () => {
    const game = new Simulation(fixture(['#######', '#P.OE #', '#######']));
    game.step('right');
    expect(game.cell({ x: 2, y: 1 })).toBe('air');
    game.step('right');
    expect(game.exitOpen).toBe(true);
    game.step('right');
    expect(game.world.status).toBe('won');
    const snapshot = structuredClone(game.world);
    game.step('left');
    expect(game.world).toEqual(snapshot);
    expect(game.drainSounds()).toContain('won');
    expect(game.drainSounds()).toEqual([]);
  });
  it('pushes a single rock horizontally once per tick, never into dirt or another rock', () => {
    const game = new Simulation(fixture(['########', '#PR  OE#', '########']));
    game.step('right');
    expect(game.object({ x: 3, y: 1 })?.kind).toBe('rock');
    game.step('right');
    expect(game.object({ x: 4, y: 1 })?.kind).toBe('rock');
    game.step('right');
    expect(game.world.player.x).toBe(3);
    const dirt = new Simulation(fixture(['########', '#PR. OE#', '########']));
    dirt.step('right');
    expect(dirt.world.player.x).toBe(1);
  });
  it('falls only one tile per tick and crushes a player only while falling', () => {
    const game = new Simulation(fixture(['#######', '# R   #', '#     #', '# P OE#', '#######']));
    game.step();
    expect(game.object({ x: 2, y: 2 })?.falling).toBe(true);
    game.step();
    expect(game.world.status).toBe('lost');
    const supported = new Simulation(fixture(['#######', '# R   #', '# P   #', '#  OE #', '#######']));
    supported.step();
    expect(supported.world.status).toBe('playing');
  });
  it('rolls off a rounded support and does not move a body twice', () => {
    const game = new Simulation(
      fixture(['########', '#  R   #', '#  R   #', '#  #   #', '#P  OE #', '########']),
    );
    game.step();
    expect(game.object({ x: 2, y: 1 })?.falling).toBe(true);
    expect(game.object({ x: 2, y: 2 })).toBeUndefined();
  });
  it('falling rocks remove a patrol, whereas touching a patrol loses', () => {
    const game = new Simulation(fixture(['########', '# R    #', '#      #', '# C POE#', '########']));
    game.step();
    game.step();
    expect(game.world.enemies).toHaveLength(0);
    const contact = new Simulation(fixture(['#######', '#PC OE#', '#######']));
    contact.step('right');
    expect(contact.world.status).toBe('lost');
  });
  it('restarts without retaining mutations and rejects invalid maps', () => {
    const level = fixture(['#######', '#P.OE #', '#######']);
    const first = new Simulation(level);
    first.step('right');
    expect(new Simulation(level).world).toEqual(createWorld(level));
    expect(() => createWorld(fixture(['#P#', '#OE', '###']))).toThrow();
  });
});
