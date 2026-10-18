import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { flankiHitsCan, flankiSway, flankiThrowVelocity, stepFlankiBall } from './FlankiPhysics';

describe('Flanki physical throw', () => {
  it('matches analytic gravity irrespective of the simulation frame rate', () => {
    const run = (steps: number) => {
      const position = new THREE.Vector3(0, 1.8, 0);
      const velocity = new THREE.Vector3(1, 2, -10);
      for (let i = 0; i < steps; i++) stepFlankiBall(position, velocity, 1 / steps);
      return position;
    };
    expect(run(30).distanceTo(run(144))).toBeLessThan(1e-10);
    expect(run(30).y).toBeCloseTo(1.8 + 2 - 9.81 / 2, 10);
  });
  it('detects crossing a narrow can even when both endpoints miss it', () => {
    expect(
      flankiHitsCan(new THREE.Vector3(0, 0.08, 2), new THREE.Vector3(0, 0.08, -2), new THREE.Vector3()),
    ).toBe(true);
    expect(
      flankiHitsCan(new THREE.Vector3(0.2, 0.08, 2), new THREE.Vector3(0.2, 0.08, -2), new THREE.Vector3()),
    ).toBe(false);
    expect(flankiHitsCan(new THREE.Vector3(0, 1, 2), new THREE.Vector3(0, 1, -2), new THREE.Vector3())).toBe(
      false,
    );
  });
  it('cosmetic hand sway does not alter the released trajectory', () => {
    const aim = new THREE.Vector3(0, -0.2, -1).normalize();
    expect(flankiThrowVelocity(aim, 0.75, 0).distanceTo(flankiThrowVelocity(aim, 0.75, 0.5))).toBe(0);
    expect(flankiSway(0.5)).toEqual(flankiSway(0.5));
    expect(flankiThrowVelocity(aim, 2, 0).length()).toBeCloseTo(16);
  });
});
