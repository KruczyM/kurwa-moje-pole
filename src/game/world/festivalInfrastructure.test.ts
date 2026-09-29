import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  FESTIVAL_INFRASTRUCTURE_PLACEMENTS,
  sampleInfrastructureGrassMask,
  placeFestivalInfrastructure,
  FestivalInfrastructureModels,
} from './festivalInfrastructure';
import { FestivalStageEffects } from './festivalStageEffects';
import { GRZYBEK_SITE } from './festivalGrzybek';

describe('festivalInfrastructure', () => {
  it('defines valid festival infrastructure placements', () => {
    expect(FESTIVAL_INFRASTRUCTURE_PLACEMENTS.length).toBeGreaterThanOrEqual(14);
    const ids = FESTIVAL_INFRASTRUCTURE_PLACEMENTS.map((p) => p.id);
    expect(ids).toContain('festival_gate_main');
    expect(ids).toContain('foh_tower_main');
    expect(ids).toContain('delay_tower_north');
    expect(ids).toContain('delay_tower_south');
    expect(ids).not.toContain('grzybek_wodny');
    expect(ids).not.toContain('toitoi_single_camp');
    expect(ids).not.toContain('field_showers_south');
    expect(ids).not.toContain('field_showers_mud');
    expect(ids).toContain('toitoi_battery_camp');
    expect(ids).toContain('wash_taps_camp');
  });

  it('samples infrastructure grass mask correctly', () => {
    // Outside any landmark: mask is 1.0 (full grass)
    expect(sampleInfrastructureGrassMask(0, 0)).toBe(1.0);
    expect(sampleInfrastructureGrassMask(200, 200)).toBe(1.0);

    // Inside Grzybek site: mask is 0.0 or near 0 (cleared for duckboard platform)
    expect(sampleInfrastructureGrassMask(GRZYBEK_SITE.x, GRZYBEK_SITE.z)).toBe(0.0);

    // Inside FOH tower site: mask is 0.0
    expect(sampleInfrastructureGrassMask(72, 18)).toBe(0.0);
  });

  it('places models and generates colliders and particles', () => {
    const parent = new THREE.Group();
    const fakeScene = new THREE.Group();
    const fakeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    fakeScene.add(fakeMesh);
    const fakeGltf: any = { scene: fakeScene };

    const models: FestivalInfrastructureModels = {
      festivalGate: fakeGltf,
      festivalSignpost: fakeGltf,
      fohTower: fakeGltf,
      delayTower: fakeGltf,
      grzybek: fakeGltf,
      toitoiRow: fakeGltf,
      washTaps: fakeGltf,
    };

    const heightAt = (_x: number, _z: number) => 0.5;
    const instance = placeFestivalInfrastructure(parent, models, heightAt);

    expect(instance.roots.length).toBeGreaterThan(0);
    expect(instance.colliders.length).toBeGreaterThan(0);
    expect(instance.grzybekParticles).not.toBeNull();

    // Verify delta-time update works without error
    expect(() => instance.update(0.016)).not.toThrow();

    // Verify cleanup
    instance.dispose();
    expect(instance.grzybekParticles).toBeNull();
  });

  it('places water curtain on the pasaż perpendicular to the road and allows walking through the archway', () => {
    const placement = FESTIVAL_INFRASTRUCTURE_PLACEMENTS.find((p) => p.id === 'water_curtain_avenue');
    expect(placement).toBeDefined();
    // On the pasaż (MAIN_ASPHALT_ROAD z in [-40, -30])
    expect(placement!.z).toBeGreaterThanOrEqual(-40);
    expect(placement!.z).toBeLessThanOrEqual(-30);
    // Perpendicular to the road (road is along X axis, arch must span along Z axis -> rotationY = +/- PI/2)
    expect(Math.abs(Math.cos(placement!.rotationY))).toBeLessThan(1e-4);

    const parent = new THREE.Group();
    const fakeGltf: any = { scene: new THREE.Group() };
    const instance = placeFestivalInfrastructure(parent, { waterCurtain: fakeGltf }, () => 0.0);

    // Center walkway through the arch is completely unobstructed
    const centerWalkwayPoint = new THREE.Vector3(placement!.x, 1.0, placement!.z);
    expect(instance.colliders.some((box) => box.containsPoint(centerWalkwayPoint))).toBe(false);

    // The two support pillars/footings on the sides block walking through the steel posts
    const northPillarPoint = new THREE.Vector3(placement!.x, 1.0, placement!.z - 2.6);
    const southPillarPoint = new THREE.Vector3(placement!.x, 1.0, placement!.z + 2.6);
    expect(instance.colliders.some((box) => box.containsPoint(northPillarPoint))).toBe(true);
    expect(instance.colliders.some((box) => box.containsPoint(southPillarPoint))).toBe(true);

    instance.dispose();
  });

  it('places crowd barrier perimeter fence around Duża Scena with Pokojowy Patrol central checkpoint gate', () => {
    const parent = new THREE.Group();
    const fakeGltf: any = { scene: new THREE.Group() };
    const instance = placeFestivalInfrastructure(parent, { crowdBarrier: fakeGltf }, () => 0.0);

    // Central gate opening at x = 110, z = 18 is open for pedestrians
    const gatePoint = new THREE.Vector3(110, 1.0, 18);
    expect(instance.colliders.some((box) => box.containsPoint(gatePoint))).toBe(false);

    // North barrier wing at x = 110, z = 0 is blocked
    const northFencePoint = new THREE.Vector3(110, 1.0, 0);
    expect(instance.colliders.some((box) => box.containsPoint(northFencePoint))).toBe(true);

    // South barrier wing at x = 110, z = 30 is blocked
    const southFencePoint = new THREE.Vector3(110, 1.0, 30);
    expect(instance.colliders.some((box) => box.containsPoint(southFencePoint))).toBe(true);

    // Checkpoint interaction exists at gate
    expect(instance.patrolCheckpoints.length).toBe(1);
    const checkpoint = instance.patrolCheckpoints[0];
    expect(checkpoint.userData.interaction?.kind).toBe('patrol_checkpoint');
    expect(checkpoint.position.x).toBeCloseTo(109.5);
    expect(checkpoint.position.z).toBeCloseTo(18);

    instance.dispose();
  });

  it('configures paired food tents and stands on both South and North passages', () => {
    const ids = FESTIVAL_INFRASTRUCTURE_PLACEMENTS.map((p) => p.id);
    expect(ids).toContain('food_tent_south_1');
    expect(ids).toContain('food_tent_south_2');
    expect(ids).toContain('food_tent_north_1');
    expect(ids).toContain('food_tent_north_2');
    expect(ids).toContain('foodtruck_frytki_south');
    expect(ids).toContain('rollbar_lech_south');
    expect(ids).toContain('foodtruck_burger_north');
    expect(ids).toContain('foodtruck_churros_north');
    expect(ids).toContain('foodtruck_makarun_north');
    expect(ids).toContain('rollbar_lech_north');

    // Grzybek standpipe relocated in front-left of Duża Scena
    const grzybek = FESTIVAL_INFRASTRUCTURE_PLACEMENTS.find((p) => p.id === 'festival_grzybek');
    expect(grzybek).toBeDefined();
    expect(grzybek!.x).toBe(160);
    expect(grzybek!.z).toBe(-8);
  });
});

describe('FestivalStageEffects', () => {
  it('creates moving head spots and sky lasers', () => {
    const effects = new FestivalStageEffects();
    expect(effects.group.children.length).toBeGreaterThan(0);

    // Test update loop
    expect(() => effects.update(0.016)).not.toThrow();
    expect(() => effects.update(0.033)).not.toThrow();

    // Test disposal
    expect(() => effects.dispose()).not.toThrow();
  });
});
