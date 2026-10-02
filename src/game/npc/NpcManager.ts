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
import { terrainHeight } from '../world/CampWorld';
import { MAIN_ASPHALT_ROAD, isInsidePrimaryCamp, PRIMARY_CAMP_PLOT } from '../world/festivalLayout';
import { MAD_DOG_CONFIG, seatLayout, type SeatConfig } from '../world/campLandmarks';

export function getSeatWorldPose(seat: SeatConfig): { position: THREE.Vector3; rotationY: number } {
  const offsetDistance = 1;
  const x = seat.position[0];
  const z = seat.position[2];
  const length = Math.hypot(x, z);
  const offsetX = length > 0 ? (x / length) * offsetDistance : 0;
  const offsetZ = length > 0 ? (z / length) * offsetDistance : 0;
  const [madX, , madZ] = MAD_DOG_CONFIG.position;
  const worldX = madX + x + offsetX;
  const worldZ = madZ + z + offsetZ;
  const worldY = terrainHeight(worldX, worldZ);
  return {
    position: new THREE.Vector3(worldX, worldY, worldZ),
    rotationY: seat.rotationY,
  };
}

export type Npc = {
  root: THREE.Group;
  name: string;
  line: string[];
  animator?: NpcAnimator;
  visual?: THREE.Object3D;
  visualBaseY?: number;
  assignedSeatId?: string;
  isSitting?: boolean;
  isDancingAtSpeaker?: boolean;
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
  passageWalker: boolean;
  passageDirection: number;
  activityCooldown: number;
  isCampMember: boolean;
  festivalRole?: 'stage_dancer' | 'asp_listener' | 'food_queue' | 'chiller' | 'walker';
  animLodAccumulator: number;
  inConversation?: boolean;
  isHidden?: boolean;
};
const CAMP_RADIUS = 13;
const SPEAKER_POSITION = { x: -1.45, z: 0.65 };

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
  speakerAnchor: THREE.Object3D | null = null;
  speakerPlaying = false;
  readonly occupiedSeats = new Map<string, Npc>();
  private disposed = false;
  private readonly ids = new Set<string>();
  private updateFrameIndex = 0;

  setSpeakerPlaying(playing: boolean): void {
    this.speakerPlaying = playing;
  }

  isSeatOccupied(seatId: string): boolean {
    return this.occupiedSeats.has(seatId);
  }

  vacateSeat(seatId: string): boolean {
    const occupant = this.occupiedSeats.get(seatId);
    if (!occupant) return false;
    this.standUpNpc(occupant);
    return true;
  }

  standUpNpc(npc: Npc): void {
    if (npc.assignedSeatId) {
      this.occupiedSeats.delete(npc.assignedSeatId);
      npc.assignedSeatId = undefined;
    }
    if (npc.isSitting) {
      npc.isSitting = false;
      if (npc.visual) {
        npc.visual.rotation.y = 0;
        npc.visual.position.y = npc.visualBaseY ?? 0;
        npc.visual.position.z = 0;
      }
    }
    npc.isDancingAtSpeaker = false;
    npc.animator?.cancelActivity();
    npc.stationary = false;
    npc.speed = 0;
    npc.velocity.set(0, 0, 0);
    npc.target.copy(npc.root.position);
    npc.watchdog.resetPosition(npc.root.position);
    npc.behavior.forceWander();
    this.applyBehaviorAction(npc, 'wander');
  }

  /**
   * Ukrywa bota NPC o podanej nazwie lub ID (używane gdy człowiek dołącza do pokoju multiplayer na tym slocie).
   */
  hideNpc(nameOrId: string): boolean {
    const key = nameOrId.toLowerCase().trim();
    const npc = this.npcs.find(
      (n) =>
        n.name.toLowerCase() === key ||
        (n.root.userData?.npcId && String(n.root.userData.npcId).toLowerCase() === key) ||
        n.root.name.toLowerCase() === `npc_${key}`,
    );
    if (!npc) return false;
    if (npc.isHidden) return true;

    if (npc.isSitting || npc.assignedSeatId) {
      this.standUpNpc(npc);
    }
    npc.isHidden = true;
    npc.root.visible = false;
    // Odsuń poza zasięg raycastera interakcji i kolizji
    npc.root.position.y = -200;
    return true;
  }

  /**
   * Przywraca bota NPC do obozu (używane gdy gracz opuszcza pokój).
   */
  showNpc(nameOrId: string): boolean {
    const key = nameOrId.toLowerCase().trim();
    const npc = this.npcs.find(
      (n) =>
        n.name.toLowerCase() === key ||
        (n.root.userData?.npcId && String(n.root.userData.npcId).toLowerCase() === key) ||
        n.root.name.toLowerCase() === `npc_${key}`,
    );
    if (!npc) return false;
    if (!npc.isHidden) return true;

    npc.isHidden = false;
    npc.root.visible = true;
    const ground = terrainHeight(npc.target.x, npc.target.z);
    npc.root.position.set(npc.target.x, ground, npc.target.z);
    npc.watchdog.resetPosition(npc.root.position);
    npc.behavior.forceWander();
    this.applyBehaviorAction(npc, 'wander');
    return true;
  }

  /**
   * Sprawdza, czy bot o danej nazwie lub ID jest obecnie ukryty.
   */
  isNpcHidden(nameOrId: string): boolean {
    const key = nameOrId.toLowerCase().trim();
    const npc = this.npcs.find(
      (n) =>
        n.name.toLowerCase() === key ||
        (n.root.userData?.npcId && String(n.root.userData.npcId).toLowerCase() === key) ||
        n.root.name.toLowerCase() === `npc_${key}`,
    );
    return npc?.isHidden ?? false;
  }

  constructor(
    private readonly scene: THREE.Scene,
    models: Map<string, GLTF>,
    speaker: GLTF | null,
    readonly navigation: NpcNavigationGrid,
    private readonly watchdogConfig?: NpcWatchdogConfig,
    private readonly seed = 0x51f15e,
  ) {
    characterAssets.forEach((asset, index) => {
      this.addNpc(asset, index, models.get(asset.id), speaker);
    });
  }

  /** Add streamed crowd models through the existing controller and animation lifecycle. */
  addFestivalNpc(asset: { id: string; name: string }, model: GLTF) {
    if (this.disposed || this.ids.has(asset.id)) return false;
    return this.addNpc(asset, this.npcs.length, model, null, true);
  }

  private addNpc(
    asset: { id: string; name: string },
    index: number,
    model: GLTF | undefined,
    speaker: GLTF | null,
    festival = false,
  ) {
    const scene = this.scene;
    const root = new THREE.Group(),
      behavior = new NpcBehaviorScheduler(
        NPC_BEHAVIOR_PROFILES[index % NPC_BEHAVIOR_PROFILES.length],
        this.seed + index * 977,
      );
    const passageWalker = festival && index % 5 !== 0;
    const isCampMember = !festival;
    let festivalRole: 'stage_dancer' | 'asp_listener' | 'food_queue' | 'chiller' | 'walker' | undefined;
    if (passageWalker) {
      festivalRole = 'walker';
    } else if (!isCampMember) {
      const roleIndex = (index - 8) % 4;
      if (roleIndex === 0) festivalRole = 'stage_dancer';
      else if (roleIndex === 1) festivalRole = 'asp_listener';
      else if (roleIndex === 2) festivalRole = 'food_queue';
      else festivalRole = 'chiller';
    }

    const isExcluded = isCampMember ? undefined : (x: number, z: number) => isInsidePrimaryCamp(x, z, 1.0);
    const preferred = passageWalker
      ? this.passageBounds()
      : isCampMember
        ? { minX: -CAMP_RADIUS, maxX: CAMP_RADIUS, minZ: -CAMP_RADIUS, maxZ: CAMP_RADIUS }
        : festivalRole === 'stage_dancer'
          ? { minX: 130, maxX: 180, minZ: 0, maxZ: 35 }
          : festivalRole === 'asp_listener'
            ? { minX: -75, maxX: -55, minZ: 92, maxZ: 102 }
            : festivalRole === 'food_queue'
              ? (behavior.random() < 0.5
                  ? { minX: -36, maxX: 36, minZ: 81, maxZ: 86 }
                  : { minX: -125, maxX: -44, minZ: -25, maxZ: -18 })
              : { minX: -70, maxX: 50, minZ: 30, maxZ: 55 };
    let spawn: THREE.Vector3 | null = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = this.navigation.randomWalkablePoint(() => behavior.random(), preferred, isExcluded);
      if (candidate && this.npcs.every((other) => other.root.position.distanceToSquared(candidate) >= 2.25)) {
        spawn = candidate;
        break;
      }
    }
    if (!spawn) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const candidate = this.navigation.randomWalkablePoint(() => behavior.random(), {}, isExcluded);
        if (candidate && this.npcs.every((other) => other.root.position.distanceToSquared(candidate) >= 2.25)) {
          spawn = candidate;
          break;
        }
      }
    }
    if (!spawn) {
      spawn = this.navigation.randomWalkablePoint(() => behavior.random(), {}) ?? new THREE.Vector3(0, 0, 0);
    }
    let animator: NpcAnimator | undefined;
    let visual: THREE.Object3D | undefined;
    if (model) {
      visual = clone(model.scene);
      animator = model.animations.length
        ? new NpcAnimator(visual, model.animations, { initialPhase: behavior.random() })
        : undefined;
      // Pierwsza klatka musi zostać zastosowana przed pomiarem SkinnedMesh.
      // Inaczej rig Pierścienia zmienia bounds dopiero po rozpoczęciu pętli.
      animator?.update(0);
      this.fit(visual, 2.45);
      if (festival) {
        const center = new THREE.Box3().setFromObject(visual).getCenter(new THREE.Vector3());
        visual.position.x -= center.x;
        visual.position.z -= center.z;
        visual.traverse((object) => {
          if (object instanceof THREE.Mesh) object.castShadow = false;
        });
      }
      root.userData.animationStatus = animator ? 'clips-available' : 'static-needs-rig';
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
      const { x, z } = SPEAKER_POSITION;
      anchor.position.set(x, terrainHeight(x, z) + 0.02, z);
      anchor.userData.interaction = { kind: 'speaker' };
      const accessory = clone(speaker.scene);
      this.fit(accessory, 0.55);
      anchor.add(accessory);
      anchor.name = 'Static_Camp_Speaker';
      anchor.traverse((object) => (object.userData.interactionRoot = anchor));
      enableInteractionLayer(anchor);
      scene.add(anchor);
      this.speakerAnchor = anchor;
    }
    root.position.set(spawn.x, terrainHeight(spawn.x, spawn.z), spawn.z);
    root.name = `NPC_${asset.id}`;
    root.userData.npcId = asset.id;
    root.rotation.y = behavior.random() * Math.PI * 2;
    root.userData.interaction = { kind: 'npc', name: asset.name };
    addNpcInteractionHitbox(root);
    root.traverse((o) => (o.userData.interactionRoot = root));
    enableInteractionLayer(root);
    scene.add(root);
    const npc: Npc = {
      root,
      name: asset.name,
      line: npcLines[asset.name] || ['Cześć!'],
      animator,
      visual,
      visualBaseY: visual?.position.y ?? 0,
      phase: index,
      target: new THREE.Vector3(),
      wait: 0,
      returning: false,
      stationary: true,
      speed: 0,
      velocity: new THREE.Vector3(),
      steeringDirection: new THREE.Vector3(),
      waypoints: [],
      behavior,
      watchdog: new NpcStuckWatchdog(asset.name, root.position, this.watchdogConfig),
      passageWalker,
      passageDirection: spawn.x < 0 ? 1 : -1,
      activityCooldown: 8 + (index % 19),
      isCampMember,
      festivalRole,
      animLodAccumulator: 0,
    };
    npc.target.copy(root.position);
    this.npcs.push(npc);
    this.ids.add(asset.id);
    return true;
  }

  private passageBounds() {
    return {
      minX: MAIN_ASPHALT_ROAD.minX + 5,
      maxX: MAIN_ASPHALT_ROAD.maxX - 5,
      minZ: MAIN_ASPHALT_ROAD.minZ + 1.5,
      maxZ: MAIN_ASPHALT_ROAD.maxZ - 1.5,
    };
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
    // Refresh the cloned skeleton after applying Idle before measuring skin bounds.
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const measuredHeight = box.max.y - box.min.y;
    object.scale.setScalar(height / (measuredHeight > 1e-6 ? measuredHeight : 1));
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
    const isExcluded = npc.isCampMember ? undefined : (x: number, z: number) => isInsidePrimaryCamp(x, z, 1.0);
    if (npc.passageWalker) {
      const road = this.passageBounds();
      const middle = (road.minX + road.maxX) / 2;
      for (let attempt = 0; attempt < 12; attempt++) {
        const bounds = {
          ...road,
          minX: npc.passageDirection > 0 ? middle + 12 : road.minX,
          maxX: npc.passageDirection > 0 ? road.maxX : middle - 12,
        };
        const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), bounds, isExcluded);
        if (
          candidate &&
          candidate.distanceToSquared(npc.root.position) > 100 &&
          this.routeTo(npc, candidate)
        ) {
          npc.passageDirection *= -1;
          return true;
        }
      }
      return false;
    }

    if (npc.festivalRole === 'stage_dancer') {
      const stageBounds = { minX: 125, maxX: 185, minZ: -4, maxZ: 38 };
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), stageBounds, isExcluded);
        if (candidate && candidate.distanceToSquared(npc.root.position) > 9 && this.routeTo(npc, candidate)) return true;
      }
    } else if (npc.festivalRole === 'asp_listener') {
      const aspBounds = { minX: -12, maxX: 12, minZ: 90, maxZ: 104 };
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), aspBounds, isExcluded);
        if (candidate && candidate.distanceToSquared(npc.root.position) > 9 && this.routeTo(npc, candidate)) return true;
      }
    } else if (npc.festivalRole === 'food_queue') {
      const queueBounds = npc.root.position.z > 0
        ? { minX: 48, maxX: 104, minZ: 76, maxZ: 83 }
        : { minX: -125, maxX: -44, minZ: -28, maxZ: -23 };
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), queueBounds, isExcluded);
        if (candidate && candidate.distanceToSquared(npc.root.position) > 9 && this.routeTo(npc, candidate)) return true;
      }
    } else if (npc.festivalRole === 'chiller') {
      const chillerBounds = npc.behavior.random() < 0.5
        ? { minX: -110, maxX: 110, minZ: -130, maxZ: -80 }
        : { minX: -90, maxX: 50, minZ: 24, maxZ: 50 };
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), chillerBounds, isExcluded);
        if (candidate && candidate.distanceToSquared(npc.root.position) > 16 && this.routeTo(npc, candidate)) return true;
      }
    }

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const sector = npc.behavior.nextSector(9);
      const candidate = this.navigation.randomWalkablePoint(
        () => npc.behavior.random(),
        this.sectorBounds(sector),
        isExcluded,
      );
      if (!candidate || candidate.distanceToSquared(npc.root.position) <= 25) continue;
      if (this.routeTo(npc, candidate)) return true;
    }
    return false;
  }

  /** Kieruje NPC do losowego, bezpiecznego punktu centralnej części obozu lub dla festiwalowiczów poza obozem. */
  private pickRunHomeTarget(npc: Npc) {
    if (!npc.isCampMember) {
      const road = this.passageBounds();
      const isExcluded = (x: number, z: number) => isInsidePrimaryCamp(x, z, 1.0);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), road, isExcluded);
        if (candidate && this.routeTo(npc, candidate)) return true;
      }
      return false;
    }
    const bounds = { minX: -CAMP_RADIUS, maxX: CAMP_RADIUS, minZ: -CAMP_RADIUS, maxZ: CAMP_RADIUS };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = this.navigation.randomWalkablePoint(() => npc.behavior.random(), bounds);
      if (candidate && this.routeTo(npc, candidate)) return true;
    }
    return this.routeTo(npc, new THREE.Vector3());
  }

  /** Wybiera krótkie spotkanie w pobliżu pojedynczego NPC, bez tworzenia dużych grup. */
  private pickSocialTarget(npc: Npc) {
    const isExcluded = npc.isCampMember ? undefined : (x: number, z: number) => isInsidePrimaryCamp(x, z, 1.0);
    const candidates = this.npcs.filter(
      (other) =>
        other !== npc &&
        other.behavior.state !== 'run-home' &&
        (!isExcluded || !isExcluded(other.root.position.x, other.root.position.z)) &&
        other.root.position.distanceToSquared(npc.root.position) > 9 &&
        other.root.position.distanceToSquared(npc.root.position) < 196,
    );
    if (!candidates.length) return false;
    const partner = candidates[Math.floor(npc.behavior.random() * candidates.length)];
    const direction = partner.root.position.clone().sub(npc.root.position).setY(0).normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(1.35);
    const candidate = partner.root.position.clone().add(side);
    if (isExcluded && isExcluded(candidate.x, candidate.z)) return false;
    return this.navigation.canStandAt(candidate.x, candidate.z) && this.routeTo(npc, candidate);
  }

  /** Kieruje NPC na wolne miejsce pod głośnikiem kempingowym do tańca. */
  private pickDanceTarget(npc: Npc) {
    if (!npc.isCampMember) return false;
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = npc.behavior.random() * Math.PI * 2;
      const radius = 1.4 + npc.behavior.random() * 1.8;
      const candidate = new THREE.Vector3(
        SPEAKER_POSITION.x + Math.cos(angle) * radius,
        0,
        SPEAKER_POSITION.z + Math.sin(angle) * radius,
      );
      candidate.y = terrainHeight(candidate.x, candidate.z);
      if (this.navigation.canStandAt(candidate.x, candidate.z) && this.routeTo(npc, candidate)) {
        return true;
      }
    }
    return false;
  }

  /** Kieruje NPC do najbliższego wolnego krzesła w obozie. */
  private pickSitTarget(npc: Npc) {
    if (!npc.isCampMember) return false;
    const availableSeats = seatLayout.filter((seat) => !this.occupiedSeats.has(seat.id));
    if (availableSeats.length === 0) return false;

    const sorted = [...availableSeats].sort((a, b) => {
      const poseA = getSeatWorldPose(a);
      const poseB = getSeatWorldPose(b);
      const distA = npc.root.position.distanceToSquared(poseA.position);
      const distB = npc.root.position.distanceToSquared(poseB.position);
      return distA - distB;
    });

    for (const chosen of sorted) {
      const pose = getSeatWorldPose(chosen);
      if (this.routeTo(npc, pose.position)) {
        this.occupiedSeats.set(chosen.id, npc);
        npc.assignedSeatId = chosen.id;
        return true;
      }
    }
    return false;
  }

  /** Stosuje decyzję schedulera i przygotowuje odpowiedni cel nawigacji. */
  private applyBehaviorAction(npc: Npc, action: NpcBehaviorAction) {
    if (action !== 'sit' && (npc.isSitting || npc.assignedSeatId)) {
      if (npc.assignedSeatId) {
        this.occupiedSeats.delete(npc.assignedSeatId);
        npc.assignedSeatId = undefined;
      }
      if (npc.isSitting) {
        npc.isSitting = false;
        if (npc.visual) {
          npc.visual.rotation.y = 0;
          npc.visual.position.y = npc.visualBaseY ?? 0;
          npc.visual.position.z = 0;
        }
      }
    }
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
          : action === 'dance'
            ? this.pickDanceTarget(npc)
            : action === 'sit'
              ? this.pickSitTarget(npc)
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
    const isExcluded = npc.isCampMember ? undefined : (x: number, z: number) => isInsidePrimaryCamp(x, z, 1.0);
    const path = this.navigation.findPath(npc.root.position, target, isExcluded);
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
    if (npc.isSitting || npc.assignedSeatId) {
      if (npc.assignedSeatId) {
        this.occupiedSeats.delete(npc.assignedSeatId);
        npc.assignedSeatId = undefined;
      }
      if (npc.isSitting) {
        npc.isSitting = false;
        if (npc.visual) {
          npc.visual.rotation.y = 0;
          npc.visual.position.y = npc.visualBaseY ?? 0;
          npc.visual.position.z = 0;
        }
      }
    }
    if (npc.isDancingAtSpeaker) {
      npc.isDancingAtSpeaker = false;
      npc.animator?.cancelActivity();
    }
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
        const bounds = npc.isCampMember
          ? {
              minX: -CAMP_RADIUS * 0.7,
              maxX: CAMP_RADIUS * 0.7,
              minZ: -CAMP_RADIUS * 0.7,
              maxZ: CAMP_RADIUS * 0.7,
            }
          : this.passageBounds();
        const isExcluded = npc.isCampMember ? undefined : (x: number, z: number) => isInsidePrimaryCamp(x, z, 1.0);
        const safePoint =
          this.navigation.randomWalkablePoint(() => npc.behavior.random(), bounds, isExcluded) ??
          (npc.isCampMember ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0, -35));
        safePoint.y = terrainHeight(safePoint.x, safePoint.z);
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
    const actualSpeed = Math.hypot(npc.velocity.x, npc.velocity.z);
    npc.animator?.setMovementSpeed(actualSpeed);
    npc.animator?.play(locomotionForSpeed(actualSpeed, npc.returning));
    npc.animator?.update(deltaTime);
  }

  /** Aktualizuje animację NPC z adaptacyjnym LOD dystansowym i przeplataniem klatek dla tłumu. */
  private stepNpcAnimation(
    npc: Npc,
    dt: number,
    playerPosition?: THREE.Vector3,
    index = 0,
    isActivity = false,
  ) {
    if (!npc.animator) return;
    if (!playerPosition) {
      if (isActivity) npc.animator.update(dt);
      else this.updateAnimation(npc, dt);
      return;
    }

    const distSq = npc.root.position.distanceToSquared(playerPosition);
    let frameSkip = 1;
    if (distSq > 75 * 75) {
      frameSkip = 8;
    } else if (distSq > 36 * 36) {
      frameSkip = 4;
    } else if (distSq > 16 * 16) {
      frameSkip = 2;
    }

    if (frameSkip === 1) {
      const totalDt = npc.animLodAccumulator + dt;
      npc.animLodAccumulator = 0;
      if (isActivity) npc.animator.update(totalDt);
      else this.updateAnimation(npc, totalDt);
      return;
    }

    npc.animLodAccumulator += dt;
    if ((this.updateFrameIndex + index) % frameSkip === 0) {
      const totalDt = npc.animLodAccumulator;
      npc.animLodAccumulator = 0;
      if (isActivity) npc.animator.update(totalDt);
      else this.updateAnimation(npc, totalDt);
    }
  }

  /** Aktualizuje decyzje ruchu, obrót, powroty od granicy i płynne animacje NPC. */
  update(dt: number, _time: number, playerPosition?: THREE.Vector3, isSpeakerPlaying?: boolean) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (isSpeakerPlaying !== undefined) {
      this.speakerPlaying = isSpeakerPlaying;
    }
    this.updateFrameIndex++;

    if (playerPosition) {
      for (const [seatId, occupant] of Array.from(this.occupiedSeats.entries())) {
        const seat = seatLayout.find((s) => s.id === seatId);
        if (!seat) continue;
        const pose = getSeatWorldPose(seat);
        if (playerPosition.distanceTo(pose.position) < 2.5) {
          this.standUpNpc(occupant);
        }
      }
    }

    const snapshots = this.npcs
      .filter((npc) => !npc.isHidden)
      .map((npc) => ({
        npc,
        position: npc.root.position.clone(),
        velocity: npc.velocity.clone(),
      }));
    let socialCount = this.npcs.filter((npc) => !npc.isHidden && npc.behavior.state === 'social').length;
    const dancingCampCount = this.npcs.filter(
      (npc) => !npc.isHidden && npc.isCampMember && (npc.behavior.state === 'dance' || npc.isDancingAtSpeaker),
    ).length;
    const sittingCampCount = this.npcs.filter(
      (npc) => !npc.isHidden && npc.isCampMember && (npc.behavior.state === 'sit' || npc.isSitting || npc.assignedSeatId),
    ).length;

    for (let index = 0; index < this.npcs.length; index++) {
      const npc = this.npcs[index];
      if (npc.isHidden) continue;

      // Jeśli głośnik przestał grać, zakończ taniec pod głośnikiem
      if (!this.speakerPlaying && npc.isDancingAtSpeaker) {
        npc.isDancingAtSpeaker = false;
        npc.animator?.cancelActivity();
        npc.behavior.forceWander();
        this.applyBehaviorAction(npc, 'wander');
      }

      // Jeśli siedzenie wygasło w animatorze, postać wstaje
      if (npc.isSitting && !npc.animator?.activityActive) {
        this.standUpNpc(npc);
      }

      // Jeśli taniec wygasł, wracaj do wander
      if (npc.isDancingAtSpeaker && !npc.animator?.activityActive) {
        npc.isDancingAtSpeaker = false;
        npc.behavior.forceWander();
        this.applyBehaviorAction(npc, 'wander');
      }

      npc.activityCooldown = Math.max(0, npc.activityCooldown - dt);
      if (npc.animator?.activityActive) {
        npc.speed = 0;
        npc.velocity.set(0, 0, 0);
        npc.stationary = true;
        npc.watchdog.resetPosition(npc.root.position);
        this.stepNpcAnimation(npc, dt, playerPosition, index, true);
        continue;
      }
      const nearEdge =
        npc.root.position.x < this.navigation.bounds.minX + 2 ||
        npc.root.position.x > this.navigation.bounds.maxX - 2 ||
        npc.root.position.z < this.navigation.bounds.minZ + 2 ||
        npc.root.position.z > this.navigation.bounds.maxZ - 2;
      const insideSafeZone =
        Math.abs(npc.root.position.x) <= CAMP_RADIUS && Math.abs(npc.root.position.z) <= CAMP_RADIUS;
      const arrived =
        npc.behavior.travelling &&
        npc.waypoints.length <= 1 &&
        (npc.target.x - npc.root.position.x) ** 2 + (npc.target.z - npc.root.position.z) ** 2 <=
          NPC_MOTION.arrivalRadius ** 2;

      let playerNearSeat = false;
      if (playerPosition && npc.assignedSeatId) {
        const seat = seatLayout.find((s) => s.id === npc.assignedSeatId);
        if (seat) {
          const pose = getSeatWorldPose(seat);
          playerNearSeat = playerPosition.distanceTo(pose.position) < 2.5;
        }
      }

      const previousState = npc.behavior.state;
      const action = npc.behavior.update(dt, {
        nearEdge,
        insideSafeZone,
        arrived,
        socialAvailable: !npc.passageWalker && socialCount < 2 && this.npcs.length > 1,
        speakerPlaying: this.speakerPlaying,
        canDance:
          npc.isCampMember &&
          Boolean(npc.animator) &&
          this.speakerPlaying &&
          dancingCampCount < 3,
        seatAvailable:
          npc.isCampMember &&
          Boolean(npc.animator) &&
          this.occupiedSeats.size < seatLayout.length &&
          sittingCampCount < 3,
        playerNearSeat,
      });
      if (action) this.applyBehaviorAction(npc, action);
      if (previousState !== 'social' && npc.behavior.state === 'social') socialCount += 1;
      if (previousState === 'social' && npc.behavior.state !== 'social') socialCount -= 1;
      npc.returning = npc.behavior.state === 'run-home';
      npc.stationary = !npc.behavior.travelling;

      // Obsługa dotarcia na krzesło i rozpoczęcie animacji siedzenia
      if (npc.behavior.state === 'sit' && !npc.isSitting && !npc.behavior.travelling) {
        const seat = seatLayout.find((s) => s.id === npc.assignedSeatId);
        if (seat) {
          const pose = getSeatWorldPose(seat);
          npc.root.position.copy(pose.position);
          npc.root.rotation.y = pose.rotationY;
        }
        npc.isSitting = true;
        if (npc.visual) {
          npc.visual.rotation.y = Math.PI;
          npc.visual.position.y = (npc.visualBaseY ?? 0) - 0.38;
          npc.visual.position.z = -0.52;
        }
        const sitClips = ['SittingIdle', 'SittingLaughing', 'SittingTalking'];
        const available = sitClips.filter((c) => npc.animator?.hasClip(c));
        const sitClip =
          available.length > 0
            ? available[Math.floor(npc.behavior.random() * available.length)]
            : 'SittingIdle';
        if (npc.animator?.hasClip(sitClip)) {
          npc.animator.startActivity([{ name: sitClip, seconds: 12 + npc.behavior.random() * 16 }]);
        }
      }

      // Obsługa dotarcia pod głośnik i rozpoczęcie tańca
      if (npc.behavior.state === 'dance' && !npc.isDancingAtSpeaker && !npc.behavior.travelling) {
        npc.isDancingAtSpeaker = true;
        const dx = SPEAKER_POSITION.x - npc.root.position.x;
        const dz = SPEAKER_POSITION.z - npc.root.position.z;
        if (dx * dx + dz * dz > 0.001) {
          npc.root.rotation.y = Math.atan2(dx, dz);
          npc.steeringDirection.set(dx, 0, dz).normalize();
        }
        const danceClips = ['Headbanging', 'HipHopDancing', 'HipHopDancingVariant1', 'SillyDancing'];
        const available = danceClips.filter((c) => npc.animator?.hasClip(c));
        if (available.length > 0) {
          const clip = available[Math.floor(npc.behavior.random() * available.length)];
          npc.animator?.startActivity([{ name: clip, seconds: 8 + npc.behavior.random() * 10 }]);
        }
      }

      if (npc.inConversation) {
        npc.speed = 0;
        npc.velocity.set(0, 0, 0);
        this.updateAnimation(npc, dt);
        continue;
      }

      if (!npc.isCampMember && isInsidePrimaryCamp(npc.root.position.x, npc.root.position.z, 0.5)) {
        const px = npc.root.position.x;
        const pz = npc.root.position.z;
        const distLeft = Math.abs(px - PRIMARY_CAMP_PLOT.minX);
        const distRight = Math.abs(px - PRIMARY_CAMP_PLOT.maxX);
        const distBottom = Math.abs(pz - PRIMARY_CAMP_PLOT.minZ);
        const distTop = Math.abs(pz - PRIMARY_CAMP_PLOT.maxZ);
        const minDist = Math.min(distLeft, distRight, distBottom, distTop);
        if (minDist === distLeft) {
          npc.root.position.x = PRIMARY_CAMP_PLOT.minX - 2.5;
        } else if (minDist === distRight) {
          npc.root.position.x = PRIMARY_CAMP_PLOT.maxX + 2.5;
        } else if (minDist === distBottom) {
          npc.root.position.z = PRIMARY_CAMP_PLOT.minZ - 2.5;
        } else {
          npc.root.position.z = PRIMARY_CAMP_PLOT.maxZ + 2.5;
        }
        npc.root.position.y = terrainHeight(npc.root.position.x, npc.root.position.z);
        npc.waypoints.length = 0;
        npc.velocity.set(0, 0, 0);
        npc.speed = 0;
        npc.wait = 0;
        this.applyBehaviorAction(npc, 'wander');
      }

      if (npc.stationary) {
        if (!npc.isSitting && !npc.isDancingAtSpeaker) {
          this.tryActivity(npc, playerPosition);
        }
        npc.root.position.y = terrainHeight(npc.root.position.x, npc.root.position.z);
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
        npc.root.position.y = terrainHeight(npc.root.position.x, npc.root.position.z);
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
        canStandAt: (x, z) => {
          if (!npc.isCampMember && isInsidePrimaryCamp(x, z, 1.0)) return false;
          return this.navigation.canStandAt(x, z);
        },
      });
      npc.steeringDirection.copy(
        turnDirectionTowards(npc.steeringDirection, steering.direction, NPC_STEERING.maximumTurnRate * dt),
      );
      const maximumSpeed = npc.returning ? NPC_MOTION.runSpeed : NPC_MOTION.walkSpeed;
      const pathSpeed = npc.waypoints.length > 1 ? maximumSpeed : brakingSpeed(distance, maximumSpeed);
      // Przy ostrym zakręcie najpierw zwalniaj, zamiast zataczać szeroki łuk
      // z pełną prędkością i odbijać się od narożnika przeszkody.
      const alignment = npc.steeringDirection.dot(steering.direction);
      const turnSpeedScale = THREE.MathUtils.clamp((alignment + 1) / 2, 0.15, 1);
      const desiredSpeed = pathSpeed * steering.speedScale * turnSpeedScale;
      npc.speed = approachSpeed(npc.speed, desiredSpeed, dt);
      const step = Math.min(distance, dt * npc.speed);
      const next = npc.root.position.clone().addScaledVector(npc.steeringDirection, step);
      const isExcluded = npc.isCampMember ? undefined : (x: number, z: number) => isInsidePrimaryCamp(x, z, 1.0);
      if (!this.navigation.hasLineOfSight(npc.root.position, next, isExcluded)) {
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
        npc.root.position.y = terrainHeight(next.x, next.z);
        npc.velocity
          .copy(next)
          .sub(previous)
          .setY(0)
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
      this.stepNpcAnimation(npc, dt, playerPosition, index, false);
    }
  }

  /** Zarządza animacjami i czynnościami w miejscu w zależności od roli i lokacji. */
  private tryActivity(npc: Npc, player?: THREE.Vector3) {
    const animator = npc.animator;
    if (!animator || npc.activityCooldown > 0) return;

    // Główny obóz: zachowaj szybkie gesty i rzadki odpoczynek dla stabilności schedulera i soak testów
    if (npc.isCampMember) {
      npc.activityCooldown = 25 + npc.behavior.random() * 45;
      const p = npc.root.position;
      const road = MAIN_ASPHALT_ROAD;
      const outsideRoad =
        p.x < road.minX - 3 || p.x > road.maxX + 3 || p.z < road.minZ - 3 || p.z > road.maxZ + 3;
      const free =
        outsideRoad &&
        (!player || p.distanceToSquared(player) > 16) &&
        this.npcs.every((other) => other === npc || other.root.position.distanceToSquared(p) > 16) &&
        [-2, 0, 2].every((x) => [-2, 0, 2].every((z) => this.navigation.canStandAt(p.x + x, p.z + z)));
      if (
        free &&
        npc.behavior.random() < 0.45 &&
        animator.startActivity([
          { name: 'LieDown' },
          { name: 'LayingIdle', seconds: 15 + npc.behavior.random() * 25 },
          { name: 'StandUpFromLaying' },
        ])
      )
        return;
      const gestures = [
        'LookAround',
        'Waving',
        'ArmStretching',
        'NeckStretching',
        'Laughing',
        'HeadNodYes',
        'Talking',
        'Clapping',
      ];
      const available = gestures.filter((name) => animator.hasClip(name));
      if (available.length)
        animator.startActivity([{ name: available[Math.floor(npc.behavior.random() * available.length)] }]);
      return;
    }

    // Tłum festiwalowy: czynności dopasowane do przypisanej roli oraz strefy festiwalowej
    npc.activityCooldown = 12 + npc.behavior.random() * 25;
    const pos = npc.root.position;

    // 1. Taniec pod Dużą Sceną (Headbanging, HipHopDancing, SillyDancing, Cheering, itp.)
    if (npc.festivalRole === 'stage_dancer' || (pos.x >= 115 && pos.x <= 195 && pos.z >= -14 && pos.z <= 48)) {
      const danceClips = [
        'Headbanging',
        'HipHopDancing',
        'HipHopDancingVariant1',
        'SillyDancing',
        'Cheering',
        'Clapping',
        'Jump',
        'Yelling',
      ];
      const available = danceClips.filter((name) => animator.hasClip(name));
      if (available.length) {
        const clip = available[Math.floor(npc.behavior.random() * available.length)];
        animator.startActivity([{ name: clip, seconds: 5 + npc.behavior.random() * 10 }]);
        return;
      }
    }

    // 2. Namiot ASP: słuchanie, siedzenie i oklaski
    if (npc.festivalRole === 'asp_listener' || (pos.x >= -85 && pos.x <= -45 && pos.z >= 86 && pos.z <= 108)) {
      const aspActivities = [
        'Sitting',
        'SittingIdle',
        'SittingTalking',
        'SittingDrinking',
        'Clapping',
        'HeadNodYes',
        'HardHeadNod',
        'LengthyHeadNod',
      ];
      const available = aspActivities.filter((name) => animator.hasClip(name));
      if (available.length) {
        const clip = available[Math.floor(npc.behavior.random() * available.length)];
        animator.startActivity([{ name: clip, seconds: 6 + npc.behavior.random() * 12 }]);
        return;
      }
    }

    // 3. Kolejka po jedzenie przed namiotami gastronomicznymi
    if (
      npc.festivalRole === 'food_queue' ||
      (pos.z >= 79 && pos.z <= 90 && pos.x >= -38 && pos.x <= 38) ||
      (pos.z >= -26 && pos.z <= -16 && pos.x >= -130 && pos.x <= -42)
    ) {
      const queueClips = [
        'TextingWhileStanding',
        'LookAround',
        'WeightShift',
        'RelievedSigh',
        'Drinking',
        'Talking',
      ];
      const available = queueClips.filter((name) => animator.hasClip(name));
      if (available.length) {
        const clip = available[Math.floor(npc.behavior.random() * available.length)];
        animator.startActivity([{ name: clip, seconds: 5 + npc.behavior.random() * 8 }]);
        return;
      }
    }

    // 4. Leżenie przy drodze lub na sąsiednich obozach (chiller)
    if (npc.festivalRole === 'chiller' || (!npc.passageWalker && npc.behavior.random() < 0.4)) {
      const layClips = ['LayingIdle', 'LayingIdleFootCrossed', 'SleepingIdle'];
      const availableLay = layClips.filter((name) => animator.hasClip(name));
      if (availableLay.length && animator.hasClip('LieDown') && animator.hasClip('StandUpFromLaying')) {
        const layClip = availableLay[Math.floor(npc.behavior.random() * availableLay.length)];
        if (
          animator.startActivity([
            { name: 'LieDown' },
            { name: layClip, seconds: 12 + npc.behavior.random() * 20 },
            { name: 'StandUpFromLaying' },
          ])
        ) {
          return;
        }
      }
    }

    // Gesty ogólne
    const generalGestures = [
      'LookAround',
      'Waving',
      'ArmStretching',
      'NeckStretching',
      'Laughing',
      'HeadNodYes',
      'Talking',
      'Clapping',
      'BeingCocky',
      'HappyHandGesture',
    ];
    const available = generalGestures.filter((name) => animator.hasClip(name));
    if (available.length) {
      animator.startActivity([{ name: available[Math.floor(npc.behavior.random() * available.length)] }]);
    }
  }

  getSpeakerWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 | null {
    if (!this.speakerAnchor) return null;
    return this.speakerAnchor.getWorldPosition(target);
  }

  /** Zatrzymuje ruch bota na czas rozmowy z graczem i obraca go w stronę gracza. */
  pauseNpcForConversation(name: string, facePosition?: THREE.Vector3): Npc | undefined {
    const npc = this.npcs.find((n) => n.name === name);
    if (!npc) return undefined;
    if (npc.isSitting || npc.assignedSeatId) {
      if (npc.assignedSeatId) {
        this.occupiedSeats.delete(npc.assignedSeatId);
        npc.assignedSeatId = undefined;
      }
      if (npc.isSitting) {
        npc.isSitting = false;
        if (npc.visual) {
          npc.visual.rotation.y = 0;
          npc.visual.position.y = npc.visualBaseY ?? 0;
          npc.visual.position.z = 0;
        }
      }
    }
    if (npc.isDancingAtSpeaker) {
      npc.isDancingAtSpeaker = false;
      npc.animator?.cancelActivity();
    }
    npc.inConversation = true;
    npc.stationary = true;
    npc.speed = 0;
    npc.velocity.set(0, 0, 0);
    npc.waypoints.length = 0;
    if (facePosition) {
      const dx = facePosition.x - npc.root.position.x;
      const dz = facePosition.z - npc.root.position.z;
      if (dx * dx + dz * dz > 0.0001) {
        npc.root.rotation.y = Math.atan2(dx, dz);
        npc.steeringDirection.set(dx, 0, dz).normalize();
      }
    }
    return npc;
  }

  /** Wznawia naturalne zachowanie NPC po zakończeniu dialogu. */
  resumeNpcAfterConversation(name: string, resumeWaitSeconds = 2.0): void {
    const npc = this.npcs.find((n) => n.name === name);
    if (!npc) return;
    npc.inConversation = false;
    npc.stationary = false;
    npc.wait = resumeWaitSeconds;
    npc.speed = 0;
    npc.velocity.set(0, 0, 0);
    npc.target.copy(npc.root.position);
    npc.watchdog.resetPosition(npc.root.position);
  }

  /** Reaguje na poczęstowanie używką (piwem lub jointem) przez gracza. */
  shareItemWithNpc(name: string, effect: 'Piwo' | 'Joint', facePosition?: THREE.Vector3): { success: boolean; message?: string } {
    const key = name.toLowerCase().trim();
    const npc = this.npcs.find(
      (n) =>
        n.name.toLowerCase() === key ||
        (n.root.userData?.npcId && String(n.root.userData.npcId).toLowerCase() === key) ||
        n.root.name.toLowerCase() === `npc_${key}`,
    );
    if (!npc || npc.isHidden) return { success: false };

    npc.stationary = true;
    npc.speed = 0;
    npc.velocity.set(0, 0, 0);
    npc.waypoints.length = 0;
    npc.wait = 4.0;

    if (facePosition) {
      const dx = facePosition.x - npc.root.position.x;
      const dz = facePosition.z - npc.root.position.z;
      if (dx * dx + dz * dz > 0.0001) {
        npc.root.rotation.y = Math.atan2(dx, dz);
        npc.steeringDirection.set(dx, 0, dz).normalize();
      }
    }

    if (effect === 'Piwo') {
      const drinkClips = ['Drinking', 'HappyHandGesture', 'Laughing'];
      const available = drinkClips.filter((c) => npc.animator?.hasClip(c));
      const clip = available[0] ?? 'HappyHandGesture';
      if (npc.animator?.hasClip(clip)) {
        npc.animator.startActivity([{ name: clip, seconds: 3.5 }]);
      }
    } else {
      const smokeClips = ['RelievedSigh', 'HappyHandGesture', 'Laughing'];
      const available = smokeClips.filter((c) => npc.animator?.hasClip(c));
      const clip = available[0] ?? 'HappyHandGesture';
      if (npc.animator?.hasClip(clip)) {
        npc.animator.startActivity([{ name: clip, seconds: 3.5 }]);
      }
    }

    const responses =
      effect === 'Piwo'
        ? [
            'Dzięki mordeczko! Zimne piwko to skarb!',
            'Za festiwal! Twoje zdrowie!',
            'Ooo, z nieba mi spadłeś, dzięki!',
            'Masz złote serce, brachu!',
          ]
        : [
            'Dzięki stary, idealny moment na dymka!',
            'Ale dobry sort, dzięki wielkie!',
            'Peace and love, dzięki za jointa!',
            'Szacuneczek, mordeczko!',
          ];
    const message = responses[Math.floor(npc.behavior.random() * responses.length)];
    return { success: true, message };
  }

  /** Zatrzymuje miksery animacji wszystkich NPC. */
  dispose() {
    this.disposed = true;
    this.occupiedSeats.clear();
    this.npcs.forEach((n) => n.animator?.dispose());
  }
}
