import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { characterAssets } from '../assets/assetManifest';
import { NpcManager } from './NpcManager';
import { NpcNavigationGrid } from './NpcNavigationGrid';
import { festivalAreaAt } from '../world/mobileFestivalAreas';

function setup(walkable = true) {
  const scene = new THREE.Scene();
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()));
  const gltf = {
    scene: model,
    animations: ['Idle', 'HipHopDancing'].map((name) => new THREE.AnimationClip(name, 1, [])),
  } as GLTF;
  const models = new Map(characterAssets.map((asset) => [asset.id, gltf]));
  const nav = new NpcNavigationGrid({ minX: -170, maxX: 260, minZ: -172, maxZ: 172 }, 2, () => walkable);
  return { scene, manager: new NpcManager(scene, models, null, nav, undefined, 42, true), gltf };
}
const active = (manager: NpcManager) => manager.npcs.filter((npc) => !npc.sectorDormant && !npc.isHidden);

describe('mobile ambient bot pool', () => {
  it('creates a bounded pool and only attaches the active place population', () => {
    const { scene, manager, gltf } = setup();
    expect(manager.npcs).toHaveLength(6);
    expect(active(manager)).toHaveLength(0);
    manager.setMobileArea('camp');
    expect(active(manager)).toHaveLength(3);
    expect(scene.children).toHaveLength(3);
    const pool = [...manager.npcs];
    manager.setMobileArea('north-camps');
    expect(active(manager)).toHaveLength(1);
    expect(scene.children).toHaveLength(1);
    expect(manager.npcs).toEqual(pool);
    expect(manager.addFestivalNpc({ id: 'heavy-crowd', name: 'Crowd' }, gltf)).toBe(false);
    manager.setMobileArea();
    expect(scene.children).toHaveLength(0);
    manager.dispose();
  });
  it('places stage bots together, dances in place and never advances dormant bots', () => {
    const { manager } = setup();
    manager.setMobileArea('main-stage');
    const positions = manager.npcs.map((npc) => npc.root.position.clone());
    for (let i = 0; i < 40; i++) manager.update(0.05, i / 20, new THREE.Vector3(170, 2, 20));
    expect(active(manager)).toHaveLength(3);
    for (const npc of active(manager)) {
      expect(festivalAreaAt(npc.root.position.x, npc.root.position.z)).toBe('main-stage');
      expect(npc.animator?.activityActive).toBe(true);
    }
    manager.npcs.forEach((npc, index) =>
      expect(npc.root.position.distanceTo(positions[index])).toBeLessThan(0.001),
    );
    manager.dispose();
  });
  it('reduces bots for humans/FPS and does not duplicate an occupied character', () => {
    const { manager } = setup();
    const name = manager.npcs[0].name;
    manager.setMobileArea('camp', 3, [name]);
    expect(active(manager)).toHaveLength(2);
    expect(active(manager).some((npc) => npc.name === name)).toBe(false);
    manager.setMobileArea('camp', 0, [], 1);
    expect(active(manager)).toHaveLength(1);
    manager.setMobileArea('camp', 15);
    expect(active(manager)).toHaveLength(0);
    manager.dispose();
  });
  it('omits bots when there is no walkable spawn instead of using an unsafe fallback', () => {
    const { manager } = setup(false);
    manager.setMobileArea('main-stage');
    expect(active(manager)).toHaveLength(0);
    manager.dispose();
  });
});
