import { describe, expect, it } from 'vitest';
import { createPilotMap } from '../data/pilotMap';
import { PILOT_QUESTS, validatePilotStory } from '../data/pilotStory';
import { AfterSimulation } from './AfterSimulation';
import { canStand, slideMove, validateMap } from './Collision';
import { hasLineOfSight } from './Interaction';
import type { MapDefinition } from './WorldState';

/** Builds an empty deterministic arena independent of graphical assets. */
function arena(): MapDefinition {
  return {
    id: 'test',
    width: 100,
    height: 100,
    tileSize: 1,
    collision: Array<boolean>(10000).fill(false),
    spawns: [{ x: 10, y: 10 }],
    interactions: [],
  };
}

/** Starts a local test session with one participant. */
function session(map = arena()): AfterSimulation {
  const simulation = new AfterSimulation(map, 'test-session');
  simulation.addPlayer('p1', 'Amper');
  return simulation;
}

describe('After deterministic simulation', () => {
  it.each([30, 60, 120])('advances the same 30 ticks at %i presentation FPS', (fps) => {
    const simulation = session();
    simulation.setInput('p1', { moveX: 1, moveY: 0, sprint: false });
    for (let i = 0; i < fps; i++) simulation.advance(1 / fps);
    expect(simulation.snapshot().tick).toBe(30);
    expect(simulation.snapshot().players[0].position.x).toBeCloseTo(12.4, 9);
  });

  it('normalizes diagonal movement', () => {
    const simulation = session();
    simulation.setInput('p1', { moveX: 1, moveY: 1, sprint: false });
    for (let i = 0; i < 30; i++) simulation.advance(1 / 30);
    const { x, y } = simulation.snapshot().players[0].position;
    expect(Math.hypot(x - 10, y - 10)).toBeCloseTo(2.4);
  });

  it('clears stale input and catch-up on local pause', () => {
    const simulation = session();
    simulation.setInput('p1', { moveX: 1, moveY: 0, sprint: true });
    simulation.advance(1 / 60);
    simulation.setPaused(true);
    simulation.advance(10);
    simulation.setInput('p1', { moveX: 1, moveY: 0, sprint: true });
    simulation.setPaused(false);
    simulation.advance(1 / 30);
    expect(simulation.snapshot().tick).toBe(1);
    expect(simulation.snapshot().players[0].position).toEqual({ x: 10, y: 10 });
  });

  it('bounds hidden-tab catch-up and ignores invalid elapsed times', () => {
    const simulation = session();
    for (const dt of [NaN, Infinity, -1, 0]) simulation.advance(dt);
    expect(simulation.snapshot().tick).toBe(0);
    const alpha = simulation.advance(60);
    expect(simulation.snapshot().tick).toBe(7);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('sanitizes axes and preserves simulation from external mutation', () => {
    const map = arena();
    const simulation = session(map);
    simulation.setInput('p1', { moveX: Infinity, moveY: NaN, sprint: true });
    simulation.advance(1 / 30);
    const snapshot = simulation.snapshot();
    snapshot.players[0].position.x = -999;
    map.spawns[0].x = -999;
    expect(simulation.snapshot().players[0].position.x).toBe(10);
  });

  it('prevents sprint stuttering after exhaustion and slows carrying', () => {
    const simulation = session();
    simulation.setInput('p1', { moveX: 1, moveY: 0, sprint: true });
    for (let i = 0; i < 126; i++) simulation.advance(1 / 30);
    const before = simulation.snapshot().players[0];
    simulation.advance(1 / 30);
    const after = simulation.snapshot().players[0];
    expect(after.position.x - before.position.x).toBeCloseTo(2.4 / 30);
    expect(after.stamina).toBeGreaterThan(before.stamina);
    simulation.setCarrying('p1', true);
    simulation.advance(1 / 30);
    expect(simulation.snapshot().players[0].position.x - after.position.x).toBeCloseTo((2.4 * 0.65) / 30);
  });

  it('limits participants to four stable unique slots', () => {
    const simulation = session();
    expect(() => simulation.addPlayer('p1', 'Chlebak')).toThrow();
    for (const id of ['p2', 'p3', 'p4']) simulation.addPlayer(id, 'Chlebak');
    expect(() => simulation.addPlayer('p5', 'Amper')).toThrow();
  });
});

describe('After collision and interaction', () => {
  it('blocks corner rays in both directions and accepts grid-boundary endpoints', () => {
    const map = arena();
    const from = { x: 10.5, y: 10.5 };
    const to = { x: 12.5, y: 12.5 };
    const collision = [...map.collision];
    collision[10 * map.width + 11] = true;
    map.collision = collision;
    expect(hasLineOfSight(map, from, to)).toBe(false);
    expect(hasLineOfSight(map, to, from)).toBe(false);
    expect(hasLineOfSight(map, { x: 5.5, y: 6.5 }, { x: 5, y: 5 })).toBe(true);
    expect(hasLineOfSight(map, from, { x: NaN, y: 1 })).toBe(false);
  });
  it('prevents tunnelling and slides along solid tiles', () => {
    const map = arena();
    const collision = [...map.collision];
    for (let y = 0; y < map.height; y++) collision[y * map.width + 12] = true;
    map.collision = collision;
    const position = slideMove(map, { x: 10, y: 10 }, { x: 6, y: 3 });
    expect(position.x).toBeLessThanOrEqual(11.78);
    expect(position.y).toBeCloseTo(13);
    expect(canStand(map, position)).toBe(true);
    expect(() => slideMove(map, position, { x: Infinity, y: 0 })).toThrow();
    expect(canStand(map, { x: -1, y: 1 })).toBe(false);
  });

  it('selects priority before distance and rejects wall-blocked targets', () => {
    const map = arena();
    const collision = [...map.collision];
    collision[10 * map.width + 11] = true;
    map.collision = collision;
    map.interactions = [
      { id: 'near', position: { x: 10, y: 10.5 }, radius: 3, priority: 0, prompt: 'Near', once: false },
      {
        id: 'priority',
        position: { x: 10, y: 11.5 },
        radius: 3,
        priority: 1,
        prompt: 'Priority',
        once: false,
      },
      {
        id: 'behind-wall',
        position: { x: 12.5, y: 10.5 },
        radius: 4,
        priority: 99,
        prompt: 'Hidden',
        once: false,
      },
    ];
    expect(session(map).prompt('p1')?.id).toBe('priority');
  });

  it('deduplicates fresh session commands and shared one-shot targets', () => {
    const map = arena();
    map.interactions = [
      { id: 'flag', position: { x: 10, y: 10 }, radius: 1, priority: 1, prompt: 'Flag', once: true },
    ];
    const simulation = session(map);
    simulation.addPlayer('p2', 'Chlebak');
    const command = { sessionId: 'test-session', slotId: 'p1', sequence: 0, targetId: 'flag' };
    expect(simulation.interact({ ...command, sessionId: 'stale' })).toBeUndefined();
    expect(simulation.interact(command)?.id).toBe('test-session:p1:0');
    expect(simulation.interact(command)).toBeUndefined();
    expect(simulation.interact({ ...command, slotId: 'p2' })).toBeUndefined();
    expect(simulation.snapshot().flags).toEqual(['interaction:flag']);
  });

  it('does not accept interactions while paused', () => {
    const simulation = session();
    simulation.setPaused(true);
    expect(
      simulation.interact({ sessionId: 'test-session', slotId: 'p1', sequence: 0, targetId: 'missing' }),
    ).toBeUndefined();
    expect(simulation.snapshot().players[0].lastSequence).toBe(-1);
  });

  it('validates the pilot map and three-quest graph, rejecting corrupt references', () => {
    const map = createPilotMap();
    expect(() => validateMap(map)).not.toThrow();
    expect(() => validatePilotStory(map)).not.toThrow();
    expect(PILOT_QUESTS).toHaveLength(3);
    expect(() => validateMap({ ...map, spawns: [{ x: 0, y: 0 }] })).toThrow();
    expect(() => validateMap({ ...map, collision: [] })).toThrow();
    expect(() =>
      validatePilotStory(map, [
        { ...PILOT_QUESTS[0], completion: { type: 'quest-complete', id: 'recover-flag' } },
      ]),
    ).toThrow('Cyclic');
    expect(() =>
      validatePilotStory(map, [
        { ...PILOT_QUESTS[0], completion: { type: 'flag', id: 'interaction:unknown' } },
      ]),
    ).toThrow();
  });
});
