import { describe, expect, it } from 'vitest';
import report from '../../../docs/bongo-v6-simulation.json';
import proofs from './data/campaign-v6-proofs.json';
import { buildCampaignV6 } from './CampaignV6';
import { Simulation } from './Simulation';
import type { ReplayInput } from './types';

const accessReports = report
  .flatMap((row) => ('rockAccessChanges' in row && row.rockAccessChanges ? [row] : []))
  .filter((row) => row.rockAccessChanges.length > 0);
// Dense level9 replays validate every recorded fall and traversal, including on loaded CI workers.
describe('recorded rock access evidence', { timeout: 30_000 }, () => {
  it('includes a recorded fall and subsequent traversal for every campaign level', () => {
    expect(accessReports.map((row) => row.id)).toEqual(buildCampaignV6().map((level) => level.id));
  });
  it('requires the sideways retreat after excavating the level 13 rock', () => {
    const game = new Simulation(buildCampaignV6()[12]);
    const inputs = proofs['13'].inputs;
    for (const d of inputs.slice(0, 265)) game.step((d ?? undefined) as ReplayInput);
    expect(game.world.player).toMatchObject({ x: 6, y: 9 });
    expect(game.object({ x: 6, y: 8 })?.kind).toBe('rock');
    expect(inputs[265]).toBe('right');
    game.step('down');
    expect(game.world.status).toBe('playing');
    expect(game.world.player).toMatchObject({ x: 6, y: 10 });
    game.step((inputs[266] ?? undefined) as ReplayInput);
    expect(game.world.status).toBe('lost');
    expect(game.world.reason).toContain('Przygnieciony');
  });
  it.each(accessReports)(
    'reproduces the fall and later traversal of each opened field on level $id',
    (row) => {
      const game = new Simulation(buildCampaignV6()[row.id - 1]);
      const proof = proofs[String(row.id) as keyof typeof proofs];
      for (const d of proof.inputs) {
        const falling = row.rockAccessChanges.filter((e) => e.fallTick === game.ticks + 1);
        for (const e of falling) {
          expect(game.chamberId).toBe(e.chamber);
          expect(game.world.objects.find((o) => o.id === e.rockId)).toMatchObject({
            kind: 'rock',
            x: e.x,
            y: e.y,
          });
        }
        game.step((d ?? undefined) as ReplayInput);
        for (const e of falling)
          expect(game.world.objects.find((o) => o.id === e.rockId)?.y).toBeGreaterThan(e.y);
        for (const e of row.rockAccessChanges.filter((e) => e.traversedTick === game.ticks)) {
          expect(e.traversedTick).toBeGreaterThan(e.fallTick);
          expect(game.chamberId).toBe(e.chamber);
          expect(game.world.player).toMatchObject({ x: e.x, y: e.y });
          expect(game.object(game.world.player)).toBeUndefined();
        }
      }
      expect(game.world.status).toBe('won');
    },
  );
});
