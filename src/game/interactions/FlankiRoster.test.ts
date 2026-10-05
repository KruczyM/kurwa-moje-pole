import { describe, it, expect } from 'vitest';
import { FlankiRoster } from './FlankiRoster';

describe('FlankiRoster', () => {
  it('swaps a human into a permanent runner role without duplicate participants', () => {
    const roster = new FlankiRoster();
    expect(roster.selectRunner('A', 'player')).toBe(true);
    expect(roster.teamA.runner.isHuman).toBe(true);
    expect(roster.teamA.throwers.map((p) => p.id)).toEqual(['kobra', 'antena']);
    for (let i = 0; i < 8; i++) expect(roster.advanceTurn().id).not.toBe('player');
    expect(roster.selectRunner('A', 'pien')).toBe(false);
  });
  it('initializes default teams with designated runners and throwers', () => {
    const roster = new FlankiRoster();
    expect(roster.teamA.throwers.length).toBe(2);
    expect(roster.teamA.runner.role).toBe('runner');
    expect(roster.teamA.runner.name).toBe('Kobra');

    expect(roster.teamB.throwers.length).toBe(2);
    expect(roster.teamB.runner.role).toBe('runner');
    expect(roster.teamB.runner.name).toBe('Dziąsło');

    // First thrower is local player
    const first = roster.getCurrentThrower();
    expect(first.isHuman).toBe(true);
    expect(first.team).toBe('A');
  });

  it('rotates strictly between Team A and Team B throwers', () => {
    const roster = new FlankiRoster();
    // Turn 0: Team A Thrower 0 (Player)
    expect(roster.getCurrentThrower().id).toBe('player');
    expect(roster.getCurrentThrower().team).toBe('A');

    // Defending runner should be Team B runner
    expect(roster.getDefendingRunner().name).toBe('Dziąsło');

    // Advance to Turn 1: Team B Thrower 0 (Pień)
    const t1 = roster.advanceTurn();
    expect(t1.name).toBe('Pień');
    expect(t1.team).toBe('B');
    expect(roster.getDefendingRunner().name).toBe('Kobra');

    // Advance to Turn 2: Team A Thrower 1 (Antena)
    const t2 = roster.advanceTurn();
    expect(t2.name).toBe('Antena');
    expect(t2.team).toBe('A');

    // Advance to Turn 3: Team B Thrower 1 (Chlebak)
    const t3 = roster.advanceTurn();
    expect(t3.name).toBe('Chlebak');
    expect(t3.team).toBe('B');

    // Advance to Turn 4: loops back to Team A Thrower 0 (Player)
    const t4 = roster.advanceTurn();
    expect(t4.id).toBe('player');
    expect(t4.team).toBe('A');
  });

  it('manages drinking and win condition when all throwers finish their beer', () => {
    const roster = new FlankiRoster();
    expect(roster.isTeamFinished('A')).toBe(false);
    expect(roster.isGameOver()).toBe(false);

    // Partial drink
    roster.drinkBeer('A', 0.5);
    expect(roster.teamA.throwers[0].beerRemaining).toBeCloseTo(0.5);
    expect(roster.teamA.throwers[1].beerRemaining).toBeCloseTo(0.5);
    expect(roster.isTeamFinished('A')).toBe(false);

    // Apply late penalty (+20%)
    roster.applyPenalty('A', 0.2);
    expect(roster.teamA.throwers[0].beerRemaining).toBeCloseTo(0.7);

    // Finish drinking
    roster.drinkBeer('A', 0.8);
    expect(roster.isTeamFinished('A')).toBe(true);
    expect(roster.isGameOver()).toBe(true);
    expect(roster.getWinner()).toBe('A');
  });
});
