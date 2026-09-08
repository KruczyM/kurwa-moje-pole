import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeNpcSteering, NPC_STEERING, turnDirectionTowards } from './NpcSteering';

const OPEN_WORLD = () => true;

/** Buduje kompletne wejście steeringu dla ruchu wzdłuż dodatniej osi Z. */
function input(overrides: Partial<Parameters<typeof computeNpcSteering>[0]> = {}) {
  return {
    position: new THREE.Vector3(),
    desiredDirection: new THREE.Vector3(0, 0, 1),
    velocity: new THREE.Vector3(0, 0, 1),
    speed: 1,
    neighbors: [],
    canStandAt: OPEN_WORLD,
    ...overrides,
  };
}

describe('computeNpcSteering', () => {
  it('preserves the route direction when the path and neighborhood are clear', () => {
    const result = computeNpcSteering(input());

    expect(result.direction.x).toBeCloseTo(0, 6);
    expect(result.direction.z).toBeCloseTo(1, 6);
    expect(result.speedScale).toBe(1);
    expect(result.obstacleAhead).toBe(false);
  });

  it('predicts a static obstacle and chooses a clear direction before contact', () => {
    const result = computeNpcSteering(
      input({
        canStandAt: (x, z) => !(z > 0.45 && z < 2 && Math.abs(x) < 0.28),
      }),
    );

    expect(result.obstacleAhead).toBe(true);
    expect(Math.abs(result.direction.x)).toBeGreaterThan(0.2);
    expect(result.direction.z).toBeGreaterThan(0);
  });

  it('steers to its own right and slows down before a head-on collision', () => {
    const result = computeNpcSteering(
      input({
        neighbors: [
          {
            position: new THREE.Vector3(0, 0, 1.6),
            velocity: new THREE.Vector3(0, 0, -1),
          },
        ],
      }),
    );

    expect(result.avoidedAgents).toBe(1);
    expect(result.direction.x).toBeLessThan(0);
    expect(result.speedScale).toBeGreaterThanOrEqual(NPC_STEERING.minimumMovingSpeedScale);
    expect(result.speedScale).toBeLessThan(1);
  });

  it('keeps finite output when agents occupy nearly the same point', () => {
    const result = computeNpcSteering(
      input({
        neighbors: [
          {
            position: new THREE.Vector3(0.00001, 0, 0.00001),
            velocity: new THREE.Vector3(),
          },
        ],
      }),
    );

    expect(result.direction.toArray().every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(result.speedScale)).toBe(true);
  });

  it('lets two head-on agents pass without overlap or side-to-side oscillation', () => {
    const positions = [new THREE.Vector3(0, 0, -2), new THREE.Vector3(0, 0, 2)];
    const desired = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
    const velocities = desired.map((direction) => direction.clone());
    const directions = desired.map((direction) => direction.clone());
    const sideSigns = [new Set<number>(), new Set<number>()];
    let minimumDistance = Infinity;

    for (let frame = 0; frame < 240; frame += 1) {
      const snapshot = positions.map((position) => position.clone());
      for (let index = 0; index < 2; index += 1) {
        const other = 1 - index;
        const steering = computeNpcSteering(
          input({
            position: snapshot[index],
            desiredDirection: desired[index],
            velocity: velocities[index],
            neighbors: [{ position: snapshot[other], velocity: velocities[other] }],
          }),
        );
        directions[index].copy(
          turnDirectionTowards(directions[index], steering.direction, NPC_STEERING.maximumTurnRate / 60),
        );
        velocities[index].copy(directions[index]).multiplyScalar(steering.speedScale);
        positions[index].addScaledVector(velocities[index], 1 / 60);
        if (Math.abs(directions[index].x) > 0.05) sideSigns[index].add(Math.sign(directions[index].x));
      }
      minimumDistance = Math.min(minimumDistance, positions[0].distanceTo(positions[1]));
    }

    expect(minimumDistance).toBeGreaterThan(NPC_STEERING.agentRadius * 2);
    expect(sideSigns[0].size).toBeLessThanOrEqual(1);
    expect(sideSigns[1].size).toBeLessThanOrEqual(1);
    expect(positions[0].z).toBeGreaterThan(positions[1].z);
  });
});

describe('turnDirectionTowards', () => {
  it('limits angular velocity instead of snapping toward the avoidance direction', () => {
    const result = turnDirectionTowards(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), Math.PI / 8);

    expect(Math.atan2(result.x, result.z)).toBeCloseTo(Math.PI / 8, 6);
  });
});
