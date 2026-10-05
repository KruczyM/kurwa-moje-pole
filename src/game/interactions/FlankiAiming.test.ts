import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FlankiAiming } from './FlankiAiming';

describe('FlankiAiming', () => {
  it('identifies sweet spot correctly', () => {
    const aiming = new FlankiAiming({ sweetSpotMin: 0.7, sweetSpotMax: 0.85 });
    expect(aiming.isSweetSpot(0.5)).toBe(false);
    expect(aiming.isSweetSpot(0.75)).toBe(true);
    expect(aiming.isSweetSpot(0.95)).toBe(false);
  });

  it('calculates launch velocity pointing toward target with positive upward velocity', () => {
    const aiming = new FlankiAiming();
    const origin = new THREE.Vector3(0, 1.4, -20);
    const target = new THREE.Vector3(0, 0.1, -26);

    const vel = aiming.calculateLaunchVelocity(origin, target, 0.8);
    expect(vel.y).toBeGreaterThan(0); // Arcing up
    expect(vel.z).toBeLessThan(0); // Travelling in -Z direction
    expect(vel.x).toBeCloseTo(0);
  });

  it('computes trajectory points affected by gravity', () => {
    const aiming = new FlankiAiming();
    const origin = new THREE.Vector3(0, 1.4, -20);
    const vel = new THREE.Vector3(0, 3.5, -7.0);

    const points = aiming.computeTrajectory(origin, vel, 35, 0.05, 0);
    expect(points.length).toBeGreaterThan(5);

    // Initial points rise in Y
    expect(points[1].y).toBeGreaterThan(points[0].y);

    // Later points fall in Y due to gravity
    const last = points[points.length - 1];
    expect(last.z).toBeLessThan(origin.z);
    expect(last.y).toBeLessThanOrEqual(0.01); // Hit or touched floor
  });
});
