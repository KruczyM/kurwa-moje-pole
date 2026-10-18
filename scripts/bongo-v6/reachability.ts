import type { Simulation } from '../../src/games/bongo-rush/Simulation';

/** Optimistic authoring bound, never game physics. Movable bodies disappear instead
 * of landing elsewhere; pickups are credited only in the final reachable component.
 * Only reachable soil is cleared. Enemies and future growth are ignored.
 */
export function optimisticAccess(game: Simulation) {
  if (game.level.chambers?.length || game.level.portals?.length)
    throw new Error('Single-room without portals only');
  const w = game.world,
    size = w.cells.length;
  const terrain = Uint8Array.from(w.cells, (c) =>
    c === 'wall' || c === 'bush' ? 1 : c === 'soil' || c === 'buried-bush' ? 2 : c === 'air' ? 0 : 3,
  );
  const bodies = new Int32Array(size).fill(-1),
    removed = new Uint8Array(w.objects.length);
  w.objects.forEach((o, i) => {
    bodies[o.y * w.width + o.x] = i;
  });
  const reach = new Uint8Array(size),
    queue = new Int32Array(size);
  let changed = true;
  const empty = (at: number) => at >= 0 && at < size && terrain[at] === 0 && bodies[at] < 0;
  const remove = (at: number) => {
    const i = bodies[at];
    removed[i] = 1;
    bodies[at] = -1;
    changed = true;
  };
  while (changed) {
    changed = false;
    reach.fill(0);
    let head = 0,
      tail = 1;
    queue[0] = w.player.y * w.width + w.player.x;
    reach[queue[0]] = 1;
    while (head < tail) {
      const at = queue[head++],
        x = at % w.width;
      for (const n of [x > 0 ? at - 1 : -1, x < w.width - 1 ? at + 1 : -1, at - w.width, at + w.width]) {
        if (n < 0 || n >= size || reach[n] || terrain[n] === 1) continue;
        const i = bodies[n];
        if (i >= 0 && w.objects[i].kind === 'rock') continue;
        if (i >= 0) remove(n);
        if (terrain[n] === 2) {
          terrain[n] = 0;
          changed = true;
        }
        reach[n] = 1;
        queue[tail++] = n;
      }
    }
    for (let i = 0; i < w.objects.length; i++) {
      if (removed[i]) continue;
      const o = w.objects[i],
        at = o.y * w.width + o.x,
        below = at + w.width;
      const falling = empty(below);
      const rolling =
        bodies[below] >= 0 &&
        [-1, 1].some((dx) => o.x + dx >= 0 && o.x + dx < w.width && empty(at + dx) && empty(below + dx));
      const pushing =
        o.kind === 'rock' &&
        [-1, 1].some(
          (dx) =>
            o.x - dx >= 0 &&
            o.x - dx < w.width &&
            o.x + dx >= 0 &&
            o.x + dx < w.width &&
            reach[at - dx] &&
            empty(at + dx),
        );
      if (falling || rolling || pushing) remove(at);
    }
  }
  // A removed body cannot cross a wall or undug, unreachable soil. Its original
  // field must join the player's final optimistic component to credit its loot.
  const canCredit = (i: number) => removed[i] && reach[w.objects[i].y * w.width + w.objects[i].x];
  const credited = w.objects.filter((o, i) => o.kind === 'pickup' && canCredit(i)).length;
  const fixed = w.objects.filter((o, i) => o.kind === 'pickup' && !canCredit(i));
  return {
    potential:
      w.collected +
      credited +
      w.enemies.filter((e) => e.kind !== 'boss').length +
      (w.lootSources ?? []).reduce((n, s) => n + s.remaining, 0),
    exitReachable: w.cells.some((c, i) => c === 'exit' && reach[i] === 1),
    blockedRequired: fixed.filter((o) => o.required).map((o) => o.id),
    fixedPickups: fixed.filter((o) => o.kind === 'pickup').map((o) => ({ id: o.id, x: o.x, y: o.y })),
    reachable: reach.reduce((n, v) => n + v, 0),
  };
}
