import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../src/games/bongo-rush/Levels';
import { Simulation } from '../src/games/bongo-rush/Simulation';
import { neighbour, same, STEP_SECONDS } from '../src/games/bongo-rush/types';
import type { Direction } from '../src/games/bongo-rush/types';

/** Replays real game inputs without teleporting, clearing rocks or changing the simulation clock. */
function simulate(index: number, pauseAtTurns: boolean) {
  const level = LEVELS[index],
    game = new Simulation(level);
  let falls = 0,
    pushes = 0,
    underRockHarvests = 0;
  let previous;
  /** Counts motion on idle ticks too, so the two profiles measure the same physical events. */
  function advance(input?: Direction): void {
    game.step(input);
    falls += game.world.objects.filter((body) => body.kind === 'rock' && body.y > body.previous.y).length;
    pushes += game.drainSounds().filter((sound) => sound === 'push').length;
  }
  for (const input of level.solution) {
    const danger =
      level.bonus &&
      [...game.world.enemies, ...game.world.objects.filter((body) => body.falling)].some(
        (body) => Math.abs(body.x - game.world.player.x) + Math.abs(body.y - game.world.player.y) <= 3,
      );
    if (pauseAtTurns && previous && previous !== input && !danger) {
      for (let wait = 0; wait < (level.bonus ? 8 : 2); wait++) advance();
    }
    const target = neighbour(game.world.player, input);
    const harvesting =
      game.object(target)?.required && game.object({ x: target.x, y: target.y - 1 })?.kind === 'rock';
    const before = game.world.collected;
    advance(input);
    assert.notEqual(game.world.status, 'lost', `${level.id}: ${game.world.reason}`);
    assert(same(game.world.player, target), `${level.id}: blocked ${input} at tick ${game.world.tick}`);
    if (harvesting && game.world.collected > before) underRockHarvests++;
    previous = input;
  }
  assert.equal(game.world.status, 'won');
  assert.equal(game.requiredRemaining, 0);
  return {
    level: level.id,
    puzzle: level.vault!.name,
    result: 'WON',
    profile: pauseAtTurns
      ? level.bonus
        ? 'eight-tick-planning-outside-live-hazards'
        : 'two-idle-ticks-at-turns'
      : 'continuous',
    moves: level.solution.length,
    ticks: game.world.tick,
    simulatedSeconds: Number((game.world.tick * STEP_SECONDS).toFixed(2)),
    limitSeconds: level.timeLimitSeconds,
    remainingSeconds: Number(game.remainingSeconds!.toFixed(2)),
    requiredLoot: level.requiredPickups!.length,
    collected: game.world.collected,
    underRockHarvests,
    rockFallSteps: falls,
    pushes,
    trappedBoss: game.world.trapped,
    kills: game.world.kills,
    requiredKills: level.requiredKills ?? 0,
  };
}

const results = LEVELS.flatMap((_, index) => [simulate(index, false), simulate(index, true)]);
mkdirSync('reports/bongo-avalanche', { recursive: true });
writeFileSync('reports/bongo-avalanche/simulation-report.json', `${JSON.stringify(results, null, 2)}\n`);
console.table(results);
