import { describe, expect, it } from 'vitest';
import { buildTerrainLayout } from './TerrainLayout';
import { LEVELS } from './Levels';
import { Simulation } from './Simulation';
import { biomeTileRect } from './BiomeTiles';

describe('world-anchored biome decoration', () => {
  it('preserves authored visible landmarks and ignores a strip crossing an open tunnel', () => {
    const level = LEVELS[0];
    const world = new Simulation(level).world;
    const art = buildTerrainLayout(world, level.id * 4 + level.biome, level.terrainTheme, level.decorations);
    expect([0, 1, 2].map((n) => art.cells[(6 + n) * world.width + 1])).toEqual([34, 35, 36]);
    expect([...art.cells.slice(4 * world.width + 4, 4 * world.width + 7)]).toEqual([25, 26, 27]);
    expect(art.cells[10 * world.width + 4]).toBe(16);
    const tunnel = { width: 3, height: 3, cells: Array(9).fill('wall') as ('wall' | 'air')[] };
    tunnel.cells[4] = 'air';
    const rejected = buildTerrainLayout(tunnel, 1, 0, [
      { at: { x: 0, y: 1 }, kind: 'horizontal', variant: 0 },
    ]);
    expect(rejected.cells[4]).toBeGreaterThanOrEqual(8);
    expect(rejected.cells[4]).toBeLessThan(14);
  });

  it('resolves all fifty v4 regions without sampling unused atlas cells', () => {
    const rects = Array.from({ length: 50 }, (_, cell) => biomeTileRect(1024, 896, 'wall', cell));
    expect(new Set(rects.map((rect) => `${rect.x},${rect.y}`)).size).toBe(50);
    for (const rect of rects) expect(rect.y + rect.height).toBeLessThanOrEqual(896);
    expect(
      new Set(Array.from({ length: 6 }, (_, n) => JSON.stringify(biomeTileRect(1024, 896, 'soil', 8 + n))))
        .size,
    ).toBe(6);
  });
  it.each(LEVELS)('keeps $id immutable and stable, with bounded accents and complete strips', (level) => {
    const world = new Simulation(level).world;
    const original = structuredClone(world);
    const art = buildTerrainLayout(world, level.id * 4 + level.biome);
    expect(art).toEqual(buildTerrainLayout(world, level.id * 4 + level.biome));
    expect(world).toEqual(original);
    expect(art.directional).toBeLessThanOrEqual(Math.floor(art.walls * 0.2));
    expect(art.accents).toBeLessThanOrEqual(Math.floor(art.walls * 0.08));
    let decorative = 0;
    for (let index = 0; index < art.cells.length; index++) {
      const cell = art.cells[index];
      if (world.cells[index] !== 'wall') {
        expect(cell).toBeGreaterThanOrEqual(8);
        expect(cell).toBeLessThanOrEqual(13);
        continue;
      }
      if (cell < 14) continue;
      decorative++;
      if ([22, 25, 28, 31].includes(cell))
        expect([...art.cells.slice(index, index + 3)]).toEqual([cell, cell + 1, cell + 2]);
      if ([34, 37, 40, 43].includes(cell))
        expect([0, 1, 2].map((n) => art.cells[index + n * world.width])).toEqual([cell, cell + 1, cell + 2]);
    }
    expect(decorative).toBe(art.accents + art.directional);
    expect(decorative).toBeGreaterThan(0);
  });

  it('resolves twenty-four distinct cells and retains legacy fixture atlas compatibility', () => {
    const rects = Array.from({ length: 24 }, (_, cell) => biomeTileRect(768, 512, 'wall', cell));
    expect(new Set(rects.map((r) => `${r.x},${r.y}`)).size).toBe(24);
    for (const rect of rects) {
      expect(rect.width).toBe(128);
      expect(rect.x + 128).toBeLessThanOrEqual(768);
      expect(rect.y + 128).toBeLessThanOrEqual(512);
    }
    expect(biomeTileRect(1024, 1024, 'soil', 1)).toEqual({ x: 512, y: 512, width: 512, height: 512 });
  });

  it('fits narrow horizontal/vertical solid bands without dangling pieces at the boundary', () => {
    for (const [width, height, first] of [
      [80, 3, 22],
      [3, 80, 34],
    ]) {
      const art = buildTerrainLayout({ width, height, cells: Array(width * height).fill('wall') }, 3);
      expect([...art.cells].some((cell) => [first, first + 3, first + 6, first + 9].includes(cell))).toBe(
        true,
      );
      expect(
        [...art.cells].some((cell) => (first === 22 ? cell >= 34 && cell < 46 : cell >= 22 && cell < 34)),
      ).toBe(false);
    }
  });
});
