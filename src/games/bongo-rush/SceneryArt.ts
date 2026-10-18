import type { PresentationPreferences } from './Presentation';
import type { Point, Scenery, World } from './types';
import type { AuthoredScenery } from './AuthoredScenery';
export const SCENERY_BIOMES = ['amarena', 'roots', 'rave', 'smoke'] as const;
export const SCENERY_PROPS = [
  'rock-0',
  'rock-1',
  'rock-2',
  'rock-3',
  'beam',
  'post',
  'column',
  'railing',
  'crate',
  'rubble',
  'vine',
  'plant',
  'arch',
  'lantern',
  'cornice',
  'crack',
] as const;
export interface SceneryArtwork {
  authored?: AuthoredScenery;
  presentation?: PresentationPreferences;
  soil?: HTMLImageElement;
  walls?: HTMLImageElement;
  floor?: HTMLImageElement;
  biome: number;
  terrain: HTMLImageElement;
  props: HTMLImageElement;
  mid: HTMLImageElement;
}
export function sceneryMaterial(scenery: Scenery | undefined, x: number, y: number): number {
  let material = 0;
  for (const region of scenery?.materials ?? []) {
    const b = region.bounds;
    if (x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height) material = region.material;
  }
  return material;
}
export function sceneryTileRect(kind: 'wall' | 'soil' | 'floor', variant: number) {
  const row = kind === 'wall' ? Math.floor(variant / 4) % 2 : kind === 'soil' ? 2 : 3;
  return { x: (((variant % 4) + 4) % 4) * 128, y: row * 128, width: 128, height: 128 };
}
/** Four exposed sides and four concave corners, based on actual solid walls. */
export function sceneryEdges(world: Pick<World, 'width' | 'height' | 'cells'>, x: number, y: number) {
  const solid = (x: number, y: number) =>
    x < 0 || y < 0 || x >= world.width || y >= world.height || world.cells[y * world.width + x] === 'wall';
  const n = solid(x, y - 1),
    e = solid(x + 1, y),
    s = solid(x, y + 1),
    w = solid(x - 1, y);
  return {
    sides: (!n ? 1 : 0) | (!e ? 2 : 0) | (!s ? 4 : 0) | (!w ? 8 : 0),
    corners:
      (n && e && !solid(x + 1, y - 1) ? 1 : 0) |
      (e && s && !solid(x + 1, y + 1) ? 2 : 0) |
      (s && w && !solid(x - 1, y + 1) ? 4 : 0) |
      (w && n && !solid(x - 1, y - 1) ? 8 : 0),
  };
}
/** Thin shared depth edges; foliage and masonry detail come from painted source pixels. */
export function paintSceneryEdges(
  ctx: CanvasRenderingContext2D,
  sides: number,
  corners: number,
  _biome = 0,
  _theme?: PresentationPreferences['visualTheme'],
  _variant = 0,
): void {
  void _biome;
  void _variant;
  ctx.save();
  for (let side = 0; side < 4; side++)
    if (sides & (1 << side)) {
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate((side * Math.PI) / 2);
      ctx.translate(-32, -32);
      ctx.fillStyle = '#101817b0';
      ctx.fillRect(0, 0, 64, 2);
      if (side === 0 || side === 3) {
        ctx.fillStyle = '#d5d2b84a';
        ctx.fillRect(0, 2, 64, 1);
      }
      ctx.restore();
    }
  for (let i = 0; i < 4; i++)
    if (corners & (1 << i)) {
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate((i * Math.PI) / 2);
      ctx.translate(-32, -32);
      ctx.fillStyle = '#101817a0';
      ctx.fillRect(60, 0, 4, 4);
      ctx.restore();
    }
  ctx.restore();
}
export function rayOpacity(touch: boolean, reduced: boolean, time: number, index: number) {
  const maximum = touch ? 0.12 : 0.18;
  return maximum * (reduced || (touch && index > 0) ? 1 : 0.94 + 0.06 * Math.sin(time * 0.35 + index));
}
export function rayEnd(ray: Scenery['rays'][number]): Point {
  const length = Math.hypot(ray.direction.x, ray.direction.y);
  return {
    x: ray.at.x + (ray.direction.x / length) * ray.length,
    y: ray.at.y + (ray.direction.y / length) * ray.length,
  };
}
export function validateScenery(rows: readonly string[], scenery: Scenery | undefined): void {
  if (!scenery) return;
  const width = rows[0].length,
    height = rows.length;
  const inside = (p: Point) =>
    Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;
  const bounds = (b: Point & { width: number; height: number }) =>
    inside(b) &&
    Number.isFinite(b.width) &&
    Number.isFinite(b.height) &&
    b.width > 0 &&
    b.height > 0 &&
    b.x + b.width <= width &&
    b.y + b.height <= height;
  for (const region of scenery.materials)
    if (!bounds(region.bounds) || ![0, 1].includes(region.material))
      throw new Error('Invalid scenery material');
  for (const view of scenery.views) {
    if (!bounds(view.bounds)) throw new Error('Invalid scenery view bounds');
    const seen = new Set<string>();
    for (const p of view.mask) {
      const key = `${p.x},${p.y}`,
        b = view.bounds;
      if (
        !Number.isInteger(p.x) ||
        !Number.isInteger(p.y) ||
        !inside(p) ||
        rows[p.y][p.x] !== '#' ||
        seen.has(key) ||
        p.x < b.x ||
        p.y < b.y ||
        p.x >= b.x + b.width ||
        p.y >= b.y + b.height
      )
        throw new Error('Scenery view must contain unique solid walls');
      seen.add(key);
    }
  }
  for (const prop of scenery.props) {
    if (!bounds({ ...prop.at, width: prop.width, height: prop.height }))
      throw new Error('Invalid scenery prop bounds');
    for (let y = Math.floor(prop.at.y); y < Math.ceil(prop.at.y + prop.height); y++)
      for (let x = Math.floor(prop.at.x); x < Math.ceil(prop.at.x + prop.width); x++)
        if (rows[y][x] !== '#') throw new Error('Scenery props cannot cover a playable cell');
  }
  for (const ray of scenery.rays)
    if (
      !inside(ray.at) ||
      !Number.isFinite(ray.length) ||
      !Number.isFinite(ray.width) ||
      ray.length <= 0 ||
      ray.width <= 0 ||
      !Number.isFinite(Math.hypot(ray.direction.x, ray.direction.y)) ||
      Math.hypot(ray.direction.x, ray.direction.y) === 0
    )
      throw new Error('Invalid scenery ray');
  for (const detail of scenery.floorDetails)
    if (!inside(detail.at) || ![' ', '.'].includes(rows[detail.at.y][detail.at.x]))
      throw new Error('Invalid floor detail');
}
