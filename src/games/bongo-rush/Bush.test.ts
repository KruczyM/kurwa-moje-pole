import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import { BUSH_GROWTH_TICKS } from './types';
import type { LevelDefinition } from './types';
import { loadProgress, HEROES } from './Progress';

/** Provides an open, supported chamber with a buried root beside the player. */
function cave(): LevelDefinition {
  return {
    id: 1,
    title: 'Krzak',
    hint: '',
    biome: 1,
    quota: 1,
    solution: [],
    rows: ['#########', '#       #', '#PK.    #', '#       #', '#     OE#', '#########'],
  };
}

/** Advances active simulation time without relying on wall clocks or a render loop. */
function ticks(game: Simulation, count = BUSH_GROWTH_TICKS): void {
  for (let tick = 0; tick < count; tick++) game.step();
}

describe('buried bush growth', () => {
  it('does not grow or start a timer before it is dug up', () => {
    const game = new Simulation(cave());
    ticks(game, BUSH_GROWTH_TICKS * 5);
    expect(game.world.nextBushGrowth).toBeUndefined();
    expect(game.world.bushRoots).toEqual([]);
    expect(game.cell({ x: 2, y: 2 })).toBe('buried-bush');
  });

  it('activates on digging and waits a full interval before the first simultaneous wave', () => {
    const game = new Simulation(cave());
    game.step('right');
    expect(game.world.bushRoots).toEqual([{ x: 2, y: 2 }]);
    expect(game.world.nextBushGrowth).toBe(1 + BUSH_GROWTH_TICKS);
    ticks(game, BUSH_GROWTH_TICKS - 1);
    expect(game.world.cells).not.toContain('bush');
    ticks(game, 1);
    expect(game.cell({ x: 2, y: 1 })).toBe('bush');
    expect(game.cell({ x: 2, y: 3 })).toBe('bush');
    expect(game.cell({ x: 1, y: 2 })).toBe('bush');
    expect(game.cell({ x: 3, y: 2 })).toBe('soil');
    expect(game.cell({ x: 2, y: 2 })).toBe('air'); // Never overwrites the player.
    expect(game.cell({ x: 3, y: 1 })).toBe('air'); // New cells cannot expand in the same wave.
    ticks(game);
    expect(game.cell({ x: 3, y: 1 })).toBe('bush');
  });

  it('spreads into the vacated root and blocks re-entry without blocking movement away', () => {
    const game = new Simulation(cave());
    game.step('right');
    game.step('right');
    ticks(game);
    expect(game.cell({ x: 2, y: 2 })).toBe('bush');
    game.step('left');
    expect(game.world.player).toMatchObject({ x: 3, y: 2 });
    game.step('right');
    expect(game.world.player).toMatchObject({ x: 4, y: 2 });
  });

  it('never replaces pickups, rocks, enemies, exits, soil or walls', () => {
    const game = new Simulation({
      ...cave(),
      rows: ['#########', '#KRC    #', '#PKO    #', '#  .    #', '#     OE#', '#########'],
    });
    // Freeze only this fixture's patrol by surrounding it; bodies remain on the root frontier.
    game.step('right');
    const rock = game.world.objects.find((body) => body.kind === 'rock')!;
    rock.x = 2;
    rock.y = 1;
    const pickup = game.world.objects.find((body) => body.kind === 'pickup')!;
    pickup.x = 3;
    pickup.y = 2;
    // Occupancy is tested by requesting the growth wave directly on the next simulation tick.
    game.world.nextBushGrowth = game.world.tick + 1;
    game.step();
    expect(game.cell({ x: 2, y: 1 })).toBe('air');
    expect(game.cell({ x: 1, y: 1 })).toBe('buried-bush');
    expect(game.cell({ x: 7, y: 4 })).toBe('exit');
    expect(game.cell({ x: 3, y: 3 })).toBe('soil');
    expect(game.world.enemies).toHaveLength(1);
    expect(game.world.objects).toHaveLength(3);
  });

  it.each(['R', 'O', 'C', '.', '#', 'K', 'E'])('does not grow over adjacent %s', (symbol) => {
    const game = new Simulation({
      ...cave(),
      rows: [
        '#########',
        '#       #',
        `#PK${symbol}    #`,
        '#  #    #',
        `#     O${symbol === 'E' ? ' ' : 'E'}#`,
        '#########',
      ],
    });
    game.step('right');
    const cell = game.cell({ x: 3, y: 2 });
    const body = game.object({ x: 3, y: 2 }) ?? game.enemy({ x: 3, y: 2 });
    game.world.nextBushGrowth = game.world.tick + 1;
    game.step(); // Tick two: red patrol remains stationary; bodies are supported by the wall below.
    expect(game.cell({ x: 3, y: 2 })).toBe(cell);
    expect(game.object({ x: 3, y: 2 }) ?? game.enemy({ x: 3, y: 2 })).toEqual(body);
  });

  it('eventually seals an excavated corridor and restart restores dormant state', () => {
    const level = { ...cave(), rows: ['#########', '#PK   OE#', '#########'] };
    const game = new Simulation(level);
    game.step('right');
    ticks(game, BUSH_GROWTH_TICKS * 7);
    expect(game.cell({ x: 5, y: 1 })).toBe('bush');
    game.step('right');
    expect(game.world.player.x).toBe(2);
    const fresh = new Simulation(level);
    expect(fresh.world.nextBushGrowth).toBeUndefined();
    expect(fresh.world.bushRoots).toEqual([]);
    expect(fresh.cell({ x: 2, y: 1 })).toBe('buried-bush');
  });

  it('has no playable Krzak and rejects an old saved selection without losing progress', () => {
    expect([...HEROES] as string[]).not.toContain('krzak');
    for (const hero of ['krzak', 'kobra']) {
      const progress = loadProgress({
        getItem: () => JSON.stringify({ version: 1, hero, unlocked: 7 }),
      });
      expect(progress.hero).toBe('amper');
      expect(progress.unlocked).toBe(7);
    }
  });
});
