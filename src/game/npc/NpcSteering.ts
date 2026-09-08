import * as THREE from 'three';

export const NPC_STEERING = Object.freeze({
  agentRadius: 0.5,
  neighborRadius: 3,
  predictionSeconds: 0.85,
  minimumMovingSpeedScale: 0.38,
  maximumTurnRate: Math.PI * 1.35,
});

export type SteeringNeighbor = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius?: number;
};

export type SteeringInput = {
  position: THREE.Vector3;
  desiredDirection: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  neighbors: readonly SteeringNeighbor[];
  canStandAt: (x: number, z: number) => boolean;
};

export type SteeringResult = {
  direction: THREE.Vector3;
  speedScale: number;
  obstacleAhead: boolean;
  avoidedAgents: number;
};

const FAN_ANGLES = [
  0,
  Math.PI / 8,
  -Math.PI / 8,
  Math.PI / 4,
  -Math.PI / 4,
  (Math.PI * 3) / 8,
  (-Math.PI * 3) / 8,
];

/** Obraca poziomy kierunek bez tworzenia macierzy ani tymczasowej sceny Three.js. */
function rotateDirection(direction: THREE.Vector3, angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector3(
    direction.x * cosine - direction.z * sine,
    0,
    direction.x * sine + direction.z * cosine,
  );
}

/** Sprawdza kilka punktów przed NPC, aby wykryć granicę lub collider zanim agent w niego wejdzie. */
function directionClearance(
  position: THREE.Vector3,
  direction: THREE.Vector3,
  distance: number,
  canStandAt: SteeringInput['canStandAt'],
) {
  for (const fraction of [0.35, 0.7, 1]) {
    if (
      !canStandAt(
        position.x + direction.x * distance * fraction,
        position.z + direction.z * distance * fraction,
      )
    ) {
      return fraction - 0.01;
    }
  }
  return 1;
}

/** Wybiera najbliższy celowi przechodni kierunek z wachlarza predykcyjnych prób. */
function avoidStaticObstacles(input: SteeringInput, desired: THREE.Vector3) {
  const lookAhead = THREE.MathUtils.clamp(0.75 + input.speed * 0.65, 0.75, 2.25);
  const obstacleAhead = directionClearance(input.position, desired, lookAhead, input.canStandAt) < 1;
  if (!obstacleAhead) return { direction: desired.clone(), obstacleAhead: false, clearance: 1 };

  let bestDirection = desired.clone();
  let bestClearance = 0;
  let bestScore = -Infinity;
  for (const angle of FAN_ANGLES) {
    const candidate = rotateDirection(desired, angle);
    const clearance = directionClearance(input.position, candidate, lookAhead, input.canStandAt);
    const score = clearance * 4 + candidate.dot(desired) - Math.abs(angle) * 0.08;
    if (score <= bestScore) continue;
    bestScore = score;
    bestClearance = clearance;
    bestDirection = candidate;
  }
  return { direction: bestDirection, obstacleAhead: true, clearance: bestClearance };
}

/** Dodaje predykcyjną separację. Przy spotkaniu czołowym agenci mijają się zawsze własną prawą stroną. */
function avoidAgents(input: SteeringInput, baseDirection: THREE.Vector3) {
  const avoidance = new THREE.Vector3();
  let closestSurfaceDistance = Infinity;
  let avoidedAgents = 0;

  for (const neighbor of input.neighbors) {
    const relative = neighbor.position.clone().sub(input.position);
    relative.y = 0;
    const distance = relative.length();
    if (distance <= 1e-5 || distance > NPC_STEERING.neighborRadius) continue;

    const combinedRadius = NPC_STEERING.agentRadius + (neighbor.radius ?? NPC_STEERING.agentRadius);
    const relativeVelocity = neighbor.velocity.clone().sub(input.velocity);
    relativeVelocity.y = 0;
    const velocityLengthSq = relativeVelocity.lengthSq();
    const closestTime =
      velocityLengthSq > 1e-5
        ? THREE.MathUtils.clamp(
            -relative.dot(relativeVelocity) / velocityLengthSq,
            0,
            NPC_STEERING.predictionSeconds,
          )
        : 0;
    const predicted = relative.clone().addScaledVector(relativeVelocity, closestTime);
    const surfaceDistance = Math.min(distance, predicted.length()) - combinedRadius;
    const approaching = relative.dot(input.velocity) > 0 || surfaceDistance < 0.8;
    if (!approaching || surfaceDistance > 1.35) continue;

    avoidedAgents += 1;
    closestSurfaceDistance = Math.min(closestSurfaceDistance, surfaceDistance);
    const away = (predicted.lengthSq() > 1e-5 ? predicted : relative).normalize().multiplyScalar(-1);
    const right = new THREE.Vector3(-baseDirection.z, 0, baseDirection.x);
    const headOn = Math.abs(away.dot(baseDirection)) > 0.72;
    const side = headOn ? right : right.multiplyScalar(Math.sign(right.dot(away)) || 1);
    const weight = THREE.MathUtils.clamp((1.35 - surfaceDistance) / 1.35, 0, 1);
    avoidance.addScaledVector(away, weight * 0.7);
    avoidance.addScaledVector(side, weight * (headOn ? 1.35 : 0.75));
  }

  const direction = baseDirection.clone().add(avoidance);
  if (direction.lengthSq() > 1e-6) direction.normalize();
  else direction.copy(baseDirection);
  const speedScale = Number.isFinite(closestSurfaceDistance)
    ? THREE.MathUtils.clamp(closestSurfaceDistance / 0.9, NPC_STEERING.minimumMovingSpeedScale, 1)
    : 1;
  return { direction, speedScale, avoidedAgents };
}

/** Łączy priorytety: granica i collider statyczny, następnie agenci, a na końcu kierunek celu. */
export function computeNpcSteering(input: SteeringInput): SteeringResult {
  const desired = input.desiredDirection.clone();
  desired.y = 0;
  if (desired.lengthSq() <= 1e-8) {
    return { direction: new THREE.Vector3(), speedScale: 0, obstacleAhead: false, avoidedAgents: 0 };
  }
  desired.normalize();
  const staticAvoidance = avoidStaticObstacles(input, desired);
  const agents = avoidAgents(input, staticAvoidance.direction);
  const lookAhead = THREE.MathUtils.clamp(0.55 + input.speed * 0.45, 0.55, 1.5);
  if (directionClearance(input.position, agents.direction, lookAhead, input.canStandAt) < 1) {
    agents.direction.copy(staticAvoidance.direction);
  }
  return {
    direction: agents.direction,
    speedScale: Math.min(agents.speedScale, staticAvoidance.clearance < 1 ? 0.55 : 1),
    obstacleAhead: staticAvoidance.obstacleAhead,
    avoidedAgents: agents.avoidedAgents,
  };
}

/** Ogranicza zmianę kąta w jednej klatce, dzięki czemu NPC nie obraca się skokowo. */
export function turnDirectionTowards(current: THREE.Vector3, target: THREE.Vector3, maximumAngle: number) {
  if (target.lengthSq() <= 1e-8) return current.clone();
  if (current.lengthSq() <= 1e-8) return target.clone().normalize();
  const currentAngle = Math.atan2(current.x, current.z);
  const targetAngle = Math.atan2(target.x, target.z);
  const delta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
  const angle = currentAngle + THREE.MathUtils.clamp(delta, -maximumAngle, maximumAngle);
  return new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
}
