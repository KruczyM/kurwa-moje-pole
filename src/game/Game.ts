import { FestivalMap } from './ui/FestivalMap';
import { browserGraphicsProfile, savedMobileQuality, isMobileQuality } from './rendering/graphicsProfile';
import { DistanceVisibility } from './rendering/DistanceVisibility';
import { StageLiveScreens } from './world/StageLiveScreens';
import * as THREE from 'three';
import { AssetLoader } from './assets/AssetLoader';
import { characterAssets, effectAssets, festivalNpcAssets, musicAsset } from './assets/assetManifest';
import { CampWorld, WORLD_LIMIT, terrainHeight } from './world/CampWorld';
import { PlayerController } from './player/PlayerController';
import { isMobileInputDevice, MobileControls } from './player/MobileControls';
import { NpcManager } from './npc/NpcManager';
import { NPC_NAVIGATION_CELL_SIZE, NPC_NAVIGATION_RADIUS, NpcNavigationGrid } from './npc/NpcNavigationGrid';
import { NpcDebugOverlay, isNpcDebugAllowed } from './npc/NpcDebugOverlay';
import { EffectManager, EffectId, VisualSettings } from './effects/EffectManager';
import { InteractionManager } from './interactions/InteractionManager';
import { SpeakerAudio } from './audio/SpeakerAudio';
import { audioPerceptionAt } from './audio/AudioPerception';
import { CampAmbientAudio } from './audio/CampAmbientAudio';
import { GrzybekWaterAudio } from './audio/GrzybekWaterAudio';
import { InspectableItemId, itemById } from './interactions/itemConfig';
import { ItemInspectController } from './interactions/ItemInspectController';
import { AppState, AppStateMachine, escapeTarget, isStageAudioEnabled } from './lifecycle/AppStateMachine';
import { EventScope } from './lifecycle/EventScope';
import { shouldAdvancePausedSharedWorld } from './lifecycle/sharedWorldPolicy';
import { disposeObjectTree } from './lifecycle/disposeThree';
import { AnimationLoop } from './lifecycle/AnimationLoop';
import { MushroomWireframeEffect } from './effects/MushroomWireframeEffect';
import { MatrixRainOverlay } from './effects/MatrixRainOverlay';
import { MatrixWireframeEffect } from './effects/MatrixWireframeEffect';
import { MatrixPhaseController } from './effects/MatrixPhaseController';
import { VoiceReactionManager } from './audio/VoiceReactionManager';
import { POINTER_LOCK_ESCAPE_SUPPRESSION_MS, PointerLockPauseGate } from './lifecycle/PointerLockPauseGate';
import { controlHintForState, interactionControlHint, resolveGameInput } from './lifecycle/InputBindings';
import {
  ConsumableInventory,
  DEFAULT_STARTER_INVENTORY,
  inventoryEffects,
} from './inventory/ConsumableInventory';
import { ItemUseSequence } from './interactions/ItemUseSequence';
import { itemUseSequenceConfig } from './interactions/itemUseSequenceConfig';
import { ItemUseSfxPlayer } from './audio/ItemUseSfx';
import { SeatController, type SeatPose } from './interactions/SeatController';
import { configureColorPipeline } from './rendering/colorPipeline';
import { RemotePlayersManager } from './network/RemotePlayersManager';
import type { NetworkClient } from './network/NetworkClient';
import type { FlankiLobbyState } from './network/flankiProtocol';
import { UIManager } from './ui/UIManager';
import { SpatialVoiceManager, type MicState } from './audio/SpatialVoiceManager';
import { NpcVoiceCoordinator } from './npc/NpcVoiceCoordinator';
import { FestivalPassport } from './interactions/FestivalPassport';
import { FestivalBingo } from './interactions/FestivalBingo';
import { NpcRelationships } from './npc/NpcRelationships';
import { NpcBranchingDialogue } from './npc/NpcBranchingDialogue';
import { PatrolQuiz } from './interactions/PatrolQuiz';
import { CanCollector } from './interactions/CanCollector';
import { ECO_DURATION_SECONDS, type EcoPoint } from './interactions/ecoChallenge';
import { CampfireGuitarGame } from './interactions/CampfireGuitarGame';
import { WheelRideController } from './world/WheelRideController';
import { SpatialStageAcoustics } from './audio/SpatialStageAcoustics';
import { ConcertLibrary } from './audio/ConcertLibrary';
import { ConcertState } from './npc/ConcertState';

/** Zwraca wymagany element interfejsu i zachowuje jego typ TypeScript. */
const qs = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
type PendingItemUse = {
  effect: EffectId;
  source: 'world' | 'inventory';
  itemId?: InspectableItemId;
  committed: boolean;
};

type PendingWarningItem = {
  id: EffectId;
  source: PendingItemUse['source'];
  itemId?: InspectableItemId;
};

import {
  SettingsService,
  INTENSE_EFFECTS,
  isIntenseEffect,
  detectSystemReducedMotion,
  loadVisualSettings,
  AudioSettings,
  defaultAudioSettings,
  loadAudioSettings,
} from './services/SettingsService';

export {
  SettingsService,
  INTENSE_EFFECTS,
  isIntenseEffect,
  detectSystemReducedMotion,
  loadVisualSettings,
  type AudioSettings,
  defaultAudioSettings,
  loadAudioSettings,
};

