import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { characterAssets } from '../assets/assetManifest';
import { npcLines } from './npcConfig';
import { NpcAnimator } from './NpcAnimator';
import { enableInteractionLayer } from '../interactions/InteractionManager';
import { NPC_MOTION, approachSpeed, brakingSpeed, locomotionForSpeed } from './locomotionCalibration';
import { NpcNavigationGrid } from './NpcNavigationGrid';
import { computeNpcSteering, NPC_STEERING, turnDirectionTowards } from './NpcSteering';
import { NPC_BEHAVIOR_PROFILES, NpcBehaviorAction, NpcBehaviorScheduler } from './NpcBehaviorScheduler';
import { NpcStuckWatchdog, NpcWatchdogConfig, WatchdogRecoveryAction } from './NpcStuckWatchdog';
export type Npc = {
  root: THREE.Group;
  name: string;
  line: string[];
  animator?: NpcAnimator;
  phase: number;
  target: THREE.Vector3;
  wait: number;
  returning: boolean;
  stationary: boolean;
  speed: number;
  velocity: THREE.Vector3;
  steeringDirection: THREE.Vector3;
  waypoints: THREE.Vector3[];
  behavior: NpcBehaviorScheduler;
  watchdog: NpcStuckWatchdog;
};
const spawns = [
    [-2, -1],
    [1, -1],
    [2.4, 1],
    [-2.6, 1.2],
    [0, 1.3],
    [4.8, 2.7],
    [7, -4],
    [-8, 5],
  ],
  CAMP_RADIUS = 13;

/** Dodaje stabilną strefę interakcji niezależną od aktualnej pozy animowanej siatki. */
function addNpcInteractionHitbox(root: THREE.Group) {
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 2.5, 0.8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  hitbox.name = 'NpcInteractionHitbox';
  hitbox.position.y = 1.25;
  root.add(hitbox);
}

