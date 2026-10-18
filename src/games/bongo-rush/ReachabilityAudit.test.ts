import { describe, expect, it } from 'vitest';
import proofs from './data/campaign-v6-proofs.json';
import { buildCampaignV6 } from './CampaignV6';
import { Simulation } from './Simulation';
import type { ReplayInput, LevelDefinition } from './types';
import { optimisticAccess } from '../../../scripts/bongo-v6/reachability';
import { hasForcedEscape, isStaticDeadlock } from '../../../scripts/bongo-v6/solve';

// This suite replays complete caves and repeatedly evaluates the offline reachability bound.
describe('optimistic single-room authoring bound', { timeout: 30_000 }, () => {
  it('rejects same-room portals rather than falsely rejecting a winning portal route', () => {
    const level: LevelDefinition = {
      id: 1,
      title: '',
      hint: '',
      biome: 0,
      quota: 1,
      solution: [],
      rows: ['##########', '#P  #O  E#', '##########'],
      requiredPickups: [{ x: 5, y: 1 }],
      portals: [{ name: '', a: { chamber: 'main', x: 2, y: 1 }, b: { chamber: 'main', x: 6, y: 1 } }],
    };
    const game = new Simulation(level);
    expect(() => optimisticAccess(game)).toThrow('without portals');
    for (const d of ['right', 'left', 'right', 'right', 'left', 'right', 'right'] as const) game.step(d);
    expect(game.world.status).toBe('won');
  });
  const fixture = (rows: string[], quota: number): LevelDefinition => ({
    id: 1,
    title: '',
    hint: '',
    biome: 0,
    quota,
    solution: [],
    rows: rows.map((r) => r.replace(/_/g, ' ')),
  });
  it('does not dig unreachable soil beneath an immovable rock', () => {
    const game = new Simulation(fixture(['#####', '#PQ##', '#R###', '#.E##', '#####'], 1));
    expect(optimisticAccess(game).exitReachable).toBe(false);
  });
  it('does not credit falling loot in a permanently separate component', () => {
    const game = new Simulation(fixture(['#########', '#P.E#Q__#', '#...#___#', '#########'], 1));
    const bound = optimisticAccess(game);
    expect(bound.potential).toBe(0);
    expect(bound.exitReachable).toBe(true);
    expect(bound.fixedPickups).toHaveLength(1);
  });
  it.each(
    buildCampaignV6().filter((l) => !l.chambers?.length && proofs[String(l.id) as keyof typeof proofs]),
  )('never rejects sampled states of a known winning route $id', (level) => {
    const g = new Simulation(level),
      proof = proofs[String(level.id) as keyof typeof proofs];
    proof.inputs.forEach((d, i) => {
      if (i % 10 === 0) {
        const before = JSON.stringify(g.world),
          bound = optimisticAccess(g);
        expect(bound.potential, `level ${level.id}, tick ${i}`).toBeGreaterThanOrEqual(level.quota);
        expect(bound.exitReachable, `level ${level.id}, tick ${i}`).toBe(true);
        expect(bound.blockedRequired, `level ${level.id}, tick ${i}`).toEqual([]);
        expect(isStaticDeadlock(g), `level ${level.id}, tick ${i}`).toBe(false);
        expect(hasForcedEscape(g), `level ${level.id}, tick ${i}`).toBe(true);
        expect(JSON.stringify(g.world)).toBe(before);
      }
      g.step((d ?? undefined) as ReplayInput);
    });
    expect(g.world.status).toBe('won');
  });
});
