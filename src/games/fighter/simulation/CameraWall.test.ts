import { describe, expect, it } from 'vitest';
import { ROSTER } from '../data/fighters/roster';
import { FighterSimulation } from './FighterSimulation';
import { enforceMaxSeparation, MAX_FIGHTER_SEPARATION, STAGE_HALF_WIDTH } from './Movement';
import { INPUT } from './CombatTypes';

describe('Fighting-game camera wall and separation constraint', () => {
  const def1 = ROSTER.amper.definition;
  const def2 = ROSTER.korba.definition;

  it('stops a retreating fighter at MAX_FIGHTER_SEPARATION without dragging the opponent', () => {
    const sim = new FighterSimulation(def1, def2);
    const state = sim.getState();

    // Place fighters at standard distance
    state.p1.x = -100;
    state.p2.x = 100;

    // P1 retreats left (INPUT.LEFT), P2 stands still
    for (let i = 0; i < 120; i++) {
      sim.update(INPUT.LEFT, 0);
    }

    const dist = Math.abs(state.p2.x - state.p1.x);
    expect(dist).toBeCloseTo(MAX_FIGHTER_SEPARATION, 1);
    // P2 should not have been dragged to the left
    expect(state.p2.x).toBe(100);
    expect(state.p1.x).toBeCloseTo(100 - MAX_FIGHTER_SEPARATION, 1);
  });

  it('shares excess separation when both fighters walk away simultaneously', () => {
    const sim = new FighterSimulation(def1, def2);
    const state = sim.getState();

    state.p1.x = -150;
    state.p2.x = 150;

    // P1 walks left, P2 walks right
    for (let i = 0; i < 90; i++) {
      sim.update(INPUT.LEFT, INPUT.RIGHT);
    }

    const dist = Math.abs(state.p2.x - state.p1.x);
    expect(dist).toBeLessThanOrEqual(MAX_FIGHTER_SEPARATION + 0.01);
    expect(state.p1.x).toBeLessThan(state.p2.x);
  });

  it('never prevents fighters from walking towards each other', () => {
    const sim = new FighterSimulation(def1, def2);
    const state = sim.getState();

    // Start at maximum separation
    state.p1.x = -MAX_FIGHTER_SEPARATION / 2;
    state.p2.x = MAX_FIGHTER_SEPARATION / 2;

    // Both walk forward towards each other
    for (let i = 0; i < 30; i++) {
      sim.update(INPUT.RIGHT, INPUT.LEFT);
    }

    const dist = Math.abs(state.p2.x - state.p1.x);
    expect(dist).toBeLessThan(MAX_FIGHTER_SEPARATION - 50);
  });

  it('keeps both fighters within stage boundaries when separation reaches arena edges', () => {
    const state = new FighterSimulation(def1, def2).getState();
    const p1 = state.p1;
    const p2 = state.p2;

    // Extreme placement near right edge
    p1.x = STAGE_HALF_WIDTH - MAX_FIGHTER_SEPARATION - 100;
    p2.x = STAGE_HALF_WIDTH + 50; // Outside wall initially
    p2.vx = 10;

    enforceMaxSeparation(p1, def1, p2, def2);

    expect(p1.x + def1.pushbox.w / 2).toBeLessThanOrEqual(STAGE_HALF_WIDTH);
    expect(p1.x - def1.pushbox.w / 2).toBeGreaterThanOrEqual(-STAGE_HALF_WIDTH);
    expect(p2.x + def2.pushbox.w / 2).toBeLessThanOrEqual(STAGE_HALF_WIDTH);
    expect(p2.x - def2.pushbox.w / 2).toBeGreaterThanOrEqual(-STAGE_HALF_WIDTH);
    expect(Math.abs(p2.x - p1.x)).toBeLessThanOrEqual(MAX_FIGHTER_SEPARATION + 0.01);
  });
});
