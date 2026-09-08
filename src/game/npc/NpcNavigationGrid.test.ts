import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NpcNavigationGrid } from './NpcNavigationGrid';

const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };

describe('NpcNavigationGrid', () => {
  it('routes around a collider and smooths redundant grid waypoints', () => {
    const navigation = new NpcNavigationGrid(bounds, 0.5, (x, z) => !(x > -1 && x < 1 && z > -8 && z < 8));
    const path = navigation.findPath(new THREE.Vector3(-6, 0, 0), new THREE.Vector3(6, 0, 0));

    expect(path.length).toBeGreaterThanOrEqual(3);
    expect(path.every((point) => navigation.canStandAt(point.x, point.z))).toBe(true);
    expect(path.some((point) => Math.abs(point.z) >= 8)).toBe(true);
    expect(navigation.lastSearch).toMatchObject({ found: true });
    expect(navigation.lastSearch!.smoothedWaypoints).toBeLessThan(navigation.lastSearch!.rawWaypoints);
  });

  it('does not cut diagonally through blocked corners', () => {
    const navigation = new NpcNavigationGrid(
      { minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
      1,
      (x, z) => !(x === 1 && z === 0) && !(x === 0 && z === 1),
    );
    expect(navigation.findPath(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 2))).toEqual([]);
  });

  it('moves a goal out of an obstacle instead of returning an invalid waypoint', () => {
    const navigation = new NpcNavigationGrid(bounds, 1, (x, z) => Math.hypot(x, z) > 2);
    const path = navigation.findPath(new THREE.Vector3(-8, 0, 0), new THREE.Vector3(0, 0, 0));
    const resolvedGoal = path[path.length - 1];

    expect(path.length).toBeGreaterThan(1);
    expect(navigation.canStandAt(resolvedGoal.x, resolvedGoal.z)).toBe(true);
    expect(Math.hypot(resolvedGoal.x, resolvedGoal.z)).toBeGreaterThan(2);
  });

  it('samples reachable targets from every field sector within the search budget', () => {
    const navigation = new NpcNavigationGrid(bounds, 0.5, () => true);
    const sectors = [
      { minX: -10, maxX: -1, minZ: -10, maxZ: -1 },
      { minX: 1, maxX: 10, minZ: -10, maxZ: -1 },
      { minX: -10, maxX: -1, minZ: 1, maxZ: 10 },
      { minX: 1, maxX: 10, minZ: 1, maxZ: 10 },
    ];

    for (const sector of sectors) {
      const target = navigation.randomWalkablePoint(() => 0.5, sector)!;
      expect(target.x).toBeGreaterThanOrEqual(sector.minX);
      expect(target.x).toBeLessThanOrEqual(sector.maxX);
      expect(target.z).toBeGreaterThanOrEqual(sector.minZ);
      expect(target.z).toBeLessThanOrEqual(sector.maxZ);
      expect(navigation.findPath(new THREE.Vector3(0, 0, 0), target).length).toBeGreaterThan(1);
      expect(navigation.lastSearch!.expandedNodes).toBeLessThan(navigation.width * navigation.depth);
      expect(navigation.lastSearch!.durationMs).toBeLessThan(100);
    }
  });
});
