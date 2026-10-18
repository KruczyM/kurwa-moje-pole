import type { Simulation } from '../../src/games/bongo-rush/Simulation';
import { DIRECTIONS, neighbour, same } from '../../src/games/bongo-rush/types';
import type { LevelDefinition, World } from '../../src/games/bongo-rush/types';

const definitions = new WeakMap<LevelDefinition, { chamber: string; x: number; y: number }[]>();

export const openingKey = (at: { chamber: string; x: number; y: number }) => `${at.chamber}:${at.x},${at.y}`;

/** Authoring history is separate from physics: a falling body can reseal a nest.
 * Only its first physical opening is subject to the reference collection window. */
export function advanceOpeningHistory(previous: ReadonlySet<string>, game: Simulation) {
  const seen = new Set(previous);
  let valid = true;
  for (const event of openings(game)) {
    const key = openingKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    if (event.fractionOfQuota < 0.45 || event.fractionOfQuota > 0.6) valid = false;
  }
  return { seen, valid };
}

/** Offline read-only observer of all production rooms. No simulation state is changed.
 * A birth on this tick proves the field was vacant immediately before the wave,
 * even though the post-step cell is already bush and canSpreadFrom would miss it.
 */
export function openings(game: Simulation) {
  const rooms = (game as unknown as { rooms: ReadonlyMap<string, World> }).rooms;
  let nests = definitions.get(game.level);
  if (!nests) {
    nests = [{ id: 'main', rows: game.level.rows }, ...(game.level.chambers ?? [])].flatMap((room) =>
      room.rows.flatMap((row, y) =>
        [...row].flatMap((c, x) => (c === 'V' ? [{ chamber: room.id, x, y }] : [])),
      ),
    );
    definitions.set(game.level, nests);
  }
  return nests.flatMap(({ chamber, x, y }) => {
    const world = rooms.get(chamber)!;
    const open = DIRECTIONS.some((direction) => {
      const p = neighbour({ x, y }, direction),
        index = p.y * world.width + p.x;
      if (world.bushBirths?.some((birth) => birth.tick === game.ticks && same(birth.at, p))) return true;
      return (
        world.cells[index] === 'air' &&
        !world.objects.some((o) => same(o, p)) &&
        !world.enemies.some((e) => same(e, p)) &&
        (chamber !== game.chamberId || !same(world.player, p))
      );
    });
    return open
      ? [
          {
            chamber,
            x,
            y,
            tick: game.ticks,
            collected: game.world.collected,
            fractionOfQuota: game.world.collected / game.level.quota,
          },
        ]
      : [];
  });
}