export class NpcManager {
  readonly npcs: Npc[] = [];
  constructor(
    scene: THREE.Scene,
    models: Map<string, GLTF>,
    speaker: GLTF | null,
    readonly navigation: NpcNavigationGrid,
    watchdogConfig?: NpcWatchdogConfig,
  ) {
    characterAssets.forEach((asset, index) => {
      const root = new THREE.Group(),
        model = models.get(asset.id);
      let animator: NpcAnimator | undefined;
      if (model) {
        const visual = clone(model.scene);
        animator = new NpcAnimator(visual, model.animations);
        // Pierwsza klatka musi zostać zastosowana przed pomiarem SkinnedMesh.
        // Inaczej rig Pierścienia zmienia bounds dopiero po rozpoczęciu pętli.
        animator.update(0);
        this.fit(visual, 2.45);
        root.add(visual);
      } else {
        const fallback = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.34, 0.75, 4, 10),
          new THREE.MeshStandardMaterial({ color: 0xff5d76 }),
        );
        fallback.position.y = 1;
        root.add(fallback);
      }
      if (index === 0 && speaker) {
        const anchor = new THREE.Object3D();
        anchor.position.set(0.55, 0.25, 1.65);
        anchor.userData.interaction = { kind: 'speaker' };
        const accessory = clone(speaker.scene);
        this.fit(accessory, 0.55);
        anchor.add(accessory);
        root.add(anchor);
      }
      root.position.set(spawns[index][0], 0, spawns[index][1]);
      root.userData.interaction = { kind: 'npc', name: asset.name };
      addNpcInteractionHitbox(root);
      root.traverse((o) => (o.userData.interactionRoot = root));
      enableInteractionLayer(root);
      scene.add(root);
      const npc = {
        root,
        name: asset.name,
        line: npcLines[asset.name] || ['Cześć!'],
        animator,
        phase: index,
        target: new THREE.Vector3(),
        wait: 0,
        returning: false,
        stationary: true,
        speed: 0,
        velocity: new THREE.Vector3(),
        steeringDirection: new THREE.Vector3(),
        waypoints: [],
        behavior: new NpcBehaviorScheduler(
          NPC_BEHAVIOR_PROFILES[index % NPC_BEHAVIOR_PROFILES.length],
          0x51f15e + index * 977,
        ),
        watchdog: new NpcStuckWatchdog(asset.name, root.position, watchdogConfig),
      };
      npc.target.copy(root.position);
      this.npcs.push(npc);
    });
  }
  /** Normalizuje wysokość modelu NPC i włącza obsługę cieni. */
  private fit(object: THREE.Object3D, height: number) {
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    object.scale.setScalar(height / Math.max(0.01, box.max.y - box.min.y));
    box.setFromObject(object);
    object.position.y = -box.min.y;
  }
  /** Zwraca granice jednego z dziewięciu sektorów pełnego pola z marginesem od krawędzi. */
  private sectorBounds(sector: number) {
    const column = sector % 3;
    const row = Math.floor(sector / 3);
    const width = (this.navigation.bounds.maxX - this.navigation.bounds.minX) / 3;
    const depth = (this.navigation.bounds.maxZ - this.navigation.bounds.minZ) / 3;
    const margin = this.navigation.cellSize;
    return {
      minX: this.navigation.bounds.minX + column * width + margin,
      maxX: this.navigation.bounds.minX + (column + 1) * width - margin,
      minZ: this.navigation.bounds.minZ + row * depth + margin,
      maxZ: this.navigation.bounds.minZ + (row + 1) * depth - margin,
    };
  }

  /** Losuje osiągalny cel w nowym sektorze i zapisuje kompletną, wygładzoną trasę. */
  private pickWanderTarget(npc: Npc) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const sector = npc.behavior.nextSector(9);
      const candidate = this.navigation.randomWalkablePoint(
        () => npc.behavior.random(),
        this.sectorBounds(sector),
      );
      if (!candidate || candidate.distanceToSquared(npc.root.position) <= 25) continue;
      if (this.routeTo(npc, candidate)) return true;
    }
    return false;
  }

  /** Kieruje NPC do losowego, bezpiecznego punktu centralnej części obozu. */
  private pickRunHomeTarget(npc: Npc) {
    const bounds = { minX: -CAMP_RADIUS, maxX: CAMP_RADIUS, minZ: -CAMP_RADIUS, maxZ: CAMP_RADIUS };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), bounds);
      if (candidate && this.routeTo(npc, candidate)) return true;
    }
    return this.routeTo(npc, new THREE.Vector3());
  }

  /** Wybiera krótkie spotkanie w pobliżu pojedynczego NPC, bez tworzenia dużych grup. */
  private pickSocialTarget(npc: Npc) {
    const candidates = this.npcs.filter(
      (other) =>
        other !== npc &&
        other.behavior.state !== 'run-home' &&
        other.root.position.distanceToSquared(npc.root.position) > 9 &&
        other.root.position.distanceToSquared(npc.root.position) < 196,
    );
    if (!candidates.length) return false;
    const partner = candidates[Math.floor(npc.behavior.random() * candidates.length)];
    const direction = partner.root.position.clone().sub(npc.root.position).setY(0).normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(1.35);
    const candidate = partner.root.position.clone().add(side);
    return this.navigation.canStandAt(candidate.x, candidate.z) && this.routeTo(npc, candidate);
  }

  /** Stosuje decyzję schedulera i przygotowuje odpowiedni cel nawigacji. */
  private applyBehaviorAction(npc: Npc, action: NpcBehaviorAction) {
    npc.returning = action === 'run-home';
    if (action === 'idle') {
      npc.waypoints.length = 0;
      npc.target.copy(npc.root.position);
      return;
    }
    const routed =
      action === 'wander'
        ? this.pickWanderTarget(npc)
        : action === 'social'
          ? this.pickSocialTarget(npc)
          : this.pickRunHomeTarget(npc);
    if (!routed) {
      npc.behavior.routeFailed();
      npc.returning = false;
      npc.waypoints.length = 0;
      npc.target.copy(npc.root.position);
    }
  }

  /** Przelicza A* do konkretnego celu i pomija waypoint leżący bezpośrednio pod NPC. */
  private routeTo(npc: Npc, target: THREE.Vector3) {
    const path = this.navigation.findPath(npc.root.position, target);
    if (path.length < 2) return false;
    npc.target.copy(path[path.length - 1]);
    npc.waypoints = path.slice(path[0].distanceToSquared(npc.root.position) < 0.04 ? 1 : 0);
    npc.watchdog.onTargetAssigned(npc.target);
    if (npc.waypoints.length > 0) {
      npc.watchdog.onWaypointChanged(npc.waypoints[0]);
    }
    return npc.waypoints.length > 0;
  }

  /** Wykonuje stopniowane odzyskiwanie zalecone przez watchdog bez resetowania animacji. */
  private applyWatchdogRecovery(npc: Npc, action: WatchdogRecoveryAction) {
    switch (action) {
      case 'steer_nudge': {
        const lateral = new THREE.Vector3(-npc.steeringDirection.z, 0, npc.steeringDirection.x).normalize();
        if (npc.watchdog.recoveryCount % 2 === 1) lateral.negate();
        npc.steeringDirection.addScaledVector(lateral, 0.85).normalize();
        npc.wait = 0;
        break;
      }
      case 'repath': {
        npc.watchdog.repathCount += 1;
        if (!this.routeTo(npc, npc.target)) {
          this.applyBehaviorAction(npc, 'wander');
        }
        npc.wait = 0;
        break;
      }
      case 'new_target': {
        npc.behavior.forceWander();
        this.applyBehaviorAction(npc, 'wander');
        npc.wait = 0;
        break;
      }
      case 'teleport': {
        const bounds = {
          minX: -CAMP_RADIUS * 0.7,
          maxX: CAMP_RADIUS * 0.7,
          minZ: -CAMP_RADIUS * 0.7,
          maxZ: CAMP_RADIUS * 0.7,
        };
        const safePoint =
          this.navigation.randomWalkablePoint(() => npc.behavior.random(), bounds) ??
          new THREE.Vector3(0, 0, 0);
        npc.root.position.copy(safePoint);
        npc.velocity.set(0, 0, 0);
        npc.speed = 0;
        npc.wait = 0;
        npc.watchdog.resetPosition(safePoint);
        npc.behavior.forceWander();
        this.applyBehaviorAction(npc, 'wander');
        break;
      }
    }
  }

  /** Wiąże klip i jego timeScale z bieżącą, płynnie zmienianą prędkością NPC. */
  private updateAnimation(npc: Npc, deltaTime: number) {
    npc.animator?.setMovementSpeed(npc.speed);
    npc.animator?.play(locomotionForSpeed(npc.speed, npc.returning));
    npc.animator?.update(deltaTime);
  }

  /** Aktualizuje decyzje ruchu, obrót, powroty od granicy i płynne animacje NPC. */
  update(dt: number, time: number, playerPosition?: THREE.Vector3) {
    const snapshots = this.npcs.map((npc) => ({
      npc,
      position: npc.root.position.clone(),
      velocity: npc.velocity.clone(),
    }));
    let socialCount = this.npcs.filter((npc) => npc.behavior.state === 'social').length;
    for (const npc of this.npcs) {
      const nearEdge =
        Math.abs(npc.root.position.x) > this.navigation.bounds.maxX - 2 ||
        Math.abs(npc.root.position.z) > this.navigation.bounds.maxZ - 2;
      const insideSafeZone =
        Math.abs(npc.root.position.x) <= CAMP_RADIUS && Math.abs(npc.root.position.z) <= CAMP_RADIUS;
      const arrived =
        npc.behavior.travelling &&
        npc.waypoints.length <= 1 &&
        npc.target.distanceToSquared(npc.root.position) <= NPC_MOTION.arrivalRadius ** 2;
      const previousState = npc.behavior.state;
      const action = npc.behavior.update(dt, {
        nearEdge,
        insideSafeZone,
        arrived,
        socialAvailable: socialCount < 2 && this.npcs.length > 1,
      });
      if (action) this.applyBehaviorAction(npc, action);
      if (previousState !== 'social' && npc.behavior.state === 'social') socialCount += 1;
      if (previousState === 'social' && npc.behavior.state !== 'social') socialCount -= 1;
      npc.returning = npc.behavior.state === 'run-home';
      npc.stationary = !npc.behavior.travelling;

      if (npc.stationary) {
        npc.root.position.y = Math.sin(time * 1.2 + npc.phase) * 0.01;
        npc.speed = approachSpeed(npc.speed, 0, dt);
        npc.velocity.set(0, 0, 0);
        const recoveryAction = npc.watchdog.update(
          dt,
          npc.root.position,
          npc.behavior.state,
          npc.behavior.travelling,
          npc.target,
        );
        if (recoveryAction) this.applyWatchdogRecovery(npc, recoveryAction);
        this.updateAnimation(npc, dt);
        continue;
      }
      if (npc.wait > 0) {
        npc.wait -= dt;
        npc.speed = approachSpeed(npc.speed, 0, dt);
        npc.velocity.set(0, 0, 0);
        const recoveryAction = npc.watchdog.update(
          dt,
          npc.root.position,
          npc.behavior.state,
          npc.behavior.travelling,
          npc.target,
        );
        if (recoveryAction) this.applyWatchdogRecovery(npc, recoveryAction);
        this.updateAnimation(npc, dt);
        continue;
      }

      let waypoint = npc.waypoints[0] ?? npc.target;
      let dir = waypoint.clone().sub(npc.root.position);
      dir.y = 0;
      let distance = dir.length();
      while (distance <= NPC_MOTION.arrivalRadius && npc.waypoints.length > 1) {
        npc.waypoints.shift();
        waypoint = npc.waypoints[0];
        npc.watchdog.onWaypointChanged(waypoint);
        dir = waypoint.clone().sub(npc.root.position);
        dir.y = 0;
        distance = dir.length();
      }
      if (distance > 0) dir.multiplyScalar(1 / distance);
      const neighbors = snapshots
        .filter((snapshot) => snapshot.npc !== npc)
        .map((snapshot) => ({ position: snapshot.position, velocity: snapshot.velocity }));
      if (playerPosition) {
        neighbors.push({ position: playerPosition, velocity: new THREE.Vector3() });
      }
      const steering = computeNpcSteering({
        position: npc.root.position,
        desiredDirection: dir,
        velocity: npc.velocity,
        speed: npc.speed,
        neighbors,
        canStandAt: (x, z) => this.navigation.canStandAt(x, z),
      });
      npc.steeringDirection.copy(
        turnDirectionTowards(npc.steeringDirection, steering.direction, NPC_STEERING.maximumTurnRate * dt),
      );
      const maximumSpeed = npc.returning ? NPC_MOTION.runSpeed : NPC_MOTION.walkSpeed;
      const pathSpeed = npc.waypoints.length > 1 ? maximumSpeed : brakingSpeed(distance, maximumSpeed);
      const desiredSpeed = pathSpeed * steering.speedScale;
      npc.speed = approachSpeed(npc.speed, desiredSpeed, dt);
      const step = Math.min(distance, dt * npc.speed);
      const next = npc.root.position.clone().addScaledVector(npc.steeringDirection, step);
      if (!this.navigation.canStandAt(next.x, next.z)) {
        if (!this.routeTo(npc, npc.target)) {
          npc.behavior.routeFailed();
          npc.waypoints.length = 0;
        }
        npc.wait = 0.08;
        npc.speed = 0;
        npc.velocity.set(0, 0, 0);
      } else {
        const previous = npc.root.position.clone();
        npc.root.position.copy(next);
        npc.velocity
          .copy(next)
          .sub(previous)
          .multiplyScalar(dt > 0 ? 1 / dt : 0);
        npc.root.rotation.y = Math.atan2(npc.steeringDirection.x, npc.steeringDirection.z);
      }
      const recoveryAction = npc.watchdog.update(
        dt,
        npc.root.position,
        npc.behavior.state,
        npc.behavior.travelling,
        npc.target,
      );
      if (recoveryAction) this.applyWatchdogRecovery(npc, recoveryAction);
      this.updateAnimation(npc, dt);
    }
  }
  /** Zatrzymuje miksery animacji wszystkich NPC. */
  dispose() {
    this.npcs.forEach((n) => n.animator?.dispose());
  }
}
