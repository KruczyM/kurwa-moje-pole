import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { terrainHeight } from '../world/terrainHeight';
import { enableInteractionLayer } from './InteractionManager';
import { FlankiRoster } from './FlankiRoster';
import { FlankiAiming } from './FlankiAiming';
import { FlankiRunnerController } from './FlankiRunnerController';
import { createFlankiActor } from './FlankiActors';
import { FlankiThrowHand } from './FlankiThrowHand';
import { FlankiThrowPose } from './FlankiThrowPose';
import { keepFlankiSkinsVisible } from './FlankiSkinVisibility';
import {
  FLANKI_BALL_RADIUS,
  FLANKI_PHYSICS_STEP,
  flankiHitsCan,
  flankiThrowVelocity,
  flankiArcDirection,
  flankiSuggestedPower,
  flankiSway,
  stepFlankiBall,
} from './FlankiPhysics';
import type { FlankiLobbyState } from '../network/flankiProtocol';

export type FlankiPhase =
  'idle' | 'aiming' | 'projectile_flying' | 'player_drinking' | 'bot_turn' | 'bot_drinking' | 'game_over';

export interface FlankiGameConfig {
  canPosition?: [number, number, number];
  playerLineZ?: number;
  botLineZ?: number;
  playerBeerInitial?: number;
  botBeerInitial?: number;
  drinkRate?: number; // beer consumed per second (default ~0.22)
  botAccuracy?: number; // 0..1 (default 0.55)
  beerCanModel?: GLTF | null;
  characterModels?: Map<string, GLTF>;
  teamAConfig?: {
    name?: string;
    throwers: { id: string; name: string; isHuman?: boolean }[];
    runner: { id: string; name: string };
  };
  teamBConfig?: {
    name?: string;
    throwers: { id: string; name: string; isHuman?: boolean }[];
    runner: { id: string; name: string };
  };
}

export interface FlankiCallbacks {
  onToast?: (msg: string) => void;
  onDrinkSfx?: () => void;
  onThrowSfx?: () => void;
  onHitSfx?: () => void;
  onVictory?: () => void;
  onChokeSfx?: () => void;
  onStopSfx?: () => void;
  onSendMultiplayerAction?: (action: string, payload: Record<string, unknown>) => void;
}

export interface FlankiHudState {
  active: boolean;
  phase: FlankiPhase;
  playerBeer: number;
  botBeer: number;
  throwPower: number;
  recommendedPower?: number;
  isCharging: boolean;
  isChugging: boolean;
  promptText: string;
  qteSequence?: string[];
  isChoking?: boolean;
  isMultiplayer?: boolean;
  opponentName?: string;
  activeThrowerName: string;
  activeThrowerTeam: 'A' | 'B';
  localTeam?: 'A' | 'B';
  defendingRunnerName: string;
  isStopActive: boolean;
  stopBannerText: string;
  isSweetSpot: boolean;
}

/**
 * Tworzy wysoce widoczną, fluorescencyjną piłeczkę do tenisa ziemnego
 */
function createTennisBallMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Flanki_TennisBall';

  const sphereGeo = new THREE.SphereGeometry(0.048, 16, 16);
  const feltMat = new THREE.MeshStandardMaterial({
    color: 0xccff00, // fluorescencyjny seledyn
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x224400,
    emissiveIntensity: 0.25,
  });
  const sphere = new THREE.Mesh(sphereGeo, feltMat);
  sphere.castShadow = true;
  group.add(sphere);

  const seamGeo = new THREE.TorusGeometry(0.0485, 0.003, 8, 32);
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
  });
  const seam1 = new THREE.Mesh(seamGeo, seamMat);
  seam1.rotation.x = Math.PI / 4;
  group.add(seam1);

  const seam2 = new THREE.Mesh(seamGeo, seamMat);
  seam2.rotation.y = Math.PI / 4;
  group.add(seam2);

  return group;
}

/**
 * Drewniany drogowskaz / tablica informacyjna boiska do flanek
 */
function createFlankiPitchSign(): THREE.Group {
  const sign = new THREE.Group();
  sign.name = 'Flanki_Pitch_Sign';

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.85 });
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8);
  const leftPost = new THREE.Mesh(postGeo, woodMat);
  leftPost.position.set(-0.5, 0.65, 0);
  leftPost.castShadow = true;
  const rightPost = new THREE.Mesh(postGeo, woodMat);
  rightPost.position.set(0.5, 0.65, 0);
  rightPost.castShadow = true;
  sign.add(leftPost, rightPost);

  const boardGeo = new THREE.BoxGeometry(1.2, 0.45, 0.05);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x7a4b23, roughness: 0.8 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(0, 1.05, 0);
  board.castShadow = true;
  sign.add(board);

  const emblemMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.3 });
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12), emblemMat);
  emblem.position.set(0, 1.05, 0.035);
  sign.add(emblem);

  return sign;
}

export class FlankiGame {
  readonly root = new THREE.Group();
  private phase: FlankiPhase = 'idle';

  public readonly roster: FlankiRoster;
  public readonly aiming: FlankiAiming;
  public readonly runnerA: FlankiRunnerController;
  public readonly runnerB: FlankiRunnerController;

  public readonly canPosition: THREE.Vector3;
  private readonly playerLineZ: number;
  private readonly botLineZ: number;
  private readonly drinkRate: number;
  private readonly botAccuracy: number;

  private isCharging = false;
  private isChugging = false;
  private chargeTimer = 0;
  private aimSeconds = 0;
  private throwPoses = new Map<string, FlankiThrowPose>();
  private throwSequence = 0;
  private lastThrower = '';
  private receivedThrowSequence = 0;
  private restoreSkinVisibility = new Map<string, () => void>();
  private throwPower = 0;
  private readonly throwHand = new FlankiThrowHand();
  private readonly actors = new Map<string, ReturnType<typeof createFlankiActor>>();
  private readonly characterModels: Map<string, GLTF>;
  private readonly borrowedActors = new Map<string, ReturnType<typeof createFlankiActor>>();
  private physicsAccumulator = 0;
  private flightSeconds = 0;
  private localPlayerId = 'player';
  private localTeam: 'A' | 'B' = 'A';
  private snapshotTimer = 0;
  private remoteRunnerTargets = new Map<'A' | 'B', THREE.Vector3>();
  private sessionId = '';
  private authoritativeHostId = '';
  private lockedAim?: THREE.Vector3;
  private suggestedPower = 0.3;
  private inputTimer = 0;
  private readonly drinkingPlayers = new Map<string, number>();

  // Projectile state (piłeczka tenisowa)
  private readonly projectilePos = new THREE.Vector3();
  private readonly projectileVel = new THREE.Vector3();
  private readonly projectileRot = new THREE.Vector3();

  // Bot throw timer
  private botTurnTimer = 0;

  // Stop/penalty feedback.
  private chokeTimer = 0;

  // STOP banner state
  private isStopActive = false;
  private stopBannerTimer = 0;
  private stopBannerText = '';

  // Multiplayer state
  private isMultiplayer = false;
  private opponentName = 'Rywale z Sektora';
  private isHost = true;

  // Meshes
  private readonly canRoot: THREE.Object3D;
  private sharedCanVisual?: THREE.Object3D;
  private readonly projectileMesh: THREE.Group;
  private readonly playerLineMesh: THREE.Mesh;
  private readonly botLineMesh: THREE.Mesh;
  public readonly interactionHitbox: THREE.Mesh;
  public readonly canInteractionHitbox: THREE.Mesh;

  private callbacks?: FlankiCallbacks;

