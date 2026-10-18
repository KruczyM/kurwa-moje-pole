import * as THREE from 'three';

export const FLANKI_BALL_RADIUS = 0.048;
export const FLANKI_PHYSICS_STEP = 1 / 120;

/** Keep the can and both chalk lines visible, in near and distant grass layers. */
export function flankiPitchGrassCoverage(x: number, z: number) {
  return Math.abs(x) <= 3.5 && z >= -33.5 && z <= -18.5 ? 0 : 1;
}

/** Deterministic sway while selecting a trajectory; charging freezes the selected arc. */
export function flankiSway(seconds: number) {
  return {
    yaw: Math.sin(seconds * 2.8) * 0.035,
    pitch: Math.sin(seconds * 4.1) * 0.015,
    x: Math.sin(seconds * 2.8) * 0.025,
    y: Math.sin(seconds * 4.1) * 0.012,
  };
}

/** Aim sets the bearing and arc; power is then charged without changing that arc. */
export function flankiArcDirection(direction: THREE.Vector3) {
  const horizontal = direction.clone().setY(0).normalize();
  if (horizontal.lengthSq() < 0.5) horizontal.set(0, 0, -1);
  const angle = THREE.MathUtils.clamp(0.35 + direction.y * 0.35, 0.1, 0.65);
  return horizontal.multiplyScalar(Math.cos(angle)).setY(Math.sin(angle));
}

export function flankiSuggestedPower(origin: THREE.Vector3, arc: THREE.Vector3, target: THREE.Vector3) {
  const distance = Math.hypot(target.x - origin.x, target.z - origin.z);
  const horizontal = Math.hypot(arc.x, arc.z);
  const denominator =
    2 *
    horizontal *
    horizontal *
    ((distance * arc.y) / Math.max(0.01, horizontal) - (target.y + 0.084 - origin.y));
  const speed = denominator > 0 ? Math.sqrt((9.81 * distance * distance) / denominator) : 16;
  return THREE.MathUtils.clamp((speed - 3) / 13, 0.05, 1);
}

export function flankiThrowVelocity(direction: THREE.Vector3, power: number, _seconds: number) {
  void _seconds; // Compatibility with the network payload; never sway an already locked throw.
  const aim = direction.clone().normalize();
  if (aim.lengthSq() < 0.5) aim.set(0, 0, -1);
  return aim.multiplyScalar(3 + 13 * THREE.MathUtils.clamp(power, 0, 1));
}

/** Swept sphere against an expanded can box: fast balls cannot tunnel between frames. */
export function flankiHitsCan(from: THREE.Vector3, to: THREE.Vector3, base: THREE.Vector3) {
  const radius = FLANKI_BALL_RADIUS;
  const box = new THREE.Box3(
    new THREE.Vector3(base.x - 0.033 - radius, base.y - radius, base.z - 0.033 - radius),
    new THREE.Vector3(base.x + 0.033 + radius, base.y + 0.168 + radius, base.z + 0.033 + radius),
  );
  if (box.containsPoint(from)) return true;
  const delta = to.clone().sub(from);
  const distance = delta.length();
  if (distance === 0) return false;
  const hit = new THREE.Ray(from, delta.divideScalar(distance)).intersectBox(box, new THREE.Vector3());
  return hit !== null && hit.distanceTo(from) <= distance;
}

export function stepFlankiBall(position: THREE.Vector3, velocity: THREE.Vector3, dt: number, gravity = 9.81) {
  position.addScaledVector(velocity, dt);
  position.y -= gravity * dt * dt * 0.5;
  velocity.y -= gravity * dt;
}
