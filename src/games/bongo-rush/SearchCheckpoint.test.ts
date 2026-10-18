import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import { buildCampaignV6 } from './CampaignV6';
import {
  clone,
  signature,
  solve,
  routeTo,
  hasForcedEscape,
  isStaticDeadlock,
  isClosedPocket,
} from '../../../scripts/bongo-v6/solve';
import proofs from './data/campaign-v6-proofs.json';
import type { ReplayInput } from './types';

describe('offline search checkpoints', () => {
  it('exhausts a closed walking pocket without confusing survival with escape', () => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['########', '#QE#####', '########', '###P ###', '########'],
    });
    const before = signature(game);
    expect(isStaticDeadlock(game)).toBe(false);
    expect(hasForcedEscape(game, 24)).toBe(true);
    expect(isClosedPocket(game, 1)).toBe(false);
    for (const budget of [0, -1, 1.5, NaN, Infinity]) expect(isClosedPocket(game, budget)).toBe(false);
    expect(isClosedPocket(game)).toBe(true);
    expect(signature(game)).toBe(before);
  });
  it('keeps a physical solution that requires waiting and pushing settled rocks', () => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['########', '#RRR   #', '#PQ   E#', '########'],
    });
    game.step('right');
    expect(isClosedPocket(game)).toBe(false);
    for (const input of [undefined, 'right', 'up', 'right', 'right', 'right', 'down'] as ReplayInput[])
      game.step(input);
    expect(game.world.status).toBe('won');
  });
  it('declines to exhaust a pocket when future growth can change the board', () => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['########', '#V EQ###', '########', '###P ###', '########'],
    });
    expect(isClosedPocket(game)).toBe(false);
  });
  it('declines when a wave fills its last available neighbour during a transition', () => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      bushGrowthSeconds: 0.2,
      rows: ['#######', '###V###', '##EPQ##', '#######'],
    });
    expect(isClosedPocket(game)).toBe(false);
    game.step('right');
    expect(game.cell({ x: 3, y: 2 })).toBe('bush');
    expect(game.world.bushBirths).toContainEqual({ at: { x: 3, y: 2 }, from: { x: 3, y: 1 }, tick: 1 });
  });
  it.each([false, true])('rejects static immobility but keeps a legal horizontal push: %s', (canPush) => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['#######', '#QE####', '###R###', canPush ? '# RPR##' : '##RPR##', '###R###', '#######'],
    });
    const before = signature(game);
    expect(isStaticDeadlock(game)).toBe(!canPush);
    expect(signature(game)).toBe(before);
    if (canPush) {
      game.step('left');
      expect(game.world.player.x).toBe(2);
    } else {
      for (let tick = 0; tick < 30; tick++) game.step();
      expect(game.world.player).toMatchObject({ x: 3, y: 3 });
      expect(game.world.collected).toBe(0);
    }
  });
  it('does not classify a board with possible future bush growth as static', () => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['#######', '#V EQ##', '###R###', '##RPR##', '###R###', '#######'],
    });
    expect(isStaticDeadlock(game)).toBe(false);
    for (let tick = 0; tick < 30; tick++) game.step();
    expect(game.cell({ x: 2, y: 1 })).toBe('bush');
  });
  it.each([false, true])('detects a forced shaft death while preserving a side exit: %s', (sideExit) => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['#######', '#E#R###', '### ###', '###P###', sideExit ? '###Q ##' : '###Q###', '#######'],
    });
    game.step();
    const before = signature(game);
    expect(hasForcedEscape(game, 1)).toBe(true);
    expect(hasForcedEscape(game, 2)).toBe(sideExit);
    expect(signature(game)).toBe(before);
    game.step('down');
    game.step(sideExit ? 'right' : undefined);
    expect(game.world.status === 'lost').toBe(!sideExit);
  });
  it('can disable the static exit heuristic when excavating a support opens the exit later', () => {
    const source = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['######', '#PQRE#', '#...##', '######'],
    });
    expect(routeTo(source, { x: 2, y: 1 }, 8, 1)).toBeUndefined();
    const found = routeTo(source, { x: 2, y: 1 }, 8, 1, {
      requireStaticExit: false,
      allowTransition: () => true,
    });
    expect(found?.route).toEqual(['right']);
    expect(source.world.collected).toBe(0);
    for (const d of ['right', 'down', 'right', 'left', 'up', 'right', 'right'] as const) source.step(d);
    expect(source.world.status).toBe('won');
  });
  it('allows a safe reaction beat while adjacent fallen rocks settle before a push', () => {
    const game = new Simulation({
      id: 9,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['########', '#RRR   #', '#PQ   E#', '########'],
    });
    const result = routeTo(game, { x: 2, y: 2 }, 8, 1, {
      requireStaticExit: false,
      allowTransition: () => true,
    });
    expect(result?.route).toEqual(['right']);
    expect(game.world.collected).toBe(0);
    const fresh = new Simulation(game.level);
    for (const d of ['right', undefined, 'right', 'up', 'right', 'right', 'right', 'down'] as ReplayInput[])
      fresh.step(d);
    expect(fresh.world.status).toBe('won');
  });
  it('keeps a supplied prefix instead of replacing it with a special level opening', () => {
    const prefix = proofs['13'].inputs.map((d) => d ?? undefined) as ReplayInput[];
    expect(solve(13, 0, prefix)).toEqual(prefix);
    const fresh = new Simulation(buildCampaignV6()[12]);
    for (const d of prefix) fresh.step(d);
    expect(fresh.world.status).toBe('won');
  });
  it('distinguishes identical blocked boards at different growth phases', () => {
    const level = buildCampaignV6()[5],
      a = new Simulation(level),
      b = new Simulation(level);
    for (let i = 0; i < 6; i++) b.step();
    expect(b.world.cells).toEqual(a.world.cells);
    expect(signature(b)).not.toBe(signature(a));
  });
  it('branches without modifying the source and agrees with input-only production replay across portals', () => {
    const level = buildCampaignV6()[11],
      source = new Simulation(level),
      before = signature(source);
    const branch = clone(source),
      fresh = new Simulation(level);
    const inputs: ReplayInput[] = ['up', 'right', 'right', 'down', undefined, 'right'];
    for (const d of inputs) {
      branch.step(d);
      fresh.step(d);
    }
    expect(signature(source)).toBe(before);
    expect(signature(branch)).toBe(signature(fresh));
    expect(branch.world).toEqual(fresh.world);
    expect(branch.chamberId).not.toBe('main');
  });
  it('retains the emission backpressure state while cloning a rich cache', () => {
    const level = buildCampaignV6()[9],
      source = new Simulation(level);
    for (const d of ['right', 'right', 'right', 'right'] as const) source.step(d);
    const branch = clone(source),
      before = signature(source),
      fresh = new Simulation(level);
    for (const d of ['right', 'right', 'right', 'right'] as const) fresh.step(d);
    for (const d of ['left', 'left', 'down', 'down', undefined] as ReplayInput[]) {
      branch.step(d);
      fresh.step(d);
    }
    expect(signature(source)).toBe(before);
    expect(signature(branch)).toBe(signature(fresh));
  });
});
