import type { LevelDefinition, Scenery, Point } from './types';
export const COMPOSITION_MOTIFS = [
  'Dawne fundamenty hurtowni',
  'Tarasowe sklepienie magazynu',
  'Trzy kamienne zsypy',
  'Stanowiska pod sklepieniem',
  'Zawalony lej dostawczy',
  'Ogród pod korzeniami',
  'Spleciony pionowy szyb',
  'Dwa zarośnięte węzły',
  'Dwie hale odbiorcze',
  'Korzenna komora stropowa',
  'Tory kryształowej galerii',
  'Zbiornik rezonansowy',
  'Pierścieniowe sanktuarium',
  'Neonowy ogród sieci',
  'Wysoki szyb sceniczny',
  'Trzy fundamenty cytadeli',
  'Dwa skrzydła twierdzy',
  'Przedsionek trzech komór',
  'Serce zawalonej sali',
  'Sala tronowa',
  'Dwa wspólne zsypy',
  'Sześć ogrodowych wysp',
  'Spiralna galeria',
  'Złamana monumentalna twierdza',
] as const;
export interface SceneComposition {
  motif: string;
  scenery: Scenery;
  roots: ReadonlyMap<number, number>;
  soilIslands: ReadonlyMap<number, SoilBounds>;
  soilBounds: SoilBounds;
  rows: readonly string[];
}
const OFFSETS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
/** A forest rooted at the top of each authored earth island. Built from immutable rows, not dug cells. */
export function rootForest(rows: readonly string[]): ReadonlyMap<number, number> {
  const width = rows[0].length,
    height = rows.length,
    unseen = new Set<number>();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (rows[y][x] === '.') unseen.add(y * width + x);
  const result = new Map<number, number>();
  while (unseen.size) {
    const first = unseen.values().next().value!;
    const island = [first],
      seen = new Set([first]);
    for (let q = 0; q < island.length; q++) {
      const at = island[q],
        x = at % width,
        y = Math.floor(at / width);
      for (const [dx, dy] of OFFSETS) {
        const nx = x + dx,
          ny = y + dy,
          n = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && unseen.has(n) && !seen.has(n)) {
          seen.add(n);
          island.push(n);
        }
      }
    }
    const center = island.reduce((n, i) => n + (i % width), 0) / island.length;
    island.sort(
      (a, b) =>
        Math.floor(a / width) - Math.floor(b / width) ||
        Math.abs((a % width) - center) - Math.abs((b % width) - center),
    );
    const root = island[0],
      queue = [root];
    unseen.delete(root);
    result.set(root, 1);
    for (let q = 0; q < queue.length; q++) {
      const at = queue[q],
        x = at % width,
        y = Math.floor(at / width);
      // Downward trunk first, then left/right branches. A tree cannot contain decorative grid loops.
      for (const side of [2, 3, 1, 0]) {
        const [dx, dy] = OFFSETS[side],
          nx = x + dx,
          ny = y + dy,
          n = ny * width + nx;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || !unseen.has(n)) continue;
        unseen.delete(n);
        queue.push(n);
        result.set(at, (result.get(at) ?? 0) | (1 << side));
        result.set(n, 1 << ((side + 2) % 4));
      }
    }
  }
  return result;
}
/** Scene descriptions are presentation only. All authored collision rows remain unchanged. */
export function composeScene(level: LevelDefinition, chamberId: string, base?: Scenery): SceneComposition {
  const room = chamberId === 'main' ? level : level.chambers!.find((room) => room.id === chamberId)!;
  const rows = room.rows,
    width = rows[0].length,
    height = rows.length;
  const scenery: Scenery = base
    ? { ...base, props: [...base.props], rays: [...base.rays] }
    : { materials: [], views: [], props: [], rays: [], floorDetails: [] };
  const props: Scenery['props'][number][] = [];
  const add = (asset: string, at: Point, w: number, h: number) => {
    if (at.x < 0 || at.y < 0 || at.x + w > width || at.y + h > height) return;
    // Decorative structures never span playable cells. Segment beams at real wall interruptions.
    for (let y = Math.floor(at.y); y < Math.ceil(at.y + h); y++)
      for (let x = Math.floor(at.x); x < Math.ceil(at.x + w); x++) if (rows[y][x] !== '#') return;
    props.push({ asset, at, width: w, height: h, layer: 'frame' });
  };
  for (const view of scenery.views) {
    const b = view.bounds,
      sideHeight = Math.max(1, b.height - 2);
    add('column', { x: b.x, y: b.y + 1 }, 1, sideHeight);
    add('column', { x: b.x + b.width - 1, y: b.y + 1 }, 1, sideHeight);
    for (let x = b.x + 1; x < b.x + b.width - 1; x += 3) {
      const span = Math.min(3, b.x + b.width - 1 - x);
      add('beam', { x, y: b.y }, span, 1);
    }
    for (let x = b.x + 1; x < b.x + b.width - 1; x += 2)
      add('railing', { x, y: b.y + b.height - 2 }, Math.min(2, b.x + b.width - 1 - x), 1);
    add(
      'cornice',
      { x: Math.floor(b.x + b.width / 2) - 1, y: b.y + b.height - 1 },
      Math.min(3, b.width - 2),
      1,
    );
    add('vine', { x: b.x + 1, y: b.y + 1 }, 1, Math.min(2, sideHeight));
    add('lantern', { x: b.x + b.width - 2, y: b.y + 1 }, 1, 1);
  }
  if (level.id === 20 && chamberId === 'main') {
    const view = scenery.views[0];
    if (view) {
      const b = view.bounds,
        cx = Math.floor(b.x + b.width / 2),
        baseY = b.y + b.height - 1;
      add('throne', { x: cx - 1, y: baseY - 3 }, 2, 3);
      for (const x of [cx - 5, cx + 4]) {
        add('column', { x, y: b.y + 1 }, 1, b.height - 2);
        add('lantern', { x, y: b.y }, 1, 1);
      }
      for (let x = cx - 4; x <= cx + 2; x += 3) add('cornice', { x, y: baseY - 1 }, 3, 1);
    }
  }
  // Existing authored accents are retained only where they do not duplicate the new supported frames.
  scenery.props = props.length ? props : scenery.props;
  const suffix = chamberId === 'main' ? '' : ` · ${'name' in room ? room.name : ''}`;
  return {
    motif: COMPOSITION_MOTIFS[level.id - 1] + suffix,
    scenery,
    roots: rootForest(rows),
    soilIslands: soilIslands(rows),
    soilBounds: soilSceneBounds(rows),
    rows,
  };
}

