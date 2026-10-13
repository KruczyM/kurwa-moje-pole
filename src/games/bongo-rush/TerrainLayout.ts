import type { World, TerrainMotif } from './types';

export interface TerrainPlacement {
  cells: Uint8Array;
  accents: number;
  directional: number;
  walls: number;
}

/** Fixed integer hashing anchors art in the world, not in the viewport or simulation clock. */
export function terrainHash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Builds decoration once per fresh world; never changes cells, collision or hidden roots. */
export function buildTerrainLayout(
  world: Pick<World, 'width' | 'height' | 'cells'>,
  seed: number,
  theme = 0,
  authored: readonly TerrainMotif[] = [],
): TerrainPlacement {
  const { width, height, cells } = world;
  const output = new Uint8Array(cells.length);
  const reserved = new Set<number>();
  const candidates: { x: number; y: number; hash: number }[] = [];
  let walls = 0,
    directional = 0,
    accents = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      output[index] =
        cells[index] === 'wall'
          ? ((Math.floor(x / 4) + Math.floor(y / 5) + theme) % 4) * 2 + (terrainHash(x, y, seed) % 2)
          : 8 + (terrainHash(x, y, seed) % 6);
      if (cells[index] === 'wall') {
        walls++;
        candidates.push({ x, y, hash: terrainHash(x, y, seed + 19) });
      }
    }
  candidates.sort((a, b) => a.hash - b.hash || a.y - b.y || a.x - b.x);
  const fits = (x: number, y: number, dx: number, dy: number, length: number) => {
    for (let n = 0; n < length; n++)
      for (let oy = 0; oy <= 0; oy++)
        for (let ox = 0; ox <= 0; ox++) {
          const nx = x + n * dx + ox,
            ny = y + n * dy + oy;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= width ||
            ny >= height ||
            cells[ny * width + nx] !== 'wall' ||
            reserved.has(ny * width + nx)
          )
            return false;
        }
    return true;
  };
  const reserve = (x: number, y: number, dx: number, dy: number, length: number) => {
    for (let n = 0; n < length; n++)
      for (let oy = 0; oy <= 0; oy++)
        for (let ox = 0; ox <= 0; ox++) reserved.add((y + n * dy + oy) * width + x + n * dx + ox);
  };
  const span = (x: number, y: number, dx: number, dy: number) => {
    let length = 1;
    for (const sign of [-1, 1])
      for (let n = 1; n < 12; n++) {
        const nx = x + n * dx * sign,
          ny = y + n * dy * sign;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || cells[ny * width + nx] !== 'wall') break;
        length++;
      }
    return length;
  };
  // Authored landmarks take priority but obey exactly the same fit and density limits.
  for (const motif of authored) {
    const { x, y } = motif.at;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(motif.variant) || motif.variant < 0)
      continue;
    const dx = motif.kind === 'horizontal' ? 1 : 0;
    const dy = motif.kind === 'vertical' ? 1 : 0;
    const length = motif.kind === 'accent' ? 1 : 3;
    if (!fits(x, y, dx, dy, length)) continue;
    if (length === 1 ? accents + 1 > Math.floor(walls * 0.08) : directional + 3 > Math.floor(walls * 0.2))
      continue;
    const first =
      motif.kind === 'accent' ? 14 + (motif.variant % 8) : (dx ? 22 : 34) + (motif.variant % 4) * 3;
    for (let n = 0; n < length; n++) output[(y + n * dy) * width + x + n * dx] = first + n;
    reserve(x, y, dx, dy, length);
    if (length === 1) accents++;
    else directional += 3;
  }
  // Prefer the longest available solid axis, then alternate on ties. Scan complete maps, never viewports.
  for (const { x, y, hash } of candidates) {
    if (directional + 3 > Math.floor(walls * 0.2)) break;
    const h = fits(x, y, 1, 0, 3),
      v = fits(x, y, 0, 1, 3);
    if (!h && !v) continue;
    const hs = span(x, y, 1, 0),
      vs = span(x, y, 0, 1);
    if ((hs > vs && !h) || (vs > hs && !v)) continue;
    const horizontal = h && (!v || hs > vs || (hs === vs && (hash & 1) === 0));
    const dx = horizontal ? 1 : 0,
      dy = horizontal ? 0 : 1;
    const first = (horizontal ? 22 : 34) + ((hash >>> 4) % 4) * 3;
    for (let n = 0; n < 3; n++) output[(y + n * dy) * width + x + n * dx] = first + n;
    reserve(x, y, dx, dy, 3);
    directional += 3;
  }
  for (const { x, y, hash } of candidates) {
    if (accents + 1 > Math.floor(walls * 0.08)) break;
    if (!fits(x, y, 0, 0, 1)) continue;
    let accent = 14 + ((hash >>> 8) % 8);
    if ((hash & 7) === 0) accent = 46 + (hash % 4);

    output[y * width + x] = accent;
    reserve(x, y, 0, 0, 1);
    accents++;
  }
  return { cells: output, walls, directional, accents };
}
