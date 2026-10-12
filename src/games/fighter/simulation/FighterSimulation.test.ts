import { describe, expect, it } from 'vitest';
import { INPUT } from './CombatTypes';
import { FighterSimulation } from './FighterSimulation';
import { amperDefinition } from '../data/fighters/amper';
import { korbaDefinition } from '../data/fighters/korba';
import { combatMove } from './combatTiming';
import { checkHit } from './CombatResolver';
import { resolvePushboxes } from './Movement';
import { ROSTER } from '../data/fighters/roster';

function close(): FighterSimulation {
  const sim = new FighterSimulation(amperDefinition, korbaDefinition);
  sim.getState().p1.x = -25;
  sim.getState().p2.x = 25;
  return sim;
}
function advance(sim: FighterSimulation, ticks: number, p1 = 0, p2 = 0): void {
  for (let i = 0; i < ticks; i++) sim.update(p1, p2);
}
function untilHit(sim: FighterSimulation, p1 = 0, p2 = 0): void {
  const hp = sim.getState().p2.hp;
  for (let i = 0; i < 90 && sim.getState().p2.hp === hp; i++) sim.update(p1, p2);
  expect(sim.getState().p2.hp).toBeLessThan(hp);
}

describe('FighterSimulation — timed combat', () => {
  it('initializes health, facing and movement', () => {
    const sim = new FighterSimulation(amperDefinition, korbaDefinition);
    expect(sim.getState().p1.hp).toBe(1000);
    expect(sim.getState().p2.hp).toBe(950);
    advance(sim, 10, INPUT.RIGHT);
    expect(sim.getState().p1.x).toBeGreaterThan(-180);
    expect(sim.getState().p1.state).toBe('walk_fwd');
  });
  it('never hits before startup finishes', () => {
    const sim = close();
    sim.update(INPUT.LP, 0);
    const hp = sim.getState().p2.hp;
    const startup = sim.getState().p1.currentMove!.startup;
    expect(startup).toBeGreaterThanOrEqual(9);
    advance(sim, startup);
    expect(sim.getState().p2.hp).toBe(hp);
    sim.update(0, 0);
    expect(sim.getState().p2.hp).toBeLessThan(hp);
    expect(sim.getState().p1.meter).toBeGreaterThan(0);
  });
  it('mashing cannot cancel a whiff or skip recovery', () => {
    const sim = new FighterSimulation(amperDefinition, korbaDefinition);
    sim.update(INPUT.LP, 0);
    const move = sim.getState().p1.currentMove!;
    for (let i = 1; i < move.startup + move.active + move.recovery; i++) {
      sim.update(i % 2 ? INPUT.RP : INPUT.LP, 0);
      expect(sim.getState().p1.currentMove?.id).toBe('light_punch');
    }
    sim.update(0, 0);
    expect(sim.getState().p1.state).toBe('idle');
  });
  it('holding attack never auto-repeats', () => {
    const sim = close();
    advance(sim, 150, INPUT.LP);
    expect(sim.getState().p1.state).toBe('idle');
    expect(sim.getEvents().filter((e) => e.type === 'hit')).toHaveLength(1);
  });
  it('mid hits cause chip and real blockstun', () => {
    const sim = close();
    const hp = sim.getState().p2.hp;
    sim.update(INPUT.RP, INPUT.BLOCK);
    untilHit(sim, 0, INPUT.BLOCK);
    const defender = sim.getState().p2;
    expect(hp - defender.hp).toBe(Math.floor(amperDefinition.moves.heavy_punch!.damage * 0.1));
    expect(defender.state).toBe('block_high');
    const stun = defender.stunTicks!;
    advance(sim, defender.hitstop, 0, INPUT.BLOCK);
    expect(defender.stunTicks).toBe(stun);
    advance(sim, stun - 1);
    expect(defender.state).toBe('block_high');
    sim.update(0, 0);
    expect(defender.state).toBe('idle');
  });
  it('hitstun prevents attack and guard until its end', () => {
    const sim = close();
    sim.update(INPUT.RP, 0);
    untilHit(sim);
    const defender = sim.getState().p2;
    advance(sim, defender.stunTicks! + defender.hitstop - 1, 0, INPUT.LP | INPUT.BLOCK);
    expect(defender.state).toBe('hit_stun');
    expect(defender.currentMove).toBeNull();
    sim.update(0, INPUT.BLOCK);
    expect(defender.state).toBe('block_high');
  });
  it('high whiffs over crouch; mid uppercut launches', () => {
    const sim = close();
    const hp = sim.getState().p2.hp;
    sim.update(INPUT.LP, INPUT.DOWN);
    advance(sim, 40, 0, INPUT.DOWN);
    expect(sim.getState().p2.hp).toBe(hp);
    sim.update(INPUT.DOWN | INPUT.RP, INPUT.DOWN | INPUT.BLOCK);
    untilHit(sim, 0, INPUT.DOWN | INPUT.BLOCK);
    expect(sim.getState().p2.isAirJuggle).toBe(true);
    advance(sim, sim.getState().p2.hitstop + 5);
    expect(sim.getState().p2.y).toBeGreaterThan(0);
  });
  it('sweep beats standing guard, pushes away and allows protected get-up', () => {
    const sim = close();
    sim.update(INPUT.DOWN | INPUT.RK, INPUT.BLOCK);
    untilHit(sim, 0, INPUT.BLOCK);
    const defender = sim.getState().p2;
    expect(defender.state).toBe('knockdown');
    expect(defender.vx).toBeGreaterThan(0);
    advance(sim, defender.hitstop);
    advance(sim, 25, 0, INPUT.LP);
    expect(defender.state).toBe('get_up');
    advance(sim, 36);
    expect(defender.state).toBe('idle');
    expect(defender.juggleHits).toBe(0);
  });
  it('crouching guard blocks sweep but crouch alone does not', () => {
    for (const guard of [true, false]) {
      const sim = close();
      const input = INPUT.DOWN | (guard ? INPUT.BLOCK : 0);
      sim.update(INPUT.DOWN | INPUT.RK, input);
      untilHit(sim, 0, input);
      expect(sim.getState().p2.state).toBe(guard ? 'block_low' : 'knockdown');
    }
  });
  it('launcher lands in knockdown; juggle has a hard limit', () => {
    const sim = close();
    sim.update(INPUT.DOWN | INPUT.RP, 0);
    untilHit(sim);
    const state = sim.getState();
    state.p1.hitstop = state.p2.hitstop = 0;
    state.p2.juggleHits = 3;
    state.p1.state = 'attack';
    state.p1.currentMove = combatMove(amperDefinition.moves.heavy_punch!);
    state.p1.moveTick = state.p1.currentMove.startup + 1;
    state.p1.hasHit = false;
    expect(checkHit(state.p1, amperDefinition, state.p2, korbaDefinition, 0)).toBeNull();
    for (let i = 0; i < 100 && state.p2.state !== 'knockdown'; i++) sim.update(0, 0);
    expect(state.p2.isGrounded).toBe(true);
    expect(state.p2.state).toBe('knockdown');
  });
  it('simultaneous strikes trade fairly, including double KO', () => {
    const sim = new FighterSimulation(amperDefinition, amperDefinition);
    const state = sim.getState();
    state.p1.x = -25;
    state.p2.x = 25;
    state.p1.hp = state.p2.hp = 1;
    sim.update(INPUT.LP, INPUT.LP);
    advance(sim, 10);
    expect(state.p1.hp).toBe(0);
    expect(state.p2.hp).toBe(0);
    expect(state.winner).toBe('draw');
  });
  it('timeout cannot accept attacks after round ends', () => {
    const sim = close();
    const state = sim.getState();
    state.roundTimer = 1;
    state.stateTicks = 59;
    sim.update(INPUT.RP, 0);
    expect(state.roundState).toBe('roundOver');
    expect(state.p1.currentMove).toBeNull();
  });
  it('pushboxes stay inside both walls and never overlap', () => {
    const { p1, p2 } = close().getState();
    for (const sign of [-1, 1]) {
      p1.x = sign * 590;
      p2.x = sign * 560;
      resolvePushboxes(p1, amperDefinition, p2, korbaDefinition);
      expect(Math.abs(p1.x)).toBeLessThanOrEqual(575);
      expect(Math.abs(p2.x)).toBeLessThanOrEqual(575);
      expect(Math.abs(p1.x - p2.x)).toBeGreaterThanOrEqual(
        (amperDefinition.pushbox.w + korbaDefinition.pushbox.w) / 2,
      );
    }
  });
  it('restores input edges and subsequent replay exactly', () => {
    const sim = close();
    sim.update(INPUT.LP, 0);
    advance(sim, 50, INPUT.LP);
    const restored = close();
    restored.loadSnapshot(sim.getSnapshot());
    for (let i = 0; i < 120; i++) {
      const mask = i < 20 ? INPUT.LP : i % 30 === 0 ? INPUT.RP : 0;
      sim.update(mask, INPUT.BLOCK);
      restored.update(mask, INPUT.BLOCK);
      expect(restored.getSnapshot()).toEqual(sim.getSnapshot());
    }
  });
  it('super needs meter and cannot damage out of range', () => {
    const sim = new FighterSimulation(amperDefinition, korbaDefinition);
    sim.update(INPUT.SPECIAL, 0);
    expect(sim.getEvents().some((e) => e.type === 'meter_empty')).toBe(true);
    sim.update(0, 0);
    sim.getState().p1.meter = 100;
    sim.update(INPUT.SPECIAL, 0);
    expect(sim.getState().p1.meter).toBe(0);
    advance(sim, 100);
    expect(sim.getState().p2.hp).toBe(950);
  });
  it('applies timing floors to all 16 characters without changing source data', () => {
    for (const entry of Object.values(ROSTER)) {
      const original = JSON.stringify(entry.definition);
      const sim = new FighterSimulation(entry.definition, korbaDefinition);
      sim.update(INPUT.LP, 0);
      expect(sim.getState().p1.currentMove!.startup).toBeGreaterThanOrEqual(9);
      expect(sim.getState().p1.currentMove!.recovery).toBeGreaterThanOrEqual(15);
      expect(JSON.stringify(entry.definition)).toBe(original);
    }
  });

  it('super can be blocked and only applies the simulation chip once', () => {
    const sim = close();
    const state = sim.getState();
    const hp = state.p2.hp;
    state.p1.meter = 100;
    sim.update(INPUT.SPECIAL, INPUT.BLOCK);
    untilHit(sim, 0, INPUT.BLOCK);
    expect(state.p2.state).toBe('block_high');
    expect(hp - state.p2.hp).toBe(Math.floor(amperDefinition.moves.ultimate!.damage * 0.1));
    const after = state.p2.hp;
    advance(sim, 100, 0, INPUT.BLOCK);
    expect(state.p2.hp).toBe(after);
    expect(sim.getEvents().filter((e) => e.type === 'block')).toHaveLength(1);
  });

  it('get-up protection and interruption never reactivate stale hitboxes', () => {
    const sim = close();
    const state = sim.getState();
    state.p1.state = 'attack';
    state.p1.currentMove = combatMove(amperDefinition.moves.heavy_punch!);
    state.p1.moveTick = state.p1.currentMove.startup + 1;
    state.p2.state = 'get_up';
    expect(checkHit(state.p1, amperDefinition, state.p2, korbaDefinition, 0)).toBeNull();
    state.p2.state = 'hit_stun';
    state.p2.currentMove = korbaDefinition.moves.heavy_punch!;
    state.p2.moveTick = 999;
    expect(checkHit(state.p2, korbaDefinition, state.p1, amperDefinition, 0)).toBeNull();
  });

  it('pressing down during standing hitstun cannot dodge the next high', () => {
    const sim = close();
    const { p1, p2 } = sim.getState();
    p1.state = 'attack';
    p1.currentMove = combatMove(amperDefinition.moves.light_punch!);
    p1.moveTick = p1.currentMove.startup + 1;
    p2.state = 'hit_stun';
    p2.stunTicks = 8;
    expect(checkHit(p1, amperDefinition, p2, korbaDefinition, INPUT.DOWN)?.hit).toBe(true);
  });

  it('pressing down during an attack cannot duck a high', () => {
    const sim = close();
    const { p1, p2 } = sim.getState();
    p1.state = 'attack';
    p1.currentMove = combatMove(amperDefinition.moves.light_punch!);
    p1.moveTick = p1.currentMove.startup + 1;
    p2.state = 'attack';
    p2.currentMove = combatMove(korbaDefinition.moves.heavy_punch!);
    expect(checkHit(p1, amperDefinition, p2, korbaDefinition, INPUT.DOWN)?.hit).toBe(true);
  });

  it('jump startup cannot be interrupted by an air move while still grounded', () => {
    const sim = close();
    sim.update(INPUT.UP, 0);
    sim.update(INPUT.RP, 0);
    expect(sim.getState().p1.state).toBe('jump_start');
    advance(sim, 5);
    expect(sim.getState().p1.y).toBeGreaterThan(0);
    expect(sim.getState().p1.isGrounded).toBe(false);
  });
});
