import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AuthoredFestivalWorld } from './AuthoredFestivalWorld';

function fixture() {
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(2.4, 1.2, 0.15);
  const material = new THREE.MeshStandardMaterial();
  const add = (id: string, x: number, z: number, category = '') => {
    const root = new THREE.Group();
    root.userData = { runtimePlacement: id, runtimeCategory: category };
    root.position.set(x, 0, z);
    root.add(new THREE.Mesh(geometry, material));
    scene.add(root);
    return root;
  };
  return { scene, add, source: { scene } as unknown as GLTF };
}

describe('authored festival migration', () => {
  it('never statically batches either live stage screen', () => {
    const f = fixture();
    for (const side of ['Left', 'Right']) {
      const root = f.add(`Screen_${side}`, 10, 20, 'Stages');
      root.children[0].userData.runtimeNode = `Wing_Single_Telebim_${side}`;
    }
    const world = new AuthoredFestivalWorld(f.source);
    for (const side of ['Left', 'Right']) {
      const screen = world.placements.get(`Screen_${side}`)!.children[0];
      expect(screen.visible).toBe(true);
      expect(screen.userData.authoredDynamic).toBe(true);
    }
    expect(world.root.children.some((o) => o.name.startsWith('AuthoredBatch_'))).toBe(false);
  });
  it('blocks only generic flag poles, not the cloth footprint or surrounding grass', () => {
    const f = fixture();
    f.add('N1-1_Pole', 8, 9, 'Life_N1-1').userData.campFlagPole = true;
    f.add('N1-1_Flag', 10, 9, 'Life_N1-1').userData.campFlagDesign = 0;
    const world = new AuthoredFestivalWorld(f.source);
    expect(world.colliders).toEqual([{ x: 8, z: 9, r: 0.15 }]);
    expect(world.grassCoverage(10, 9)).toBe(1);
  });
  it('uses moved model footprints for grass and collisions, not the old layout', () => {
    const f = fixture();
    f.add('T01', 80, 90, 'Camping');
    const world = new AuthoredFestivalWorld(f.source);
    expect(world.grassCoverage(80, 90)).toBe(0);
    expect(world.grassCoverage(0, 0)).toBe(1);
    expect(world.colliders).toHaveLength(1);
    expect(
      'box' in world.colliders[0] && world.colliders[0].box.containsPoint(new THREE.Vector3(80, 0, 90)),
    ).toBe(true);
  });

  it('binds seating at the exported position and shares repeated scenery draw calls', () => {
    const f = fixture();
    f.add('S01', 12, 18);
    f.add('S02', 15, 18);
    const world = new AuthoredFestivalWorld(f.source);
    expect(world.interactables.filter((i) => i.action === 'seat')).toHaveLength(2);
    expect(world.interactables[0].object.userData.interaction.position[0]).toBe(12);
    const batches: THREE.InstancedMesh[] = [];
    world.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) batches.push(o);
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].count).toBe(2);
    expect(f.scene.children[0].children[0].visible).toBe(true);
  });

  it('creates exactly three patrol checkpoints in the gaps, never on barrier segments', () => {
    const f = fixture();
    for (const [i, x] of [0, 2.5, 12.5, 15, 25, 27.5, 37.5, 40].entries())
      f.add(`StageBarrier_${String(i).padStart(3, '0')}`, x, 0);
    const world = new AuthoredFestivalWorld(f.source);
    expect(world.infrastructure.patrolCheckpoints).toHaveLength(3);
    expect(world.infrastructure.patrolCheckpoints.map((o) => o.position.x)).toEqual([7.5, 20, 32.5]);
    expect(world.colliders).toHaveLength(8);
  });

  it('preserves a wheel hierarchy and drives its existing controller without batching it', () => {
    const f = fixture();
    const root = f.add('AllegroWheel', 40, -20);
    const rotor = new THREE.Group();
    rotor.userData.wheelPart = 'rotor';
    for (let i = 0; i < 24; i++) {
      const gondola = new THREE.Group();
      gondola.userData.wheelPart = 'gondola';
      rotor.add(gondola);
    }
    root.add(rotor);
    const world = new AuthoredFestivalWorld(f.source);
    expect(world.wheel?.getGondola(23)).toBeDefined();
    const angle = world.wheel!.getAngle();
    world.wheel!.update(20);
    expect(world.wheel!.getAngle()).not.toBe(angle);
  });

  it('merges compatible unique opaque geometry but keeps animated doors separate', () => {
    const f = fixture();
    const a = f.add('detailA', 2, 3);
    const b = f.add('detailB', 5, 3);
    (b.children[0] as THREE.Mesh).geometry = new THREE.BoxGeometry(1, 1, 1);
    const doors = f.add('toitoi_battery_camp', 10, 0);
    const door = new THREE.Mesh(
      (a.children[0] as THREE.Mesh).geometry,
      (a.children[0] as THREE.Mesh).material,
    );
    door.userData.runtimeNode = 'ToiToi_Door_0';
    doors.add(door);
    const world = new AuthoredFestivalWorld(f.source);
    const merged: THREE.Object3D[] = [];
    world.root.traverse((o) => {
      if (o.name.startsWith('AuthoredMerged_')) merged.push(o);
    });
    expect(merged).toHaveLength(1);
    expect(world.interactables.filter((i) => i.action === 'toitoi_door')).toHaveLength(1);
    expect(world.infrastructure.toiToiDoors.getAllRecords()[0].doorWing?.visible).toBe(true);
  });
});
