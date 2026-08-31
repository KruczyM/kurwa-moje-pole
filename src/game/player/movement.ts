export type MoveInput = { forward: number; right: number };
export type GroundDirection = { x: number; z: number };

/** Returns a normalized horizontal direction in the player's local yaw space.
 * yaw=0 faces the Three.js forward direction (negative Z). Pitch is deliberately
 * not an argument: looking up/down can never alter ground movement. */
export function calculateLocalMove(yaw: number, input: MoveInput): GroundDirection {
  const length = Math.hypot(input.forward, input.right);
  if (length === 0) return { x: 0, z: 0 };
  const forward = input.forward / length,
    right = input.right / length;
  // A Three.js camera looks along local -Z. Rotating the camera +90° around Y
  // therefore makes forward point toward world -X, not +X.
  const fx = -Math.sin(yaw),
    fz = -Math.cos(yaw);
  const rx = Math.cos(yaw),
    rz = -Math.sin(yaw);
  return { x: fx * forward + rx * right, z: fz * forward + rz * right };
}
