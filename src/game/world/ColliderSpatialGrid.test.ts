import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ColliderSpatialGrid, type WorldCollider } from './ColliderSpatialGrid';

describe('ColliderSpatialGrid', () => {
  it('detects collision with circle colliders', () => {
    const grid = new ColliderSpatialGrid(16);
    grid.add({ x: 10, z: 10, r: 2 });

    // Inside / touching collider
    expect(grid.hasCollision(10, 10, 0.5)).toBe(true);
    expect(grid.hasCollision(12, 10, 0.1)).toBe(true);

    // Well outside
    expect(grid.hasCollision(15, 15, 0.5)).toBe(false);
    expect(grid.hasCollision(0, 0, 0.5)).toBe(false);
  });

  it('detects collision with box colliders and respects boundaries', () => {
    const grid = new ColliderSpatialGrid(16);
    const box = new THREE.Box3(
      new THREE.Vector3(-5, 0, -5),
      new THREE.Vector3(5, 5, 5),
    );
    grid.add({ box });

    expect(grid.hasCollision(0, 0, 0.3)).toBe(true);
    expect(grid.hasCollision(5.2, 0, 0.3)).toBe(true);
    expect(grid.hasCollision(5.5, 0, 0.1)).toBe(false);
    expect(grid.hasCollision(-10, -10, 0.5)).toBe(false);
  });

  it('correctly handles colliders spanning across cell boundaries', () => {
    const grid = new ColliderSpatialGrid(16);
    // Spans from x: 10 to 22 (crosses boundary at x: 16)
    const box = new THREE.Box3(
      new THREE.Vector3(10, 0, 10),
      new THREE.Vector3(22, 5, 22),
    );
    grid.add({ box });

    // In cell (0, 0)
    expect(grid.hasCollision(12, 12, 0.3)).toBe(true);
    // In cell (1, 1)
    expect(grid.hasCollision(20, 20, 0.3)).toBe(true);
    // Exactly at boundary
    expect(grid.hasCollision(16, 16, 0.3)).toBe(true);
  });

  it('honors enabled callback on dynamic colliders', () => {
    let isOpen = false;
    const grid = new ColliderSpatialGrid(16);
    grid.add({
      box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2)),
      enabled: () => !isOpen,
    });

    expect(grid.hasCollision(1, 1, 0.3)).toBe(true);
    isOpen = true;
    expect(grid.hasCollision(1, 1, 0.3)).toBe(false);
  });

  it('produces identical results to brute-force collider scan', () => {
    const grid = new ColliderSpatialGrid(16);
    const rawColliders: WorldCollider[] = [
      { x: -50, z: -30, r: 4 },
      { x: 25, z: 80, r: 1.5 },
      {
        box: new THREE.Box3(
          new THREE.Vector3(-10, 0, -10),
          new THREE.Vector3(10, 5, 10),
        ),
      },
      {
        box: new THREE.Box3(
          new THREE.Vector3(30, 0, -40),
          new THREE.Vector3(60, 5, -20),
        ),
      },
    ];

    rawColliders.forEach((c) => grid.add(c));

    const bruteForce = (x: number, z: number, r: number) => {
      return rawColliders.some((collider) => {
        if ('enabled' in collider && collider.enabled && !collider.enabled()) return false;
        return 'box' in collider
          ? x > collider.box.min.x - r &&
              x < collider.box.max.x + r &&
              z > collider.box.min.z - r &&
              z < collider.box.max.z + r
          : Math.hypot(x - collider.x, z - collider.z) < collider.r + r;
      });
    };

    // Test a grid of points
    for (let x = -70; x <= 70; x += 5) {
      for (let z = -70; z <= 70; z += 5) {
        expect(grid.hasCollision(x, z, 0.34)).toBe(bruteForce(x, z, 0.34));
      }
    }
  });

  it('clears all cells and colliders on clear()', () => {
    const grid = new ColliderSpatialGrid(16);
    grid.add({ x: 0, z: 0, r: 2 });
    expect(grid.colliders.length).toBe(1);
    expect(grid.hasCollision(0, 0, 0.5)).toBe(true);

    grid.clear();
    expect(grid.colliders.length).toBe(0);
    expect(grid.hasCollision(0, 0, 0.5)).toBe(false);
  });
});
