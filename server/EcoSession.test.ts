import { describe, it, expect } from 'vitest';
import { EcoSession } from './EcoSession';
import { ecoPosition } from '../src/game/interactions/ecoChallenge';

const pool = Array.from({ length: 96 }, (_, i) => ({ x: (i % 12) * 6, z: Math.floor(i / 12) * 6 }));
describe('Eko race authority', () => {
  it('scores bundles and wave bonuses authoritatively',()=>{
    const {session,advance}=setup();advance(20000);
    const state=session.getState()!,point=ecoPosition(state.seed,5,0,pool);
    expect(session.collect('a',{roundId:state.id,canId:'eco_5',generation:0},[point.x,0,point.z])).toBe(true);
    expect(session.getState()!.players[0].score).toBe(6);
  });
  function setup() {
    let now = 1000;
    const session = new EcoSession(() => now);
    expect(session.create('a', 'A', pool)).toBe(true);
    session.join('b', 'B');
    session.start('a');
    return {
      session,
      advance: (ms: number) => {
        now += ms;
      },
    };
  }
  it('requires two members and the host; transfers host on leave', () => {
    const session = new EcoSession(() => 1000);
    expect(session.create('a', 'A', pool)).toBe(true);
    expect(session.start('a')).toBe(false);
    session.join('b', 'B');
    expect(session.start('b')).toBe(false);
    session.leave('a');
    expect(session.start('b')).toBe(false);
    session.join('c', 'C');
    expect(session.start('b')).toBe(true);
  });
  it('each player can collect the same private object, not duplicates or distant objects', () => {
    const { session } = setup(),
      state = session.getState()!;
    const point = ecoPosition(state.seed, 0, 0, pool),
      request = { roundId: state.id, canId: 'eco_0', generation: 0 };
    expect(session.collect('a', request, [999, 0, 999])).toBe(false);
    expect(session.collect('a', request, [point.x, 0, point.z])).toBe(true);
    expect(session.collect('a', request, [point.x, 0, point.z])).toBe(false);
    expect(session.collect('b', request, [point.x, 0, point.z])).toBe(true);
    expect(session.getState()!.players.map((p) => p.score)).toEqual([1, 1]);
  });
  it('checks respawn generations, cooldown and server deadline', () => {
    const { session, advance } = setup(),
      state = session.getState()!;
    const pick = (generation: number) => {
      const point = ecoPosition(state.seed, 0, generation, pool);
      return session.collect('a', { roundId: state.id, canId: 'eco_0', generation }, [point.x, 0, point.z]);
    };
    expect(pick(1)).toBe(false);
    expect(pick(0)).toBe(true);
    expect(pick(1)).toBe(false);
    advance(4000);
    expect(pick(1)).toBe(true);
    advance(180000);
    expect(pick(2)).toBe(false);
    expect(session.getState()!.phase).toBe('finished');
  });
  it('rejects invalid and duplicate spawn pools', () => {
    const session = new EcoSession();
    expect(session.create('a', 'A', [])).toBe(false);
    expect(session.create('a', 'A', Array(48).fill({ x: 0, z: 0 }))).toBe(false);
    expect(session.create('a', 'A', [...pool, { x: Infinity, z: 0 }])).toBe(false);
  });
});
