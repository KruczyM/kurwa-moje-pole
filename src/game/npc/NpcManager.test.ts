import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NpcManager } from './NpcManager';
import { INTERACTION_LAYER } from '../interactions/InteractionManager';
import { NpcNavigationGrid } from './NpcNavigationGrid';

/** Buduje mały, całkowicie przechodni grid używany przez testy menedżera. */
function openNavigation() {
  return new NpcNavigationGrid({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, 1, () => true);
}

/** Buduje minimalny asset, którego rozmiar zmienia się dopiero po uruchomieniu Idle. */
function animatedScaleAsset(): GLTF {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = 'animated-mesh';
  scene.add(mesh);
  const idle = new THREE.AnimationClip('Idle', 1, [
    new THREE.VectorKeyframeTrack('animated-mesh.scale', [0, 1], [100, 100, 100, 100, 100, 100]),
  ]);
  return { scene, animations: [idle] } as GLTF;
}

describe('NpcManager', () => {
  it('fits a character after applying its initial animated pose', () => {
    const scene = new THREE.Scene();
    const models = new Map([['amper', animatedScaleAsset()]]);
    const manager = new NpcManager(scene, models, null, openNavigation());
    const visual = manager.npcs[0].root.children[0];
    const height = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3()).y;

    expect(height).toBeCloseTo(2.45, 4);
    manager.dispose();
  });

  it('adds a stable interaction hitbox independent of the animated mesh pose', () => {
    const scene = new THREE.Scene();
    const models = new Map([['amper', animatedScaleAsset()]]);
    const manager = new NpcManager(scene, models, null, openNavigation());
    const npc = manager.npcs[0];
    const hitbox = npc.root.getObjectByName('NpcInteractionHitbox') as THREE.Mesh;

    expect(hitbox).toBeInstanceOf(THREE.Mesh);
    expect(hitbox.userData.interactionRoot).toBe(npc.root);
    expect((hitbox.material as THREE.MeshBasicMaterial).opacity).toBe(0);
    expect(hitbox.layers.isEnabled(INTERACTION_LAYER)).toBe(true);
    manager.dispose();
  });

  it('accelerates a walking NPC instead of applying its full speed in one frame', () => {
    const manager = new NpcManager(new THREE.Scene(), new Map(), null, openNavigation());
    const npc = manager.npcs[1];
    manager.npcs.forEach((candidate, index) => candidate.root.position.set(100 + index * 3, 0, 100));
    npc.root.position.set(0, 0, 0);
    npc.target.set(10, 0, 0);
    npc.waypoints = [npc.target.clone()];
    npc.wait = 0;
    npc.behavior.update(10, {
      nearEdge: false,
      insideSafeZone: true,
      arrived: false,
      socialAvailable: false,
    });

    manager.update(0.1, 0);
    expect(npc.speed).toBeCloseTo(0.18, 5);
    expect(npc.root.position.x).toBeCloseTo(0.018, 5);

    manager.update(0.1, 0.1);
    expect(npc.speed).toBeCloseTo(0.36, 5);
    expect(npc.root.position.x).toBeCloseTo(0.054, 5);
    manager.dispose();
  });

  it('enters run-home only at the edge and leaves it in the safe camp zone', () => {
    const manager = new NpcManager(new THREE.Scene(), new Map(), null, openNavigation());
    const npc = manager.npcs[2];
    npc.root.position.set(19, 0, 0);

    manager.update(0.1, 0);
    expect(npc.behavior.state).toBe('run-home');
    expect(npc.returning).toBe(true);

    npc.root.position.set(10, 0, 0);
    manager.update(0.1, 0.1);
    expect(npc.behavior.state).toBe('idle');
    expect(npc.returning).toBe(false);
    expect(npc.stationary).toBe(true);
    manager.dispose();
  });

  it('triggers watchdog recovery when an agent is stuck against an obstacle without resetting animations', () => {
    // Grid z przeszkodą bezpośrednio przed NPC: (0,0) jest wolne, ale (x > 0) jest zablokowane
    const blockedNav = new NpcNavigationGrid(
      { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      1,
      (x) => x <= 0.1,
    );
    const logs: any[] = [];
    const manager = new NpcManager(new THREE.Scene(), new Map(), null, blockedNav, {
      noMovementLimitSeconds: 1.0,
      logger: (entry) => logs.push(entry),
    });

    const npc = manager.npcs[0];
    // Przesuń pozostałych NPC daleko
    manager.npcs.forEach((other, index) => {
      if (other !== npc) other.root.position.set(100 + index * 3, 0, 100);
    });

    npc.root.position.set(0, 0, 0);
    npc.target.set(5, 0, 0);
    npc.waypoints = [new THREE.Vector3(1, 0, 0)];
    npc.behavior.state = 'wander';
    npc.behavior.travelling = true;
    npc.stationary = false;
    npc.wait = 0;

    // Aktualizacje przez 1.2s - NPC próbuje iść w prawo, ale trafia na blokadę
    for (let i = 0; i < 12; i++) {
      manager.update(0.1, i * 0.1);
    }

    // Watchdog musiał wykryć utknięcie i podjąć akcję
    expect(npc.watchdog.recoveryCount).toBeGreaterThanOrEqual(1);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].npcName).toBe(npc.name);
    expect(logs[0].reason).toBe('no_movement');
    expect(logs[0].action).toBe('steer_nudge');
    expect(logs[0].message).toContain('[NpcWatchdog]');
    manager.dispose();
  });

  it('teleports an agent as emergency fallback after prolonged stuckness across all recovery tiers', () => {
    const blockedNav = new NpcNavigationGrid(
      { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      1,
      (x, z) => Math.abs(x) < 5 && Math.abs(z) < 5,
    );
    const logs: any[] = [];
    const manager = new NpcManager(new THREE.Scene(), new Map(), null, blockedNav, {
      noMovementLimitSeconds: 0.5,
      logger: (entry) => logs.push(entry),
    });

    const npc = manager.npcs[1];
    npc.root.position.set(0, 0, 0);
    npc.target.set(15, 0, 15);
    npc.waypoints = [new THREE.Vector3(10, 0, 10)];
    npc.behavior.state = 'wander';
    npc.behavior.travelling = true;
    npc.stationary = false;

    // Utrzymujemy pozycję na przeszkodzie przez 6 sekund, pozwalając schedulerowi na kolejne próby
    for (let step = 0; step < 60; step++) {
      npc.root.position.set(0, 0, 0);
      manager.update(0.1, step * 0.1);
    }

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('steer_nudge');
    expect(actions).toContain('repath');
    expect(actions).toContain('new_target');
    expect(actions).toContain('teleport');

    // Ostateczna akcja to teleport
    const teleportLog = logs.find((l) => l.action === 'teleport');
    expect(teleportLog).toBeDefined();
    expect(teleportLog.npcName).toBe(npc.name);
    manager.dispose();
  });

  it('preserves animator state without excessive clip resets during watchdog recoveries', () => {
    const scene = new THREE.Scene();
    const models = new Map([['amper', animatedScaleAsset()]]);
    const blockedNav = new NpcNavigationGrid(
      { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      1,
      (x) => x <= 0.1,
    );
    const manager = new NpcManager(scene, models, null, blockedNav, {
      noMovementLimitSeconds: 0.3,
    });
    const npc = manager.npcs[0];

    npc.root.position.set(0, 0, 0);
    npc.target.set(5, 0, 0);
    npc.waypoints = [new THREE.Vector3(1, 0, 0)];
    npc.behavior.state = 'wander';
    npc.behavior.travelling = true;
    npc.stationary = false;

    // Wykonaj 10 kroków - watchdog podejmie recovery (steer_nudge, repath)
    for (let i = 0; i < 10; i++) {
      manager.update(0.1, i * 0.1);
    }

    expect(npc.watchdog.recoveryCount).toBeGreaterThanOrEqual(1);
    // Animator pozostał w poprawnym stanie locomotion i nie rzuca błędami
    const diag = npc.animator?.getDiagnostics();
    expect(diag).toBeDefined();
    expect(diag?.currentClip).toBe('Idle'); // animatedScaleAsset ma tylko Idle
    manager.dispose();
  });
});
