import manifest from './data/authored-scenery-v6.json';
import { loadCachedImage, settleImageBatch } from '../shared/ImageCache';
import type { PresentationPreferences } from './Presentation';
import type { World } from './types';

export type RasterRect = readonly [number, number, number, number];
export interface AuthoredRoomDefinition {
  width: number;
  height: number;
  initial: string;
  path: string;
}
export interface AuthoredRoom extends AuthoredRoomDefinition {
  background: HTMLImageElement;
  walls: HTMLImageElement;
  soil: HTMLImageElement;
}
export interface AuthoredScenery {
  level: number;
  biome: string;
  rooms: ReadonlyMap<string, AuthoredRoom>;
  edges: HTMLImageElement;
  edgeRects: Readonly<Record<string, RasterRect>>;
  colonyBody: HTMLImageElement;
  colonyOverlays: HTMLImageElement;
  colonyMasks: HTMLImageElement;
  colonyCores: HTMLImageElement;
  colonyTopologies: readonly number[];
  actors: HTMLImageElement;
}
interface Manifest {
  pixelsPerCell: number;
  levels: Record<string, { biome: string; rooms: Record<string, AuthoredRoomDefinition> }>;
  biomes: Record<string, { edges: Record<string, RasterRect>; colonyTopologies: number[] }>;
}
const definitions = manifest as unknown as Manifest;
export const AUTHORED_CELL_PIXELS = definitions.pixelsPerCell;
export const AUTHORED_DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
const COLONY_NEIGHBOURS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;

export function authoredRoomDefinition(level: number, chamber = 'main') {
  return definitions.levels[String(level)]?.rooms[chamber];
}

/** Maps approved images into the shared host cache, with no additional loader/cache. */
export async function loadAuthoredScenery(
  base: string,
  preferences: PresentationPreferences,
  level: number,
): Promise<AuthoredScenery | undefined> {
  if (preferences.visualTheme !== 'storybook') return undefined;
  const definition = definitions.levels[String(level)];
  if (!definition) throw new Error(`Brak zatwierdzonej scenografii poziomu ${level}.`);
  const root = `${base}game-assets/2d/bongo-rush/authored-v6`;
  const image = (path: string) => loadCachedImage(`${root}/${path}.webp`);
  const [common, rooms] = await settleImageBatch([
    settleImageBatch(
      ['edges', 'colony-body', 'colony-overlays', 'colony-masks', 'colony-cores', 'actors'].map((name) =>
        image(`${definition.biome}/${name}`),
      ),
    ),
    settleImageBatch(
      Object.entries(definition.rooms).map(async ([name, room]) => {
        const [background, walls, soil] = await settleImageBatch(
          ['background', 'walls', 'soil'].map((layer) => image(`${room.path}/${layer}`)),
        );
        for (const layer of [background, walls, soil])
          if (
            layer.naturalWidth !== room.width * AUTHORED_CELL_PIXELS ||
            layer.naturalHeight !== room.height * AUTHORED_CELL_PIXELS
          )
            throw new Error(`Nieprawidłowy rozmiar grafiki poziomu ${level}, ${name}.`);
        return [name, { ...room, background, walls, soil }] as const;
      }),
    ),
  ] as const);
  return {
    level,
    biome: definition.biome,
    rooms: new Map(rooms),
    edges: common[0],
    colonyBody: common[1],
    colonyOverlays: common[2],
    colonyMasks: common[3],
    colonyCores: common[4],
    actors: common[5],
    edgeRects: definitions.biomes[definition.biome].edges,
    colonyTopologies: definitions.biomes[definition.biome].colonyTopologies,
  };
}

export function authoredImages(pack: AuthoredScenery | undefined): HTMLImageElement[] {
  return pack
    ? [
        pack.edges,
        pack.colonyBody,
        pack.colonyOverlays,
        pack.colonyMasks,
        pack.colonyCores,
        pack.actors,
        ...[...pack.rooms.values()].flatMap((room) => [room.background, room.walls, room.soil]),
      ]
    : [];
}

export function authoredCellRect(x: number, y: number): RasterRect {
  return [x * AUTHORED_CELL_PIXELS, y * AUTHORED_CELL_PIXELS, AUTHORED_CELL_PIXELS, AUTHORED_CELL_PIXELS];
}
export function isAuthoredSolid(cell: World['cells'][number]): boolean {
  return cell === 'wall' || cell === 'soil' || cell === 'buried-bush';
}
export interface AuthoredEdge {
  x: number;
  y: number;
  side: number;
  wall: boolean;
  old: boolean;
}
/** Includes both materials; only actual empty neighbours receive a painted lip/AO. */
export function authoredEdges(
  world: Pick<World, 'width' | 'height' | 'cells'>,
  initial: string,
): AuthoredEdge[] {
  const { width, height, cells } = world;
  const result: AuthoredEdge[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!isAuthoredSolid(cells[i])) continue;
    const x = i % width,
      y = Math.floor(i / width);
    for (const [side, [dx, dy]] of AUTHORED_DIRECTIONS.entries()) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || isAuthoredSolid(cells[ny * width + nx]))
        continue;
      result.push({ x, y, side, wall: cells[i] === 'wall', old: !'#.v'.includes(initial[ny * width + nx]) });
    }
  }
  return result;
}

export function colonyBlobMask(bits: number): number {
  for (const diagonal of [1, 3, 5, 7])
    if (!(bits & (1 << ((diagonal - 1) % 8))) || !(bits & (1 << ((diagonal + 1) % 8))))
      bits &= ~(1 << diagonal);
  return bits;
}
/** Four-connected shared bodies retain one oldest surviving original core. */
export function authoredColony(world: Pick<World, 'width' | 'height' | 'cells'>, initial: string) {
  const { width, height, cells } = world;
  const tiles = new Map<number, number>(),
    cores = new Set<number>(),
    unseen = new Set<number>();
  cells.forEach((cell, i) => {
    if (cell === 'bush') unseen.add(i);
  });
  for (const i of unseen) {
    const x = i % width,
      y = Math.floor(i / width);
    let bits = 0;
    COLONY_NEIGHBOURS.forEach(([dx, dy], side) => {
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && cells[ny * width + nx] === 'bush')
        bits |= 1 << side;
    });
    tiles.set(i, colonyBlobMask(bits));
  }
  while (unseen.size) {
    const first = unseen.values().next().value!,
      group = [first];
    unseen.delete(first);
    for (let q = 0; q < group.length; q++) {
      const i = group[q],
        x = i % width,
        y = Math.floor(i / width);
      for (const [dx, dy] of AUTHORED_DIRECTIONS) {
        const nx = x + dx,
          ny = y + dy,
          index = ny * width + nx;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && unseen.delete(index)) group.push(index);
      }
    }
    const seeds = group.filter((i) => initial[i] === 'b' || initial[i] === 'v');
    cores.add(Math.min(...(seeds.length ? seeds : group)));
  }
  return { tiles, cores };
}
