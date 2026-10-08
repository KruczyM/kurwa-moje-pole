import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NpcManager } from './NpcManager';
import { NpcNavigationGrid } from './NpcNavigationGrid';
import { MAIN_ASPHALT_ROAD, isInsidePrimaryCamp } from '../world/festivalLayout';
import { festivalNpcAssets } from '../assets/assetManifest';
import { disposeObjectTree } from '../lifecycle/disposeThree';

function fixture() {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
  mesh.position.set(10, 3, -5); // AI export origin is not necessarily beneath the feet.
  scene.add(mesh);
  return { scene, animations: [] } as unknown as GLTF;
}

function create(seed = 73) {
  const scene = new THREE.Scene();
  const navigation = new NpcNavigationGrid(
    { minX: -260, maxX: 260, minZ: -170, maxZ: 170 },
    1,
    (x, z) => !(Math.abs(x) < 4 && z > -5 && z < 5),
  );
  return { scene, navigation, manager: new NpcManager(scene, new Map(), null, navigation, undefined, seed) };
}

describe('streamed festival crowd', () => {
  it('supports a smaller mobile crowd with dancers and walkers on both passages', () => {
    const { scene, manager } = create();
    const baseline = manager.npcs.length;
    manager.setCrowdDistribution(8, 8);
    const model = fixture();
    for (const asset of festivalNpcAssets.slice(0, 24)) manager.addFestivalNpc(asset, model);
    const crowd = manager.npcs.slice(baseline);
    expect(crowd.filter((npc) => npc.festivalRole === 'stage_dancer')).toHaveLength(8);
    expect(crowd.filter((npc) => npc.passageWalker && npc.passageLane === 'lower')).toHaveLength(8);
    expect(crowd.filter((npc) => npc.passageWalker && npc.passageLane === 'upper')).toHaveLength(8);
    manager.dispose();
    disposeObjectTree(scene);
  });
  it('adds all 91 catalog models without the eight-spawn limit, with safe separate positions', () => {
    const { scene, manager, navigation } = create();
    const model = fixture();
    const baseline = manager.npcs.length;
    try {
      for (const asset of festivalNpcAssets) expect(manager.addFestivalNpc(asset, model)).toBe(true);
      const crowd = manager.npcs.slice(baseline);
      expect(crowd).toHaveLength(91);
      expect(new Set(crowd.map((n) => n.root.userData.npcId)).size).toBe(91);
      expect(manager.addFestivalNpc(festivalNpcAssets[0], model)).toBe(false);
      expect(crowd.filter((n) => n.passageWalker)).toHaveLength(71);
      for (const npc of crowd) {
        expect(navigation.canStandAt(npc.root.position.x, npc.root.position.z)).toBe(true);
        expect(npc.root.parent).toBe(scene);
        expect(npc.animator).toBeUndefined();
        expect(npc.root.userData.animationStatus).toBe('static-needs-rig');
        npc.root.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(npc.root.children[0]);
        expect(bounds.getSize(new THREE.Vector3()).y).toBeCloseTo(2.45, 5);
        expect(bounds.min.y).toBeCloseTo(0);
        expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(npc.root.position.x);
        expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(npc.root.position.z);
        for (const other of crowd)
          if (other !== npc)
            expect(other.root.position.distanceTo(npc.root.position)).toBeGreaterThanOrEqual(1.5);
      }
      manager.dispose();
      expect(manager.addFestivalNpc({ id: 'late', name: 'Late' }, model)).toBe(false);
    } finally {
      manager.dispose();
      disposeObjectTree(scene);
    }
  });

  it('keeps passage walkers on the road and alternates destinations across it', () => {
    const { scene, manager } = create();
    for (const asset of festivalNpcAssets) manager.addFestivalNpc(asset, fixture());
    const npc = manager.npcs.at(-1)!;
    try {
      expect(npc.passageWalker).toBe(true);
      for (let i = 0; i < 100; i++) manager.update(0.1, i / 10);
      const first = npc.target.clone();
      expect(first.z).toBeGreaterThan(MAIN_ASPHALT_ROAD.minZ + 1);
      expect(first.z).toBeLessThan(MAIN_ASPHALT_ROAD.maxZ - 1);
      expect(npc.root.position.z).toBeGreaterThan(MAIN_ASPHALT_ROAD.minZ);
      expect(npc.root.position.z).toBeLessThan(MAIN_ASPHALT_ROAD.maxZ);
      npc.root.position.copy(first);
      npc.waypoints = [first.clone()];
      manager.update(0.1, 10);
      expect(npc.behavior.state).toBe('idle');
      for (let i = 0; i < 260; i++) manager.update(0.1, 10 + i / 10);
      expect(npc.target.x * first.x).toBeLessThan(0);
      expect(npc.target.z).toBeGreaterThan(MAIN_ASPHALT_ROAD.minZ + 1);
      expect(npc.target.z).toBeLessThan(MAIN_ASPHALT_ROAD.maxZ - 1);
    } finally {
      manager.dispose();
      disposeObjectTree(scene);
    }
  });

  it('strictly prevents outsider festival NPCs from entering the primary camp plot (kurwa moje pole)', () => {
    const { scene, manager } = create();
    try {
      const model = fixture();
      for (const asset of festivalNpcAssets) manager.addFestivalNpc(asset, model);
      const festivalNpcs = manager.npcs.filter((n) => !n.isCampMember);
      expect(festivalNpcs.length).toBe(91);

      // Verify none of the festival outsiders spawned inside primary camp
      for (const npc of festivalNpcs) {
        expect(isInsidePrimaryCamp(npc.root.position.x, npc.root.position.z, 0)).toBe(false);
      }

      // Simulate movement steps and verify they never step inside primary camp
      for (let step = 0; step < 60; step++) {
        manager.update(0.1, step * 0.1);
        for (const npc of festivalNpcs) {
          expect(isInsidePrimaryCamp(npc.root.position.x, npc.root.position.z, 0)).toBe(false);
        }
      }
    } finally {
      manager.dispose();
      disposeObjectTree(scene);
    }
  });

  it('assigns the requested 20 stage dancers, 20 lower-road walkers and 51 upper-road walkers', () => {
    const { scene, manager } = create();
    try {
      const model = fixture();
      for (const asset of festivalNpcAssets) manager.addFestivalNpc(asset, model);
      const festivalNpcs = manager.npcs.filter((n) => !n.isCampMember);

      const roles = new Set(festivalNpcs.map((n) => n.festivalRole).filter(Boolean));
      expect(roles.has('stage_dancer')).toBe(true);
      expect(roles).toEqual(new Set(['stage_dancer', 'walker']));
      expect(festivalNpcs.filter((n) => n.festivalRole === 'stage_dancer')).toHaveLength(20);
      expect(festivalNpcs.filter((n) => n.passageWalker && n.passageLane === 'lower')).toHaveLength(20);
      expect(festivalNpcs.filter((n) => n.passageWalker && n.passageLane === 'upper')).toHaveLength(51);

      const walkers = festivalNpcs.filter((n) => n.passageWalker);
      expect(walkers).toHaveLength(71);
    } finally {
      manager.dispose();
      disposeObjectTree(scene);
    }
  });
});