export interface SoilBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Connected earth islands are measured once from authored rows. Digging never shifts the painting. */
export function soilIslands(rows: readonly string[]): ReadonlyMap<number, SoilBounds> {
  const width = rows[0].length,
    height = rows.length,
    unseen = new Set<number>();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (rows[y][x] === '.' || rows[y][x] === 'K') unseen.add(y * width + x);
  const result = new Map<number, SoilBounds>();
  while (unseen.size) {
    const first = unseen.values().next().value!,
      queue = [first];
    unseen.delete(first);
    let left = first % width,
      right = left,
      top = Math.floor(first / width),
      bottom = top;
    for (let q = 0; q < queue.length; q++) {
      const at = queue[q],
        x = at % width,
        y = Math.floor(at / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (const [dx, dy] of OFFSETS) {
        const nx = x + dx,
          ny = y + dy,
          n = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && unseen.delete(n)) queue.push(n);
      }
    }
    const bounds = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    for (const at of queue) result.set(at, bounds);
  }
  return result;
}
/** Object-fit cover in authored scene space: adjacent tiles share exact UV edges without stretching the art. */
export function paintedSoilCrop(
  bounds: SoilBounds,
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
) {
  const pixelsPerTile = Math.min(imageWidth / bounds.width, imageHeight / bounds.height);
  return {
    x: (imageWidth - bounds.width * pixelsPerTile) / 2 + (x - bounds.x) * pixelsPerTile,
    y: (imageHeight - bounds.height * pixelsPerTile) / 2 + (y - bounds.y) * pixelsPerTile,
    width: pixelsPerTile,
    height: pixelsPerTile,
  };
}

/** One composition spans all authored earth, including disconnected terraces, without repeating per island. */
export function soilSceneBounds(rows: readonly string[]): SoilBounds {
  let left = rows[0].length,
    top = rows.length,
    right = -1,
    bottom = -1;
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[0].length; x++)
      if (rows[y][x] === '.' || rows[y][x] === 'K') {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  return right < 0
    ? { x: 0, y: 0, width: rows[0].length, height: rows.length }
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
