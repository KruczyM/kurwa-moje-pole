import { describe, expect, it } from 'vitest';
import { AfterCampaign } from './AfterCampaign';
import { createPilotMap } from './data/pilotMap';
import type { Point } from './simulation/WorldState';

/** Finds a cardinal, collision-free path through authored content; no teleport/debug mutation. */
function walkTo(campaign: AfterCampaign, targetId: string, slotId = 'p1'): void {
  const map = createPilotMap();
  const target = map.interactions.find((entry) => entry.id === targetId)!;
  const player = campaign.snapshot().world.players.find((entry) => entry.slotId === slotId)!;
  const start = Math.floor(player.position.y) * map.width + Math.floor(player.position.x);
  const end = Math.floor(target.position.y) * map.width + Math.floor(target.position.x);
  const parents = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (let i = 0; i < queue.length && !parents.has(end); i++) {
    const cell = queue[i];
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      const next = ny * map.width + nx;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || map.collision[next] || parents.has(next))
        continue;
      parents.set(next, cell);
      queue.push(next);
    }
  }
  expect(parents.has(end), `reachable target ${targetId}`).toBe(true);
  const path: Point[] = [];
  for (let cell = end; cell !== start; cell = parents.get(cell)!)
    path.unshift({ x: (cell % map.width) + 0.5, y: Math.floor(cell / map.width) + 0.5 });
  for (const waypoint of path) {
    let arrived = false;
    for (let step = 0; step < 30; step++) {
      const current = campaign.snapshot().world.players.find((entry) => entry.slotId === slotId)!.position;
      const dx = waypoint.x - current.x;
      const dy = waypoint.y - current.y;
      if (Math.hypot(dx, dy) < 0.001) {
        arrived = true;
        break;
      }
      campaign.setInput(slotId, {
        moveX: Math.max(-1, Math.min(1, dx / 0.08)),
        moveY: Math.max(-1, Math.min(1, dy / 0.08)),
        sprint: false,
      });
      campaign.advance(1 / 30);
    }
    expect(arrived, `walk waypoint ${waypoint.x},${waypoint.y}`).toBe(true);
  }
  campaign.setInput(slotId, { moveX: 0, moveY: 0, sprint: false });
}

describe('After pilot campaign integration', () => {
  it.each(['Amper', 'Chlebak'] as const)('can finish solo as %s, even after an early return', (hero) => {
    const campaign = new AfterCampaign('test');
    campaign.addPlayer('p1', hero);
    let sequence = 0;
    /** Uses precisely the same prompt and command boundary as the future UI. */
    const interact = (targetId: string) => {
      walkTo(campaign, targetId);
      expect(campaign.prompt('p1')?.id).toBe(targetId);
      return campaign.interact({ sessionId: 'test', slotId: 'p1', targetId, sequence: sequence++ });
    };
    expect(interact('camp-return')).toBeDefined();
    expect(campaign.snapshot().finished).toBe(false);
    walkTo(campaign, 'power');
    expect(campaign.prompt('p1')).toBeUndefined();
    expect(
      campaign.interact({ sessionId: 'test', slotId: 'p1', targetId: 'power', sequence: sequence++ }),
    ).toBeUndefined();
    for (const targetId of ['friend', 'flag', 'cable', 'power']) expect(interact(targetId)).toBeDefined();
    expect(campaign.snapshot().story.completedQuestIds).toHaveLength(3);
    expect(campaign.snapshot().world.nightPhase).toBe('before-dawn');
    expect(campaign.snapshot().finished).toBe(false);
    interact('camp-return');
    expect(campaign.snapshot().finished).toBe(true);
    expect(() => campaign.addPlayer('late', 'Chlebak')).toThrow('already finished');
    const tick = campaign.snapshot().world.tick;
    campaign.setPaused(false);
    campaign.advance(1);
    expect(campaign.snapshot().world.tick).toBe(tick);
    expect(campaign.prompt('p1')).toBeUndefined();
  });

  it('shares progress across local participant slots without duplicating rewards', () => {
    const campaign = new AfterCampaign('test');
    campaign.addPlayer('p1', 'Amper');
    campaign.addPlayer('p2', 'Chlebak');
    walkTo(campaign, 'cable', 'p1');
    expect(
      campaign.interact({ sessionId: 'test', slotId: 'p1', targetId: 'cable', sequence: 0 }),
    ).toBeDefined();
    walkTo(campaign, 'power', 'p2');
    const command = { sessionId: 'test', slotId: 'p2', targetId: 'power', sequence: 0 };
    expect(campaign.interact(command)).toBeDefined();
    expect(campaign.interact(command)).toBeUndefined();
    expect(campaign.snapshot().story.rewardFlags).toEqual(['camp-lit']);
  });

  it('rejects unavailable pilot heroes without creating a participant', () => {
    const campaign = new AfterCampaign();
    expect(() => campaign.addPlayer('p1', 'Antena')).toThrow();
    expect(campaign.snapshot().world.players).toEqual([]);
  });
});
