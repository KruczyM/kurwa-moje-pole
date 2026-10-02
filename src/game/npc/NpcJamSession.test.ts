import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { NpcJamSession } from './NpcJamSession';
import { Campfire } from '../world/Campfire';
import { AcousticGuitarSynth } from '../audio/AcousticGuitarSynth';
import type { Npc, NpcManager } from './NpcManager';

function createMockNpc(name: string, pos = new THREE.Vector3(0, 0, 0)): Npc {
  const root = new THREE.Group();
  root.name = `NPC_${name}`;
  root.position.copy(pos);
  return {
    root,
    name,
    line: ['Siema'],
    target: new THREE.Vector3(),
    waypoints: [],
    speed: 0,
    velocity: new THREE.Vector3(),
    steeringDirection: new THREE.Vector3(),
    stationary: false,
    isSitting: false,
    isCampMember: true,
    phase: 0,
    wait: 0,
    returning: false,
    activityCooldown: 0,
    animLodAccumulator: 0,
    behavior: {
      forceWander: vi.fn(),
      random: () => 0.5,
      state: 'idle',
      travelling: false,
      update: vi.fn(),
    } as unknown as Npc['behavior'],
    watchdog: {
      resetPosition: vi.fn(),
    } as unknown as Npc['watchdog'],
    passageWalker: false,
    passageDirection: 1,
  };
}

describe('NpcJamSession', () => {
  it('initializes in inactive state', () => {
    const npcs: Npc[] = [createMockNpc('Kobra'), createMockNpc('Amper')];
    const mockManager = {
      npcs,
      standUpNpc: vi.fn(),
    } as unknown as NpcManager;

    const session = new NpcJamSession(mockManager, { autoNightTrigger: false });
    expect(session.active).toBe(false);
    expect(session.guitaristNpc).toBeNull();
    expect(session.audienceCount).toBe(0);
    session.dispose();
  });

  it('starts session and selects a guitarist and audience', () => {
    const guitarist = createMockNpc('078_girl_with_guitar', new THREE.Vector3(3, 0, -2));
    const fan1 = createMockNpc('Kobra', new THREE.Vector3(4, 0, -1));
    const fan2 = createMockNpc('Amper', new THREE.Vector3(5, 0, -4));
    const npcs = [fan1, guitarist, fan2];

    const mockManager = {
      npcs,
      standUpNpc: vi.fn((npc: Npc) => {
        npc.isSitting = false;
        npc.assignedSeatId = undefined;
      }),
    } as unknown as NpcManager;

    const campfire = new Campfire({ position: [5.5, 0, -3.0] });
    const synth = new AcousticGuitarSynth();
    const startSpy = vi.spyOn(synth, 'start');
    const stopSpy = vi.spyOn(synth, 'stop');

    const session = new NpcJamSession(mockManager, {
      campfire,
      guitarSynth: synth,
      autoNightTrigger: false,
    });

    const started = session.startSession();
    expect(started).toBe(true);
    expect(session.active).toBe(true);
    expect(session.guitaristNpc).toBe(guitarist);
    expect(guitarist.isSitting).toBe(true);
    expect(startSpy).toHaveBeenCalled();
    expect(session.audienceCount).toBeGreaterThanOrEqual(1);

    session.stopSession();
    expect(session.active).toBe(false);
    expect(session.guitaristNpc).toBeNull();
    expect(stopSpy).toHaveBeenCalled();
    expect(mockManager.standUpNpc).toHaveBeenCalledWith(guitarist);

    session.dispose();
  });

  it('triggers automatically when night falls', () => {
    const npcs = [createMockNpc('012_acoustic_songster', new THREE.Vector3(5, 0, -3))];
    const mockManager = {
      npcs,
      standUpNpc: vi.fn(),
    } as unknown as NpcManager;

    const session = new NpcJamSession(mockManager, { autoNightTrigger: true });
    expect(session.active).toBe(false);

    // During day: nothing
    session.update(0.1, undefined, 'day');
    expect(session.active).toBe(false);

    // At evening/night: starts session
    session.update(0.1, undefined, 'night');
    expect(session.active).toBe(true);

    // Back to day: stops session
    session.update(0.1, undefined, 'day');
    expect(session.active).toBe(false);

    session.dispose();
  });
});
