import type { MapDefinition, Point } from './WorldState';

export const PLAYER_RADIUS = 0.22;

/** Tests a foot collider against only nearby grid cells; outside the map is solid. */
export function canStand(map: MapDefinition, point: Point, radius = PLAYER_RADIUS): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if (!Number.isFinite(radius) || radius <= 0) return false;
  if (
    point.x - radius < 0 ||
    point.y - radius < 0 ||
    point.x + radius > map.width * map.tileSize ||
    point.y + radius > map.height * map.tileSize
  )
    return false;
  const minX = Math.floor((point.x - radius) / map.tileSize);
  const maxX = Math.min(map.width - 1, Math.floor((point.x + radius) / map.tileSize));
  const minY = Math.floor((point.y - radius) / map.tileSize);
  const maxY = Math.min(map.height - 1, Math.floor((point.y + radius) / map.tileSize));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!map.collision[y * map.width + x]) continue;
      const closestX = Math.max(x * map.tileSize, Math.min(point.x, (x + 1) * map.tileSize));
      const closestY = Math.max(y * map.tileSize, Math.min(point.y, (y + 1) * map.tileSize));
      if ((point.x - closestX) ** 2 + (point.y - closestY) ** 2 < radius ** 2) return false;
    }
  }
  return true;
}

/** Substeps a move to prevent tunnelling and resolves axes separately to slide along walls. */
export function slideMove(map: MapDefinition, from: Point, displacement: Point): Point {
  if (
    !canStand(map, from) ||
    !Number.isFinite(displacement.x) ||
    !Number.isFinite(displacement.y) ||
    Math.hypot(displacement.x, displacement.y) > Math.hypot(map.width, map.height) * map.tileSize
  ) {
    throw new Error('Invalid After movement');
  }
  const count = Math.max(1, Math.ceil(Math.hypot(displacement.x, displacement.y) / (PLAYER_RADIUS / 2)));
  const next = { ...from };
  for (let i = 0; i < count; i++) {
    const x = { x: next.x + displacement.x / count, y: next.y };
    if (canStand(map, x)) next.x = x.x;
    const y = { x: next.x, y: next.y + displacement.y / count };
    if (canStand(map, y)) next.y = y.y;
  }
  return next;
}

/** Rejects malformed grids and unsafe entry points before a session starts. */
export function validateMap(map: MapDefinition): void {
  if (
    !map.id ||
    !Number.isInteger(map.width) ||
    !Number.isInteger(map.height) ||
    map.width < 1 ||
    map.height < 1 ||
    !Number.isFinite(map.tileSize) ||
    map.tileSize <= 0 ||
    map.collision.length !== map.width * map.height ||
    !map.collision.every((value) => typeof value === 'boolean')
  ) {
    throw new Error('Invalid After collision grid');
  }
  if (!map.spawns.length || map.spawns.some((point) => !canStand(map, point))) {
    throw new Error('After map needs safe spawns');
  }
  const ids = new Set<string>();
  for (const target of map.interactions) {
    if (
      !target.id ||
      ids.has(target.id) ||
      !canStand(map, target.position) ||
      !Number.isFinite(target.radius) ||
      target.radius <= 0 ||
      !Number.isFinite(target.priority) ||
      !target.prompt.trim()
    ) {
      throw new Error('Invalid After interaction');
    }
    ids.add(target.id);
  }
}
