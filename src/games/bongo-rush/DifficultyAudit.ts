import { Simulation } from './Simulation';
import { DIRECTIONS, neighbour, same } from './types';
import type { Direction, LevelDefinition, Point } from './types';

/** Measures real patrol travel and drop recovery along an unmodified, input-only replay. */
export function auditPatrols(level: LevelDefinition, inputs = level.solution) {
  const game = new Simulation(level);
  const initial = game.world.enemies.map((enemy) => ({ ...enemy }));
  const paths = new Map(initial.map((enemy) => [enemy.id, new Set<string>()]));
  const closest = new Map(initial.map((enemy) => [enemy.id, Infinity]));
  const drops = new Set<number>();
  let recovered = 0;
  for (const input of inputs) {
    const target = neighbour(game.world.player, input);
    const pickup = game.object(target);
    if (pickup && drops.has(pickup.id)) recovered++;
    const alive = new Set(game.world.enemies.map((enemy) => enemy.id));
    game.step(input);
    if (!same(game.world.player, target) || game.world.status === 'lost')
      throw new Error(`Invalid patrol replay ${level.id}: ${game.world.reason}`);
    for (const body of game.world.objects)
      if (body.kind === 'pickup' && alive.has(body.id)) drops.add(body.id);
    for (const enemy of game.world.enemies) {
      paths.get(enemy.id)!.add(`${enemy.x},${enemy.y}`);
      closest.set(
        enemy.id,
        Math.min(
          closest.get(enemy.id)!,
          Math.abs(enemy.x - game.world.player.x) + Math.abs(enemy.y - game.world.player.y),
        ),
      );
    }
  }
  if (game.world.status !== 'won') throw new Error(`Unsolved patrol replay ${level.id}`);
  return {
    result: game.world.status,
    kills: game.world.kills,
    recoveredDrops: recovered,
    patrols: initial.map((enemy) => ({
      kind: enemy.kind,
      spawn: { x: enemy.x, y: enemy.y },
      role: level.encounters?.find((encounter) => same(encounter.spawn, enemy))?.role,
      visited: paths.get(enemy.id)!.size,
      closest: closest.get(enemy.id),
    })),
  };
}

/** Audits actual solution mechanics, not a claimed human difficulty score based on map size. */
export function auditDifficulty(level: LevelDefinition) {
  const game = new Simulation(level);
  let pushes = 0,
    dangerousHarvests = 0,
    reversals = 0,
    requiredCollected = 0;
  let harvests = 0;
  let previous: Direction | undefined;
  const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const rows = new Set<number>();
  for (const direction of level.solution) {
    const target = neighbour(game.world.player, direction);
    const body = game.object(target);
    if (body?.kind === 'pickup' && game.object({ x: target.x, y: target.y - 1 })?.kind === 'rock') harvests++;
    if (body?.required) {
      requiredCollected++;
      rows.add(target.y);
      if (game.object({ x: target.x, y: target.y - 1 })?.kind === 'rock') dangerousHarvests++;
    }
    if (previous && opposite[previous] === direction) reversals++;
    game.step(direction);
    pushes += game.drainSounds().filter((sound) => sound === 'push').length;
    if (!same(game.world.player, target) || game.world.status === 'lost')
      throw new Error(`Invalid difficulty replay ${level.id}: ${game.world.reason}`);
    previous = direction;
  }
  if (game.world.status !== 'won') throw new Error(`Unsolved difficulty replay ${level.id}`);
  return {
    level: level.id,
    moves: level.solution.length,
    pushes,
    dangerousHarvests,
    reversals,
    requiredCollected,
    requiredRows: rows.size,
    kills: game.world.kills,
    harvests,
    result: game.world.status,
  };
}

/** Finds the nearest visible objective, ignoring future gravity: deliberately naive, not a full solver. */
function greedyDirection(game: Simulation): Direction | undefined {
  const targets: Point[] = game.exitOpen
    ? game.world.cells.flatMap((cell, index) =>
        cell === 'exit' ? [{ x: index % game.world.width, y: Math.floor(index / game.world.width) }] : [],
      )
    : game.world.objects.filter((body) => body.kind === 'pickup');
  const targetKeys = new Set(targets.map((point) => point.y * game.world.width + point.x));
  const queue: { point: Point; first?: Direction }[] = [{ point: game.world.player }];
  const seen = new Set<number>([game.world.player.y * game.world.width + game.world.player.x]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    for (const direction of DIRECTIONS) {
      const point = neighbour(current.point, direction),
        key = point.y * game.world.width + point.x;
      if (seen.has(key) || ['wall', 'bush'].includes(game.cell(point)) || game.enemy(point)) continue;
      if (game.cell(point) === 'exit' && !game.exitOpen) continue;
      const body = game.object(point);
      if (body?.kind === 'rock') {
        const destination = neighbour(point, direction);
        if (
          !['left', 'right'].includes(direction) ||
          body.falling ||
          game.cell(destination) !== 'air' ||
          game.object(destination) ||
          game.enemy(destination)
        )
          continue;
      }
      const first = current.first ?? direction;
      if (targetKeys.has(key)) return first;
      seen.add(key);
      queue.push({ point, first });
    }
  }
  return;
}

/** Tries nearest-pickup play without anticipating collapse or preparing pockets; failure is not proof of difficulty. */
export function runGreedyProbe(level: LevelDefinition, maximumTicks = 2000) {
  const game = new Simulation(level);
  let steps = 0;
  for (; steps < maximumTicks && game.world.status === 'playing'; steps++) {
    const input = greedyDirection(game);
    if (!input) break;
    game.step(input);
  }
  return {
    status: game.world.status,
    steps,
    requiredRemaining: game.requiredRemaining,
    reason: game.world.reason || (steps === maximumTicks ? 'probe-budget' : 'no-naive-route'),
  };
}
