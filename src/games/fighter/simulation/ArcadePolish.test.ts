import { describe, expect, it } from 'vitest';
import { FighterSimulation } from './FighterSimulation';
import { INPUT } from './CombatTypes';
import { ROSTER } from '../data/fighters/roster';
import { combatClip } from '../presentation/CombatSpriteBank';
import { combatMove } from './combatTiming';

const moves: [string, number, string][] = [
  ['light_punch', INPUT.LP, 'jab'],
  ['heavy_punch', INPUT.RP, 'cross'],
  ['light_kick', INPUT.LK, 'kick'],
  ['heavy_kick', INPUT.RK, 'heavy_kick'],
  ['crouch_punch', INPUT.DOWN | INPUT.LP, 'crouch_punch'],
  ['crouch_kick', INPUT.DOWN | INPUT.LK, 'crouch_kick'],
  ['uppercut', INPUT.DOWN | INPUT.RP, 'uppercut'],
  ['sweep', INPUT.DOWN | INPUT.RK, 'sweep'],
  ['jump_punch', INPUT.LP, 'jump_punch'],
  ['jump_kick', INPUT.LK, 'air_kick'],
  ['special', INPUT.TECHNIQUE, 'special'],
  ['ultimate', INPUT.SPECIAL, 'ultimate'],
];

describe('complete arcade moves and authoritative super freeze', () => {
  it('stops an already active enemy strike on the activation tick and accepts simultaneous ultimates fairly', () => {
    const def = ROSTER.amper.definition;
    const sim = new FighterSimulation(def, def),
      state = sim.getState();
    state.p1.x = -25;
    state.p2.x = 25;
    state.p1.meter = 100;
    const move = combatMove(def.moves.heavy_punch);
    Object.assign(state.p2, { state: 'attack', currentMove: move, moveTick: move.startup });
    sim.update(INPUT.SPECIAL, 0);
    expect(state.p1.currentMove?.id).toBe('ultimate');
    expect(state.p1.hp).toBe(def.maxHp);
    expect(state.superFreezeTicks).toBe(48);
    expect(sim.getEvents().some((event) => event.type === 'hit')).toBe(false);
    const mirror = new FighterSimulation(def, def),
      both = mirror.getState();
    both.p1.meter = both.p2.meter = 100;
    mirror.update(INPUT.SPECIAL, INPUT.SPECIAL);
    expect(both.p1.currentMove?.id).toBe('ultimate');
    expect(both.p2.currentMove?.id).toBe('ultimate');
    expect(both.p1.meter + both.p2.meter).toBe(0);
    expect(both.superFreezeTicks).toBe(48);
  });
  it.each(Object.values(ROSTER).map((entry) => [entry.definition.id, entry.definition] as const))(
    '%s exposes all twelve moves and the corresponding animation',
    (_id, definition) => {
      for (const [id, input, clip] of moves) {
        const sim = new FighterSimulation(definition, definition);
        sim.getState().p1.meter = 100;
        if (id.startsWith('jump_')) {
          sim.update(INPUT.UP, 0);
          for (let i = 0; i < 3; i++) sim.update(0, 0);
        }
        sim.update(input, 0);
        const fighter = sim.getState().p1;
        expect(fighter.currentMove?.id, `${definition.id}/${id}`).toBe(id);
        expect(combatClip(fighter)).toBe(clip);
        if (id === 'special') expect(fighter.meter).toBe(70);
        if (id === 'ultimate') expect(fighter.meter).toBe(0);
      }
    },
  );
  it('freezes both actors and timer for exactly 48 ticks, preserves snapshot replay and resumes guard', () => {
    const def = ROSTER.amper.definition;
    const sim = new FighterSimulation(def, def);
    const state = sim.getState();
    state.p1.x = -25;
    state.p2.x = 25;
    state.p1.meter = 100;
    sim.update(INPUT.SPECIAL, INPUT.BLOCK);
    const frozen = sim.getSnapshot();
    const replay = new FighterSimulation(def, def);
    replay.loadSnapshot(frozen);
    for (let i = 0; i < 48; i++) {
      sim.update(0, INPUT.BLOCK);
      replay.update(0, INPUT.BLOCK);
      expect(sim.getSnapshot()).toEqual(replay.getSnapshot());
      expect(state.p1.moveTick).toBe(0);
      expect(state.p2.hp).toBe(frozen.p2.hp);
      expect(state.roundTimer).toBe(frozen.roundTimer);
      expect(state.stateTicks).toBe(frozen.stateTicks);
    }
    expect(state.superFreezeTicks).toBe(0);
    for (let i = 0; i < 65; i++) sim.update(0, INPUT.BLOCK);
    expect(sim.getEvents().filter((event) => event.type === 'block')).toHaveLength(1);
    expect(frozen.p2.hp - state.p2.hp).toBe(Math.floor(def.moves.ultimate.damage * 0.1));
  });
  it('earns ultimate in seven heavy hits with more than half health, never from whiffs', () => {
    const def = ROSTER.amper.definition;
    const sim = new FighterSimulation(def, def),
      state = sim.getState();
    for (let hit = 0; hit < 7; hit++) {
      state.p1.x = -25;
      state.p2.x = 25;
      sim.update(INPUT.RP, 0);
      for (let i = 0; i < 100; i++) sim.update(0, 0);
    }
    expect(state.p1.meter).toBe(100);
    expect(state.p1.hp).toBe(state.p1.maxHp);
    expect(sim.getEvents().filter((event) => event.type === 'meter_ready')).toHaveLength(1);
    const whiff = new FighterSimulation(def, def);
    for (let i = 0; i < 150; i++) whiff.update(i % 50 === 0 ? INPUT.RP : 0, 0);
    expect(whiff.getState().p1.meter).toBe(0);
    whiff.update(INPUT.TECHNIQUE, 0);
    expect(whiff.getState().p1.currentMove).toBeNull();
  });
});
