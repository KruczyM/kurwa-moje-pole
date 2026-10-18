import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { tentFootprint, circleTouchesFootprint } from './tentFootprint';
import { ColliderSpatialGrid } from './ColliderSpatialGrid';

describe('tent body footprint', () => {
  it('ignores ropes outside the groundsheet, including after rotation', () => {
    const root = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(2, 0.04, 4));
    sheet.name = 'Tent_Groundsheet';
    root.add(sheet);
    const rope = new THREE.Mesh(new THREE.BoxGeometry(12, 0.02, 0.02));
    rope.name = 'Guy_Rope';
    root.add(rope);
    root.rotation.y = Math.PI / 4;
    root.updateMatrixWorld(true);
    const footprint = tentFootprint(root)!;
    const grid = new ColliderSpatialGrid();
    grid.add({ box: footprint.box, points: footprint.points });
    expect(grid.hasCollision(0, 0, 0.2)).toBe(true);
    expect(grid.hasCollision(3, 3, 0.2)).toBe(false);
    expect(circleTouchesFootprint(0, 0, 0, footprint.points)).toBe(true);
    expect(grid.hasCollision(1.9, -1.9, 0.1)).toBe(false);
  });
});
