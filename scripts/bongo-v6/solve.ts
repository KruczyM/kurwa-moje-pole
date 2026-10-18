/** Offline authoring search. All edges are single calls to the production Simulation.step(). */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { buildCampaignV6 } from '../../src/games/bongo-rush/CampaignV6';
import { Simulation } from '../../src/games/bongo-rush/Simulation';
import { buildCampaignV5 } from '../../src/games/bongo-rush/CampaignV5';
import { DIRECTIONS, neighbour } from '../../src/games/bongo-rush/types';
import type { Direction, ReplayInput, World } from '../../src/games/bongo-rush/types';

// Checkpoint only in this offline search, never used to advance the game or validate a win.
export function clone(source: Simulation): Simulation {
  const copy = Object.assign(Object.create(Simulation.prototype), source);
  const internal = source as unknown as { rooms: Map<string, World> };
  copy.rooms = new Map();
  for (const [key, w] of internal.rooms) {
    const room = {
      ...w,
      cells: [...w.cells],
      player: { ...w.player },
      objects: w.objects.map((o) => ({ ...o })),
      enemies: w.enemies.map((e) => ({ ...e })),
      bushRoots: [...w.bushRoots],
      bushBirths: [...(w.bushBirths ?? [])],
      lootSources: w.lootSources?.map((s) => ({ ...s })),
    };
    copy.rooms.set(key, room);
    if (source.world === w) copy.activeWorld = room;
  }
  copy.sounds = [];
  return copy;
}

/** Static distances are only a heuristic: every accepted edge still runs actual gravity/enemies. */
function distances(game: Simulation, target: { x: number; y: number }) {
  const w = game.world,
    d = new Int16Array(w.width * w.height).fill(30000);
  const queue = [target.y * w.width + target.x];
  d[queue[0]] = 0;
  const rocks = new Set(w.objects.filter((o) => o.kind === 'rock').map((o) => o.y * w.width + o.x));
  while (queue.length) {
    queue.sort((a, b) => d[b] - d[a]);
    const at = queue.pop()!,
      x = at % w.width,
      y = Math.floor(at / w.width);
    for (const dir of DIRECTIONS) {
      const p = neighbour({ x, y }, dir),
        next = p.y * w.width + p.x;
      if (p.x < 0 || p.y < 0 || p.x >= w.width || p.y >= w.height) continue;
      if (w.cells[next] === 'wall' || w.cells[next] === 'bush') continue;
      const cost = rocks.has(next) ? 5 : 1;
      if (d[next] <= d[at] + cost) continue;
      d[next] = d[at] + cost;
      queue.push(next);
    }
  }
  return d;
}

export function signature(g: Simulation, ignoreDormantGrowthClock = false) {
  const internal = g as unknown as {
    rooms: ReadonlyMap<string, World>;
    portalLatch: boolean;
    nextObjectId: number;
  };
  const worldKey = (w: World) =>
    [
      w.player.x,
      w.player.y,
      w.collected,
      w.kills,
      +w.trapped,
      ignoreDormantGrowthClock || w.nextBushGrowth === undefined ? '' : w.nextBushGrowth - g.ticks,
      w.cells.join(''),
      w.objects.map((o) => `${o.id}:${o.x},${o.y},${+o.falling},${+!!o.required}`).join(';'),
      w.enemies.map((e) => `${e.id}:${e.x},${e.y},${e.direction},${+!!e.wallAttached}`).join(';'),
      w.bushRoots.map((p) => `${p.x},${p.y}`).join(';'),
      w.lootSources?.map((s) => `${+s.activated}:${s.remaining}`).join(';') ?? '',
    ].join('|');
  return [
    g.chamberId,
    g.ticks % 6,
    g.level.timeLimitSeconds === undefined ? '' : g.ticks,
    +internal.portalLatch,
    internal.nextObjectId,
    ...[...internal.rooms].map(([id, w]) => `${id}:${worldKey(w)}`),
  ].join('|');
}

/** Exhaust a small physical state graph, including waits and horizontal pushes.
 * True means every reachable state repeats or loses. Budget exhaustion and any
 * possible timed growth/emission/enemy/portal event deliberately return false.
 * This diagnoses closed pockets, not general solvability or quota feasibility. */