export class Game {
  readonly canvas = qs<HTMLCanvasElement>('#game');
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500);
  readonly clock = new THREE.Clock();
  readonly speakerAudio = new SpeakerAudio(musicAsset);
  readonly campAmbient = new CampAmbientAudio();
  readonly grzybekAudio = new GrzybekWaterAudio();
  readonly voiceReactions = new VoiceReactionManager();
  player?: PlayerController;
  world?: CampWorld;
  npcs?: NpcManager;
  npcDebugOverlay?: NpcDebugOverlay;
  remotePlayersManager?: RemotePlayersManager;
  spatialVoice?: SpatialVoiceManager;
  npcVoiceCoordinator?: NpcVoiceCoordinator;
  effects?: EffectManager;
  interactions?: InteractionManager;
  toiletTimer = 0;
  private networkSyncTimer = 0;
  readonly settingsService = new SettingsService();
  get settings(): VisualSettings {
    return this.settingsService.visual;
  }
  get audioSettings(): AudioSettings {
    return this.settingsService.audio;
  }
  private propModels = new Map<string, THREE.Object3D>();
  private readonly inspectController = new ItemInspectController({
    getPropModel: (id) => this.propModels.get(id),
  });
  readonly ui = new UIManager();
  festivalMap: FestivalMap | null = null;
  private stageLiveScreens?: StageLiveScreens;
  private events = new EventScope();
  private unsubscribeState: () => void;
  private flankiNetworkCleanup: (() => void)[] = [];
  private ecoMode: 'solo' | 'race' | null = null;
  private ecoRoundId = '';
  private ecoBest = 0;
  private activeFlankiSession = '';
  private lastFlankiPhase = 'idle';
  private started = false;
  private disposed = false;
  private animationLoop = new AnimationLoop(() => this.updateFrame());
  private mushroomWireframe = new MushroomWireframeEffect(this.scene);
  private matrixRain = new MatrixRainOverlay('#matrix-rain', {
    quality: this.settings.matrixQuality,
  });
  private matrixWireframe = new MatrixWireframeEffect(this.scene);
  private matrixController = new MatrixPhaseController(this.settings.matrixMode);
  private speakerReactionPlayed = false;
  private pointerLockPause = new PointerLockPauseGate();
  private readonly mobileInput = isMobileInputDevice();
  private graphics = browserGraphicsProfile(savedMobileQuality());
  private distanceVisibility?: DistanceVisibility;
  private contextLost = false;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private viewportDpr = 0;
  private mobileControls?: MobileControls;
  private readonly inventory = new ConsumableInventory(DEFAULT_STARTER_INVENTORY);
  private useSequence?: ItemUseSequence;
  private itemUseSfx?: ItemUseSfxPlayer;
  private seatController?: SeatController;
  private pendingItemUse?: PendingItemUse;
  private pendingWarningItem?: PendingWarningItem;
  readonly passport = new FestivalPassport({
    onStampAwarded: (stamp) => {
      this.toast(`🏆 Nowa pieczątka w Paszporcie: ${stamp.icon} ${stamp.title}!`);
    },
  });
  readonly bingo = new FestivalBingo({
    passport: this.passport,
    onSquareChecked: (square) => {
      this.toast(`🎯 Bingo zaliczone: ${square.label}!`);
    },
    onBingo: () => {
      this.toast('🎉 BINGO! Ukończono linię w festiwalowym Bingo!');
    },
  });
  readonly relationships = new NpcRelationships();
  readonly branchingDialogue = new NpcBranchingDialogue(this.relationships);
  readonly patrolQuiz = new PatrolQuiz({
    passport: this.passport,
    onQuizCompleted: (score) => {
      if (score.passed) {
        this.bingo.checkSquare('quiz');
        this.toast(`🎉 Egzamin Patrolu zdany! Wynik: ${score.correct}/${score.total}`);
      }
    },
  });
  readonly canCollector = new CanCollector({
    minigameOnly: true,
    onCanRemoved: (id) => this.world?.removeCanObject(id),
    passport: this.passport,
    onBadgeAwarded: (badge) => {
      this.bingo.checkSquare('puszki');
      this.toast(`🏆 Odznaka „${badge}” odblokowana!`);
    },
    onCanSpawned: (can) => {
      this.world?.respawnCanObject(can);
    },
    onCanCollected: (can) => {
      if (can.label.startsWith('Eko-Sprint')) this.toast('Eko-Sprint! +35% szybkości przez 12 sekund.');
      if (this.ecoMode !== 'race' || this.networkClient?.ecoState?.phase !== 'playing') return;
      const roundId = this.ecoRoundId;
      void this.networkClient
        .requestEco('collect', { roundId, canId: can.id, generation: can.generation ?? 0 })
        .then((accepted) => {
          if (!accepted && this.ecoRoundId === roundId) {
            this.canCollector.restoreRejectedPickup(can.id);
            this.toast('Serwer nie potwierdził zebrania. Spróbuj ponownie.');
          }
        });
    },
    onGoldenCanCollected: () => {
      this.toast('⭐ ZŁOTA PUSZKA WOODSTOCK 1995! (+5 puszek & +35% sprint)');
    },
    onRushFinished: (res) => {
      if (this.ecoMode === 'solo') {
        this.ecoBest = Math.max(this.ecoBest, res.totalCollected);
        try {
          localStorage.setItem('eco-best-v1', String(this.ecoBest));
        } catch {
          /* Storage optional. */
        }
      }
      this.toast(res.message);
    },
  });
  campfireGuitarGame = new CampfireGuitarGame();
  readonly concertState = new ConcertState();
  readonly concertLibrary = new ConcertLibrary();
  readonly stageAcoustics = new SpatialStageAcoustics();
  wheelRideController?: WheelRideController;
  private landmarkCheckTimer = 0;
  constructor(
    readonly state: AppStateMachine,
    readonly networkClient?: NetworkClient,
  ) {
    this.scene.add(this.camera);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    } catch {
      throw new Error('Ta przeglądarka nie obsługuje WebGL.');
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.graphics.dprCap));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    configureColorPipeline(this.renderer, 'world');
    this.scene.background = new THREE.Color(0x9bb9d0);
    this.scene.fog = new THREE.Fog(0x8da1b5, 100, 380);
    this.events.listen(window, 'resize', () => this.resize());
    this.events.listen(this.canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      if (this.disposed) return;
      this.contextLost = true;
      this.animationLoop.stop();
      this.state.transition('error');
      const message = qs('#load-error');
      message.textContent =
        'Telefon utracił kontekst grafiki WebGL. Zamknij inne ciężkie karty i spróbuj ponownie w trybie Oszczędnym.';
      message.hidden = false;
    });
    const quality = document.querySelector<HTMLSelectElement>('#setting-mobile-quality');
    if (quality) {
      quality.value = savedMobileQuality();
      this.events.listen(quality, 'change', () => {
        if (!isMobileQuality(quality.value)) return;
        try {
          localStorage.setItem('festival-mobile-quality', quality.value);
        } catch {
          /* Optional preference. */
        }
        this.graphics = browserGraphicsProfile(quality.value);
        this.distanceVisibility?.setProfile(this.graphics);
        if (this.npcs) this.npcs.visibility.profile = this.graphics;
        if (this.remotePlayersManager) this.remotePlayersManager.visibility.profile = this.graphics;
        this.world?.setShadowResolution(this.graphics.shadowMapSize);
        this.stageLiveScreens?.setQuality(this.graphics.tvFeedWidth, this.graphics.tvFeedFps);
        if (this.effects) this.effects.bloomResolutionScale = this.graphics.bloomScale;
        this.resize(true);
      });
    }
    if (window.visualViewport) this.events.listen(window.visualViewport, 'resize', () => this.resize());
    this.events.listen(window, 'keydown', (event) => this.key(event as KeyboardEvent));
    this.events.listen(window, 'keyup', (event) => this.keyUp(event as KeyboardEvent));
    this.events.listen(this.canvas, 'pointerdown', (event) => this.pointerDown(event as PointerEvent));
    this.events.listen(window, 'pointerup', (event) => this.pointerUp(event as PointerEvent));
    this.events.listen(document, 'pointerlockchange', () => this.pointerLockChanged());
    this.settingsService.onVisualChange((visual) => {
      this.effects?.setSettings(visual);
      if (this.world && visual.grassQuality) this.world.setGrassQuality(visual.grassQuality);
      if (visual.matrixMode) this.matrixController.setMode(visual.matrixMode);
      if (visual.matrixQuality) this.matrixRain.setQuality(visual.matrixQuality);
      this.syncSettingsUi();
    });
    this.unsubscribeState = this.state.subscribe(({ to }) => this.syncState(to));
    this.speakerAudio.setUserVolume(this.audioSettings.speakerVolume);
    this.campAmbient.setVolume(this.audioSettings.ambientVolume);
    this.grzybekAudio.setVolume(this.audioSettings.ambientVolume);
    this.syncSettingsUi();
    this.syncInventoryUi();
    this.ui.initLsdOverlays(effectAssets.lsdOverlays[0], effectAssets.lsdOverlays[1]);
    const mapCanvas =
      typeof document !== 'undefined'
        ? document.querySelector<HTMLCanvasElement>('#festival-map-canvas')
        : null;
    this.festivalMap = new FestivalMap(mapCanvas);
    void this.festivalMap
      .loadBlenderReference()
      .catch(() => this.toast('Nie udało się załadować rzutu mapy z Blendera.'));
    this.ui.initMapControls(
      this.festivalMap,
      () => (this.player ? { x: this.player.camera.position.x, z: this.player.camera.position.z } : null),
      () => this.toggleMap(false),
    );
    this.syncState(this.state.current);
  }

  get paused() {
    return this.state.current === 'paused';
  }

  /** Ładuje zasoby, buduje wszystkie systemy sceny i uruchamia główną pętlę gry. */
  async start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.voiceReactions.playGameEntry();
    const text = qs('#load-text'),
      error = qs('#load-error');
    error.hidden = true;
    error.textContent = '';
    try {
      const loader = new AssetLoader(
        (message) => (text.textContent = message),
        (message) => {
          error.textContent = message;
          error.hidden = false;
        },
      );
      const assets = await loader.loadAll();
      if (this.disposed) return;
      if (this.contextLost) throw new Error('WebGL utracony podczas ładowania modeli.');
      if (assets.characters.size === 0)
        throw new Error('Nie udało się załadować żadnej postaci. Sprawdź Git LFS i pliki game-assets.');
      assets.interactables.forEach((asset, id) => this.propModels.set(id, asset.scene));
      this.world = new CampWorld(this.scene, assets);
      this.world.setShadowResolution(this.graphics.shadowMapSize);
      if (this.graphics.mobile)
        this.distanceVisibility = new DistanceVisibility(this.world.authoredRoot, this.graphics);
      try {
        this.ecoBest = Math.max(0, Number(localStorage.getItem('eco-best-v1')) || 0);
      } catch {
        /* Storage optional. */
      }
      for (const can of this.canCollector.getAllCans()) {
        if (can.collected) this.world.removeCanObject(can.id);
        else this.world.respawnCanObject(can);
      }
      if (this.networkClient)
        this.flankiNetworkCleanup.push(
          this.networkClient.onEcoState((eco) => {
            const member = eco?.players.some((p) => p.id === this.networkClient?.getMyPlayerId());
            if (eco?.phase === 'playing' && member && eco.id !== this.ecoRoundId) {
              this.ecoRoundId = eco.id;
              this.beginEcoRound(
                eco.seed,
                eco.pool,
                Math.max(0, (eco.endsAt - eco.serverNow) / 1000),
                'race',
              );
            } else if (this.ecoMode === 'race' && (!member || eco?.phase === 'finished')) {
              this.canCollector.stopRush();
              if (!member) this.ecoMode = null;
            }
          }),
        );
      this.stageLiveScreens = new StageLiveScreens(this.scene, this.world.mapScenery);
      this.stageLiveScreens.setQuality(this.graphics.tvFeedWidth, this.graphics.tvFeedFps);
      this.stageLiveScreens.renderScope = (render) => {
        const roots = [
          ...(this.npcs?.npcs.filter((npc) => !npc.isHidden).map((npc) => npc.root) ?? []),
          ...Array.from(this.remotePlayersManager?.remotePlayers.values() ?? []).map((entity) => entity.root),
        ];
        const visibility = roots.map((root) => root.visible);
        roots.forEach((root) => {
          root.visible = true;
        });
        try {
          if (this.distanceVisibility) this.distanceVisibility.withFullVisibility(render);
          else render();
        } finally {
          roots.forEach((root, index) => {
            root.visible = visibility[index];
          });
        }
      };
      const audioStage = this.world.mapScenery.find((item) => item.id === 'Main_Stage_Deck_Plinth');
      if (audioStage) this.stageAcoustics.setStagePosition(audioStage);
      this.syncStageAudio();
      this.stageLiveScreens.setVideoPlaylist(this.stageAcoustics);
      this.festivalMap?.setAuthoredLayout(this.world.mapScenery);
      this.world.setGrassQuality(this.settings.grassQuality);
      const npcNavigation = new NpcNavigationGrid(
        {
          minX: -WORLD_LIMIT + NPC_NAVIGATION_RADIUS,
          maxX: WORLD_LIMIT - NPC_NAVIGATION_RADIUS,
          minZ: -WORLD_LIMIT + NPC_NAVIGATION_RADIUS,
          maxZ: WORLD_LIMIT - NPC_NAVIGATION_RADIUS,
        },
        NPC_NAVIGATION_CELL_SIZE,
        (x, z) => this.world!.canMove(x, z, NPC_NAVIGATION_RADIUS),
      );
      this.npcs = new NpcManager(
        this.scene,
        assets.characters,
        assets.speaker,
        npcNavigation,
        undefined,
        Math.floor(Math.random() * 0x100000000),
      );
      this.remotePlayersManager = new RemotePlayersManager(this.scene, assets.characters, this.networkClient);
      this.npcs.visibility.profile = this.graphics;
      this.remotePlayersManager.visibility.profile = this.graphics;
      this.npcs.setFestivalLayout(this.world.mapScenery);
      if (isNpcDebugAllowed() && this.world) {
        this.npcDebugOverlay = new NpcDebugOverlay({
          scene: this.scene,
          world: this.world,
          npcManager: this.npcs,
        });
      }
      this.player = new PlayerController(
        this.camera,
        this.canvas,
        (x, z) => this.world!.canMove(x, z),
        !this.mobileInput,
        this.world.getPlayerSpawn(),
      );
      if (this.mobileInput) {
        this.mobileControls = new MobileControls(qs('#mobile-controls'), {
          move: (forward, right, run) => this.player?.setMobileMove(forward, right, run),
          look: (deltaX, deltaY) => this.player?.lookBy(deltaX, deltaY),
          interact: () => this.interact(),
          press: (key) =>
            this.key(new KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : 'KeyE' })),
          release: (key) =>
            this.keyUp(new KeyboardEvent('keyup', { key, code: key === ' ' ? 'Space' : 'KeyE' })),
          menu: () => this.setPause(true),
          inventory: () => this.toggleInventory(),
        });
        this.mobileControls.setState(this.state.current);
      }
      this.effects = new EffectManager(this.renderer, this.scene, this.camera, this.speakerAudio);
      this.effects.bloomResolutionScale = this.graphics.bloomScale;
      this.effects.resize(innerWidth, innerHeight);
      this.effects.setSettings(this.settings);
      this.interactions = new InteractionManager(this.camera, () => [
        ...(this.npcs!.speakerAnchor ? [this.npcs!.speakerAnchor] : []),
        ...this.npcs!.npcs.map((npc) => npc.root),
        ...this.world!.interactables.map((item) => item.object),
      ]);
      const selectedName =
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('camp-player-character') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('camp-player-character') : null);
      const selectedAsset = characterAssets.find((asset) => asset.name === selectedName);
      const selectedCharacter =
        (selectedAsset ? assets.characters.get(selectedAsset.id) : undefined) ??
        assets.characters.values().next().value;
      if (selectedCharacter) this.stageLiveScreens?.setLocalAvatar(selectedCharacter);
      this.useSequence = new ItemUseSequence(
        this.scene,
        this.camera,
        selectedCharacter,
        this.propModels,
        (x, z) => this.world!.canMove(x, z),
      );
      this.seatController = new SeatController(this.scene, this.camera, selectedCharacter);
      this.itemUseSfx = new ItemUseSfxPlayer();
      if (this.world.flankiGame) {
        this.world.flankiGame.setCallbacks({
          onToast: (msg) => this.toast(msg),
          onVictory: () => {
            this.passport.awardStamp('flanki_player');
            this.bingo.checkSquare('flanki');
          },
          onDrinkSfx: () => {
            this.itemUseSfx?.play('swallow');
          },
          onThrowSfx: () => {
            this.itemUseSfx?.play('beer_open');
          },
          onHitSfx: () => {
            this.itemUseSfx?.play('beer_open');
          },
          onChokeSfx: () => {
            this.voiceReactions.playToilet();
          },
          onSendMultiplayerAction: (action, payload) => {
            if (this.networkClient?.isOnline()) {
              this.networkClient.sendFlankiAction(action, payload);
            }
          },
        });
      }
      this.campfireGuitarGame.setCallbacks({
        onToast: (msg) => this.toast(msg),
        onSongFinished: (stats) => {
          if (stats.accuracyPercent >= 60) {
            this.passport.recordEvent('campfire_guitar');
            this.toast(`🎉 Brawo! Odblokowano pieczątkę „Bard Ogniska” (${stats.finalScore} pkt)!`);
          }
        },
        onCrowdCheerSfx: () => {
          this.toast('🔥 Ognisko szaleje z zachwytu!');
        },
      });
      if (this.networkClient) {
        this.flankiNetworkCleanup.push(
          this.networkClient.onError((error) => {
            if (error.code === 'UNAUTHORIZED') this.toast(error.message);
          }),
          this.networkClient.onFlankiLobby((lobby) => this.syncFlankiLobby(lobby)),
          this.networkClient.onFlankiAction((event) => {
            if (event.sessionId === this.activeFlankiSession)
              this.world?.flankiGame?.handleNetworkAction(
                event.action,
                event.payload,
                event.playerId,
                event.sessionId,
              );
          }),
        );
      }
      this.ui.populateMotionSelect(this.seatController.animationNames);
      this.campAmbient.start();
      this.grzybekAudio.init();
      // Every visit starts silent, even if the last session persisted speakerEnabled=true.
      // Only an explicit interaction with the camp speaker may start this music.
      this.updateAudioSettings({ speakerEnabled: false });

      // Przestrzenny czat głosowy WebRTC:
      this.spatialVoice = new SpatialVoiceManager(this.networkClient, {
        userVolume: 1.0,
        onMicStateChange: (micState) => this.syncMicUi(micState),
      });
      this.syncMicUi(this.spatialVoice.getMicState());
      const micBtn = document.querySelector<HTMLButtonElement>('#voice-mic-toggle');
      if (micBtn) {
        micBtn.onclick = () => {
          this.spatialVoice?.toggleMute();
        };
      }
      void this.spatialVoice.requestMicrophone();

      // Koordynator rozmów głosowych z botami NPC:
      this.npcVoiceCoordinator = new NpcVoiceCoordinator(this.npcs!, {
        dialogRoot: qs('#dialog'),
        nameElement: qs('#dialog-name'),
        textElement: qs('#dialog-text'),
        voiceStatusElement: qs('#dialog-voice-status'),
        textInputElement: document.querySelector('#dialog-text-input') as HTMLInputElement | undefined,
        sendButton: document.querySelector('#dialog-send-btn') as HTMLButtonElement | undefined,
        micButton: document.querySelector('#dialog-mic-btn') as HTMLButtonElement | undefined,
        replayButton: document.querySelector('#dialog-replay-btn') as HTMLButtonElement | undefined,
        geminiButton: document.querySelector('#dialog-gemini-btn') as HTMLButtonElement | undefined,
        geminiConfigElement: document.querySelector('#dialog-gemini-config') as HTMLElement | undefined,
        geminiInputElement: document.querySelector('#dialog-gemini-key-input') as
          HTMLInputElement | undefined,
        geminiSaveButton: document.querySelector('#dialog-gemini-save-btn') as HTMLButtonElement | undefined,
        geminiClearButton: document.querySelector('#dialog-gemini-clear-btn') as
          HTMLButtonElement | undefined,
        geminiCloseButton: document.querySelector('#dialog-gemini-close-btn') as
          HTMLButtonElement | undefined,
        geminiStatusElement: document.querySelector('#dialog-gemini-status') as HTMLElement | undefined,
        elevenLabsInputElement: document.querySelector('#dialog-elevenlabs-key-input') as
          HTMLInputElement | undefined,
        elevenLabsSaveButton: document.querySelector('#dialog-elevenlabs-save-btn') as
          HTMLButtonElement | undefined,
        elevenLabsClearButton: document.querySelector('#dialog-elevenlabs-clear-btn') as
          HTMLButtonElement | undefined,
        elevenLabsStatusElement: document.querySelector('#dialog-elevenlabs-status') as
          HTMLElement | undefined,
        choicesContainer: document.querySelector('#dialog-choices') as HTMLElement | undefined,
        branchingDialogue: this.branchingDialogue,
        patrolQuiz: this.patrolQuiz,
      });

      // Kontroler przejażdżki kołem widokowym:
      const wheel = this.world.getWheel();
      if (wheel && this.player) {
        this.wheelRideController = new WheelRideController(wheel, this.camera, this.player, {
          onFade: (showing) => this.ui.setFade(showing),
          onStateChange: (state) => {
            if (state === 'riding') {
              this.toast('Przejażdżka kołem! Rozglądaj się myszką. [E] — opuść kabinę na dole.');
            } else if (state === 'idle') {
              this.passport.recordEvent('ferris_wheel');
              this.bingo.checkSquare('mlyn');
            }
          },
        });
      }

      const progressBar =
        typeof document !== 'undefined' ? document.querySelector<HTMLDivElement>('#load-progress-bar') : null;
      const skipCrowdBtn =
        typeof document !== 'undefined' ? document.querySelector<HTMLButtonElement>('#skip-crowd-btn') : null;

      let skippedCrowd = false;
      if (skipCrowdBtn) {
        skipCrowdBtn.hidden = false;
        skipCrowdBtn.onclick = () => {
          skippedCrowd = true;
          skipCrowdBtn.hidden = true;
          this.toast('Pominięto ładowanie — tłum wczyta się w tle.');
        };
      }

      if (this.settings.preloadCrowd !== false && !this.graphics.mobile) {
        text.textContent = `Wczytywanie postaci festiwalowiczów (0/${festivalNpcAssets.length})…`;
        if (progressBar) progressBar.style.width = '20%';
        await loader.loadFestivalNpcs(
          (asset, model) => this.npcs?.addFestivalNpc(asset, model) ?? false,
          () => this.disposed || skippedCrowd,
          (loaded, total, name) => {
            if (this.disposed || skippedCrowd) return;
            const percent = 20 + Math.round((loaded / total) * 60);
            if (progressBar) progressBar.style.width = `${percent}%`;
            text.textContent = `Wczytywanie festiwalowiczów (${loaded}/${total}): ${name}`;
          },
          4,
        );
      }

      if (skipCrowdBtn) skipCrowdBtn.hidden = true;
      if (progressBar) progressBar.style.width = '85%';
      text.textContent = 'Rozgrzewka grafiki i shaderów…';
      await this.warmUpGpu();
      if (this.contextLost) throw new Error('WebGL utracony podczas przygotowania grafiki.');
      if (progressBar) progressBar.style.width = '100%';

      this.startLoop();
      this.state.transition('playing');

      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('camp-free-camera') === '1') {
        sessionStorage.removeItem('camp-free-camera');
        this.toggleFreeCamera(true);
      }

      if (skippedCrowd || this.settings.preloadCrowd === false || this.graphics.mobile) {
        this.toast('Festiwalowicze doczytują się w tle: pod dużą sceną i na obu pasażach.');
        void loader
          .loadFestivalNpcs(
            (asset, model) => this.npcs?.addFestivalNpc(asset, model) ?? false,
            () => this.disposed,
          )
          .then((result) => {
            if (!this.disposed) {
              console.info('Festiwalowicze (tło):', result);
              this.toast(
                `Festiwalowicze: ${result.loaded}/${result.total}${result.failed ? ' — część modeli nie została wczytana' : ' — tłum gotowy'}`,
              );
            }
          })
          .catch((cause) => {
            if (!this.disposed) console.error('Ładowanie festiwalowiczów przerwane:', cause);
          });
      } else {
        const loadedCount = this.npcs?.npcs.length ?? 0;
        this.toast(`Obóz i festiwalowicze gotowi (${loadedCount} postaci). Miłej zabawy!`);
      }
    } catch (cause) {
      if (this.disposed) return;
      error.textContent = `Nie udało się uruchomić gry: ${cause instanceof Error ? cause.message : String(cause)}`;
      error.hidden = false;
      this.state.transition('error');
    }
  }

  private syncMicUi(state: MicState) {
    const icon = document.querySelector<HTMLSpanElement>('#voice-mic-icon');
    const text = document.querySelector<HTMLSpanElement>('#voice-mic-text');
    const btn = document.querySelector<HTMLButtonElement>('#voice-mic-toggle');
    if (!icon || !text || !btn) return;

    btn.className = `voice-mic-btn ${state}`;
    switch (state) {
      case 'active':
        icon.textContent = '🎤';
        text.textContent = 'Mikrofon: Włączony [V]';
        break;
      case 'muted':
        icon.textContent = '🔇';
        text.textContent = 'Mikrofon: Wyciszony [V]';
        break;
      case 'requesting':
        icon.textContent = '⏳';
        text.textContent = 'Łączenie mikrofonu...';
        break;
      case 'denied':
        icon.textContent = '🚫';
        text.textContent = 'Mikrofon: Zablokowany';
        break;
      case 'unsupported':
        icon.textContent = '⚠️';
        text.textContent = 'Brak mikrofonu';
        break;
      default:
        icon.textContent = '🎤';
        text.textContent = 'Mikrofon: Wyłączony';
        break;
    }
  }

  /** Obsługuje globalne skróty Escape, Tab, E oraz Ctrl+K zgodnie ze stanem gry. */
  private key(event: KeyboardEvent) {
    if (this.disposed) return;
    if (this.ui.isEcoPanelOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeEcoPanel();
      }
      return;
    }
    const keyLower = event.key.toLowerCase();
    if (
      (keyLower === 'v' || keyLower === 'u') &&
      (this.state.current === 'playing' || this.state.current === 'seated')
    ) {
      this.spatialVoice?.toggleMute();
      return;
    }
    if (
      (event.key === 'h' || event.key === 'H' || event.key === 'F1') &&
      (this.state.current === 'playing' || this.state.current === 'seated' || this.ui.isGuideOpen())
    ) {
      event.preventDefault();
      this.toggleGuide();
      return;
    }
    if (
      (event.key === 'm' || event.key === 'M') &&
      (this.state.current === 'playing' || this.state.current === 'seated' || this.ui.isMapOpen())
    ) {
      event.preventDefault();
      this.toggleMap();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.toggleFreeCamera();
      return;
    }
    const activeFlanki = this.world?.flankiGame;
    if ((this.ui.isGuideOpen() || this.ui.isMapOpen()) && ['e', ' '].includes(event.key.toLowerCase()))
      return;
    if (
      event.key.toLowerCase() === 'e' &&
      this.state.current === 'playing' &&
      activeFlanki &&
      !this.ui.isFlankiRosterOpen() &&
      !['idle', 'game_over'].includes(activeFlanki.getPhase())
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) {
        if (activeFlanki.canLocalRunnerMove()) {
          activeFlanki.updateLocalRunnerPosition(this.camera.position);
          activeFlanki.standUpCanByPlayer();
        } else activeFlanki.setPlayerDrinking(true);
      }
      return;
    }
    if (this.campfireGuitarGame && this.campfireGuitarGame.getPhase() === 'playing') {
      const k = event.key.toLowerCase();
      let lane = -1;
      if (k === 'd' || k === '1') lane = 0;
      else if (k === 'f' || k === '2') lane = 1;
      else if (k === 'j' || k === '3') lane = 2;
      else if (k === 'k' || k === '4') lane = 3;

      if (lane >= 0) {
        event.preventDefault();
        if (!event.repeat) this.campfireGuitarGame.hitLane(lane);
        return;
      }
    }
    if (this.campfireGuitarGame.getPhase() !== 'idle' && event.key !== 'Escape') return;
    if (event.code === 'Space' || event.key === ' ') {
      const flanki = this.world?.flankiGame;
      if (flanki && flanki.getPhase() !== 'idle') {
        const phase = flanki.getPhase();
        if (phase === 'aiming') {
          event.preventDefault();
          flanki.startCharge(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));
          return;
        }
      }
      if (
        this.state.current === 'playing' &&
        !this.ui.isMapOpen() &&
        !this.ui.isGuideOpen() &&
        !this.ui.isFlankiRosterOpen() &&
        (!flanki || ['idle', 'game_over'].includes(flanki.getPhase()))
      ) {
        event.preventDefault();
        if (!event.repeat && this.player?.requestJump()) {
          this.networkClient?.sendAction('jump');
          this.stageLiveScreens?.playLocalJump();
        }
        return;
      }
    }
    const action = resolveGameInput(this.state.current, event.key, event.repeat);
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'escape') {
      if (this.ui.isGuideOpen()) {
        this.toggleGuide(false);
        return;
      }
      if (this.ui.isMapOpen()) {
        this.toggleMap(false);
        return;
      }
      if (this.wheelRideController && !this.wheelRideController.isIdle()) {
        this.wheelRideController.cancelToGround();
        this.toast('Przerwano przejażdżkę kołem widokowym.');
        return;
      }
      if (this.ui.isFlankiRosterOpen()) {
        this.networkClient?.requestFlankiLobby('leave');
        this.ui.hideFlankiRoster();
        if (this.state.current === 'playing' && !this.mobileInput) {
          this.canvas.requestPointerLock?.().catch?.(() => undefined);
        }
        return;
      }
      if (this.world?.flankiGame && this.world.flankiGame.getPhase() !== 'idle') {
        if (this.activeFlankiSession) this.networkClient?.requestFlankiLobby('leave');
        this.world.flankiGame.stopMatch();
        this.toast('Mecz flanków przerwany.');
        if (this.player) this.player.setMovementLocked(false);
        return;
      }
      if (this.campfireGuitarGame && this.campfireGuitarGame.getPhase() !== 'idle') {
        this.campfireGuitarGame.stopSong();
        this.toast('Odłożono gitarę.');
        return;
      }
      const source = this.state.current;
      const menuEscape = source === 'playing' || source === 'paused';
      const target = escapeTarget(source);
      if (target) {
        // To samo Escape nie może zamknąć preview i chwilę później otworzyć pauzy.
        if (source === 'inspecting') {
          this.pointerLockPause.suppressLossesUntil(performance.now() + POINTER_LOCK_ESCAPE_SUPPRESSION_MS);
        }
        if (menuEscape) this.voiceReactions.playMenuEscape();
        this.closeCurrentState(target);
      }
      return;
    }
    if (action === 'toggle-inventory') {
      this.toggleInventory();
      return;
    }
    if (this.state.current === 'inventory') {
      const effectKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const effectIndex = effectKeys.indexOf(event.key);
      if (effectIndex >= 0 && effectIndex < inventoryEffects.length) {
        this.useInventoryEffect(inventoryEffects[effectIndex]);
        return;
      }
    }
    if (this.state.current === 'seated') this.leaveSeat();
    else if (this.state.current === 'inspecting') this.acceptInspect();
    else if (this.state.current === 'playing') this.interact();
  }

  private keyUp(event: KeyboardEvent) {
    if (this.disposed) return;
    if (event.key.toLowerCase() === 'e') this.world?.flankiGame?.setPlayerDrinking(false);
    if (event.code === 'Space' || event.key === ' ') {
      const flanki = this.world?.flankiGame;
      if (flanki) {
        const phase = flanki.getPhase();
        if (phase === 'aiming') {
          const dir = this.camera.getWorldDirection(new THREE.Vector3());
          flanki.releaseThrow(this.camera.position, dir);
        }
      }
    }
  }

  private pointerDown(event: PointerEvent) {
    if (this.disposed || event.button !== 0) return;
    if (this.ui.isGuideOpen() || this.ui.isMapOpen()) return;
    if (this.state.current !== 'playing') return;
    const flanki = this.world?.flankiGame;
    if (!flanki) return;
    const phase = flanki.getPhase();
    if (phase === 'aiming') {
      flanki.startCharge(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));
    }
  }

  private pointerUp(event: PointerEvent) {
    if (this.disposed || event.button !== 0) return;
    const flanki = this.world?.flankiGame;
    if (!flanki) return;
    const phase = flanki.getPhase();
    if (phase === 'aiming') {
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      flanki.releaseThrow(this.camera.position, dir);
    }
  }

  /** Sprząta bieżący modal i przechodzi do wskazanego stanu. */
  private closeCurrentState(target: AppState) {
    if (this.state.current === 'seated' && target === 'playing') {
      this.leaveSeat();
      return;
    }
    if (this.state.current === 'seated') this.seatController?.stop();
    if (this.state.current === 'inspecting') {
      this.voiceReactions.playInspectCancel();
      this.inspectController.close();
    }
    if (this.state.current === 'using-item') {
      this.useSequence?.cancel();
      this.pendingItemUse = undefined;
    }
    if (this.state.current === 'dialog') {
      this.npcVoiceCoordinator?.endConversation();
    }
    if (this.state.current === 'effect-warning') {
      this.pendingWarningItem = undefined;
    }
    this.state.transition(target);
  }

  /** Przełącza tryb swobodnej kamery 3D do inspekcji i obserwacji terenu festiwalu. */
  toggleFreeCamera(force?: boolean): boolean {
    if (!this.player) return false;
    const next = force !== undefined ? force : !this.player.isFreeCamera();
    this.player.setFreeCamera(next);
    if (next) {
      this.toast('Swobodna kamera: WSAD ruch 3D, Spacja/C góra/dół, Shift turbo, Rolka prędkość.');
    } else {
      this.toast('Powrót do trybu postaci.');
    }
    this.syncFreeCameraHud(next);
    return next;
  }

  private syncFreeCameraHud(active: boolean) {
    this.ui.setFreeCameraBadge(active);
  }

  /** Otwiera pauzę wyłącznie po rzeczywistej utracie wcześniej uzyskanego pointer lock. */
  private closeEcoPanel() {
    this.ui.setEcoPanelOpen(false);
    if (this.state.current === 'playing') this.player?.requestPointerLock();
  }

  private ecoSpawnPool(): EcoPoint[] {
    const pool: EcoPoint[] = [];
    const add = (x: number, z: number) => {
      if (
        pool.length < 240 &&
        Math.abs(x) <= 290 &&
        Math.abs(z) <= 170 &&
        this.world?.canMove(x, z, 0.7) &&
        !pool.some((p) => p.x === x && p.z === z)
      )
        pool.push({ x, z });
    };
    for (const road of this.world?.mapScenery.filter((p) => /^Road_/.test(p.id)) ?? []) {
      for (let x = road.x - road.width / 2 + 7; x < road.x + road.width / 2 - 7; x += 14) {
        add(x, road.z - 2);
        add(x, road.z + 2);
      }
    }
    for (let x = -130; x <= 130; x += 26) for (let z = -130; z <= 130; z += 26) add(x, z);
    const stage = this.world?.mapScenery.find((p) => p.id === 'Main_Stage_Deck_Plinth');
    if (stage)
      for (let x = stage.x - 45; x <= stage.x - 20; x += 8)
        for (let z = stage.z - 16; z <= stage.z + 16; z += 8) add(x, z);
    return pool;
  }

  private beginEcoRound(seed: number, pool: EcoPoint[], seconds: number, mode: 'solo' | 'race') {
    for (const can of this.canCollector.getAllCans()) this.world?.removeCanObject(can.id);
    this.ecoMode = mode;
    this.canCollector.startEcoRound(seed, pool, seconds);
    this.ui.setEcoPanelOpen(false);
    this.toast('Eko-Rush: zbieraj śmieci [E]. Wyniki znajdziesz w Eko-Zagrodzie.');
  }

  private updateEcoPanel() {
    const network = this.networkClient,
      eco = network?.ecoState;
    const member = eco?.players.some((p) => p.id === network?.getMyPlayerId());
    const active = this.canCollector.isRushActive();
    const request = (operation: string, payload: Record<string, unknown> = {}) => {
      void network?.requestEco(operation, payload).then((ok) => {
        if (!ok)
          this.toast(
            'Nie potwierdzono operacji. Sprawdź połączenie i uruchom ponownie backend po aktualizacji.',
          );
      });
    };
    this.ui.updateEcoPanel(
      `Plecak: ${this.canCollector.getInventoryCount()} | Rekord solo: ${this.ecoBest} | ${active ? `Pozostało ${this.canCollector.getRushTimeRemaining()} s` : eco?.phase === 'lobby' ? `Lobby: ${eco.players.length}/16 graczy — gospodarz rozpoczyna` : eco?.phase === 'finished' ? 'Wyścig zakończony — poniżej wyniki końcowe' : 'Runda: 180 sekund'}`,
      eco?.players.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) ?? [
        { name: 'Twój wynik solo', score: this.canCollector.getRushStats().cansCollected },
      ],
      {
        deposit: {
          enabled: this.canCollector.getInventoryCount() > 0,
          run: () => this.toast(this.canCollector.depositCans(this.camera.position).message),
        },
        solo: {
          enabled: !active && !member,
          run: () => {
            const pool = this.ecoSpawnPool();
            if (pool.length < 48) {
              this.toast('Za mało bezpiecznych miejsc na śmieci.');
              return;
            }
            this.beginEcoRound(Math.floor(Math.random() * 0xffffffff), pool, ECO_DURATION_SECONDS, 'solo');
          },
        },
        create: {
          enabled: !!network?.isOnline() && !active && (!eco || eco.phase === 'finished'),
          run: () => request('create', { pool: this.ecoSpawnPool() }),
        },
        join: {
          enabled: !!network?.isOnline() && !active && eco?.phase === 'lobby' && !member,
          run: () => request('join'),
        },
        start: {
          enabled:
            eco?.phase === 'lobby' && eco.hostId === network?.getMyPlayerId() && eco.players.length >= 2,
          run: () => request('start'),
        },
        leave: { enabled: !!member, run: () => request('leave') },
        close: { enabled: true, run: () => this.closeEcoPanel() },
      },
    );
  }

  private pointerLockChanged() {
    if (this.disposed || this.state.current !== 'playing' || this.toiletTimer) return;
    if (
      this.ui.isEcoPanelOpen() ||
      this.ui.isMapOpen() ||
      this.ui.isGuideOpen() ||
      this.ui.isFlankiRosterOpen() ||
      this.campfireGuitarGame.getPhase() !== 'idle'
    )
      return;
    if (this.pointerLockPause.update(document.pointerLockElement === this.canvas))
      this.state.transition('paused');
  }

  /** Uruchamia kontekstową interakcję wskazaną przez InteractionManager. */
  interact() {
    if (this.state.current === 'seated') {
      this.leaveSeat();
      return;
    }
    if (this.state.current !== 'playing' || !this.interactions) return;
    if (this.campfireGuitarGame.getPhase() !== 'idle') return;
    if (this.ui.isFlankiRosterOpen() || this.ui.isEcoPanelOpen()) return;
    if (this.toiletTimer) {
      this.finishToilet();
      return;
    }
    const interaction = this.interactions.update();
    if (!interaction) return;
    if (interaction.kind === 'flanki') {
      if (this.world?.flankiGame) {
        const flanki = this.world.flankiGame;
        const phase = flanki.getPhase();
        if (phase === 'idle' || phase === 'game_over') {
          if (!(this.networkClient?.isOnline() && this.networkClient.supportsFlanki()))
            flanki.prepareOfflineLobby();
          if (this.npcs) flanki.enlistNearbyNpcs(this.npcs.reserveFlankiPlayers(flanki.canPosition));
          this.pointerLockPause.reset();
          if (document.pointerLockElement) document.exitPointerLock?.();
          if (this.networkClient?.isOnline() && this.networkClient.supportsFlanki()) {
            void this.networkClient.requestFlankiLobby('join').then((accepted) => {
              if (!accepted && !this.activeFlankiSession) flanki.stopMatch();
            });
            this.toast('Dołączanie do lobby Flanek…');
            return;
          }
          this.ui.showFlankiRoster(
            flanki.roster,
            () => {
              if (!flanki.arePlayersReady()) {
                this.toast('Poczekaj, aż zawodnicy podejdą na linie.');
                return false;
              }
              flanki.startMatch();
              this.positionPlayerForFlanki();
              if (!this.mobileInput) {
                this.canvas.requestPointerLock?.().catch?.(() => undefined);
              }
            },
            () => {
              flanki.stopMatch();
              if (!this.mobileInput) {
                this.canvas.requestPointerLock?.().catch?.(() => undefined);
              }
            },
            { onRunnerChange: (team, id) => flanki.selectRunner(team, id) },
          );
        }
      }
      return;
    }
    if (interaction.kind === 'flanki_can') {
      if (this.world?.flankiGame) {
        this.world.flankiGame.standUpCanByPlayer();
      }
      return;
    }
    if (interaction.kind === 'speaker') {
      if (!this.speakerReactionPlayed) {
        this.speakerReactionPlayed = true;
        this.voiceReactions.playFirstSpeaker();
      }
      this.speakerAudio.toggle().then((playing) => {
        this.updateAudioSettings({ speakerEnabled: playing });
        this.toast(playing ? 'Głośnik: muzyka włączona' : 'Głośnik: muzyka wyłączona');
      });
      return;
    }
    if (interaction.kind === 'toitoi_door') {
      const doorId = interaction.doorId;
      const controller = this.world?.infrastructure?.toiToiDoors;
      if (controller) {
        controller.toggle(doorId);
        const door = controller.getDoor(doorId);
        this.toast(door?.isOpen ? 'Drzwi toi-toia otwarte' : 'Drzwi toi-toia zamknięte');
      }
      return;
    }
    if (interaction.kind === 'ferris_wheel') {
      if (this.wheelRideController) {
        if (this.wheelRideController.isIdle()) {
          const started = this.wheelRideController.requestBoarding(false);
          if (started) {
            this.toast('Wejście zgłoszone — wsiądziesz podczas postoju dolnej kabiny.');
          } else {
            this.toast('Nie można teraz rozpocząć przejażdżki. Spróbuj ponownie przy wejściu.');
          }
        } else {
          this.wheelRideController.queueExit();
          this.toast('Zgłoszono wyjście z koła na najbliższej dolnej stacji.');
        }
      }
      return;
    }
    if (interaction.kind === 'campfire_guitar') {
      if (this.campfireGuitarGame) {
        if (this.campfireGuitarGame.getPhase() === 'idle') {
          this.campfireGuitarGame.openSongSelect();
          this.pointerLockPause.reset();
          if (document.pointerLockElement) document.exitPointerLock?.();
          this.player?.stop();
          this.toast('🎸 Gitara przy ognisku! Wybierz piosenkę i graj klawiszami [D, F, J, K].');
        }
      }
      return;
    }
    if (interaction.kind === 'clean_can') {
      const canId = interaction.canId;
      const collected = this.canCollector.collectCan(canId, this.camera.position);
      if (collected) {
        this.world?.removeCanObject(canId);
        const count = this.canCollector.getInventoryCount();
        this.toast(
          `${this.canCollector.getAllCans().find((c) => c.id === canId)?.label ?? 'Śmieć'} — plecak: ${count}${this.canCollector.getEcoWaveMultiplier() === 2 ? ' | EKO-FALA ×2!' : ''}`,
        );
        if (count >= 5) {
          this.bingo.checkSquare('puszki');
        }
      } else {
        this.toast('Puszka poza zasięgiem.');
      }
      return;
    }
    if (interaction.kind === 'clean_corral') {
      this.ui.setEcoPanelOpen(true);
      this.pointerLockPause.reset();
      document.exitPointerLock();
      this.player?.stop();
      this.updateEcoPanel();
      return;
    }
    if (interaction.kind === 'field_shower') {
      this.passport.recordEvent('water_refill');
      this.bingo.checkSquare('woda');
      this.toast('Orzeźwiający prysznic! Zmyłeś z siebie festiwalowy kurz i błoto.');
      return;
    }
    if (interaction.kind === 'toilet') {
      this.voiceReactions.playToilet();
      this.toiletTimer = 2;
      if (this.player) this.player.enabled = false;
      this.ui.setFade(true);
      this.toast('Chwila prywatności…');
      return;
    }
    if (interaction.kind === 'item') {
      this.inspect(interaction.itemId);
      return;
    }
    if (interaction.kind === 'seat' && this.seatController) {
      this.npcs?.vacateSeat(interaction.seatId);
      const pose: SeatPose = {
        seatId: interaction.seatId,
        position: interaction.position,
        rotationY: interaction.rotationY,
      };
      if (this.seatController.start(pose)) {
        this.interactions.clear();
        this.state.transition('seated');
        this.toast('Siedzisz. E lub Esc — wstań.');
      } else {
        this.toast('Ta postać nie ma poprawnej animacji siedzenia.');
      }
      return;
    }
    if (interaction.kind === 'npc') {
      this.state.transition('dialog');
      this.npcVoiceCoordinator?.startConversation(interaction.name, this.camera.position);
      return;
    }
  }

  /** Kończy animację siedzenia i wraca do sterowania pierwszoosobowego. */
  private leaveSeat() {
    if (this.state.current !== 'seated') return;
    this.seatController?.requestStop();
    if (!this.seatController?.active) this.state.transition('playing');
  }

  /** Preview gestures/rest with the existing avatar, camera and update loop. */
  performMotion(name: string) {
    if (this.state.current !== 'paused' || !this.seatController?.animationNames.includes(name)) return;
    const position = this.camera.position;
    if (!this.world?.canMove(position.x, position.z, 2)) {
      this.toast('Podejdź na wolne miejsce — animacja potrzebuje miejsca wokół postaci.');
      return;
    }
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    if (
      this.seatController.start(
        {
          seatId: 'player-motion',
          position: [position.x, terrainHeight(position.x, position.z), position.z],
          rotationY: Math.atan2(direction.x, direction.z),
        },
        name,
      )
    ) {
      this.state.transition('seated');
      this.toast('E lub Esc — zakończ animację; podczas odpoczynku najpierw wstaniesz.');
    }
  }

  /** Wypełnia opis przedmiotu i otwiera scenę jego inspekcji. */
  private inspect(id: string) {
    const item = itemById.get(id as InspectableItemId);
    if (!item || this.state.current !== 'playing') return;
    this.ui.openInspect(
      item.label,
      item.description,
      controlHintForState('inspecting', this.mobileInput ? 'mobile' : 'desktop'),
    );
    this.inspectController.show(id);
    this.state.transition('inspecting');
    this.voiceReactions.playInspectEnter();
  }

  /** Zamyka inspekcję bez użycia przedmiotu. */
  closeInspect() {
    if (this.state.current === 'inspecting') this.closeCurrentState('playing');
  }

  /** Kończy inspekcję i uruchamia efekt przypisany do przedmiotu. */
  acceptInspect() {
    const id = this.inspectController.activeItemId;
    if (this.state.current !== 'inspecting' || !id) return;
    const item = itemById.get(id as InspectableItemId);
    if (!item) return;
    if (!this.beginItemUse(item.effect, 'world', item.id)) return;
    this.interactions?.clear();
    this.inspectController.close();
  }

  /** Zabiera oglądany egzemplarz ze świata i dodaje go do pustego początkowo plecaka. */
  takeInspectedItem() {
    const id = this.inspectController.activeItemId;
    if (this.state.current !== 'inspecting' || !id) return;
    const item = itemById.get(id as InspectableItemId);
    if (!item || !this.world?.removeItem(item.id)) return;
    this.inventory.add(item.effect);
    this.interactions?.clear();
    this.inspectController.close();
    this.syncInventoryUi();
    this.state.transition('playing');
    this.toast(`${item.label}: dodano do ekwipunku`);
  }

  /** Uruchamia efekt wyłącznie wtedy, gdy plecak zawiera jego egzemplarz. */
  useInventoryEffect(id: EffectId) {
    if (this.state.current !== 'inventory') return false;
    if (this.inventory.quantity(id) < 1) {
      this.toast(`Brak w plecaku: ${id}`);
      return false;
    }
    return this.beginItemUse(id, 'inventory');
  }
  /** Przełącza pomiędzy rozgrywką i ekranem ekwipunku. */
  toggleInventory() {
    if (this.state.current === 'playing') {
      this.syncInventoryUi();
      this.state.transition('inventory');
    } else if (this.state.current === 'inventory') {
      this.state.transition('playing');
    }
  }
  /** Rozpoczyna transakcyjne użycie przedmiotu bez usuwania go przed markerem animacji. */
  private beginItemUse(id: EffectId, source: PendingItemUse['source'], itemId?: InspectableItemId) {
    if (!this.effects || !this.player || !this.useSequence) return false;
    if (this.state.current !== 'inspecting' && this.state.current !== 'inventory') return false;
    if (isIntenseEffect(id) && !localStorage.getItem('camp-effect-warning')) {
      this.pendingWarningItem = { id, source, itemId };
      this.state.transition('effect-warning');
      return true;
    }
    return this.executeItemUse(id, source, itemId);
  }

  /** Inicjalizuje sekwencję animacji użycia przedmiotu. */
  private executeItemUse(id: EffectId, source: PendingItemUse['source'], itemId?: InspectableItemId) {
    if (!this.effects || !this.player || !this.useSequence) return false;
    if (this.useSequence.active) {
      this.useSequence.cancel();
    }
    const started = this.useSequence.start(id, this.player.yaw);
    if (!started) {
      if (source === 'inventory') {
        if (!this.inventory.consume(id)) return false;
        this.syncInventoryUi();
      } else if (itemId) {
        this.world?.removeItem(itemId);
        this.interactions?.clear();
      }
      this.pendingItemUse = undefined;
      this.effects.use(id);
      this.voiceReactions.effectStarted(id);
      this.toast(`${id}: efekt uruchomiony`);
      if (this.state.current !== 'playing') {
        this.state.transition('playing');
      }
      return true;
    }
    this.pendingItemUse = { effect: id, source, itemId, committed: false };
    this.ui.setUseSequenceLabel(itemUseSequenceConfig[id].label);
    if (this.state.current !== 'using-item') {
      this.state.transition('using-item');
    }
    return true;
  }

  /** Potwierdza ostrzeżenie o intensywnych efektach z opcjonalnym trybem bezpiecznym. */
  confirmWarning(enableSafeMode: boolean) {
    if (this.state.current !== 'effect-warning') return;
    const item = this.pendingWarningItem;
    this.pendingWarningItem = undefined;

    const dontShowAgain = this.ui.isWarningDontShowAgainChecked();
    if (dontShowAgain) {
      localStorage.setItem('camp-effect-warning', '1');
    }

    if (enableSafeMode) {
      this.updateSettings({
        reduceMotion: true,
        limitSway: true,
        disableShake: true,
        disableBloom: true,
        disableFlashes: true,
        disableAberration: true,
        intensity: Math.min(this.settings.intensity, 0.5),
      });
      this.toast('Włączono tryb łagodny');
    }

    if (item) {
      this.executeItemUse(item.id, item.source, item.itemId);
    } else {
      this.state.transition('playing');
    }
  }

  /** Anuluje ostrzeżenie i wraca do rozgrywki bez użycia przedmiotu. */
  cancelWarning() {
    if (this.state.current !== 'effect-warning') return;
    this.pendingWarningItem = undefined;
    this.state.transition('playing');
  }

  /** Zużywa przedmiot i uruchamia efekt dokładnie na markerze animacji. */
  private commitItemUse() {
    const pending = this.pendingItemUse;
    if (!pending || pending.committed || !this.effects) return;
    if (pending.source === 'inventory') {
      if (!this.inventory.consume(pending.effect)) {
        this.cancelUseSequence();
        return;
      }
      this.syncInventoryUi();
    } else if (pending.itemId) {
      this.world?.removeItem(pending.itemId);
      this.interactions?.clear();
    }
    pending.committed = true;
    this.effects.use(pending.effect);
    this.voiceReactions.effectStarted(pending.effect);
    this.toast(`${pending.effect}: efekt uruchomiony`);
  }

  /** Przerywa aktywną sekwencję bez otwierania menu pauzy. */
  cancelUseSequence() {
    if (this.state.current !== 'using-item') return;
    this.useSequence?.cancel();
    this.pendingItemUse = undefined;
    this.state.transition('playing');
  }

  /** Odświeża liczniki oraz dostępność przycisków całego ekwipunku. */
  private syncInventoryUi() {
    this.ui.syncInventory(this.inventory);
  }
  /** Rozpoczyna kontrolowane wygaszanie aktywnego efektu. */
  cancelEffect() {
    this.effects?.cancel();
    this.toast('Efekt wygaszany');
  }
  /** Zamyka dialog NPC i wraca do rozgrywki. */
  closeDialog() {
    if (this.state.current === 'dialog') {
      this.npcVoiceCoordinator?.endConversation();
      this.state.transition('playing');
    }
  }
  /** Włącza albo wyłącza pauzę, o ile bieżący stan pozwala na przejście. */
  setPause(on: boolean) {
    if (on) this.world?.flankiGame?.cancelThrowCharge();
    if (on) this.world?.flankiGame?.setPlayerDrinking(false);
    if (on && this.state.current === 'playing') this.state.transition('paused');
    else if (!on && this.state.current === 'paused') this.state.transition('playing');
  }

  /** Zapisuje częściowe ustawienia wizualne i przekazuje je do EffectManagera oraz świata. */
  updateSettings(values: Partial<VisualSettings>) {
    this.settingsService.updateVisual(values);
  }

  /** Zapisuje częściowe ustawienia audio i natychmiast aktualizuje głośności głośnika i ambientu. */
  updateAudioSettings(values: Partial<AudioSettings>) {
    this.settingsService.updateAudio(values);
    if (typeof values.speakerVolume === 'number') {
      this.speakerAudio.setUserVolume(this.audioSettings.speakerVolume);
    }
    if (typeof values.ambientVolume === 'number') {
      this.syncStageAudio();
      this.campAmbient.setVolume(this.audioSettings.ambientVolume);
      this.grzybekAudio.setVolume(this.audioSettings.ambientVolume);
    }
    this.syncSettingsUi();
  }

  /** Odświeża kontrolki dostępności i audio na podstawie bieżących ustawień. */
  private syncSettingsUi() {
    this.ui.syncSettings(this.settings, this.audioSettings);
  }

  /** Synchronizuje HUD, modale, sterowanie graczem i pointer lock ze stanem aplikacji. */
  private syncStageAudio() {
    this.stageAcoustics.update(this.camera.position, this.player?.yaw ?? 0);
    this.stageAcoustics.setUserVolume(
      isStageAudioEnabled(this.state.current) ? this.audioSettings.ambientVolume : 0,
    );
  }

  private syncState(state: AppState) {
    this.syncStageAudio();
    this.ui.syncState(state, this.mobileInput);
    if (state === 'paused') {
      this.campAmbient.pause();
      this.grzybekAudio.pause();
    } else if (state === 'playing') {
      this.campAmbient.resume();
      this.grzybekAudio.resume();
    }
    this.mobileControls?.setState(state);
    if (this.player) {
      this.player.enabled = state === 'playing' && !this.toiletTimer;
      if (!this.player.enabled) this.player.stop();
    }
    if (state === 'playing') {
      this.pointerLockPause.reset();
      this.player?.requestPointerLock();
    } else if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    if (state === 'inspecting') {
      requestAnimationFrame(() => {
        if (!this.disposed && this.state.current === 'inspecting') this.inspectController.resize();
      });
    }
    if (state !== 'playing') {
      this.interactions?.clear();
    }
  }

  /** Prekompiluje shadery sceny oraz inicjalizuje tekstury na GPU, eliminując przycięcia klatek po starcie gry. */
  private async warmUpGpu() {
    try {
      this.scene.updateMatrixWorld(true);
      this.distanceVisibility?.update(1, this.camera.position);
      if (typeof this.renderer.compileAsync === 'function') {
        try {
          await this.renderer.compileAsync(this.scene, this.camera);
        } catch {
          this.renderer.compile(this.scene, this.camera);
        }
      } else if (typeof this.renderer.compile === 'function') {
        this.renderer.compile(this.scene, this.camera);
      }

      this.scene.traverseVisible((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of materials) {
            if (!mat) continue;
            const standard = mat as THREE.MeshStandardMaterial;
            if (standard.map && typeof this.renderer.initTexture === 'function') {
              try {
                this.renderer.initTexture(standard.map);
              } catch {
                // ignoruj brak wsparcia
              }
            }
            if (standard.normalMap && typeof this.renderer.initTexture === 'function') {
              try {
                this.renderer.initTexture(standard.normalMap);
              } catch {
                // ignoruj brak wsparcia
              }
            }
            if (standard.roughnessMap && typeof this.renderer.initTexture === 'function') {
              try {
                this.renderer.initTexture(standard.roughnessMap);
              } catch {
                // ignoruj brak wsparcia
              }
            }
          }
        }
      });
      this.effects?.warmUp();
    } catch (err) {
      console.warn('GPU warmup warning (non-fatal):', err);
    }
  }

  /** Uruchamia zegar Three.js oraz pojedynczą pętlę renderującą. */
  private startLoop() {
    this.clock.start();
    this.animationLoop.start();
  }

  /** Aktualizuje wszystkie systemy symulacji i renderuje jedną klatkę. */
  private updateFrame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05),
      state = this.state.current;
    if (state !== 'playing' && this.world?.flankiGame?.getHudState().isChugging)
      this.world.flankiGame.setPlayerDrinking(false);
    if (state !== 'paused' && state !== 'error') {
      if (this.toiletTimer && state === 'playing') {
        this.toiletTimer -= dt;
        if (this.toiletTimer <= 0) this.finishToilet();
      }
      if (state === 'playing') {
        if (this.world?.flankiGame && !['idle', 'game_over'].includes(this.world.flankiGame.getPhase()))
          this.player?.setMovementLocked(
            this.world.flankiGame.shouldLockPlayerMovement() || this.ui.isGuideOpen() || this.ui.isMapOpen(),
          );
        const speedBoost = this.canCollector.getSpeedBoostMultiplier();
        const baseMods = this.effects?.modifiers || { speed: 1, sway: 0, shake: 0, bob: 1 };
        const activeMods = speedBoost > 1.0 ? { ...baseMods, speed: baseMods.speed * speedBoost } : baseMods;
        this.player?.update(dt, activeMods);
        this.world?.flankiGame?.updateLocalRunnerPosition(this.camera.position);
        this.updateInteractionPrompt();
      }
      if (state === 'playing' || state === 'seated') {
        this.npcs?.update(dt, this.clock.elapsedTime, this.camera.position, this.speakerAudio.isPlaying);
      }
      if ((state === 'playing' || state === 'seated') && this.networkClient?.isOnline()) {
        this.networkSyncTimer += dt;
        if (this.networkSyncTimer >= 0.05) {
          this.networkSyncTimer = 0;
          const transform = this.player?.getTransform();
          if (transform) {
            this.networkClient.sendPlayerUpdate(transform);
          }
        }
      }
      this.remotePlayersManager?.update(dt, this.camera);
      if (this.spatialVoice && this.remotePlayersManager) {
        const remotePositions = new Map<string, { x: number; y: number; z: number }>();
        for (const [id, entity] of this.remotePlayersManager.remotePlayers) {
          remotePositions.set(id, entity.currentPosition);
        }
        const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.spatialVoice.update(this.camera.position, euler.y, remotePositions);
      }
      if (state === 'seated') {
        this.seatController?.update(dt);
        if (this.seatController?.finished) {
          this.seatController.stop();
          this.state.transition('playing');
        }
      }
      this.world?.update(
        this.clock.elapsedTime,
        this.camera.position,
        dt,
        this.wheelRideController?.shouldReduceMotion(this.settings.reduceMotion) ??
          this.settings.reduceMotion,
      );
      this.effects?.update(dt);
      const speakerPos = this.npcs?.getSpeakerWorldPosition();
      if (speakerPos) {
        this.speakerAudio.setSpeakerPosition(speakerPos);
      }
      this.speakerAudio.update(this.camera.position, dt);
      const perception = audioPerceptionAt(
        this.effects?.active ?? null,
        this.effects?.visualIntensity ?? 0,
        this.clock.elapsedTime,
        this.settings.reduceMotion,
      );
      this.speakerAudio.setPerception(perception);
      this.stageAcoustics.setPerception(perception);
      if (this.world?.infrastructure?.grzybekParticles) {
        this.grzybekAudio.update(this.camera.position.x, this.camera.position.z);
      }
      if (state === 'using-item') {
        const event = this.useSequence?.update(dt);
        if (event?.sfx) this.itemUseSfx?.play(event.sfx);
        if (event?.activateEffect) this.commitItemUse();
        if (event?.complete) {
          this.pendingItemUse = undefined;
          if (this.state.current === 'using-item') this.state.transition('playing');
        }
      }
      this.voiceReactions.update(dt, this.effects?.active || null, this.effects?.phase || 'inactive');
      // Material-swapping effects must never own the same meshes simultaneously.
      if (this.effects?.active === 'Grzyb') this.matrixWireframe.update(false, 0, false);
      this.mushroomWireframe.update(
        this.effects?.active === 'Grzyb',
        dt,
        this.effects?.visualIntensity || 0,
        this.effects?.settings.reduceMotion === true,
      );
      const isDrugActive = Boolean(this.effects?.active && this.effects?.phase !== 'inactive');
      const matrixAlpha = this.matrixController.update(
        dt,
        isDrugActive,
        this.effects?.visualIntensity ?? 1,
        this.settings.reduceMotion,
      );
      this.matrixRain.update(dt, matrixAlpha, this.settings.reduceMotion, this.settings.disableFlashes);
      this.matrixWireframe.update(
        this.matrixController.isWireframeEligible && this.effects?.active !== 'Grzyb',
        matrixAlpha,
        this.settings.reduceMotion,
      );
      if (state === 'inspecting') {
        this.inspectController.update(dt);
      }
    }
    if (state === 'paused' || state === 'error') {
      // A local overlay cannot pause the host's shared simulation or remote avatars.
      if (shouldAdvancePausedSharedWorld(state, this.networkClient?.isOnline() ?? false)) {
        this.npcs?.update(dt, this.clock.elapsedTime, this.camera.position, this.speakerAudio.isPlaying);
        this.remotePlayersManager?.update(dt, this.camera);
        this.world?.update(
          this.clock.elapsedTime,
          this.camera.position,
          dt,
          this.wheelRideController?.shouldReduceMotion(this.settings.reduceMotion) ??
            this.settings.reduceMotion,
        );
      }
      this.mushroomWireframe.update(false, 0, 0, false);
      this.matrixWireframe.update(false, 0, false);
    }
    this.npcDebugOverlay?.update(this.camera);
    this.distanceVisibility?.update(dt, this.camera.position);
    this.stageLiveScreens?.update(
      dt,
      this.renderer,
      this.camera,
      this.remotePlayersManager?.getPlayerMarkers() ?? [],
      this.networkClient?.isOnline() && this.player
        ? {
            id: this.networkClient?.getMyPlayerId() ?? 'local',
            name: 'Ty',
            x: this.camera.position.x,
            z: this.camera.position.z,
            yaw: this.player.yaw,
            y: this.player.isAirborne() ? this.camera.position.y - 1.9 : 0,
          }
        : undefined,
    );
    this.effects?.render();
    this.updateEffectHud();
    this.ui.updateFlankiHud(this.world?.flankiGame?.getHudState() ?? null);
    this.canCollector.update(dt);
    if (this.ui.isEcoPanelOpen()) this.updateEcoPanel();
    this.campfireGuitarGame.update(dt);
    this.ui.updateGuitarHud(
      this.campfireGuitarGame.getHudState(),
      (songId) => this.campfireGuitarGame.startSong(songId),
      (lane) => this.campfireGuitarGame.hitLane(lane),
      () => this.campfireGuitarGame.stopSong(),
    );
    this.ui.updateCanRushHud(
      this.canCollector.isRushActive(),
      this.canCollector.getRushTimeRemaining(),
      this.ecoMode === 'race'
        ? (this.networkClient?.ecoState?.players.find((p) => p.id === this.networkClient?.getMyPlayerId())
            ?.score ?? 0)
        : this.canCollector.getRushStats().cansCollected,
      [
        this.canCollector.getEcoWaveMultiplier() === 2 ? 'EKO-FALA ×2' : '',
        this.canCollector.getSpeedBoostRemaining() > 0
          ? `Sprint ${Math.ceil(this.canCollector.getSpeedBoostRemaining())} s`
          : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
    if (this.isMapOpen() && this.player) {
      const forwardDir = new THREE.Vector3();
      this.camera.getWorldDirection(forwardDir);
      this.festivalMap?.render(
        {
          x: this.player.camera.position.x,
          z: this.player.camera.position.z,
          yaw: this.player.yaw,
          dirX: forwardDir.x,
          dirZ: forwardDir.z,
        },
        this.remotePlayersManager?.getPlayerMarkers() ?? [],
        performance.now(),
        this.canCollector.getActiveCanMarkers(),
      );
    }
    if (this.world?.flankiGame) {
      const flankiPhase = this.world.flankiGame.getPhase();
      if (flankiPhase === 'game_over' && this.lastFlankiPhase !== 'game_over')
        this.world.flankiGame.releaseParticipants();
      this.lastFlankiPhase = flankiPhase;
      const shouldLockMove =
        this.ui.isEcoPanelOpen() ||
        this.ui.isFlankiRosterOpen() ||
        this.ui.isGuideOpen() ||
        this.ui.isMapOpen() ||
        this.campfireGuitarGame.getPhase() !== 'idle' ||
        this.world.flankiGame.shouldLockPlayerMovement() ||
        (this.wheelRideController !== undefined && !this.wheelRideController.isIdle());
      if (this.player && this.player.movementLocked !== shouldLockMove) {
        this.player.setMovementLocked(shouldLockMove);
      }
      this.world.flankiGame.updateThrowHand(this.camera);
      if (flankiPhase === 'aiming') {
        this.world.flankiGame.updateAimPreview(
          this.camera.position,
          this.camera.getWorldDirection(new THREE.Vector3()),
        );
      }
    }
    this.wheelRideController?.update(
      dt,
      this.wheelRideController.shouldReduceMotion(this.settings.reduceMotion),
    );
    if (state === 'playing') {
      this.landmarkCheckTimer += dt;
      if (this.landmarkCheckTimer >= 0.5) {
        this.landmarkCheckTimer = 0;
        const px = this.camera.position.x;
        const pz = this.camera.position.z;

        // Duża Scena (216, 18)
        const distStage = Math.hypot(px - 216, pz - 18);
        if (distStage < 45) {
          this.passport.recordEvent('main_stage');
          this.bingo.checkSquare('scena');
        }

        // ASP Namiot (-65, 97)
        const distAsp = Math.hypot(px - -65, pz - 97);
        if (distAsp < 30) {
          this.bingo.checkSquare('asp');
        }

        // Kąpiel Błotna (64, -12)
        const distMud = Math.hypot(px - 64, pz - -12);
        if (distMud < 14) {
          this.passport.recordEvent('mud_bath');
          this.bingo.checkSquare('bloto');
        }

        // Grzybek Wodny (160, -8)
        const distGrzybek = Math.hypot(px - 160, pz - -8);
        if (distGrzybek < 12) {
          this.passport.recordEvent('water_refill');
          this.bingo.checkSquare('woda');
        }

        // Obóz gracza (0, 0)
        const distCamp = Math.hypot(px, pz);
        if (distCamp < 12) {
          this.passport.recordEvent('tent_builder');
          this.bingo.checkSquare('namiot');
        }

        // Obliczenie parametrów akustycznych Dużej Sceny
        this.stageAcoustics.update(this.camera.position, this.player?.yaw ?? 0);
      }
    }
  }

  /** Buduje tekst podpowiedzi dla aktualnie wskazanego obiektu. */
  private updateInteractionPrompt() {
    const interaction = this.interactions?.update();
    if (!interaction) {
      this.ui.setInteractionPrompt(null);
      return;
    }
    const action =
      interaction.kind === 'flanki'
        ? 'Zagraj we Flanki'
        : interaction.kind === 'flanki_can'
          ? 'Postaw puszkę! [E]'
          : interaction.kind === 'campfire_guitar'
            ? 'Zagraj na gitarze przy ognisku [E]'
            : interaction.kind === 'ferris_wheel'
              ? 'Przejedź się kołem widokowym'
              : interaction.kind === 'clean_can'
                ? 'Podnieś puszkę'
                : interaction.kind === 'clean_corral'
                  ? this.canCollector.getInventoryCount() > 0
                    ? 'Oddaj puszki do Eko Zagrody [E]'
                    : 'Rozpocznij Eko-Rush Challenge [E]'
                  : interaction.kind === 'npc'
                    ? `Porozmawiaj z ${interaction.name}`
                    : interaction.kind === 'speaker'
                      ? 'Włącz / wyłącz muzykę'
                      : interaction.kind === 'item'
                        ? itemById.get(interaction.itemId)?.label || 'Obejrzyj przedmiot'
                        : interaction.kind === 'seat'
                          ? 'Usiądź na krześle'
                          : interaction.kind === 'toitoi_door'
                            ? this.world?.infrastructure?.toiToiDoors?.getDoor(interaction.doorId)?.label ||
                              'Otwórz / zamknij toi-toi'
                            : interaction.kind === 'field_shower'
                              ? 'Umyj się pod prysznicem'
                              : 'Wejdź do toi-toia';
    this.ui.setInteractionPrompt(interactionControlHint(action, this.mobileInput ? 'mobile' : 'desktop'));
  }

  /** Aktualizuje licznik efektu oraz nakładki LSD i papierosa. */
  private updateEffectHud() {
    this.ui.updateEffectHud(
      this.effects?.active || null,
      this.effects?.phase || 'inactive',
      this.effects?.remaining || 0,
      this.effects?.visualIntensity || 0,
      this.effects?.settings.reduceMotion === true,
    );
  }

  /** Kończy sekwencję toi-toia i przywraca sterowanie. */
  private finishToilet() {
    this.toiletTimer = 0;
    this.ui.setFade(false);
    if (this.player) {
      this.player.enabled = this.state.current === 'playing';
      this.player.requestPointerLock();
    }
    this.toast('Gotowe.');
  }

  /** Dopasowuje kamerę i postprocessing do aktualnego rozmiaru okna. */
  resize(force = false) {
    if (this.disposed) return;
    const dpr = Math.min(devicePixelRatio, this.graphics.dprCap);
    if (
      !force &&
      this.viewportWidth === innerWidth &&
      this.viewportHeight === innerHeight &&
      this.viewportDpr === dpr
    )
      return;
    this.viewportWidth = innerWidth;
    this.viewportHeight = innerHeight;
    this.viewportDpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.effects?.resize(innerWidth, innerHeight);
    this.matrixRain.resize(innerWidth, innerHeight);
    if (this.state.current === 'inspecting') this.inspectController.resize();
  }

  /** Pokazuje krótką wiadomość HUD i odnawia jej czas wygaszenia. */
  toast(message: string) {
    this.ui.showToast(message);
  }

  /** Deterministycznie zatrzymuje grę i zwalnia wszystkie zasoby oraz listenery. */
  /** Przełącza widoczność modala Przewodnika Festiwalowicza */
  toggleGuide(open?: boolean): boolean {
    const isOpen = this.ui.toggleGuide(open);
    if (isOpen) {
      this.world?.flankiGame?.cancelThrowCharge();
      this.world?.flankiGame?.setPlayerDrinking(false);
      this.player?.stop();
      this.ui.renderBingo(this.bingo);
      this.ui.renderPassport(this.passport);
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
    return isOpen;
  }

  /** Przełącza widoczność Mapy Festiwalu */
  toggleMap(open?: boolean): boolean {
    const isOpen = this.ui.toggleMap(open);
    if (isOpen) {
      this.world?.flankiGame?.cancelThrowCharge();
      this.world?.flankiGame?.setPlayerDrinking(false);
      this.player?.stop();
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      if (this.player) {
        const forwardDir = new THREE.Vector3();
        this.camera.getWorldDirection(forwardDir);
        this.festivalMap?.render(
          {
            x: this.player.camera.position.x,
            z: this.player.camera.position.z,
            yaw: this.player.yaw,
            dirX: forwardDir.x,
            dirZ: forwardDir.z,
          },
          this.remotePlayersManager?.getPlayerMarkers() ?? [],
          performance.now(),
          this.canCollector.getActiveCanMarkers(),
        );
      }
    } else {
      if (this.state.current === 'playing' && !this.mobileInput) {
        this.canvas.requestPointerLock?.().catch?.(() => undefined);
      }
    }
    return isOpen;
  }

  isGuideOpen(): boolean {
    return this.ui.isGuideOpen();
  }

  isMapOpen(): boolean {
    return this.ui.isMapOpen();
  }

  private positionPlayerForFlanki() {
    const flanki = this.world?.flankiGame;
    if (!flanki || !this.player) return;
    this.camera.position.copy(flanki.getLocalStandPosition()).add(new THREE.Vector3(0, 1.9, 0));
    const bearing = flanki.canPosition.clone().sub(this.camera.position);
    this.player.yaw = Math.atan2(-bearing.x, -bearing.z);
    this.player.pitch = -0.25;
    this.camera.rotation.set(-0.25, this.player.yaw, 0, 'YXZ');
  }

  private syncFlankiLobby(lobby: FlankiLobbyState | null) {
    const flanki = this.world?.flankiGame;
    const playerId = this.networkClient?.getMyPlayerId();
    if (!flanki || !playerId) return;
    if (!lobby || !lobby.players.some((player) => player.id === playerId)) {
      if (this.activeFlankiSession) {
        flanki.stopMatch();
        this.player?.setMovementLocked(false);
        this.world?.flankiGame?.stopMatch();
        this.ui.hideFlankiRoster();
        this.activeFlankiSession = '';
      }
      if (lobby?.phase === 'waiting')
        this.toast('🍻 Trwa zbieranie ekipy na Flanki! Podejdź do boiska i wciśnij [E].');
      return;
    }
    if (lobby.phase === 'waiting') {
      this.activeFlankiSession = lobby.sessionId;
      flanki.configureLobby(lobby, playerId);
      if (this.npcs) flanki.enlistNearbyNpcs(this.npcs.reserveFlankiPlayers(flanki.canPosition));
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.ui.showFlankiRoster(
        flanki.roster,
        () => {
          if (!flanki.arePlayersReady()) {
            this.toast('Poczekaj, aż zawodnicy podejdą na linie.');
            return false;
          }
          this.networkClient?.requestFlankiLobby('start');
        },
        () => this.networkClient?.requestFlankiLobby('leave'),
        {
          canStart: lobby.hostId === playerId,
          localTeam: lobby.players.find((player) => player.id === playerId)?.team,
          onRunnerChange: (team, runnerId) =>
            this.networkClient?.requestFlankiLobby('runner', { team, runnerId }),
          status: `${lobby.players.length}/4 graczy. Pozostali mogą dołączyć przy boisku przed startem; wolne miejsca zajmą NPC.`,
        },
      );
    } else if (flanki.getPhase() === 'idle' || flanki.getPhase() === 'game_over') {
      this.activeFlankiSession = lobby.sessionId;
      flanki.configureLobby(lobby, playerId);
      flanki.startMatch({ multiplayer: true, isHost: lobby.hostId === playerId });
      this.ui.hideFlankiRoster();
      this.positionPlayerForFlanki();
      if (!this.mobileInput) this.canvas.requestPointerLock?.().catch?.(() => undefined);
    }
  }

  dispose() {
    this.distanceVisibility?.dispose();
    if (this.activeFlankiSession) this.networkClient?.requestFlankiLobby('leave');
    this.flankiNetworkCleanup.forEach((cleanup) => cleanup());
    if (this.disposed) return;
    this.disposed = true;
    this.animationLoop.stop();
    this.ui.dispose();
    this.events.dispose();
    this.unsubscribeState();
    this.inspectController.dispose();
    this.useSequence?.dispose();
    this.useSequence = undefined;
    this.itemUseSfx?.dispose();
    this.itemUseSfx = undefined;
    this.seatController?.dispose();
    this.seatController = undefined;
    this.pendingItemUse = undefined;
    this.pendingWarningItem = undefined;
    this.settingsService.dispose();
    this.interactions?.dispose();
    this.mobileControls?.dispose();
    this.mobileControls = undefined;
    this.player?.dispose();
    this.npcs?.dispose();
    this.remotePlayersManager?.dispose();
    this.remotePlayersManager = undefined;
    this.spatialVoice?.dispose();
    this.spatialVoice = undefined;
    this.npcVoiceCoordinator?.dispose();
    this.npcVoiceCoordinator = undefined;
    this.wheelRideController?.dispose();
    this.wheelRideController = undefined;
    this.npcDebugOverlay?.dispose();
    this.npcDebugOverlay = undefined;
    this.stageLiveScreens?.dispose();
    this.world?.dispose();
    this.effects?.dispose();
    this.mushroomWireframe.dispose();
    this.matrixWireframe.dispose();
    this.matrixRain.dispose();
    this.matrixController.reset();
    this.speakerAudio.dispose();
    this.campAmbient.dispose();
    this.grzybekAudio.dispose();
    this.voiceReactions.dispose();
    this.campfireGuitarGame.dispose();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    disposeObjectTree(this.scene);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.propModels.clear();
  }
}
