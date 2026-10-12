import { describe, expect, it } from 'vitest';
import { interpolateMatch } from './interpolate';
import { FighterSimulation } from '../simulation/FighterSimulation';
import { amperDefinition } from '../data/fighters/amper';

describe('online presentation', () => {
  it('interpolates positions without changing combat decisions or source snapshots', () => {
    const sim = new FighterSimulation(amperDefinition, amperDefinition);
    const before = sim.getSnapshot();
    const after = sim.getSnapshot();
    after.p1.x += 100;
    after.p2.y = 80;
    after.p2.hp = 500;
    const view = interpolateMatch(before, after, 0.5);
    expect(view.p1.x).toBe(before.p1.x + 50);
    expect(view.p2.y).toBe(40);
    expect(view.p2.hp).toBe(500);
    expect(before.p2.hp).toBe(1000);
    expect(after.p2.y).toBe(80);
    after.roundNumber++;
    expect(interpolateMatch(before, after, 0.5)).toBe(after);
  });
  it('retains actor identities while loading isolated authoritative snapshots', () => {
    const sim = new FighterSimulation(amperDefinition, amperDefinition);
    const state = sim.getState(),
      p1 = state.p1,
      p2 = state.p2;
    const snapshot = sim.getSnapshot();
    snapshot.p2.hp = 400;
    p2.isAirJuggle = true;
    sim.loadSnapshot(snapshot);
    expect(p2.isAirJuggle).toBeUndefined();
    expect(sim.getState()).toBe(state);
    expect(sim.getState().p1).toBe(p1);
    expect(sim.getState().p2).toBe(p2);
    snapshot.p2.hp = 0;
    expect(p2.hp).toBe(400);
  });
});