export function isClosedPocket(game: Simulation, budget = 512): boolean {
  function uncertain(g: Simulation) {
    const w = g.world;
    if (
      g.level.timeLimitSeconds !== undefined ||
      g.level.chambers?.length ||
      g.level.portals?.length ||
      w.enemies.length ||
      w.lootSources?.some((s) => s.activated && s.remaining > 0)
    )
      return true;
    const bushes = [
      ...w.bushRoots,
      ...w.cells.flatMap((cell, i) =>
        cell === 'bush' ? [{ x: i % w.width, y: Math.floor(i / w.width) }] : [],
      ),
    ];
    return bushes.some(
      (root) =>
        g.canSpreadFrom(root) ||
        (g.cell(root) === 'air' && !g.object(root) && (root.x !== w.player.x || root.y !== w.player.y)),
    );
  }
  if (game.world.status !== 'playing' || !Number.isSafeInteger(budget) || budget < 1 || uncertain(game))
    return false;
  const queue = [game],
    seen = new Set([signature(game, true)]);
  for (let at = 0; at < queue.length; at++) {
    for (const input of [...DIRECTIONS, undefined]) {
      const next = clone(queue[at]);
      next.step(input);
      // A wave can fill its last free neighbour in this very step. Checking
      // only future spread on the resulting board would miss that timed event.
      if (
        next.world.status === 'won' ||
        uncertain(next) ||
        next.world.cells.some((cell, i) => cell === 'bush' && queue[at].world.cells[i] !== 'bush')
      )
        return false;
      if (next.world.status === 'lost') continue;
      const key = signature(next, true);
      if (seen.has(key)) continue;
      if (seen.size >= budget) return false;
      seen.add(key);
      queue.push(next);
    }
  }
  return true;
}

/** Reject forced losses and static immobility within a bounded authoring check.
 * Multiple distinct safe continuations are retained. A custom allow policy may
 * conservatively reject physical escapes; this helper never changes game physics. */
export function hasForcedEscape(
  game: Simulation,
  horizon = 8,
  allow: (next: Simulation) => boolean = () => true,
): boolean {
  if (game.world.status === 'lost') return false;
  if (game.world.status === 'won' || horizon <= 0) return true;
  if (isStaticDeadlock(game)) return false;
  const safe = new Map<string, Simulation>();
  for (const input of [...DIRECTIONS, undefined]) {
    const next = clone(game);
    next.step(input);
    if (next.world.status === 'won') return true;
    if (next.world.status !== 'lost' && allow(next)) {
      safe.set(signature(next), next);
      if (safe.size > 1) return true;
    }
  }
  if (safe.size === 0) return false;
  return hasForcedEscape(safe.values().next().value!, horizon - 1, allow);
}

/** Sufficient deadlock check for quiet single-room boards. It deliberately
 * declines to decide when enemies, portals, emissions or growth may change them. */
export function isStaticDeadlock(game: Simulation): boolean {
  const w = game.world;
  if (
    w.status !== 'playing' ||
    game.level.chambers?.length ||
    game.level.portals?.length ||
    w.enemies.length ||
    w.lootSources?.some((s) => s.activated && s.remaining > 0)
  )
    return false;
  for (const direction of DIRECTIONS) {
    const p = neighbour(w.player, direction);
    if (['wall', 'bush'].includes(game.cell(p))) continue;
    if (game.object(p)?.kind !== 'rock') return false;
    if (direction === 'left' || direction === 'right') {
      const destination = neighbour(p, direction);
      if (game.cell(destination) === 'air' && !game.object(destination)) return false;
    }
  }
  const bushes = [
    ...w.bushRoots,
    ...w.cells.flatMap((cell, i) =>
      cell === 'bush' ? [{ x: i % w.width, y: Math.floor(i / w.width) }] : [],
    ),
  ];
  for (const root of bushes)
    if (
      game.canSpreadFrom(root) ||
      (game.cell(root) === 'air' && !game.object(root) && (root.x !== w.player.x || root.y !== w.player.y))
    )
      return false;
  const next = clone(game);
  next.step();
  const n = next.world;
  if (
    n.status === 'won' ||
    next.chamberId !== game.chamberId ||
    n.player.x !== w.player.x ||
    n.player.y !== w.player.y
  )
    return false;
  if (n.status === 'lost') return true;
  if (
    n.collected !== w.collected ||
    n.kills !== w.kills ||
    n.trapped !== w.trapped ||
    n.cells.some((c, i) => c !== w.cells[i]) ||
    n.objects.length !== w.objects.length ||
    n.objects.some((o, i) => {
      const before = w.objects[i];
      return o.id !== before.id || o.x !== before.x || o.y !== before.y || o.falling !== before.falling;
    }) ||
    (n.lootSources ?? []).some(
      (s, i) => s.activated !== w.lootSources?.[i].activated || s.remaining !== w.lootSources?.[i].remaining,
    )
  )
    return false;
  return true;
}

