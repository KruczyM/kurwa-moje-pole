import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NpcDebugOverlay, isNpcDebugAllowed } from './NpcDebugOverlay';
import { NpcManager } from './NpcManager';
import { NpcNavigationGrid } from './NpcNavigationGrid';

function openNavigation() {
  return new NpcNavigationGrid({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, 1, () => true);
}

function setupMockDOM() {
  const createEl = (tag: string) => {
    const el: any = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      style: {},
      children: [],
      innerHTML: '',
      parentElement: null,
      appendChild(child: any) {
        this.children.push(child);
        child.parentElement = this;
        return child;
      },
      removeChild(child: any) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        child.parentElement = null;
        return child;
      },
      querySelector(selector: string) {
        if (selector.startsWith('#')) {
          const targetId = selector.slice(1);
          const findRecursive = (node: any): any => {
            if (node.id === targetId) return node;
            for (const c of node.children) {
              const res = findRecursive(c);
              if (res) return res;
            }
            return null;
          };
          return findRecursive(this);
        }
        return null;
      },
      querySelectorAll(selector: string) {
        const results: any[] = [];
        if (selector.startsWith('.')) {
          const targetClass = selector.slice(1);
          const collectRecursive = (node: any) => {
            if (node.className === targetClass) results.push(node);
            for (const c of node.children) collectRecursive(c);
          };
          collectRecursive(this);
        }
        return results;
      },
    };
    return el;
  };

  const body = createEl('body');
  (globalThis as any).document = {
    createElement: createEl,
    body,
  };
  (globalThis as any).window = {
    innerWidth: 1024,
    innerHeight: 768,
    location: { search: '?debugNpc=1' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return body;
}

describe('NpcDebugOverlay', () => {
  let scene: THREE.Scene;
  let mockWorld: { colliders: readonly ({ x: number; z: number; r: number } | { box: THREE.Box3 })[] };
  let manager: NpcManager;
  let mockBody: any;

  beforeEach(() => {
    mockBody = setupMockDOM();
    scene = new THREE.Scene();
    mockWorld = {
      colliders: [
        { box: new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(-2, 2, -2)) },
        { x: 3, z: 3, r: 1.5 },
      ],
    };
    manager = new NpcManager(scene, new Map(), null, openNavigation());
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it('creates debug groups and objects for colliders, grid, paths and targets', () => {
    const overlay = new NpcDebugOverlay({
      scene,
      world: mockWorld,
      npcManager: manager,
      container: mockBody,
      initialVisible: true,
    });

    expect(overlay.rootGroup.name).toBe('NpcDebugOverlay');
    expect(overlay.visible).toBe(true);
    expect(overlay.rootGroup.children.length).toBe(4); // colliders, grid, paths, targets
    expect(mockBody.querySelector('#npc-debug-overlay')).toBeDefined();
    expect(mockBody.querySelector('#npc-debug-metrics')).toBeDefined();
    expect(mockBody.querySelectorAll('.npc-debug-label').length).toBe(manager.npcs.length);

    overlay.dispose();
  });

  it('toggles visibility of all layers or individual layers independently', () => {
    const overlay = new NpcDebugOverlay({
      scene,
      world: mockWorld,
      npcManager: manager,
      initialVisible: false,
    });

    expect(overlay.visible).toBe(false);

    // Włącz cały overlay
    overlay.toggle('all');
    expect(overlay.visible).toBe(true);

    // Przełączanie poszczególnych warstw
    overlay.toggle('colliders');
    expect(overlay.showColliders).toBe(false);

    overlay.toggle('grid');
    expect(overlay.showGrid).toBe(false);

    overlay.toggle('paths');
    expect(overlay.showPaths).toBe(false);

    overlay.toggle('targets');
    expect(overlay.showTargets).toBe(false);

    overlay.toggle('labels');
    expect(overlay.showLabels).toBe(false);

    overlay.toggle('metrics');
    expect(overlay.showMetrics).toBe(false);

    overlay.dispose();
  });

  it('formats label content with NPC name, state, speed, and stuck timer', () => {
    const overlay = new NpcDebugOverlay({
      scene,
      world: mockWorld,
      npcManager: manager,
    });

    const npc = manager.npcs[0];
    npc.speed = 1.45;
    npc.watchdog.timeWithoutProgress = 1.2;
    npc.behavior.state = 'wander';

    const html = overlay.formatLabelContent(npc);
    expect(html).toContain(npc.name);
    expect(html).toContain('[wander]');
    expect(html).toContain('1.45 m/s');
    expect(html).toContain('1.2s');

    overlay.dispose();
  });

  it('aggregates diagnostic metrics summary across all NPCs', () => {
    const overlay = new NpcDebugOverlay({
      scene,
      world: mockWorld,
      npcManager: manager,
    });

    manager.npcs[0].watchdog.repathCount = 3;
    manager.npcs[0].watchdog.stateTransitionCount = 5;
    manager.npcs[0].watchdog.recoveryCount = 2;

    manager.npcs[1].watchdog.repathCount = 1;
    manager.npcs[1].watchdog.stateTransitionCount = 4;
    manager.npcs[1].watchdog.recoveryCount = 1;

    const metrics = overlay.getMetricsSummary();
    expect(metrics.totalRepaths).toBe(4);
    expect(metrics.totalStateTransitions).toBe(9);
    expect(metrics.totalRecoveries).toBe(3);
    expect(metrics.npcs.length).toBe(manager.npcs.length);

    overlay.dispose();
  });

  it('updates path positions and DOM label coordinates when projected by a camera', () => {
    const overlay = new NpcDebugOverlay({
      scene,
      world: mockWorld,
      npcManager: manager,
      container: mockBody,
      initialVisible: true,
    });

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    manager.npcs[0].root.position.set(0, 0, 0);
    manager.npcs[0].target.set(5, 0, 5);
    manager.npcs[0].waypoints = [new THREE.Vector3(2, 0, 2), new THREE.Vector3(5, 0, 5)];

    overlay.update(camera);

    const labels = mockBody.querySelectorAll('.npc-debug-label');
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0].style.display).toBe('block');
    expect(labels[0].style.left).toBeDefined();
    expect(labels[0].style.top).toBeDefined();

    overlay.dispose();
  });

  it('cleans up root group and removes DOM nodes upon dispose', () => {
    const overlay = new NpcDebugOverlay({
      scene,
      world: mockWorld,
      npcManager: manager,
      container: mockBody,
      initialVisible: true,
    });

    expect(scene.children).toContain(overlay.rootGroup);
    expect(mockBody.querySelector('#npc-debug-overlay')).not.toBeNull();

    overlay.dispose();

    expect(scene.children).not.toContain(overlay.rootGroup);
    expect(mockBody.querySelector('#npc-debug-overlay')).toBeNull();
  });

  it('checks isNpcDebugAllowed in dev environment', () => {
    expect(isNpcDebugAllowed()).toBe(true);
  });
});
