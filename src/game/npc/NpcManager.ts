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
        wait: 0.6 + index * 0.18,
        returning: false,
        stationary: index === 0 || index === 3 || index === 5,
        speed: 0,
        velocity: new THREE.Vector3(),
        steeringDirection: new THREE.Vector3(),
        waypoints: [],
      };
      if (npc.stationary) npc.target.copy(root.position);
      else this.pickTarget(npc, false);
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
  /** Losuje osiągalny cel i zapisuje kompletną, wygładzoną trasę do niego. */
  private pickTarget(npc: Npc, toCamp: boolean) {
    npc.returning = toCamp;
    const targetBounds = toCamp
      ? { minX: -CAMP_RADIUS, maxX: CAMP_RADIUS, minZ: -CAMP_RADIUS, maxZ: CAMP_RADIUS }
      : {};
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = this.navigation.randomWalkablePoint(Math.random, targetBounds);
      if (!candidate || candidate.distanceToSquared(npc.root.position) <= 25) continue;
      if (this.routeTo(npc, candidate)) return;
    }
    const fallback = new THREE.Vector3(0, 0, 0);
    if (!this.routeTo(npc, fallback)) {
      npc.target.copy(npc.root.position);
      npc.waypoints.length = 0;
    }
  }

  /** Przelicza A* do konkretnego celu i pomija waypoint leżący bezpośrednio pod NPC. */
  private routeTo(npc: Npc, target: THREE.Vector3) {
    const path = this.navigation.findPath(npc.root.position, target);
    if (path.length < 2) return false;
    npc.target.copy(path[path.length - 1]);
    npc.waypoints = path.slice(path[0].distanceToSquared(npc.root.position) < 0.04 ? 1 : 0);
    return npc.waypoints.length > 0;
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
    for (const npc of this.npcs) {
      if (npc.stationary) {
        npc.root.position.y = Math.sin(time * 1.2 + npc.phase) * 0.01;
        npc.speed = approachSpeed(npc.speed, 0, dt);
        npc.velocity.set(0, 0, 0);
        this.updateAnimation(npc, dt);
        continue;
      }
      if (npc.wait > 0) {
        npc.wait -= dt;
        npc.speed = approachSpeed(npc.speed, 0, dt);
        npc.velocity.set(0, 0, 0);
        this.updateAnimation(npc, dt);
        continue;
      }
      const nearEdge =
        Math.abs(npc.root.position.x) > this.navigation.bounds.maxX - 2 ||
        Math.abs(npc.root.position.z) > this.navigation.bounds.maxZ - 2;
      if (nearEdge && !npc.returning) this.pickTarget(npc, true);

      let waypoint = npc.waypoints[0] ?? npc.target;
      let dir = waypoint.clone().sub(npc.root.position);
      dir.y = 0;
      let distance = dir.length();
      while (distance <= NPC_MOTION.arrivalRadius && npc.waypoints.length > 1) {
        npc.waypoints.shift();
        waypoint = npc.waypoints[0];
        dir = waypoint.clone().sub(npc.root.position);
        dir.y = 0;
        distance = dir.length();
      }
      if (distance <= NPC_MOTION.arrivalRadius && npc.speed < NPC_MOTION.idleSpeedThreshold) {
        npc.wait = 0.5 + Math.random() * 1.7;
        this.pickTarget(npc, false);
        npc.speed = 0;
        this.updateAnimation(npc, dt);
        continue;
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
        if (!this.routeTo(npc, npc.target)) this.pickTarget(npc, false);
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
      this.updateAnimation(npc, dt);
    }
  }
  /** Zatrzymuje miksery animacji wszystkich NPC. */
  dispose() {
    this.npcs.forEach((n) => n.animator?.dispose());
  }
}
