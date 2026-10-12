import { describe, expect, it } from 'vitest';
import { BotController } from './BotController';
import { FighterSimulation } from '../simulation/FighterSimulation';
import { amperDefinition } from '../data/fighters/amper';
import { korbaDefinition } from '../data/fighters/korba';
import { INPUT } from '../simulation/CombatTypes';

function setup(roll = 0.3) {
  const sim = new FighterSimulation(amperDefinition, korbaDefinition);
  const { p1: self, p2: opponent } = sim.getState();
  self.x = -25;
  opponent.x = 25;
  return { sim, self, opponent, bot: new BotController('normal', () => roll) };
}

describe('BotController', () => {
  it('pulses attacks and releases the key before the next decision', () => {
    const { bot, self, opponent } = setup();
    expect(bot.update(self, opponent)).toBe(INPUT.LP);
    for (let i = 0; i < 10; i++) expect(bot.update(self, opponent)).toBe(0);
    expect(bot.update(self, opponent)).toBe(INPUT.LP);
  });
  it('does not queue strikes in recovery, hitstop or reaction states', () => {
    const { bot, self, opponent } = setup();
    for (const state of ['attack', 'hit_stun', 'knockdown', 'get_up'] as const) {
      self.state = state;
      expect(bot.update(self, opponent)).toBe(0);
    }
    self.state = 'idle';
    self.hitstop = 5;
    expect(bot.update(self, opponent)).toBe(0);
  });
  it('approaches instead of wasting an empty ultimate at mid range', () => {
    const { bot, self, opponent } = setup(0.1);
    opponent.x = 140;
    expect(bot.update(self, opponent)).toBe(INPUT.RIGHT);
  });
  it('holds a low guard against a sweep', () => {
    const { bot, self, opponent } = setup(0);
    opponent.state = 'attack';
    opponent.currentMove = { ...korbaDefinition.moves.heavy_kick!, attackHeight: 'low' };
    expect(bot.update(self, opponent)).toBe(INPUT.BLOCK | INPUT.DOWN);
    expect(bot.update(self, opponent)).toBe(INPUT.BLOCK | INPUT.DOWN);
  });
  it('uses standing guard against a mid', () => {
    const { bot, self, opponent } = setup(0);
    opponent.state = 'attack';
    opponent.currentMove = korbaDefinition.moves.heavy_punch!;
    expect(bot.update(self, opponent)).toBe(INPUT.BLOCK);
  });
  it('only selects ultimate with full meter', () => {
    const { bot, self, opponent } = setup(0);
    self.meter = 100;
    expect(bot.update(self, opponent)).toBe(INPUT.SPECIAL);
    const other = new BotController('normal', () => 0);
    self.meter = 99;
    expect(other.update(self, opponent)).toBe(INPUT.LP);
  });
  it('stops on KO and can attack in the air', () => {
    const { bot, self, opponent } = setup();
    self.isGrounded = false;
    expect(bot.update(self, opponent)).toBe(INPUT.RK);
    opponent.hp = 0;
    expect(bot.update(self, opponent)).toBe(0);
  });
  it('completes a deterministic bot duel without invalid positions', () => {
    const { sim } = setup();
    let seed = 42;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const a = new BotController('normal', random),
      b = new BotController('normal', random);
    const initialHp = sim.getState().p1.hp + sim.getState().p2.hp;
    for (let tick = 0; tick < 5400; tick++) {
      const s = sim.getState();
      sim.update(a.update(s.p1, s.p2), b.update(s.p2, s.p1));
      for (const fighter of [s.p1, s.p2]) {
        expect(Number.isFinite(fighter.x + fighter.y)).toBe(true);
        expect(fighter.y).toBeGreaterThanOrEqual(0);
      }
      if (s.roundState !== 'fight') break;
    }
    expect(sim.getState().p1.hp + sim.getState().p2.hp).toBeLessThan(initialHp);
    expect(sim.getState().roundState).not.toBe('fight');
  });
});
