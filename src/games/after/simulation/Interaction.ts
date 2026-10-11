import { canStand } from './Collision';
import type { InteractionDefinition, MapDefinition, PlayerState } from './WorldState';

/** Traverses each crossed grid cell, including both sides of a corner; thin wall corners never leak. */
export function hasLineOfSight(
  map: MapDefinition,
  from: PlayerState['position'],
  to: PlayerState['position'],
): boolean {
  if (!canStand(map, from, 0.01) || !canStand(map, to, 0.01)) return false;
  let x = Math.floor(from.x / map.tileSize);
  let y = Math.floor(from.y / map.tileSize);
  const endX = Math.floor(to.x / map.tileSize);
  const endY = Math.floor(to.y / map.tileSize);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const deltaX = dx === 0 ? Infinity : map.tileSize / Math.abs(dx);
  const deltaY = dy === 0 ? Infinity : map.tileSize / Math.abs(dy);
  let nextX = dx === 0 ? Infinity : ((x + (stepX > 0 ? 1 : 0)) * map.tileSize - from.x) / dx;
  let nextY = dy === 0 ? Infinity : ((y + (stepY > 0 ? 1 : 0)) * map.tileSize - from.y) / dy;
  /** Treats outside cells as walls even at a boundary/corner. */
  const solid = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= map.width || cy >= map.height || map.collision[cy * map.width + cx];
  while (x !== endX || y !== endY) {
    if (Math.min(nextX, nextY) >= 1) return true;
    if (Math.abs(nextX - nextY) < 1e-10) {
      if (solid(x + stepX, y) || solid(x, y + stepY)) return false;
      x += stepX;
      y += stepY;
      nextX += deltaX;
      nextY += deltaY;
    } else if (nextX < nextY) {
      x += stepX;
      nextX += deltaX;
    } else {
      y += stepY;
      nextY += deltaY;
    }
    if (solid(x, y)) return false;
  }
  return true;
}

/** Selects a reachable target by priority, then distance, then stable content order. */
export function nearestInteraction(
  map: MapDefinition,
  player: PlayerState,
  flags: readonly string[],
): InteractionDefinition | undefined {
  let selected: InteractionDefinition | undefined;
  let bestDistance = Infinity;
  for (const target of map.interactions) {
    if (target.once && flags.includes(`interaction:${target.id}`)) continue;
    const distance = Math.hypot(target.position.x - player.position.x, target.position.y - player.position.y);
    if (distance > target.radius || !hasLineOfSight(map, player.position, target.position)) continue;
    if (
      !selected ||
      target.priority > selected.priority ||
      (target.priority === selected.priority && distance < bestDistance)
    ) {
      selected = target;
      bestDistance = distance;
    }
  }
  return selected;
}
