import { describe, expect, it } from 'vitest';
import { CAVE_WALL_STYLES, paintCaveTile } from './CaveVisuals';

/** Records geometry rather than colours: changing a palette alone cannot satisfy distinct-biome tests. */
function geometry(biome: number, kind: 'wall' | 'soil', variant = 0): string {
  const calls: unknown[] = [];
  const context = new Proxy(
    {},
    {
      set: () => true,
      get:
        (_, property) =>
        (...args: unknown[]) => {
          if (property === 'createLinearGradient') return { addColorStop: () => undefined };
          calls.push([property, ...args]);
        },
    },
  ) as CanvasRenderingContext2D;
  paintCaveTile(context, biome, kind, variant);
  return JSON.stringify(calls);
}

describe('biome construction languages', () => {
  it('uses four different wall geometries, not just palette changes', () => {
    expect(new Set(CAVE_WALL_STYLES).size).toBe(4);
    expect(new Set([0, 1, 2, 3].map((biome) => geometry(biome, 'wall'))).size).toBe(4);
  });
  it('distinguishes diggable soil from solid walls and from other biomes', () => {
    expect(new Set([0, 1, 2, 3].map((biome) => geometry(biome, 'soil'))).size).toBe(4);
    for (let biome = 0; biome < 4; biome++) expect(geometry(biome, 'wall')).not.toBe(geometry(biome, 'soil'));
  });
  it('rebuilds identical cached variants deterministically', () => {
    for (let biome = 0; biome < 4; biome++) {
      expect(geometry(biome, 'wall', 2)).toBe(geometry(biome, 'wall', 2));
      expect(geometry(biome, 'wall', 0)).not.toBe(geometry(biome, 'wall', 2));
    }
  });
});