  constructor(config: FlankiGameConfig = {}, callbacks?: FlankiCallbacks) {
    this.root.name = 'FlankiGame';
    this.callbacks = callbacks;
    this.characterModels = config.characterModels ?? new Map();

    const canY = config.canPosition ? config.canPosition[1] : terrainHeight(0, -26);
    this.canPosition = new THREE.Vector3(config.canPosition?.[0] ?? 0, canY, config.canPosition?.[2] ?? -26);
    this.playerLineZ = config.playerLineZ ?? -20.0;
    this.botLineZ = config.botLineZ ?? -32.0;
    this.drinkRate = config.drinkRate ?? 0.22;
    this.botAccuracy = config.botAccuracy ?? 0.55;

    // Inicjalizacja modułów: Roster, Aiming
    this.roster = new FlankiRoster(config.teamAConfig, config.teamBConfig);
    this.aiming = new FlankiAiming({ pointCount: 36 });
    this.root.add(this.aiming.trajectoryMesh);

    // Runner A & B visuals
    const runnerAMesh = this.addActor(this.roster.teamA.runner.id).root;
    const runnerBMesh = this.addActor(this.roster.teamB.runner.id).root;
    this.root.add(runnerAMesh);
    this.root.add(runnerBMesh);

    this.runnerA = new FlankiRunnerController({
      id: this.roster.teamA.runner.id,
      name: this.roster.teamA.runner.name,
      team: 'A',
      baseLineZ: this.playerLineZ,
      basePosition: new THREE.Vector3(
        2.2,
        terrainHeight(2.2, this.playerLineZ - 0.5),
        this.playerLineZ + 0.5,
      ),
      mesh: runnerAMesh,
      runSpeed: 8.5,
      rightingDuration: 0.15,
      onCanRighted: () => this.handleCanRighted(),
      onStopCalled: (name) => this.handleStopCalled(name),
    });

    this.runnerB = new FlankiRunnerController({
      id: this.roster.teamB.runner.id,
      name: this.roster.teamB.runner.name,
      team: 'B',
      baseLineZ: this.botLineZ,
      basePosition: new THREE.Vector3(2.2, terrainHeight(2.2, this.botLineZ - 0.5), this.botLineZ - 0.5),
      mesh: runnerBMesh,
      runSpeed: 8.5,
      rightingDuration: 0.15,
      onCanRighted: () => this.handleCanRighted(),
      onStopCalled: (name) => this.handleStopCalled(name),
    });
    this.refreshThrowerActors();

    // 1. Podstawka / biały kredowy okrąg pod puszkę na środku boiska
    const canSpot = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }),
    );
    canSpot.name = 'Flanki_CanSpot';
    canSpot.rotation.x = -Math.PI / 2;
    canSpot.position.copy(this.canPosition).add(new THREE.Vector3(0, 0.01, 0));
    this.root.add(canSpot);

    // Can mesh (autentyczna puszka 500ml: wysokość 0.168m, średnica 0.066m / promień 0.033m)
    if (config.beerCanModel && config.beerCanModel.scene) {
      const cloned = clone(config.beerCanModel.scene);
      this.sharedCanVisual = cloned;
      const box = new THREE.Box3().setFromObject(cloned);
      const origHeight = Math.max(0.01, box.max.y - box.min.y);
      const targetH = 0.168;
      cloned.scale.setScalar(targetH / origHeight);
      box.setFromObject(cloned);
      cloned.position.y = -box.min.y;

      const wrapper = new THREE.Group();
      wrapper.name = 'Flanki_Can';
      wrapper.add(cloned);
      wrapper.position.copy(this.canPosition);
      this.canRoot = wrapper;
    } else {
      const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.168, 20);
      const canMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.85,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(canGeo, canMat);
      mesh.name = 'Flanki_Can';
      mesh.position.copy(this.canPosition).add(new THREE.Vector3(0, 0.084, 0));
      mesh.castShadow = true;
      this.canRoot = mesh;
    }
    this.root.add(this.canRoot);

    // 2. Linie rzutu (białe kredowe pasy na trawie)
    const lineGeo = new THREE.BoxGeometry(5.0, 0.02, 0.18);
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
    });
    this.playerLineMesh = new THREE.Mesh(lineGeo, lineMat);
    this.playerLineMesh.name = 'Flanki_PlayerLine';
    this.playerLineMesh.position.set(0, terrainHeight(0, this.playerLineZ) + 0.01, this.playerLineZ);
    this.root.add(this.playerLineMesh);

    this.botLineMesh = new THREE.Mesh(lineGeo, lineMat);
    this.botLineMesh.name = 'Flanki_BotLine';
    this.botLineMesh.position.set(0, terrainHeight(0, this.botLineZ) + 0.01, this.botLineZ);
    this.root.add(this.botLineMesh);

    // Tablica / drogowskaz boiska na linii gracza
    const pitchSign = createFlankiPitchSign();
    pitchSign.position.set(3.0, terrainHeight(3.0, this.playerLineZ), this.playerLineZ);
    this.root.add(pitchSign);

    // 3. Piłeczka tenisowa o wysokiej widoczności
    this.projectileMesh = createTennisBallMesh();
    this.projectileMesh.visible = false;
    this.root.add(this.projectileMesh);

    // 4. Trigger rozpoczęcia gry na linii gracza
    const hitGeo = new THREE.BoxGeometry(6.0, 3.0, 4.0);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    });
    this.interactionHitbox = new THREE.Mesh(hitGeo, hitMat);
    this.interactionHitbox.position.set(0, terrainHeight(0, this.playerLineZ) + 1.2, this.playerLineZ);
    this.interactionHitbox.userData.interaction = {
      kind: 'flanki',
      label: 'Zagraj we Flanki (Bierball) [E]',
    };
    this.interactionHitbox.userData.interactionRoot = this.interactionHitbox;
    this.interactionHitbox.userData.entryRadius = 3.5;
    enableInteractionLayer(this.interactionHitbox);
    this.root.add(this.interactionHitbox);

    // Dodanie warstwy interakcji do linii kredowej i tablicy informacyjnej
    this.playerLineMesh.userData.interaction = {
      kind: 'flanki',
      label: 'Zagraj we Flanki (Bierball) [E]',
    };
    this.playerLineMesh.userData.interactionRoot = this.interactionHitbox;
    enableInteractionLayer(this.playerLineMesh);

    pitchSign.userData.interaction = {
      kind: 'flanki',
      label: 'Zagraj we Flanki (Bierball) [E]',
    };
    pitchSign.userData.interactionRoot = this.interactionHitbox;
    enableInteractionLayer(pitchSign);

    // 5. Trigger podniesienia puszki (dla manualnego podejścia gracza)
    const canHitGeo = new THREE.BoxGeometry(2.2, 1.8, 2.2);
    const canHitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    });
    this.canInteractionHitbox = new THREE.Mesh(canHitGeo, canHitMat);
    this.canInteractionHitbox.position.copy(this.canPosition).add(new THREE.Vector3(0, 0.6, 0));
    this.canInteractionHitbox.userData.interaction = {
      kind: 'flanki',
      label: 'Zagraj we Flanki (Bierball) [E]',
    };
    this.canInteractionHitbox.userData.interactionRoot = this.canInteractionHitbox;
    enableInteractionLayer(this.canInteractionHitbox);
    this.root.add(this.canInteractionHitbox);
  }

  setCallbacks(callbacks: FlankiCallbacks): void {
    this.callbacks = callbacks;
  }

  private addActor(id: string) {
    const borrowed = this.borrowedActors.get(id);
    if (borrowed) {
      this.actors.set(id, borrowed);
      return borrowed;
    }
    const actor = createFlankiActor(id, this.characterModels);
    actor.root.visible = false;
    this.actors.set(id, actor);
    this.root.add(actor.root);
    return actor;
  }

  private faceCan(root: THREE.Object3D) {
    root.rotation.y = Math.atan2(this.canPosition.x - root.position.x, this.canPosition.z - root.position.z);
  }

  private animateThrow(id: string, released = true) {
    const actor = this.actors.get(id);
    if (actor) {
      let pose = this.throwPoses.get(id);
      if (!pose) {
        pose = new FlankiThrowPose(actor.root);
        this.throwPoses.set(id, pose);
      }
      pose.start();
    }
    if (released && this.isHost) {
      this.lastThrower = id;
      this.throwSequence++;
    }
  }

  /** Borrow the existing crowd entities; never clone or reparent them. */
  enlistNearbyNpcs(
    npcs: { root: THREE.Group; animator?: import('../npc/NpcAnimator').NpcAnimator; name: string }[],
  ) {
    if (this.borrowedActors.size) return;
    const slots = [
      this.roster.teamA.runner,
      this.roster.teamB.runner,
      ...this.roster.teamA.throwers.filter((p) => !p.isHuman),
      ...this.roster.teamB.throwers.filter((p) => !p.isHuman),
    ];
    slots.forEach((slot, index) => {
      if (slot.isHuman) return;
      const npc = npcs[index];
      if (!npc) return;
      this.actors.get(slot.id)?.dispose();
      const actor = { root: npc.root, animator: npc.animator, groundFeet: () => {}, dispose: () => {} };
      this.borrowedActors.set(slot.id, actor);
      this.restoreSkinVisibility.set(slot.id, keepFlankiSkinsVisible(npc.root));
      this.actors.set(slot.id, actor);
      slot.name = npc.name;
      npc.root.userData.flankiName = npc.name;
      const runner = slot.role === 'runner' ? (slot.team === 'A' ? this.runnerA : this.runnerB) : undefined;
      if (runner) {
        runner.mesh = npc.root;
        runner.name = npc.name;
      }
      const z = runner?.basePosition.z ?? (slot.team === 'A' ? this.playerLineZ : this.botLineZ);
      npc.root.userData.flankiTarget = new THREE.Vector3(
        runner
          ? this.canPosition.x + 2.2
          : this.canPosition.x -
              1.6 +
              (slot.team === 'A' ? this.roster.teamA : this.roster.teamB).throwers.findIndex(
                (p) => p.id === slot.id,
              ) *
                1.6,
        terrainHeight(this.canPosition.x, z),
        z,
      );
      npc.root.userData.flankiActive = false;
      npc.root.visible = true;
      npc.animator?.cancelActivity();
      npc.root.userData.flankiFacing = this.canPosition;
    });
  }

  arePlayersReady() {
    return [...this.borrowedActors.values()].every((actor) => {
      const target = actor.root.userData.flankiTarget as THREE.Vector3 | undefined;
      return !target || actor.root.position.distanceTo(target) < 0.2;
    });
  }

  private refreshThrowerActors() {
    const required = new Set([
      this.roster.teamA.runner.id,
      this.roster.teamB.runner.id,
      ...this.roster.teamA.throwers.filter((p) => !p.isHuman).map((p) => p.id),
      ...this.roster.teamB.throwers.filter((p) => !p.isHuman).map((p) => p.id),
    ]);
    for (const [id, actor] of this.borrowedActors) {
      if (required.has(id)) continue;
      delete actor.root.userData.flankiTarget;
      delete actor.root.userData.flankiActive;
      delete actor.root.userData.flankiRouted;
      delete actor.root.userData.flankiFacing;
      delete actor.root.userData.flankiStalled;
      this.borrowedActors.delete(id);
      this.restoreSkinVisibility.get(id)?.();
      this.restoreSkinVisibility.delete(id);
      this.actors.delete(id);
    }
    for (const [id, actor] of this.actors) {
      if (id === this.roster.teamA.runner.id || id === this.roster.teamB.runner.id) continue;
      actor.dispose();
      this.actors.delete(id);
    }
    for (const team of [this.roster.teamA, this.roster.teamB]) {
      team.throwers.forEach((participant, index) => {
        if (participant.isHuman) return;
        const actor = this.addActor(participant.id);
        if (actor.root.userData.flankiName) participant.name = actor.root.userData.flankiName;
        const z = participant.team === 'A' ? this.playerLineZ : this.botLineZ;
        if (this.borrowedActors.has(participant.id)) return;
        actor.root.position.set(
          this.canPosition.x - 1.6 + index * 1.6,
          terrainHeight(this.canPosition.x, z),
          z,
        );
        actor.root.rotation.y = participant.team === 'A' ? Math.PI : 0;
      });
    }
  }

  isLocalTurn() {
    return this.roster.getCurrentThrower().id === this.localPlayerId;
  }
  getLocalLineZ() {
    return this.localTeam === 'A' ? this.playerLineZ : this.botLineZ;
  }
  isLocalRunner() {
    return [this.roster.teamA.runner, this.roster.teamB.runner].some(
      (p) => p.id === this.localPlayerId && p.isHuman,
    );
  }
  prepareOfflineLobby() {
    this.localPlayerId = 'player';
    this.localTeam = 'A';
    this.sessionId = '';
    this.roster.setHumans([{ id: 'player', name: 'Ty (Gracz)', team: 'A' }]);
    this.refreshThrowerActors();
    this.syncRunnerRoles();
  }
  canLocalRunnerMove() {
    return (
      this.isLocalRunner() &&
      this.isDrinkingPhase() &&
      this.roster.getDefendingRunner().id === this.localPlayerId
    );
  }
  shouldLockPlayerMovement() {
    return this.phase !== 'idle' && this.phase !== 'game_over' && !this.canLocalRunnerMove();
  }
  private isDrinkingPhase() {
    return this.phase === 'player_drinking' || this.phase === 'bot_drinking';
  }
  private runnerFor(team: 'A' | 'B') {
    return team === 'A' ? this.runnerA : this.runnerB;
  }
  getLocalStandPosition() {
    if (this.isLocalRunner()) return this.runnerFor(this.localTeam).basePosition.clone();
    return this.standPosition(this.localTeam, this.localPlayerId);
  }
  private standPosition(teamId: 'A' | 'B', id: string) {
    const team = teamId === 'A' ? this.roster.teamA : this.roster.teamB;
    const index = Math.max(
      0,
      team.throwers.findIndex((p) => p.id === id),
    );
    const x = this.canPosition.x - 1.6 + index * 1.6;
    const z = teamId === 'A' ? this.playerLineZ : this.botLineZ;
    return new THREE.Vector3(x, terrainHeight(x, z), z);
  }
  selectRunner(team: 'A' | 'B', id: string): boolean {
    if (this.phase !== 'idle' || !this.roster.selectRunner(team, id)) return false;
    this.syncRunnerRoles();
    return true;
  }
  private syncRunnerRoles() {
    for (const team of [this.roster.teamA, this.roster.teamB]) {
      const runner = this.runnerFor(team.runner.team);
      runner.id = team.runner.id;
      const actor = team.runner.isHuman
        ? undefined
        : (this.actors.get(team.runner.id) ?? this.addActor(team.runner.id));
      if (actor?.root.userData.flankiName) team.runner.name = actor.root.userData.flankiName;
      runner.name = team.runner.name;
      runner.mesh = actor?.root;
      if (runner.mesh) {
        runner.mesh.userData.flankiFacing = this.canPosition;
        runner.mesh.userData.flankiTarget = runner.basePosition.clone();
        delete runner.mesh.userData.flankiRouted;
      }
      for (const [index, p] of team.throwers.entries()) {
        const actor = this.actors.get(p.id);
        if (!actor || p.isHuman) continue;
        const z = p.team === 'A' ? this.playerLineZ : this.botLineZ;
        actor.root.userData.flankiTarget = new THREE.Vector3(
          this.canPosition.x - 1.6 + index * 1.6,
          terrainHeight(this.canPosition.x, z),
          z,
        );
        actor.root.userData.flankiFacing = this.canPosition;
        delete actor.root.userData.flankiRouted;
      }
    }
  }
  updateLocalRunnerPosition(camera: THREE.Vector3) {
    if (!this.canLocalRunnerMove()) return;
    const position = camera.clone();
    position.x = THREE.MathUtils.clamp(position.x, this.canPosition.x - 3.4, this.canPosition.x + 3.4);
    position.z = THREE.MathUtils.clamp(position.z, this.botLineZ - 0.7, this.playerLineZ + 0.7);
    position.y = terrainHeight(position.x, position.z);
    camera.set(position.x, position.y + 1.9, position.z);
    if (this.isHost) this.runnerFor(this.localTeam).updateHumanPosition(position);
    else if (this.inputTimer <= 0) {
      this.callbacks?.onSendMultiplayerAction?.('flanki:runner_move', { position: position.toArray() });
      this.inputTimer = 0.1;
    }
  }
  getChargeSeconds() {
    return this.chargeTimer;
  }

  cancelThrowCharge() {
    this.isCharging = false;
    this.lockedAim = undefined;
    this.chargeTimer = 0;
    this.throwPower = 0.05;
    this.aiming.hideTrajectory();
  }
  updateThrowHand(camera: THREE.Camera) {
    this.throwHand.update(
      camera,
      this.phase === 'aiming' && this.isLocalTurn(),
      this.aimSeconds,
      this.isCharging,
    );
  }

  configureLobby(lobby: FlankiLobbyState, localId: string): void {
    this.localPlayerId = localId;
    this.localTeam = lobby.players.find((player) => player.id === localId)?.team ?? 'A';
    this.isHost = lobby.hostId === localId;
    this.authoritativeHostId = lobby.hostId;
    this.sessionId = lobby.sessionId;
    this.roster.setHumans(lobby.players);
    for (const team of ['A', 'B'] as const)
      if (lobby.runners?.[team]) this.roster.selectRunner(team, lobby.runners[team]!);
    this.refreshThrowerActors();
    this.syncRunnerRoles();
  }

  private publishSnapshot(): void {
    this.callbacks?.onSendMultiplayerAction?.('flanki:snapshot', {
      phase: this.phase,
      turn: this.roster.getTurnIndex(),
      beerA: this.roster.teamA.throwers.map((player) => player.beerRemaining),
      beerB: this.roster.teamB.throwers.map((player) => player.beerRemaining),
      canUpright: this.isCanUpright(),
      projectile: this.projectilePos.toArray(),
      projectileVisible: this.projectileMesh.visible,
      runnerA: this.runnerA.currentPosition.toArray(),
      runnerB: this.runnerB.currentPosition.toArray(),
      runningA: this.runnerA.isRunning(),
      runningB: this.runnerB.isRunning(),
      runnerStateA: this.runnerA.getState(),
      runnerStateB: this.runnerB.getState(),
      runnerIdA: this.roster.teamA.runner.id,
      runnerIdB: this.roster.teamB.runner.id,
      stop: this.isStopActive,
      stopText: this.stopBannerText,
      throwSequence: this.throwSequence,
      thrower: this.lastThrower,
    });
  }

  handleNetworkAction(
    action: string,
    payload: Record<string, unknown>,
    senderId: string,
    sessionId: string,
  ): void {
    if (!this.isMultiplayer || sessionId !== this.sessionId) return;
    if (action === 'flanki:snapshot' && !this.isHost && senderId === this.authoritativeHostId) {
      let rolesChanged = false;
      for (const [team, id] of [
        ['A', payload.runnerIdA],
        ['B', payload.runnerIdB],
      ] as const) {
        const rosterTeam = team === 'A' ? this.roster.teamA : this.roster.teamB;
        if (typeof id === 'string' && rosterTeam.runner.id !== id)
          rolesChanged = this.roster.selectRunner(team, id) || rolesChanged;
      }
      if (rolesChanged) {
        this.refreshThrowerActors();
        this.syncRunnerRoles();
      }
      if (
        typeof payload.throwSequence === 'number' &&
        Number.isSafeInteger(payload.throwSequence) &&
        payload.throwSequence > this.receivedThrowSequence &&
        typeof payload.thrower === 'string'
      ) {
        this.receivedThrowSequence = payload.throwSequence;
        this.animateThrow(payload.thrower);
      }
      const validPhases: FlankiPhase[] = [
        'idle',
        'aiming',
        'projectile_flying',
        'player_drinking',
        'bot_turn',
        'bot_drinking',
        'game_over',
      ];
      if (
        !validPhases.includes(payload.phase as FlankiPhase) ||
        typeof payload.turn !== 'number' ||
        !Number.isFinite(payload.turn)
      )
        return;
      this.roster.setTurnIndex(payload.turn);
      for (const [team, values] of [
        [this.roster.teamA, payload.beerA],
        [this.roster.teamB, payload.beerB],
      ] as const) {
        if (Array.isArray(values))
          team.throwers.forEach((participant, index) => {
            if (typeof values[index] === 'number' && Number.isFinite(values[index]))
              participant.beerRemaining = THREE.MathUtils.clamp(values[index], 0, 1);
          });
      }
      const oldPhase = this.phase;
      this.phase = payload.phase as FlankiPhase;
      if (this.phase === 'aiming' || (this.phase === 'bot_turn' && this.roster.getCurrentThrower().isHuman))
        this.phase = this.isLocalTurn() ? 'aiming' : 'bot_turn';
      if (this.localTeam === 'B') {
        if (this.phase === 'player_drinking') this.phase = 'bot_drinking';
        else if (this.phase === 'bot_drinking') this.phase = 'player_drinking';
      }
      if (oldPhase !== this.phase) {
        this.isCharging = false;
        if (!this.isDrinkingPhase()) this.isChugging = false;
        this.aiming.hideTrajectory();
      }
      if (payload.canUpright) this.resetCan();
      else if (this.isCanUpright()) this.tipOverCan(false);
      const vector = (value: unknown) =>
        Array.isArray(value) &&
        value.length === 3 &&
        value.every((v) => typeof v === 'number' && Number.isFinite(v))
          ? new THREE.Vector3(value[0], value[1], value[2])
          : null;
      const projectile = vector(payload.projectile);
      if (projectile) {
        this.projectilePos.copy(projectile);
        this.projectileMesh.position.copy(projectile);
      }
      this.projectileMesh.visible = payload.projectileVisible === true;
      for (const [team, value] of [
        ['A', payload.runnerA],
        ['B', payload.runnerB],
      ] as const) {
        const target = vector(value);
        if (target) this.remoteRunnerTargets.set(team, target);
      }
      if (this.runnerA.mesh) this.runnerA.mesh.userData.networkRunning = payload.runningA === true;
      if (this.runnerB.mesh) this.runnerB.mesh.userData.networkRunning = payload.runningB === true;
      const runnerStates = [
        'idle_at_base',
        'running_to_can',
        'righting_can',
        'running_back',
        'crossed_line',
      ] as const;
      for (const [runner, state] of [
        [this.runnerA, payload.runnerStateA],
        [this.runnerB, payload.runnerStateB],
      ] as const)
        if (runnerStates.includes(state as (typeof runnerStates)[number]))
          runner.setNetworkState(state as (typeof runnerStates)[number]);
      this.isStopActive = payload.stop === true;
      this.stopBannerText = typeof payload.stopText === 'string' ? payload.stopText.slice(0, 100) : '';
      if (
        this.phase === 'game_over' &&
        oldPhase !== 'game_over' &&
        this.roster.getWinner() === this.localTeam
      )
        this.callbacks?.onVictory?.();
      return;
    }
    if (!this.isHost) return;
    if (
      action === 'flanki:throw' &&
      this.roster.getCurrentThrower().id === senderId &&
      this.phase === 'bot_turn'
    ) {
      const direction = payload.direction;
      if (
        !Array.isArray(direction) ||
        direction.length !== 3 ||
        !direction.every((v) => typeof v === 'number' && Number.isFinite(v)) ||
        typeof payload.power !== 'number' ||
        !Number.isFinite(payload.power) ||
        typeof payload.swaySeconds !== 'number' ||
        !Number.isFinite(payload.swaySeconds)
      )
        return;
      const participant = this.roster.getCurrentThrower();
      const origin = this.standPosition(participant.team, participant.id).add(new THREE.Vector3(0, 1.9, 0));
      const supplied = payload.origin;
      if (
        Array.isArray(supplied) &&
        supplied.length === 3 &&
        supplied.every((v) => typeof v === 'number' && Number.isFinite(v))
      ) {
        const actual = new THREE.Vector3(...(supplied as [number, number, number]));
        if (actual.distanceTo(origin) > 0.75) return;
        origin.copy(actual);
      }
      const aim = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize();
      if (aim.lengthSq() < 0.5) return;
      this.projectilePos.copy(this.throwOrigin(origin, aim));
      this.projectileVel.copy(flankiThrowVelocity(aim, payload.power, payload.swaySeconds));
      this.animateThrow(participant.id);
      this.projectileMesh.position.copy(this.projectilePos);
      this.projectileMesh.visible = true;
      this.physicsAccumulator = this.flightSeconds = 0;
      this.phase = 'projectile_flying';
      this.callbacks?.onThrowSfx?.();
    } else if (action === 'flanki:drink' && typeof payload.held === 'boolean') {
      this.setDrinkingFor(senderId, payload.held);
    } else if (action === 'flanki:runner_move' || action === 'flanki:pickup') {
      const participant = [this.roster.teamA.runner, this.roster.teamB.runner].find(
        (p) => p.id === senderId && p.isHuman,
      );
      if (!participant || !this.isDrinkingPhase() || this.roster.getDefendingRunner().id !== senderId) return;
      const runner = this.runnerFor(participant.team);
      const values = payload.position;
      if (action === 'flanki:pickup') runner.pickUpCan();
      else if (
        Array.isArray(values) &&
        values.length === 3 &&
        values.every((v) => typeof v === 'number' && Number.isFinite(v))
      ) {
        const position = new THREE.Vector3(values[0], 0, values[2]);
        if (
          Math.abs(position.x - this.canPosition.x) > 3.4 ||
          position.z < this.botLineZ - 0.7 ||
          position.z > this.playerLineZ + 0.7 ||
          Math.hypot(position.x - runner.currentPosition.x, position.z - runner.currentPosition.z) > 1.5
        )
          return;
        position.y = terrainHeight(position.x, position.z);
        runner.updateHumanPosition(position);
      }
    }
  }

  getPhase(): FlankiPhase {
    return this.phase;
  }

  get playerBeer(): number {
    return this.roster.teamA.throwers[0]?.beerRemaining ?? 1.0;
  }

  set playerBeer(val: number) {
    for (const t of this.roster.teamA.throwers) {
      t.beerRemaining = Math.max(0, val);
    }
  }

  get botBeer(): number {
    return this.roster.teamB.throwers[0]?.beerRemaining ?? 1.0;
  }

  set botBeer(val: number) {
    for (const t of this.roster.teamB.throwers) {
      t.beerRemaining = Math.max(0, val);
    }
  }

  getPlayerBeer(): number {
    return this.playerBeer;
  }

  getBotBeer(): number {
    return this.botBeer;
  }

  getCanPosition(): THREE.Vector3 {
    return this.canPosition.clone();
  }

  isCanUpright(): boolean {
    return this.canRoot.rotation.x === 0;
  }

  /** Rozpoczyna nowy mecz we flanki */
  startMatch(options?: { multiplayer?: boolean; opponentName?: string; isHost?: boolean }): void {
    this.throwSequence = this.receivedThrowSequence = 0;
    this.lastThrower = '';
    this.syncRunnerRoles();
    for (const actor of this.actors.values()) {
      actor.root.visible = true;
      if (actor.root.userData.flankiTarget) actor.root.userData.flankiActive = true;
      const target = actor.root.userData.flankiTarget as THREE.Vector3 | undefined;
      if (target) actor.root.position.copy(target);
      this.faceCan(actor.root);
    }
    if (!options?.multiplayer && this.sessionId) {
      this.localPlayerId = 'player';
      this.localTeam = 'A';
      this.sessionId = '';
      this.roster.setHumans([{ id: 'player', name: 'Ty (Gracz)', team: 'A' }]);
      this.refreshThrowerActors();
    }
    this.roster.reset();
    this.isMultiplayer = options?.multiplayer ?? false;
    this.opponentName = options?.opponentName ?? this.roster.teamB.name;
    this.isHost = options?.isHost ?? true;

    this.resetCan();
    this.runnerA.reset();
    this.runnerB.reset();

    const currentThrower = this.roster.getCurrentThrower();
    if (this.isMultiplayer && !this.isHost) {
      this.phase = 'bot_turn';
      this.botTurnTimer = 1.2;
    } else {
      this.phase = currentThrower.id === this.localPlayerId ? 'aiming' : 'bot_turn';
      if (!currentThrower.isHuman) {
        this.botTurnTimer = 1.2;
      }
    }

    this.isCharging = false;
    this.isChugging = false;
    this.throwPower = 0;
    this.chargeTimer = 0;
    this.chokeTimer = 0;
    this.isStopActive = false;
    this.stopBannerTimer = 0;
    this.stopBannerText = '';

    this.drinkingPlayers.clear();
    this.lockedAim = undefined;
    this.projectileMesh.visible = false;
    this.aiming.hideTrajectory();

    const throwerDesc = this.isLocalTurn()
      ? 'Rzucasz pierwszy!'
      : `Rzut wykonuje: ${currentThrower.name} (${currentThrower.team === 'A' ? 'Drużyna A' : 'Drużyna B'})`;
    this.toast(`🍻 FLANKI ROZPOCZĘTE! Biegacze na pozycjach! ${throwerDesc}`);
    if (this.isMultiplayer && this.isHost) this.publishSnapshot();
  }

  /** Compatibility input entry point; E starts holding, no random-key challenge. */
  handleDrinkInput(
    inputKey: string,
    playerId = this.localPlayerId,
  ): { success: boolean; finished: boolean; choked: boolean } {
    const participant = [...this.roster.teamA.throwers, ...this.roster.teamB.throwers].find(
      (player) => player.id === playerId && player.isHuman,
    );
    if (!participant) return { success: false, finished: false, choked: false };
    if (this.isMultiplayer && !this.isHost) {
      if (inputKey.toUpperCase() === 'E') this.setPlayerDrinking(true);
      return { success: false, finished: false, choked: false };
    }
    if (this.isStopActive && (this.phase === 'bot_turn' || this.phase === 'aiming')) {
      this.roster.applyPenalty(participant.team, 0.2);
      this.callbacks?.onChokeSfx?.();
      this.toast('⚠️ KARNIAK! +20% PIWA ZA PICIE PO KOMENDZIE STOP!');
      return { success: false, finished: false, choked: false };
    }
    if (this.phase !== (participant.team === 'A' ? 'player_drinking' : 'bot_drinking'))
      return { success: false, finished: false, choked: false };
    if (this.chokeTimer > 0) return { success: false, finished: false, choked: true };

    const success = inputKey.toUpperCase() === 'E';
    if (success) this.setDrinkingFor(playerId, true);
    return { success, finished: false, choked: false };
  }

  stopMatch(): void {
    this.phase = 'idle';
    this.isCharging = false;
    this.isChugging = false;
    this.chokeTimer = 0;
    this.isStopActive = false;
    this.drinkingPlayers.clear();
    this.lockedAim = undefined;
    this.resetCan();
    this.releaseParticipants();
    this.projectileMesh.visible = false;
    this.aiming.hideTrajectory();
    this.throwHand.root.visible = false;
  }

  releaseParticipants(): void {
    for (const restore of this.restoreSkinVisibility.values()) restore();
    this.restoreSkinVisibility.clear();
    for (const pose of this.throwPoses.values()) pose.dispose();
    this.throwPoses.clear();
    for (const [id, actor] of this.actors) {
      if (this.borrowedActors.has(id)) {
        delete actor.root.userData.flankiTarget;
        delete actor.root.userData.flankiActive;
        delete actor.root.userData.flankiRouted;
        delete actor.root.userData.flankiName;
        delete actor.root.userData.flankiFacing;
        delete actor.root.userData.flankiStalled;
        this.actors.delete(id);
      } else actor.root.visible = false;
    }
    this.borrowedActors.clear();
  }

  startCharge(cameraOrigin?: THREE.Vector3, direction?: THREE.Vector3): void {
    if (this.phase === 'aiming' && this.isLocalTurn() && !this.isCharging) {
      this.isCharging = true;
      this.chargeTimer = 0;
      this.throwPower = 0.05;
      this.lockedAim = direction ? this.arcDirection(direction, cameraOrigin) : undefined;
      if (cameraOrigin && this.lockedAim)
        this.suggestedPower = flankiSuggestedPower(
          this.throwOrigin(cameraOrigin, this.lockedAim),
          this.lockedAim,
          this.canPosition,
        );
    }
  }

  setPlayerDrinking(isDrinking: boolean): void {
    const wasDrinking = this.isChugging;
    this.isChugging =
      isDrinking &&
      !this.isLocalRunner() &&
      this.isDrinkingPhase() &&
      this.roster.getCurrentThrower().team === this.localTeam;
    if (this.isHost) this.setDrinkingFor(this.localPlayerId, this.isChugging);
    else this.callbacks?.onSendMultiplayerAction?.('flanki:drink', { held: this.isChugging });
    if (this.isChugging && !wasDrinking) {
      this.callbacks?.onDrinkSfx?.();
    }
  }

  private setDrinkingFor(id: string, held: boolean) {
    const participant = this.roster.getAttackingThrowers().find((p) => p.id === id && p.isHuman);
    if (held && participant && this.isDrinkingPhase()) this.drinkingPlayers.set(id, 0.5);
    else this.drinkingPlayers.delete(id);
  }

  /** Aktualizuje łuk trajektorii balistycznej w czasie celowania */
  updateAimPreview(cameraOrigin: THREE.Vector3, direction?: THREE.Vector3): void {
    if (this.phase !== 'aiming') {
      this.aiming.hideTrajectory();
      return;
    }
    const aim =
      this.lockedAim ??
      this.arcDirection(direction ?? this.canPosition.clone().sub(cameraOrigin).normalize(), cameraOrigin);
    const origin = this.throwOrigin(cameraOrigin, aim);
    if (!this.isCharging) this.suggestedPower = flankiSuggestedPower(origin, aim, this.canPosition);
    const power = this.isCharging ? this.effectivePower(this.throwPower) : this.suggestedPower;
    const launchVel = flankiThrowVelocity(aim, power, 0);
    this.aiming.updateTrajectoryMesh(
      origin,
      launchVel,
      this.canPosition.y + FLANKI_BALL_RADIUS,
      Math.abs(power - this.suggestedPower) <= 0.06 ? 0.75 : power > this.suggestedPower ? 1 : 0,
    );
  }

  private throwOrigin(origin: THREE.Vector3, direction: THREE.Vector3) {
    return origin
      .clone()
      .addScaledVector(direction, 0.45)
      .add(new THREE.Vector3(0, -0.2, 0));
  }
  private effectivePower(power: number) {
    return THREE.MathUtils.clamp(power, 0.05, 1);
  }
  private arcDirection(direction: THREE.Vector3, _origin?: THREE.Vector3) {
    void _origin;
    const arc = flankiArcDirection(direction);
    const sway = flankiSway(this.aimSeconds);
    arc.applyAxisAngle(new THREE.Vector3(0, 1, 0), sway.yaw);
    const right = new THREE.Vector3().crossVectors(arc, new THREE.Vector3(0, 1, 0)).normalize();
    arc.applyAxisAngle(right, sway.pitch);
    return arc;
  }

  /** Zwalnia ładowanie i wyrzuca piłeczkę tenisową */
  releaseThrow(cameraOrigin: THREE.Vector3, cameraDirection: THREE.Vector3): boolean {
    if (this.phase !== 'aiming' || !this.isCharging || !this.isLocalTurn()) return false;

    this.isCharging = false;
    this.aiming.hideTrajectory();

    const aim = this.lockedAim ?? this.arcDirection(cameraDirection, cameraOrigin);
    if (!this.lockedAim)
      this.suggestedPower = flankiSuggestedPower(this.throwOrigin(cameraOrigin, aim), aim, this.canPosition);
    const power = this.effectivePower(this.throwPower);
    this.phase = 'projectile_flying';

    this.projectilePos.copy(this.throwOrigin(cameraOrigin, aim));
    this.projectileMesh.position.copy(this.projectilePos);
    this.projectileMesh.visible = true;

    // Prędkość z FlankiAiming
    const launchVel = flankiThrowVelocity(aim, power, 0);
    this.projectileVel.copy(launchVel);
    this.animateThrow(this.localPlayerId);
    this.lockedAim = undefined;
    this.physicsAccumulator = this.flightSeconds = 0;
    this.projectileRot.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);

    this.callbacks?.onThrowSfx?.();
    const isSweet = this.aiming.isSweetSpot(power);
    const sweetTxt = isSweet ? ' [🎯 IDEALNA SIŁA!]' : '';
    this.toast(`🎾 Rzut piłeczką! (Siła: ${Math.round(power * 100)}%)${sweetTxt}`);

    if (this.isMultiplayer) {
      this.callbacks?.onSendMultiplayerAction?.('flanki:throw', {
        power,
        origin: [cameraOrigin.x, cameraOrigin.y, cameraOrigin.z],
        direction: aim.toArray(),
        swaySeconds: 0,
      });
    }

    return true;
  }

  standUpCanByPlayer(): boolean {
    if (!this.canLocalRunnerMove()) return false;
    if (!this.isHost) {
      this.callbacks?.onSendMultiplayerAction?.('flanki:pickup', {});
      return true;
    }
    return this.runnerFor(this.localTeam).pickUpCan();
  }

  private resetCan(): void {
    this.canRoot.rotation.set(0, 0, 0);
    const offset = this.canRoot.name === 'Flanki_Can' && (this.canRoot as any).isMesh ? 0.084 : 0;
    this.canRoot.position.set(this.canPosition.x, this.canPosition.y + offset, this.canPosition.z);
    if (this.phase === 'idle' || this.phase === 'game_over') {
      this.canInteractionHitbox.userData.interaction = {
        kind: 'flanki',
        label: 'Zagraj we Flanki (Bierball) [E]',
      };
    }
  }

  private tipOverCan(notifyRemote = true): void {
    // Fall away from the ball's impact rather than always in the same direction.
    this.canRoot.rotation.set(Math.PI / 2, Math.atan2(this.projectileVel.x, this.projectileVel.z), 0);
    this.canRoot.position.set(this.canPosition.x, this.canPosition.y + 0.033, this.canPosition.z);
    this.canInteractionHitbox.userData.interaction = {
      kind: 'flanki_can',
      label: 'Postaw puszkę! [E]',
    };
    if (notifyRemote) this.callbacks?.onHitSfx?.();
  }

  private handleCanRighted(): void {
    this.resetCan();
    this.toast('Puszka postawiona! Biegacz wraca za linię!');
  }

  private handleStopCalled(runnerName: string): void {
    this.isChugging = false;
    this.drinkingPlayers.clear();
    this.isStopActive = true;
    this.stopBannerTimer = 1.6;
    this.stopBannerText = `🛑 STOP! (${runnerName})`;
    this.callbacks?.onStopSfx?.();
    this.toast(`🛑 STOP! ${runnerName} przekroczył linię drużyny! Koniec picia!`);

    if (this.roster.isGameOver()) {
      const winner = this.roster.getWinner();
      this.phase = 'game_over';
      const winToast = winner === 'A' ? '🏆 TWOJA DRUŻYNA WYGRAŁA WE FLANKI!' : '🍺 DRUŻYNA B WYGRAŁA MECZ!';
      this.toast(winToast);
      if (winner === 'A') this.callbacks?.onVictory?.();
      return;
    }

    // Przejście do kolejnego rzucającego
    const nextThrower = this.roster.advanceTurn();
    if (nextThrower.id === this.localPlayerId) {
      this.phase = 'aiming';
      this.toast(`Twoja kolej na rzut!`);
    } else {
      this.phase = 'bot_turn';
      this.botTurnTimer = 1.3;
      this.toast(
        `Rzut wykonuje: ${nextThrower.name} (${nextThrower.team === 'A' ? 'Drużyna A' : 'Drużyna B'})`,
      );
    }
  }

  private toast(msg: string): void {
    this.callbacks?.onToast?.(msg);
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.updateSimulation(dt);
    if (this.isMultiplayer && this.isHost && this.phase !== 'idle') {
      this.snapshotTimer += dt;
      if (this.snapshotTimer >= 0.1) {
        this.snapshotTimer %= 0.1;
        this.publishSnapshot();
      }
    }
  }

  private updateSimulation(dt: number): void {
    if (this.phase === 'aiming' && !this.isCharging) this.aimSeconds += dt;
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.inputTimer = Math.max(0, this.inputTimer - dt);
    if (this.isChugging && this.isHost) this.setDrinkingFor(this.localPlayerId, true);
    if (this.isChugging && !this.isHost && this.inputTimer <= 0) {
      this.callbacks?.onSendMultiplayerAction?.('flanki:drink', { held: true });
      this.inputTimer = 0.15;
    }
    for (const [id, actor] of this.actors) {
      if (this.phase === 'idle' || this.phase === 'game_over') continue;
      const runner =
        id === this.runnerA.id ? this.runnerA : id === this.runnerB.id ? this.runnerB : undefined;
      const running =
        this.isMultiplayer && !this.isHost
          ? runner?.mesh?.userData.networkRunning === true
          : runner?.getState() === 'running_to_can' || runner?.getState() === 'running_back';
      const pose = this.throwPoses.get(id);
      pose?.restore();
      actor.animator?.play(running ? 'Run' : 'Idle');
      actor.animator?.setMovementSpeed(running ? 8.5 : 0);
      actor.animator?.update(dt);
      pose?.update(dt);
      if (!running && !runner?.isRunning()) {
        const target = actor.root.userData.flankiTarget as THREE.Vector3 | undefined;
        if (target) actor.root.position.copy(target);
        this.faceCan(actor.root);
      }
      actor.groundFeet();
    }
    if (this.phase === 'idle' || this.phase === 'game_over') return;
    if (this.isMultiplayer && !this.isHost) {
      for (const runner of [this.runnerA, this.runnerB]) {
        const target = this.remoteRunnerTargets.get(runner.team);
        if (target && runner.mesh) {
          const delta = target.clone().sub(runner.mesh.position);
          if (Math.hypot(delta.x, delta.z) > 0.02) runner.mesh.rotation.y = Math.atan2(delta.x, delta.z);
          runner.mesh.position.lerp(target, 1 - Math.exp(-20 * dt));
        }
      }
      if (this.phase === 'aiming' && this.isCharging) {
        this.chargeTimer += dt;
        this.throwPower = Math.min(1, 0.05 + this.chargeTimer * 0.5);
      }
      return;
    }

    if (this.chokeTimer > 0) {
      this.chokeTimer = Math.max(0, this.chokeTimer - dt);
    }

    if (this.stopBannerTimer > 0) {
      this.stopBannerTimer = Math.max(0, this.stopBannerTimer - dt);
      if (this.stopBannerTimer <= 0) {
        this.isStopActive = false;
      }
    }

    if (this.phase === 'player_drinking' && this.runnerB.getState() === 'idle_at_base') {
      this.runnerB.startRun(this.canPosition);
    }
    if (this.phase === 'bot_drinking' && this.runnerA.getState() === 'idle_at_base') {
      this.runnerA.startRun(this.canPosition);
    }

    // Aktualizacja sterowników obu biegaczy
    if (!this.roster.teamA.runner.isHuman) this.runnerA.update(dt);
    if (!this.roster.teamB.runner.isHuman) this.runnerB.update(dt);

    // 1. Ładowanie siły rzutu piłki
    if (this.phase === 'aiming' && this.isCharging) {
      this.chargeTimer += dt;
      // Oscylacja wskaźnika siły 0.15 .. 1.0 z wyraźnym sweet-spotem
      this.throwPower = Math.min(1, 0.05 + this.chargeTimer * 0.5);
    }

    // 2. Lot piłeczki tenisowej
    if (this.phase === 'projectile_flying') {
      this.physicsAccumulator += Math.min(dt, 2);
      while (this.physicsAccumulator + 1e-9 >= FLANKI_PHYSICS_STEP) {
        this.physicsAccumulator -= FLANKI_PHYSICS_STEP;
        this.flightSeconds += FLANKI_PHYSICS_STEP;
        const previous = this.projectilePos.clone();
        stepFlankiBall(this.projectilePos, this.projectileVel, FLANKI_PHYSICS_STEP);
        if (flankiHitsCan(previous, this.projectilePos, this.canPosition)) {
          this.projectileMesh.visible = false;
          this.tipOverCan();
          const thrower = this.roster.getCurrentThrower();
          this.phase = thrower.team === 'A' ? 'player_drinking' : 'bot_drinking';
          const runner = thrower.team === 'A' ? this.runnerB : this.runnerA;
          runner.startRun(this.canPosition);
          this.callbacks?.onDrinkSfx?.();
          this.toast(`🎯 TRAFIENIE! ${runner.name} biegnie postawić puszkę!`);
          return;
        }
        const floor = terrainHeight(this.projectilePos.x, this.projectilePos.z) + FLANKI_BALL_RADIUS;
        if (this.projectilePos.y < floor && this.projectileVel.y < 0) {
          this.projectilePos.y = floor;
          this.projectileVel.y *= -0.55;
          this.projectileVel.x *= 0.76;
          this.projectileVel.z *= 0.76;
        }
        if (
          this.flightSeconds >= 4 ||
          this.projectileVel.length() < 0.8 ||
          this.projectilePos.distanceTo(this.canPosition) > 25
        ) {
          this.projectileMesh.visible = false;
          this.toast('💨 PUDŁO!');
          const next = this.roster.advanceTurn();
          this.phase = next.id === this.localPlayerId ? 'aiming' : 'bot_turn';
          this.botTurnTimer = 1.3;
          return;
        }
      }
      this.projectileMesh.position.copy(this.projectilePos);
      this.projectileMesh.rotation.x += this.projectileRot.x * dt;
      this.projectileMesh.rotation.y += this.projectileRot.y * dt;
    }

    // 3. Faza picia gracza (Drużyna A pije, Biegacz B sprintuje)
    if (this.phase === 'player_drinking') {
      this.consumeTeamBeer('A', dt);
      if (this.roster.isTeamFinished('A')) {
        this.phase = 'game_over';
        this.toast('🏆 WYGRAŁEŚ WE FLANKI! Mistrzowie festivalu!');
        this.callbacks?.onVictory?.();
        return;
      }
    }

    // 4. Faza picia bota (Drużyna B pije, Biegacz A sprintuje)
    if (this.phase === 'bot_drinking') {
      this.consumeTeamBeer('B', dt);
      if (this.roster.isTeamFinished('B')) {
        this.phase = 'game_over';
        this.toast('🍺 PRZEGRANA! Rywale opróżnili puszki jako pierwsi!');
        return;
      }
    }

    // 5. Tura bota (wykonanie rzutu przez bota)
    if (this.phase === 'bot_turn') {
      if (this.roster.getCurrentThrower().isHuman) return;
      this.botTurnTimer -= dt;
      if (this.botTurnTimer > 0 && this.botTurnTimer <= 0.28)
        this.animateThrow(this.roster.getCurrentThrower().id, false);
      if (this.botTurnTimer <= 0) {
        const currentThrower = this.roster.getCurrentThrower();
        const actor = this.actors.get(currentThrower.id);
        this.animateThrow(currentThrower.id);
        const origin =
          actor?.root.position.clone() ??
          new THREE.Vector3(0, 0, currentThrower.team === 'A' ? this.playerLineZ : this.botLineZ);
        origin.y += 1.3;
        const target = this.canPosition.clone().add(new THREE.Vector3(0, 0.084, 0));
        // Default spread is ~34 cm total, not 90 cm around a 6.6 cm can.
        target.x += (Math.random() - 0.5) * (1 - THREE.MathUtils.clamp(this.botAccuracy, 0, 1)) * 0.75;
        const duration = Math.hypot(target.x - origin.x, target.z - origin.z) / 12;
        this.projectilePos.copy(origin);
        this.projectileVel.copy(target.sub(origin).divideScalar(duration));
        this.projectileVel.y += 0.5 * this.aiming.gravity * duration;
        this.projectileMesh.position.copy(origin);
        this.projectileMesh.visible = true;
        this.projectileRot.set(4, 6, 2);
        this.physicsAccumulator = this.flightSeconds = 0;
        this.phase = 'projectile_flying';
        this.callbacks?.onThrowSfx?.();
      }
    }
  }

  private consumeTeamBeer(teamId: 'A' | 'B', dt: number) {
    const team = teamId === 'A' ? this.roster.teamA : this.roster.teamB;
    for (const player of team.throwers) {
      const holdTime = this.drinkingPlayers.get(player.id) ?? 0;
      if (!player.isHuman || holdTime > 0)
        player.beerRemaining = Math.max(
          0,
          player.beerRemaining -
            this.drinkRate *
              (!player.isHuman || player.id === this.localPlayerId ? dt : Math.min(dt, holdTime)),
        );
    }
    for (const [id, ttl] of this.drinkingPlayers) {
      if (ttl <= dt) this.drinkingPlayers.delete(id);
      else this.drinkingPlayers.set(id, ttl - dt);
    }
  }

  getHudState(): FlankiHudState {
    let prompt = '';
    const currentThrower = this.roster.getCurrentThrower();
    const defendingRunner = this.roster.getDefendingRunner();

    switch (this.phase) {
      case 'idle':
        prompt = 'Naciśnij [E], aby zagrać w Flanki';
        break;
      case 'aiming':
        prompt = this.isCharging
          ? `Moc: ${Math.round(this.throwPower * 100)}%. Zalecana: ${Math.round(this.suggestedPower * 100)}% ±6. Puść LPM / Spację, gdy łuk jest zielony.`
          : 'Najpierw wyceluj łukiem. Przytrzymaj LPM / Spację, aby zablokować trajektorię i wybrać siłę.';
        break;
      case 'projectile_flying':
        prompt = 'Piłka w locie ku puszce!';
        break;
      case 'player_drinking':
        prompt =
          this.chokeTimer > 0
            ? '💥 ZAKRZTUSIŁEŚ SIĘ! Piana! Odczekaj chwilę...'
            : `🍻 Przytrzymaj [E], aby pić. Puść, aby przerwać. Biegacz ${defendingRunner.name} wraca po puszkę.`;
        break;
      case 'bot_turn':
        prompt = `${currentThrower.name} (${currentThrower.team === 'A' ? 'Twoja Ekipa' : 'Rywale'}) przymierza się do rzutu...`;
        break;
      case 'bot_drinking':
        prompt = `⚠️ ${defendingRunner.name} sprintuje postawić puszkę! Po powrocie krzyczy STOP!`;
        break;
      case 'game_over':
        prompt =
          this.roster.getWinner() === this.localTeam
            ? '🏆 WYGRANA TWOJEJ EKIPY!'
            : '🍺 PRZEGRANA — RYWALE LEPSI!';
        break;
    }
    if (this.canLocalRunnerMove())
      prompt = this.isCanUpright()
        ? 'Puszka postawiona! Wróć za swoją linię — wtedy STOP.'
        : 'Jesteś biegaczem! Podbiegnij do puszki i naciśnij [E], aby ją postawić.';

    return {
      active: this.phase !== 'idle',
      phase: this.phase,
      playerBeer: this.localTeam === 'A' ? this.getPlayerBeer() : this.getBotBeer(),
      botBeer: this.localTeam === 'A' ? this.getBotBeer() : this.getPlayerBeer(),
      throwPower: this.throwPower,
      recommendedPower: this.suggestedPower,
      isCharging: this.isCharging,
      isChugging: this.isChugging,
      promptText: prompt,
      qteSequence: undefined,
      isChoking: this.chokeTimer > 0,
      isMultiplayer: this.isMultiplayer,
      opponentName: this.opponentName,
      activeThrowerName: currentThrower.name,
      activeThrowerTeam: currentThrower.team,
      localTeam: this.localTeam,
      defendingRunnerName: defendingRunner.name,
      isStopActive: this.isStopActive,
      stopBannerText: this.stopBannerText,
      isSweetSpot: Math.abs(this.throwPower - this.suggestedPower) <= 0.06,
    };
  }

  dispose(): void {
    this.stopMatch();
    this.throwHand.dispose();
    for (const actor of this.actors.values()) {
      actor.dispose();
    }
    this.actors.clear();
    this.sharedCanVisual?.removeFromParent();
    this.aiming.dispose();
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
    this.root.clear();
  }
}
