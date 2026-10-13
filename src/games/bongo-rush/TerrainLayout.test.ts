import { describe, expect, it } from 'vitest';
import { buildTerrainLayout } from './TerrainLayout';
import { LEVELS } from './Levels';
import { Simulation } from './Simulation';
import { biomeTileRect } from './BiomeTiles';

describe('world-anchored biome decoration', () => {
  it.each(LEVELS)('keeps $id immutable and stable, with bounded accents and complete strips', (level) => {
    const world = new Simulation(level).world;
    const original = structuredClone(world);
    const art = buildTerrainLayout(world, level.id * 4 + level.biome);
    expect(art).toEqual(buildTerrainLayout(world, level.id * 4 + level.biome));
    expect(world).toEqual(original);
    expect(art.directional).toBeLessThanOrEqual(Math.floor(art.walls * 0.15));
    expect(art.accents).toBeLessThanOrEqual(Math.floor(art.walls * 0.05));
    expect([...art.cells].filter((cell) => cell === 11).length).toBeLessThanOrEqual(
      Math.floor(art.walls * 0.02),
    );
    let decorative = 0;
    for (let index = 0; index < art.cells.length; index++) {
      const cell = art.cells[index];
      if (world.cells[index] !== 'wall') {
        expect(cell).toBeGreaterThanOrEqual(4);
        expect(cell).toBeLessThanOrEqual(7);
        continue;
      }
      if (cell < 8) continue;
      decorative++;
      const x = index % world.width,
        y = Math.floor(index / world.width);
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ])
        expect(world.cells[(y + dy) * world.width + x + dx]).toBe('wall');
      if ([12, 15].includes(cell))
        expect([...art.cells.slice(index, index + 3)]).toEqual([cell, cell + 1, cell + 2]);
      if ([18, 21].includes(cell))
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
      [80, 3, 12],
      [3, 80, 18],
    ]) {
      const art = buildTerrainLayout({ width, height, cells: Array(width * height).fill('wall') }, 3);
      expect([...art.cells].some((cell) => cell === first || cell === first + 3)).toBe(true);
      expect([...art.cells].some((cell) => (first === 12 ? cell >= 18 : cell >= 12 && cell < 18))).toBe(
        false,
      );
    }
  });
});
