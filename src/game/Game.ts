import * as THREE from 'three';
import { AssetLoader } from './assets/AssetLoader';
import { characterAssets, effectAssets, musicAsset } from './assets/assetManifest';
import { CampWorld, WORLD_LIMIT, terrainHeight } from './world/CampWorld';
import { PlayerController } from './player/PlayerController';
import { PLAYER_SPAWN_CONFIG } from './world/campLandmarks';
import { isMobileInputDevice, MobileControls } from './player/MobileControls';
import { NpcManager } from './npc/NpcManager';
import { NPC_NAVIGATION_CELL_SIZE, NPC_NAVIGATION_RADIUS, NpcNavigationGrid } from './npc/NpcNavigationGrid';
import { NpcDebugOverlay, isNpcDebugAllowed } from './npc/NpcDebugOverlay';
import { EffectManager, EffectId, VisualSettings } from './effects/EffectManager';
import { InteractionManager } from './interactions/InteractionManager';
import { SpeakerAudio } from './audio/SpeakerAudio';
import { CampAmbientAudio } from './audio/CampAmbientAudio';
import { GrzybekWaterAudio } from './audio/GrzybekWaterAudio';
import { InspectableItemId, itemById } from './interactions/itemConfig';
import { ItemInspectController } from './interactions/ItemInspectController';
import { AppState, AppStateMachine, escapeTarget } from './lifecycle/AppStateMachine';
import { EventScope } from './lifecycle/EventScope';
import { disposeObjectTree } from './lifecycle/disposeThree';
import { AnimationLoop } from './lifecycle/AnimationLoop';
import { MushroomWireframeEffect } from './effects/MushroomWireframeEffect';
import { MatrixRainOverlay } from './effects/MatrixRainOverlay';
import { MatrixWireframeEffect } from './effects/MatrixWireframeEffect';
import { MatrixPhaseController } from './effects/MatrixPhaseController';
import { VoiceReactionManager } from './audio/VoiceReactionManager';
import { POINTER_LOCK_ESCAPE_SUPPRESSION_MS, PointerLockPauseGate } from './lifecycle/PointerLockPauseGate';
import { controlHintForState, interactionControlHint, resolveGameInput } from './lifecycle/InputBindings';
import { ConsumableInventory, DEFAULT_STARTER_INVENTORY, inventoryEffects } from './inventory/ConsumableInventory';
import { ItemUseSequence } from './interactions/ItemUseSequence';
import { itemUseSequenceConfig } from './interactions/itemUseSequenceConfig';
import { ItemUseSfxPlayer } from './audio/ItemUseSfx';
import { SeatController, type SeatPose } from './interactions/SeatController';
import { configureColorPipeline } from './rendering/colorPipeline';
import { RemotePlayersManager } from './network/RemotePlayersManager';
import type { NetworkClient } from './network/NetworkClient';
import { UIManager } from './ui/UIManager';
import { SpatialVoiceManager, type MicState } from './audio/SpatialVoiceManager';
import { NpcVoiceCoordinator } from './npc/NpcVoiceCoordinator';

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
  private events = new EventScope();
  private unsubscribeState: () => void;
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
  private mobileControls?: MobileControls;
  private readonly inventory = new ConsumableInventory(DEFAULT_STARTER_INVENTORY);
  private useSequence?: ItemUseSequence;
  private itemUseSfx?: ItemUseSfxPlayer;
  private seatController?: SeatController;
  private pendingItemUse?: PendingItemUse;
  private pendingWarningItem?: PendingWarningItem;
  constructor(
    readonly state: AppStateMachine,
    readonly networkClient?: NetworkClient,
  ) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    } catch {
      throw new Error('Ta przeglądarka nie obsługuje WebGL.');
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    configureColorPipeline(this.renderer, 'world');
    this.scene.background = new THREE.Color(0x9bb9d0);
    this.scene.fog = new THREE.Fog(0x8da1b5, 100, 380);
    this.events.listen(window, 'resize', () => this.resize());
    this.events.listen(window, 'keydown', (event) => this.key(event as KeyboardEvent));
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
      if (assets.characters.size === 0)
        throw new Error('Nie udało się załadować żadnej postaci. Sprawdź Git LFS i pliki game-assets.');
      assets.interactables.forEach((asset, id) => this.propModels.set(id, asset.scene));
      this.world = new CampWorld(this.scene, assets);
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
        PLAYER_SPAWN_CONFIG,
      );
      if (this.mobileInput) {
        this.mobileControls = new MobileControls(qs('#mobile-controls'), {
          move: (forward, right, run) => this.player?.setMobileMove(forward, right, run),
          look: (deltaX, deltaY) => this.player?.lookBy(deltaX, deltaY),
          interact: () => this.interact(),
          menu: () => this.setPause(true),
          inventory: () => this.toggleInventory(),
        });
        this.mobileControls.setState(this.state.current);
      }
      this.effects = new EffectManager(this.renderer, this.scene, this.camera, this.speakerAudio);
      this.effects.setSettings(this.settings);
      this.interactions = new InteractionManager(this.camera, () => [
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
      this.useSequence = new ItemUseSequence(
        this.scene,
        this.camera,
        selectedCharacter,
        this.propModels,
        (x, z) => this.world!.canMove(x, z),
      );
      this.seatController = new SeatController(this.scene, this.camera, selectedCharacter);
      this.itemUseSfx = new ItemUseSfxPlayer();
      this.ui.populateMotionSelect(this.seatController.animationNames);
      this.campAmbient.start();
      this.grzybekAudio.init();
      if (this.audioSettings.speakerEnabled) {
        void this.speakerAudio.play();
      }

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
        geminiInputElement: document.querySelector('#dialog-gemini-key-input') as HTMLInputElement | undefined,
        geminiSaveButton: document.querySelector('#dialog-gemini-save-btn') as HTMLButtonElement | undefined,
        geminiClearButton: document.querySelector('#dialog-gemini-clear-btn') as HTMLButtonElement | undefined,
        geminiCloseButton: document.querySelector('#dialog-gemini-close-btn') as HTMLButtonElement | undefined,
        geminiStatusElement: document.querySelector('#dialog-gemini-status') as HTMLElement | undefined,
        elevenLabsInputElement: document.querySelector('#dialog-elevenlabs-key-input') as HTMLInputElement | undefined,
        elevenLabsSaveButton: document.querySelector('#dialog-elevenlabs-save-btn') as HTMLButtonElement | undefined,
        elevenLabsClearButton: document.querySelector('#dialog-elevenlabs-clear-btn') as HTMLButtonElement | undefined,
        elevenLabsStatusElement: document.querySelector('#dialog-elevenlabs-status') as HTMLElement | undefined,
      });

      this.startLoop();
      this.state.transition('playing');
      this.toast('Festiwalowicze doczytują się w tle. Szukaj ich przy asfaltowym pasażu.');
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('camp-free-camera') === '1') {
        sessionStorage.removeItem('camp-free-camera');
        this.toggleFreeCamera(true);
      }
      void loader
        .loadFestivalNpcs(
          (asset, model) => this.npcs?.addFestivalNpc(asset, model) ?? false,
          () => this.disposed,
        )
        .then((result) => {
          if (!this.disposed) {
            console.info('Festiwalowicze:', result);
            this.toast(
              `Festiwalowicze: ${result.loaded}/${result.total}${result.failed ? ' — część modeli nie została wczytana' : ' — tłum gotowy'}`,
            );
          }
        })
        .catch((cause) => {
          if (!this.disposed) console.error('Ładowanie festiwalowiczów przerwane:', cause);
        });
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
        text.textContent = 'Mikrofon: Włączony [M]';
        break;
      case 'muted':
        icon.textContent = '🔇';
        text.textContent = 'Mikrofon: Wyciszony [M]';
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
    if (
      (event.key === 'm' || event.key === 'M') &&
      (this.state.current === 'playing' || this.state.current === 'seated')
    ) {
      this.spatialVoice?.toggleMute();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.toggleFreeCamera();
      return;
    }
    const action = resolveGameInput(this.state.current, event.key, event.repeat);
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'escape') {
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
      const effectKeys = ['1', '2', '3', '4', '5', '6', '7'];
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
  private pointerLockChanged() {
    if (this.disposed || this.state.current !== 'playing' || this.toiletTimer) return;
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
    if (this.toiletTimer) {
      this.finishToilet();
      return;
    }
    const interaction = this.interactions.current;
    if (!interaction) return;
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
    if (interaction.kind === 'field_shower') {
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
  private syncState(state: AppState) {
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
    if (state !== 'paused' && state !== 'error') {
      if (this.toiletTimer && state === 'playing') {
        this.toiletTimer -= dt;
        if (this.toiletTimer <= 0) this.finishToilet();
      }
      if (state === 'playing') {
        this.player?.update(dt, this.effects?.modifiers || { speed: 1, sway: 0, shake: 0, bob: 1 });
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
      this.world?.update(this.clock.elapsedTime, this.camera.position, dt, this.settings.reduceMotion);
      this.effects?.update(dt);
      const speakerPos = this.npcs?.getSpeakerWorldPosition();
      if (speakerPos) {
        this.speakerAudio.setSpeakerPosition(speakerPos);
      }
      this.speakerAudio.update(this.camera.position, dt);
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
        this.matrixController.isWireframeEligible,
        matrixAlpha,
        this.settings.reduceMotion,
      );
      if (state === 'inspecting') {
        this.inspectController.update(dt);
      }
    }
    if (state === 'paused' || state === 'error') {
      this.mushroomWireframe.update(false, 0, 0, false);
      this.matrixWireframe.update(false, 0, false);
    }
    this.npcDebugOverlay?.update(this.camera);
    this.effects?.render();
    this.updateEffectHud();
  }

  /** Buduje tekst podpowiedzi dla aktualnie wskazanego obiektu. */
  private updateInteractionPrompt() {
    const interaction = this.interactions?.update();
    if (!interaction) {
      this.ui.setInteractionPrompt(null);
      return;
    }
    const action =
      interaction.kind === 'npc'
        ? `Porozmawiaj z ${interaction.name}`
        : interaction.kind === 'speaker'
          ? 'Włącz / wyłącz muzykę'
          : interaction.kind === 'item'
            ? itemById.get(interaction.itemId)?.label || 'Obejrzyj przedmiot'
            : interaction.kind === 'seat'
              ? 'Usiądź na krześle'
              : interaction.kind === 'toitoi_door'
                ? this.world?.infrastructure?.toiToiDoors?.getDoor(interaction.doorId)?.label || 'Otwórz / zamknij toi-toi'
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
  resize() {
    if (this.disposed) return;
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
  dispose() {
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
    this.npcDebugOverlay?.dispose();
    this.npcDebugOverlay = undefined;
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
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    disposeObjectTree(this.scene);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.propModels.clear();
  }
}