type Node = { game: Simulation; route: ReplayInput[]; score: number };

/** Conservative authoring heuristic: reject harvests that strand the player below a sealed pile. */
export function connectedToExit(game: Simulation): boolean {
  return connectedTo(game, (p) => game.cell(p) === 'exit');
}

export function connectedToGallery(game: Simulation): boolean {
  return connectedTo(game, (p) => p.y === 4);
}
export function connectedToSurface(game: Simulation, y: number): boolean {
  return connectedTo(game, (p) => p.y <= y);
}

function connectedTo(game: Simulation, target: (p: { x: number; y: number }) => boolean): boolean {
  const w = game.world,
    queue = [{ x: w.player.x, y: w.player.y }],
    seen = new Set<string>();
  const bodies = new Map(w.objects.map((o) => [`${o.x},${o.y}`, o]));
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (target(p)) return true;
    for (const dir of DIRECTIONS) {
      const q = neighbour(p, dir),
        key = `${q.x},${q.y}`;
      if (seen.has(key) || game.cell(q) === 'wall' || game.cell(q) === 'bush') continue;
      const rock = bodies.get(key);
      if (rock?.kind === 'rock') {
        const beyond = neighbour(q, dir);
        if (
          !['left', 'right'].includes(dir) ||
          game.cell(beyond) !== 'air' ||
          bodies.has(`${beyond.x},${beyond.y}`)
        )
          continue;
      }
      seen.add(key);
      queue.push(q);
    }
  }
  return false;
}

