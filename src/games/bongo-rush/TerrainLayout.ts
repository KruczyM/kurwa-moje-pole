import type { World, TerrainMotif } from './types';

export interface TerrainPlacement {
  cells: Uint8Array;
  accents: number;
  directional: number;
  walls: number;
}

/** Hashing varies surfaces only; architecture is always explicitly placed. */
export function terrainHash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** One quiet material per chamber, with authored continuous structural bands. */
export function buildTerrainLayout(
  world: Pick<World, 'width' | 'height' | 'cells'>,
  seed: number,
  theme = 0,
  authored: readonly TerrainMotif[] = [],
): TerrainPlacement {
  const { width, height, cells } = world;
  const output = new Uint8Array(cells.length);
  const reserved = new Set<number>();
  let walls = 0,
    directional = 0,
    accents = 0;
  cells.forEach((cell, i) => {
    const x = i % width,
      y = Math.floor(i / width);
    output[i] =
      cell === 'wall' ? (theme % 4) * 2 + (terrainHash(x, y, seed) % 2) : 8 + (terrainHash(x, y, seed) % 2);
    if (cell === 'wall') walls++;
  });
  for (const motif of authored) {
    const { x, y } = motif.at;
    if (![x, y, motif.variant].every(Number.isInteger) || motif.variant < 0) continue;
    const dx = motif.kind === 'horizontal' ? 1 : 0,
      dy = motif.kind === 'vertical' ? 1 : 0;
    const length = motif.kind === 'accent' ? 1 : 3;
    const indices = Array.from({ length }, (_, n) => (y + n * dy) * width + x + n * dx);
    if (
      indices.some(
        (i, n) =>
          x + n * dx < 0 ||
          x + n * dx >= width ||
          y + n * dy < 0 ||
          y + n * dy >= height ||
          cells[i] !== 'wall' ||
          reserved.has(i),
      )
    )
      continue;
    const first = length === 1 ? 14 + (motif.variant % 8) : (dx ? 22 : 34) + (motif.variant % 4) * 3;
    indices.forEach((i, n) => {
      output[i] = first + n;
      reserved.add(i);
    });
    if (length === 1) accents++;
    else directional += length;
  }
  return { cells: output, walls, directional, accents };
}
