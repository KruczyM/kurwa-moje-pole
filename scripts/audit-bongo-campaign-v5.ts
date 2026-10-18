import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/games/bongo-rush/Levels';
import { Simulation } from '../src/games/bongo-rush/Simulation';
import type { ReplayInput } from '../src/games/bongo-rush/types';

const out = 'reports/bongo-campaign-v5';
mkdirSync(out, { recursive: true });
const summaries = [],
  routes = [],
  failures = [];
for (const level of LEVELS) {
  const game = new Simulation(level),
    route: ReplayInput[] = [];
  for (const input of level.replay ?? level.solution) {
    route.push(input);
    game.step(input);
    assert.notEqual(game.world.status, 'lost', `${level.id}:${game.ticks} ${game.world.reason}`);
    if (game.world.status === 'won') break;
  }
  assert.equal(
    game.world.status,
    'won',
    `${level.id}: incomplete loot=${game.world.collected} mandatory=${game.requiredRemaining} kills=${game.world.kills} player=${game.world.player.x},${game.world.player.y}`,
  );
  assert.equal(game.requiredRemaining, 0);
  routes.push({ id: level.id, style: level.style ?? 'challenge', solution: route });
  summaries.push({
    id: level.id,
    result: 'WON',
    ticks: game.ticks,
    collected: game.world.collected,
    kills: game.world.kills,
    trapped: game.world.trapped,
  });
  // Record a concrete failed sequence as well as the correct one. This does not claim
  // every single mistaken move is irreversible or that an automatic audit proves fun.
  for (let i = 0; i < route.length; i++) {
    if (!route[i]) continue;
    const altered = [...route];
    altered[i] = undefined;
    const wrong = new Simulation(level);
    for (const input of altered) wrong.step(input);
    if (wrong.world.status === 'won') continue;
    failures.push({
      id: level.id,
      omittedInput: route[i],
      atTick: i + 1,
      result: wrong.world.status,
      reason:
        wrong.world.reason ||
        'Sekwencja nie realizuje wymaganych zależności; możliwy restart lub naprawienie trasy.',
      requiredRemaining: wrong.requiredRemaining,
      inputs: altered,
    });
    break;
  }
}
assert.equal(failures.length, 24);
writeFileSync(`${out}/simulation.json`, JSON.stringify(summaries, null, 2));
writeFileSync(`${out}/browser-routes.json`, JSON.stringify(routes));
writeFileSync(`${out}/failed-sequences.json`, JSON.stringify(failures, null, 2));
console.table(summaries);
console.log('24 winning routes and 24 failed sequences recorded.');
