import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { NpcStuckWatchdog, NpcWatchdogLogEntry } from './NpcStuckWatchdog';

describe('NpcStuckWatchdog', () => {
  it('does not trigger stuck detection when NPC is idling stationary', () => {
    const logger = vi.fn();
    const pos = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(10, 0, 10);
    const watchdog = new NpcStuckWatchdog('Amper', pos, {
      noMovementLimitSeconds: 2.0,
      logger,
    });

    // Symulacja 5 sekund bezruchu w stanie idle (travelling = false)
    for (let i = 0; i < 50; i++) {
      const action = watchdog.update(0.1, pos, 'idle', false, target);
      expect(action).toBeNull();
    }

    expect(watchdog.timeWithoutProgress).toBe(0);
    expect(logger).not.toHaveBeenCalled();
    expect(watchdog.recoveryCount).toBe(0);
  });

  it('detects no movement during travel after the configured time limit and escalates recovery', () => {
    const logs: NpcWatchdogLogEntry[] = [];
    const pos = new THREE.Vector3(5, 0, 5);
    const target = new THREE.Vector3(15, 0, 5);
    const watchdog = new NpcStuckWatchdog('Zawór', pos, {
      noMovementLimitSeconds: 2.0,
      logger: (entry) => logs.push(entry),
    });

    // 1.9 sekundy braku ruchu - brak akcji
    let action = watchdog.update(1.9, pos, 'wander', true, target);
    expect(action).toBeNull();
    expect(watchdog.timeWithoutProgress).toBeCloseTo(1.9, 3);
    expect(logs).toHaveLength(0);

    // Przekroczenie 2.0s -> Stopień 1: steer_nudge
    action = watchdog.update(0.2, pos, 'wander', true, target);
    expect(action).toBe('steer_nudge');
    expect(watchdog.recoveryCount).toBe(1);
    expect(watchdog.lastRecoveryReason).toBe('no_movement');
    expect(logs).toHaveLength(1);
    expect(logs[0].npcName).toBe('Zawór');
    expect(logs[0].action).toBe('steer_nudge');
    expect(logs[0].reason).toBe('no_movement');
    expect(logs[0].position).toEqual({ x: 5, y: 0, z: 5 });

    // Kolejny okres braku ruchu -> Stopień 2: repath
    action = watchdog.update(2.1, pos, 'wander', true, target);
    expect(action).toBe('repath');
    expect(watchdog.recoveryCount).toBe(2);
    expect(logs[1].action).toBe('repath');

    // Kolejny okres braku ruchu -> Stopień 3: new_target
    action = watchdog.update(2.1, pos, 'wander', true, target);
    expect(action).toBe('new_target');
    expect(watchdog.recoveryCount).toBe(3);
    expect(logs[2].action).toBe('new_target');

    // Kolejny okres braku ruchu -> Stopień 4: awaryjny teleport
    action = watchdog.update(2.1, pos, 'wander', true, target);
    expect(action).toBe('teleport');
    expect(watchdog.recoveryCount).toBe(4);
    expect(logs[3].action).toBe('teleport');
  });

  it('resets timeWithoutProgress when agent makes steady progress and resets recovery stage after sustained movement', () => {
    const logger = vi.fn();
    const pos = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(20, 0, 0);
    const watchdog = new NpcStuckWatchdog('Antena', pos, {
      noMovementLimitSeconds: 2.0,
      minProgressDistance: 0.25,
      logger,
    });

    // 1 sekunda utknięcia
    watchdog.update(1.0, pos, 'wander', true, target);
    expect(watchdog.timeWithoutProgress).toBeCloseTo(1.0, 3);

    // Krok w przód o 0.5m -> reset timera braku postępu
    pos.x += 0.5;
    watchdog.update(0.1, pos, 'wander', true, target);
    expect(watchdog.timeWithoutProgress).toBe(0);

    // Wymuszenie jednego zdarzenia recovery (1.9s + 0.2s = 2.1s bezruchu)
    watchdog.update(2.1, pos, 'wander', true, target);
    expect(watchdog.recoveryCount).toBe(1);
    expect(watchdog.lastRecoveryAction).toBe('steer_nudge');

    // Teraz agent przemieszcza się o 1.8m (powyżej 1.5m wymaganego do zresetowania stopnia eskalacji)
    pos.x += 1.8;
    watchdog.update(0.5, pos, 'wander', true, target);

    // Kolejne utknięcie po długim ruchu powinno znowu zacząć od stopnia 1 (steer_nudge), a nie 2!
    const nextAction = watchdog.update(2.1, pos, 'wander', true, target);
    expect(nextAction).toBe('steer_nudge');
  });

  it('detects waypoint oscillation between two points and triggers recovery', () => {
    const logs: NpcWatchdogLogEntry[] = [];
    const pos = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(10, 0, 0);
    const watchdog = new NpcStuckWatchdog('Krwiak', pos, {
      logger: (entry) => logs.push(entry),
    });

    const wA = new THREE.Vector3(1, 0, 0);
    const wB = new THREE.Vector3(5, 0, 0);

    // Oscylacja: wA -> wB -> wA
    watchdog.onWaypointChanged(wA);
    watchdog.update(0.2, pos, 'wander', true, target);
    watchdog.onWaypointChanged(wB);
    watchdog.update(0.2, pos, 'wander', true, target);
    watchdog.onWaypointChanged(wA);

    const action = watchdog.update(0.1, pos, 'wander', true, target);
    expect(action).toBe('repath'); // Oscylacja startuje od co najmniej repath
    expect(watchdog.lastRecoveryReason).toBe('waypoint_oscillation');
    expect(logs[0].reason).toBe('waypoint_oscillation');
  });

  it('detects decision loops (state avalanche) and triggers new_target', () => {
    const logs: NpcWatchdogLogEntry[] = [];
    const pos = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(10, 0, 0);
    const watchdog = new NpcStuckWatchdog('Gruczoł', pos, {
      flappingWindowSeconds: 2.5,
      flappingLimitCount: 4,
      logger: (entry) => logs.push(entry),
    });

    // 4 szybkie przejścia stanów w oknie 0.5 sekundy:
    // idle -> wander -> social -> wander -> run-home
    watchdog.update(0.1, pos, 'idle', false, target);
    watchdog.update(0.1, pos, 'wander', true, target);
    watchdog.update(0.1, pos, 'social', true, target);
    watchdog.update(0.1, pos, 'wander', true, target);
    const action = watchdog.update(0.1, pos, 'run-home', true, target);

    expect(action).toBe('new_target'); // Lawina zmian stanu wymaga co najmniej new_target
    expect(watchdog.lastRecoveryReason).toBe('decision_loop');
    expect(logs[0].reason).toBe('decision_loop');
    expect(logs[0].action).toBe('new_target');
  });

  it('detects state timeout when NPC travels in a state for too long', () => {
    const logs: NpcWatchdogLogEntry[] = [];
    const pos = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(10, 0, 0);
    const watchdog = new NpcStuckWatchdog('Klątwa', pos, {
      stateTimeoutSeconds: 15.0,
      logger: (entry) => logs.push(entry),
    });

    // Symulacja ruchu, ale agent nigdy nie osiąga celu przez 16 sekund
    for (let i = 0; i < 15; i++) {
      pos.x += 0.3; // agent się porusza, więc no_movement nie zachodzi
      watchdog.update(1.0, pos, 'wander', true, target);
    }
    expect(logs).toHaveLength(0);

    // Przekroczenie 15s w wander
    pos.x += 0.3;
    const action = watchdog.update(1.0, pos, 'wander', true, target);
    expect(action).not.toBeNull();
    expect(watchdog.lastRecoveryReason).toBe('state_timeout');
    expect(logs[0].reason).toBe('state_timeout');
  });
});