export function routeTo(
  start: Simulation,
  target: { x: number; y: number; id?: number; portal?: boolean },
  width: number,
  depth: number,
  options?: {
    allowTransition: (before: Simulation, after: Simulation) => boolean;
    stateKey?: (game: Simulation) => string;
    requireStaticExit?: boolean;
  },
): Node | undefined {
  const d = distances(start, target),
    w = start.world;
  const initialObjects = new Set(w.objects.filter((o) => o.kind === 'pickup').map((o) => o.id));
  const targetId = target.id;
  let frontier: Node[] = [{ game: start, route: [], score: 0 }];
  const seen = new Set<string>();
  for (let n = 0; n < depth; n++) {
    // Bound authoring memory; dropping old search keys cannot create a false replay win.
    if (seen.size > 10000) seen.clear();
    const next: Node[] = [];
    for (const node of frontier)
      for (const dir of [...DIRECTIONS, undefined]) {
        if (dir && start.level.id === 13) {
          const p = neighbour(node.game.world.player, dir);
          if (
            p.y === 9 &&
            ((p.x === 18 && node.game.world.objects.some((o) => [13, 15].includes(o.id))) ||
              (p.x === 6 && node.game.world.objects.some((o) => o.id === 17)))
          )
            continue;
        }
        if (dir && start.level.id === 15) {
          const p = neighbour(node.game.world.player, dir);
          if (p.x === 4 && [15, 16].includes(p.y) && node.game.object(p)?.kind === 'pickup' && target.x !== 4)
            continue;
        }
        if (dir && start.level.id === 4 && start.world.kills < 4) {
          const p = neighbour(node.game.world.player, dir);
          if (node.game.cell(p) === 'soil' || node.game.object(p)?.kind === 'pickup') {
            if (
              [10, 18, 26, 34].some(
                (x) =>
                  (p.y === 8 && p.x === x - 1) ||
                  (p.y === 8 && p.x === x && (target.x !== p.x || target.y !== p.y)) ||
                  (p.y === 11 && [x - 1, x].includes(p.x)) ||
                  ([9, 10].includes(p.y) && [x - 2, x + 1].includes(p.x)),
              )
            )
              continue;
          }
        }
        const g = clone(node.game);
        g.step(dir);
        if (g.world.status === 'lost') continue;
        if (start.level.id === 9 && isStaticDeadlock(g)) continue;
        if (options && !options.allowTransition(node.game, g)) continue;
        if (g.chamberId !== start.chamberId && !target.portal) continue;
        const route = [...node.route, dir];
        if (
          g.world.status === 'won' ||
          g.chamberId !== start.chamberId ||
          (targetId !== undefined
            ? !g.world.objects.some((o) => o.id === targetId)
            : g.world.player.x === target.x && g.world.player.y === target.y)
        ) {
          // Reject a move that collects the target but makes death unavoidable next tick.
          if (
            g.world.status === 'playing' &&
            ![...DIRECTIONS, undefined].some((i) => {
              const c = clone(g);
              c.step(i);
              return (
                c.world.status !== 'lost' &&
                (!options ||
                  (options.allowTransition(g, c) &&
                    (start.level.id === 9 ||
                      c.world.player.x !== g.world.player.x ||
                      c.world.player.y !== g.world.player.y ||
                      c.chamberId !== g.chamberId)))
              );
            })
          )
            continue;
          if (start.level.id === 9 && !hasForcedEscape(g, 24)) continue;
          if ((options?.requireStaticExit ?? [9, 16].includes(start.level.id)) && !connectedToExit(g))
            continue;
          return { game: g, route, score: 0 };
        }
        const key = `${signature(g)}|author:${options?.stateKey?.(g) ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const liveTarget =
          targetId === undefined ? undefined : g.world.objects.find((o) => o.id === targetId);
        const dist =
          liveTarget && (liveTarget.x !== target.x || liveTarget.y !== target.y)
            ? Math.abs(liveTarget.x - g.world.player.x) + Math.abs(liveTarget.y - g.world.player.y)
            : d[g.world.player.y * w.width + g.world.player.x];
        const collected =
          w.objects.filter((o) => initialObjects.has(o.id) && o.kind === 'pickup').length -
          g.world.objects.filter((o) => initialObjects.has(o.id) && o.kind === 'pickup').length;
        const score = -dist * 10 + collected * 2 + (g.world.kills - w.kills) * 10 - n * 0.05;
        next.push({ game: g, route, score });
      }
    next.sort((a, b) => b.score - a.score);
    const positions = new Map<string, number>();
    frontier = next
      .filter((node) => {
        const key = `${node.game.world.player.x},${node.game.world.player.y}`;
        const count = positions.get(key) ?? 0;
        positions.set(key, count + 1);
        return count < 2;
      })
      .slice(0, width);
    if (!frontier.length) break;
  }
}

export function solve(
  id: number,
  attempt: number,
  prefix?: readonly ReplayInput[],
): ReplayInput[] | undefined {
  const level = buildCampaignV6()[id - 1];
  let g = new Simulation(level),
    route: ReplayInput[] = [];
  if (prefix) {
    route = [...prefix];
    for (const input of route) g.step(input);
  }
  if (id === 3 && !prefix) {
    // The unchanged two-rock opening already has a production proof in v5.
    route = [...buildCampaignV5()[2].replay!.slice(0, 66)];
    for (const input of route) g.step(input);
    if (g.world.status === 'lost') return;
  }
  if (id === 13 && !prefix) {
    // Clear the lower blind pocket through the central crossing before opening
    // the soil support beneath the rock in the upper vertical passage.
    route = Array<ReplayInput>(9).fill('down');
    for (const input of route) g.step(input);
    const pocket = routeTo(g, { x: 18, y: 15 }, 48, 100);
    if (!pocket) return;
    route.push(...pocket.route);
    g = pocket.game;
  }
  if (id === 9 && !prefix && attempt % 2 === 0) {
    route = [
      ...Array<ReplayInput>(5).fill('right'),
      'up',
      'up',
      'down',
      'left',
      ...Array<ReplayInput>(25).fill(undefined),
    ];
    for (const input of route) g.step(input);
    if (g.world.status === 'lost') return;
  }
  let iteration = 0,
    lastCollected = -1,
    stalled = 0;
  while (iteration++ < 600 && route.length < 6000 && g.world.status === 'playing') {
    const w = g.world;
    const currentCollected = w.collected;
    stalled = currentCollected === lastCollected ? stalled + 1 : 0;
    lastCollected = currentCollected;
    if (stalled > 30) {
      console.log('stalled', id, w.collected, g.requiredRemaining, w.kills);
      return;
    }
    const canFinish = g.exitOpen;
    const points: { x: number; y: number; id?: number; rank: number; portal?: boolean }[] = [];
    const dFromPlayer = distances(g, w.player);
    if (canFinish)
      w.cells.forEach((c, i) => {
        if (c === 'exit') points.push({ x: i % w.width, y: Math.floor(i / w.width), rank: -10000 });
      });
    for (const o of w.objects)
      if (o.kind === 'pickup') {
        const distance = dFromPlayer[o.y * w.width + o.x];
        const jitter = ((o.id * 31 + attempt * 17) % 23) / 4;
        const ordering =
          attempt < 6
            ? 0
            : attempt % 3 === 0
              ? o.y * 3
              : attempt % 3 === 1
                ? -o.y * 3
                : Math.abs(o.x - 20) * 2;
        points.push({ ...o, rank: distance + (o.required ? -(attempt % 3) * 6 : 0) + jitter + ordering });
      }
    for (const source of w.lootSources ?? [])
      if (!source.activated) points.push({ ...source.definition.tile, rank: 0 });
    if (level.gate && !w.trapped && w.collected >= level.quota && g.requiredRemaining === 0)
      points.push({ x: level.gate.x - 1, y: level.gate.y, rank: -100 });
    if (w.kills < (level.requiredKills ?? 0))
      for (const rock of w.objects.filter((o) => o.kind === 'rock')) {
        if (!w.enemies.some((e) => Math.abs(e.x - rock.x) + Math.abs(e.y - rock.y) < 8)) continue;
        const p = { x: rock.x, y: rock.y + 1 };
        if (g.cell(p) === 'soil')
          points.push({ ...p, rank: dFromPlayer[p.y * w.width + p.x] - (attempt % 2 ? 40 : 0) });
      }
    // Portal return is attempted only after exhausting the local chamber's useful loot.
    for (const p of g.activePortals)
      if (p.x !== w.player.x || p.y !== w.player.y)
        points.push({ ...p, portal: true, rank: 1000 + dFromPlayer[p.y * w.width + p.x] });
    points.sort((a, b) => a.rank - b.rank);
    let found: Node | undefined;
    for (const p of points.slice(0, attempt < 3 ? 12 : 30)) {
      found = routeTo(
        g,
        p,
        attempt < 3 ? 16 : 48,
        Math.min(240, Math.max(60, 30 + dFromPlayer[p.y * w.width + p.x] * 3)),
      );
      if (found) break;
    }
    if (!found && [9, 16].includes(id)) {
      // A reservoir can require moving a settled rock before any further loot
      // becomes reachable. These are physical push goals, not removed objects.
      const rocks = w.objects
        .filter(
          (o) =>
            o.kind === 'rock' &&
            !o.falling &&
            ['left', 'right'].some((dir) => {
              const p = neighbour(o, dir as Direction);
              return g.cell(p) === 'air' && !g.object(p);
            }),
        )
        .sort((a, b) => dFromPlayer[a.y * w.width + a.x] - dFromPlayer[b.y * w.width + b.x] || b.y - a.y);
      for (const rock of rocks) {
        found = routeTo(g, { x: rock.x, y: rock.y }, 48, 140);
        if (found) break;
      }
    }
    if (!found) {
      writeFileSync(
        `reports/bongo-campaign-v6/partial-${id}-${attempt}.json`,
        JSON.stringify({ route, world: w }),
      );
      console.log('no path', id, w.collected, g.requiredRemaining, w.kills, `${w.player.x},${w.player.y}`);
      return;
    }
    route.push(...found.route);
    g = found.game;
    if (process.env.BONGO_VERIFY_CHECKPOINTS === '1') {
      const fresh = new Simulation(level);
      for (const input of route) fresh.step(input);
      if (JSON.stringify(fresh.world) !== JSON.stringify(g.world)) {
        writeFileSync(
          'reports/bongo-campaign-v6/checkpoint-difference.json',
          JSON.stringify({ route, fresh: fresh.world, search: g.world }),
        );
        throw new Error(`Checkpoint diverged ${id} iteration ${iteration}`);
      }
    }
    if (iteration % 25 === 0)
      console.log(
        id,
        attempt,
        'progress',
        route.length,
        w.collected,
        g.requiredRemaining,
        g.world.kills,
        g.chamberId,
      );
  }
  if (g.world.status === 'won') return route;
}

if (process.argv[1]?.endsWith('solve.ts')) {
  mkdirSync('reports/bongo-campaign-v6', { recursive: true });
  const id = Number(process.argv[2] ?? 1),
    attempts = Number(process.argv[3] ?? 6);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const prefix = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')) : undefined;
    const route = solve(id, attempt, prefix);
    if (route) {
      const game = new Simulation(buildCampaignV6()[id - 1]);
      for (const input of route) game.step(input);
      if (game.world.status !== 'won')
        throw new Error('Checkpoint search differed from fresh production replay');
      writeFileSync(`reports/bongo-campaign-v6/route-${id}.json`, JSON.stringify(route));
      console.log('WON', id, route.length, game.world.collected);
      process.exit(0);
    }
    console.log('No winning route in bounded attempt', id, attempt);
  }
  process.exitCode = 2;
}
