import * as THREE from 'three';
import { AssetLoader } from './assets/AssetLoader';
import { characterAssets, effectAssets, musicAsset } from './assets/assetManifest';
import { CampWorld, WORLD_LIMIT } from './world/CampWorld';
import { DEFAULT_GRASS_PRESET, isGrassQualityPreset } from './world/grassQuality';
import { PlayerController } from './player/PlayerController';
import { PLAYER_SPAWN_CONFIG } from './world/campLandmarks';
import { isMobileInputDevice, MobileControls } from './player/MobileControls';
import { NpcManager } from './npc/NpcManager';
import { NPC_NAVIGATION_CELL_SIZE, NPC_NAVIGATION_RADIUS, NpcNavigationGrid } from './npc/NpcNavigationGrid';
import { NpcDebugOverlay, isNpcDebugAllowed } from './npc/NpcDebugOverlay';
import { EffectManager, EffectId, VisualSettings, defaultVisualSettings } from './effects/EffectManager';
import { InteractionManager } from './interactions/InteractionManager';
import { SpeakerAudio } from './audio/SpeakerAudio';
import { CampAmbientAudio } from './audio/CampAmbientAudio';
import { InspectableItemId, itemById } from './interactions/itemConfig';
import { itemPresentation } from './interactions/itemPresentationConfig';
import { centerInspectModel, inspectCameraDistance } from './interactions/inspectPresentation';
import { AppState, AppStateMachine, escapeTarget } from './lifecycle/AppStateMachine';
import { EventScope } from './lifecycle/EventScope';
import { cloneDisposableModel, disposeObjectTree } from './lifecycle/disposeThree';
import { AnimationLoop } from './lifecycle/AnimationLoop';
import { MushroomWireframeEffect } from './effects/MushroomWireframeEffect';
import { MatrixRainOverlay } from './effects/MatrixRainOverlay';
import { MatrixWireframeEffect } from './effects/MatrixWireframeEffect';
import { MatrixPhaseController } from './effects/MatrixPhaseController';
import { VoiceReactionManager } from './audio/VoiceReactionManager';
import { POINTER_LOCK_ESCAPE_SUPPRESSION_MS, PointerLockPauseGate } from './lifecycle/PointerLockPauseGate';
import { controlHintForState, interactionControlHint, resolveGameInput } from './lifecycle/InputBindings';
import { ConsumableInventory } from './inventory/ConsumableInventory';
import { InspectControls } from './interactions/InspectControls';
import { ItemUseSequence } from './interactions/ItemUseSequence';
import { itemUseSequenceConfig } from './interactions/itemUseSequenceConfig';
import { SeatController, type SeatPose } from './interactions/SeatController';
import { configureColorPipeline } from './rendering/colorPipeline';

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

export const INTENSE_EFFECTS: readonly EffectId[] = ['Grzyb', 'MDMA', 'LSD', 'Kreska'];

export function isIntenseEffect(id: EffectId): boolean {
  return INTENSE_EFFECTS.includes(id);
}

/** Wykrywa systemową preferencję ograniczenia ruchu (prefers-reduced-motion). */
export function detectSystemReducedMotion(): boolean {
  const target =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined'
        ? (globalThis as unknown as Window)
        : undefined;
  return (
    typeof target !== 'undefined' &&
    typeof target.matchMedia === 'function' &&
    target.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Odczytuje ustawienia efektów z localStorage i uzupełnia brakujące wartości domyślne. */
export function loadVisualSettings(): VisualSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('camp-visual-settings') : null;
    const parsed = raw ? JSON.parse(raw) : {};
    const systemReducedMotion = detectSystemReducedMotion();

    const loaded: VisualSettings = {
      ...defaultVisualSettings,
      ...(systemReducedMotion && !raw
        ? {
            reduceMotion: true,
            limitSway: true,
            disableShake: true,
            disableFlashes: true,
            disableAberration: true,
          }
        : {}),
      ...parsed,
    };
    if (!isGrassQualityPreset(loaded.grassQuality)) {
      loaded.grassQuality = DEFAULT_GRASS_PRESET;
    }
    if (loaded.matrixMode !== 'auto' && loaded.matrixMode !== 'always' && loaded.matrixMode !== 'off') {
      loaded.matrixMode = defaultVisualSettings.matrixMode;
    }
    if (
      loaded.matrixQuality !== 'low' &&
      loaded.matrixQuality !== 'medium' &&
      loaded.matrixQuality !== 'high'
    ) {
      loaded.matrixQuality = defaultVisualSettings.matrixQuality;
    }
    if (typeof loaded.intensity !== 'number' || Number.isNaN(loaded.intensity)) {
      loaded.intensity = defaultVisualSettings.intensity;
    } else {
      loaded.intensity = THREE.MathUtils.clamp(loaded.intensity, 0, 1);
    }
    return loaded;
  } catch {
    return { ...defaultVisualSettings };
  }
}

export type AudioSettings = {
  speakerVolume: number;
  ambientVolume: number;
  speakerEnabled: boolean;
};

export const defaultAudioSettings: AudioSettings = {
  speakerVolume: 0.7,
  ambientVolume: 0.35,
  speakerEnabled: false,
};

/** Odczytuje ustawienia dźwiękowe z localStorage lub zwraca wartości domyślne. */
export function loadAudioSettings(): AudioSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('camp-audio-settings') : null;
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      speakerVolume:
        typeof parsed.speakerVolume === 'number' && !Number.isNaN(parsed.speakerVolume)
          ? THREE.MathUtils.clamp(parsed.speakerVolume, 0, 1)
          : defaultAudioSettings.speakerVolume,
      ambientVolume:
        typeof parsed.ambientVolume === 'number' && !Number.isNaN(parsed.ambientVolume)
          ? THREE.MathUtils.clamp(parsed.ambientVolume, 0, 1)
          : defaultAudioSettings.ambientVolume,
      speakerEnabled:
        typeof parsed.speakerEnabled === 'boolean'
          ? parsed.speakerEnabled
          : defaultAudioSettings.speakerEnabled,
    };
  } catch {
    return { ...defaultAudioSettings };
  }
}

export class Game {
  readonly canvas = qs<HTMLCanvasElement>('#game');
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
  readonly clock = new THREE.Clock();
  readonly speakerAudio = new SpeakerAudio(musicAsset);
  readonly campAmbient = new CampAmbientAudio();
  readonly voiceReactions = new VoiceReactionManager();
  player?: PlayerController;
  world?: CampWorld;
  npcs?: NpcManager;
  npcDebugOverlay?: NpcDebugOverlay;
  effects?: EffectManager;
  interactions?: InteractionManager;
  toiletTimer = 0;
  private settings = loadVisualSettings();
  private audioSettings = loadAudioSettings();
  private propModels = new Map<string, THREE.Object3D>();
  private inspectRenderer?: THREE.WebGLRenderer;
  private inspectScene?: THREE.Scene;
  private inspectCamera?: THREE.PerspectiveCamera;
  private inspectModel?: THREE.Object3D;
  private inspectPivot?: THREE.Group;
  private inspectControls?: InspectControls;
  private inspectCameraBaseDistance = 1;
  private inspectId?: string;
  private events = new EventScope();
  private unsubscribeState: () => void;
  private toastTimer = 0;
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
  private readonly inventory = new ConsumableInventory();
  private useSequence?: ItemUseSequence;
  private seatController?: SeatController;
  private pendingItemUse?: PendingItemUse;
  private pendingWarningItem?: PendingWarningItem;
  private mediaQueryList?: MediaQueryList;
  private mediaQueryHandler?: (event: MediaQueryListEvent) => void;

  constructor(readonly state: AppStateMachine) {
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
    this.scene.fog = new THREE.Fog(0x8da1b5, 45, 120);
    this.events.listen(window, 'resize', () => this.resize());
    this.events.listen(window, 'keydown', (event) => this.key(event as KeyboardEvent));
    this.events.listen(document, 'pointerlockchange', () => this.pointerLockChanged());
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.mediaQueryHandler = (event: MediaQueryListEvent) => {
        if (!localStorage.getItem('camp-visual-settings')) {
          this.updateSettings({
            reduceMotion: event.matches,
            limitSway: event.matches,
            disableShake: event.matches,
            disableFlashes: event.matches,
            disableAberration: event.matches,
          });
        }
      };
      this.mediaQueryList.addEventListener?.('change', this.mediaQueryHandler);
    }
    this.unsubscribeState = this.state.subscribe(({ to }) => this.syncState(to));
    this.speakerAudio.setUserVolume(this.audioSettings.speakerVolume);
    this.campAmbient.setVolume(this.audioSettings.ambientVolume);
    this.syncSettingsUi();
    this.syncInventoryUi();
    const lsdOverlay = qs('#lsd-overlay');
    lsdOverlay.style.setProperty('--lsd-image-a', `url("${effectAssets.lsdOverlays[0]}")`);
    lsdOverlay.style.setProperty('--lsd-image-b', `url("${effectAssets.lsdOverlays[1]}")`);
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
      this.npcs = new NpcManager(this.scene, assets.characters, assets.speaker, npcNavigation);
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
      const selectedName = localStorage.getItem('camp-player-character');
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
      this.campAmbient.start();
      if (this.audioSettings.speakerEnabled) {
        void this.speakerAudio.play();
      }
      this.startLoop();
      this.state.transition('playing');
    } catch (cause) {
      if (this.disposed) return;
      error.textContent = `Nie udało się uruchomić gry: ${cause instanceof Error ? cause.message : String(cause)}`;
      error.hidden = false;
      this.state.transition('error');
    }
  }

  /** Obsługuje globalne skróty Escape, Tab i E zgodnie z aktualnym stanem aplikacji. */
  private key(event: KeyboardEvent) {
    if (this.disposed) return;
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
    if (this.state.current === 'seated') this.leaveSeat();
    else if (this.state.current === 'inspecting') this.acceptInspect();
    else if (this.state.current === 'playing') this.interact();
  }

  /** Sprząta bieżący modal i przechodzi do wskazanego stanu. */
  private closeCurrentState(target: AppState) {
    if (this.state.current === 'seated') this.seatController?.stop();
    if (this.state.current === 'inspecting') {
      this.voiceReactions.playInspectCancel();
      this.finishInspect();
    }
    if (this.state.current === 'using-item') {
      this.useSequence?.cancel();
      this.pendingItemUse = undefined;
    }
    if (this.state.current === 'effect-warning') {
      this.pendingWarningItem = undefined;
    }
    this.state.transition(target);
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
        this.audioSettings.speakerEnabled = playing;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('camp-audio-settings', JSON.stringify(this.audioSettings));
        }
        this.toast(playing ? 'Głośnik: muzyka włączona' : 'Głośnik: muzyka wyłączona');
      });
      return;
    }
    if (interaction.kind === 'toilet') {
      this.voiceReactions.playToilet();
      this.toiletTimer = 2;
      if (this.player) this.player.enabled = false;
      qs('#fade').classList.add('show');
      this.toast('Chwila prywatności…');
      return;
    }
    if (interaction.kind === 'item') {
      this.inspect(interaction.itemId);
      return;
    }
    if (interaction.kind === 'seat' && this.seatController) {
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
    if (interaction.kind === 'npc' && this.npcs) {
      const npc = this.npcs.npcs.find((candidate) => candidate.name === interaction.name);
      if (!npc) return;
      qs('#dialog-name').textContent = npc.name;
      qs('#dialog-text').textContent = npc.line[Math.floor(Math.random() * npc.line.length)];
      this.state.transition('dialog');
    }
  }

  /** Kończy animację siedzenia i wraca do sterowania pierwszoosobowego. */
  private leaveSeat() {
    if (this.state.current !== 'seated') return;
    this.seatController?.stop();
    this.state.transition('playing');
  }

  /** Wypełnia opis przedmiotu i otwiera scenę jego inspekcji. */
  private inspect(id: string) {
    const item = itemById.get(id as InspectableItemId);
    if (!item || this.state.current !== 'playing') return;
    qs('#inspect-name').textContent = item.label;
    qs('#inspect-text').textContent = item.description;
    qs('#inspect-help').textContent = controlHintForState(
      'inspecting',
      this.mobileInput ? 'mobile' : 'desktop',
    );
    this.createInspectScene(id);
    this.state.transition('inspecting');
    this.voiceReactions.playInspectEnter();
  }

  /** Tworzy osobną, małą scenę podglądu z naturalną orientacją źródłowego modelu. */
  private createInspectScene(id: string) {
    this.clearInspectModel();
    if (!this.inspectRenderer || !this.inspectScene || !this.inspectCamera) {
      const canvas = qs<HTMLCanvasElement>('#inspect-canvas');
      this.inspectRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      this.inspectRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      configureColorPipeline(this.inspectRenderer, 'itemInspect');
      this.inspectScene = new THREE.Scene();
      this.inspectScene.background = new THREE.Color(0x09070f);
      this.inspectCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
      this.inspectScene.add(new THREE.HemisphereLight(0xbdd8ff, 0x241630, 2.2));
      const light = new THREE.DirectionalLight(0xffffff, 2.5);
      light.position.set(2, 3, 3);
      this.inspectScene.add(light);
      this.inspectControls = new InspectControls(canvas);
    }
    this.inspectControls?.reset();
    const source = this.propModels.get(id);
    this.inspectModel = source
      ? cloneDisposableModel(source)
      : new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.5),
          new THREE.MeshStandardMaterial({ color: 0xa8e04a }),
        );
    const presentation = itemPresentation[id as InspectableItemId];
    this.inspectModel.rotation.set(...presentation.inspectRotation);
    const box = new THREE.Box3().setFromObject(this.inspectModel);
    const dimensions = box.getSize(new THREE.Vector3());
    this.inspectModel.scale.setScalar(
      presentation.inspectSize / Math.max(0.01, dimensions.x, dimensions.y, dimensions.z),
    );
    const centered = centerInspectModel(this.inspectModel, presentation.inspectOffsetY);
    this.inspectPivot = centered.pivot;
    this.inspectScene.add(this.inspectPivot);
    this.inspectId = id;
    this.resizeInspectPreview();
  }

  /** Dopasowuje renderer i kamerę tak, aby obracany model zawsze mieścił się w canvasie. */
  private resizeInspectPreview() {
    if (!this.inspectRenderer || !this.inspectCamera || !this.inspectPivot) return;
    const canvas = qs<HTMLCanvasElement>('#inspect-canvas');
    const width = Math.max(1, Math.round(canvas.clientWidth || 360));
    const height = Math.max(1, Math.round(canvas.clientHeight || 280));
    this.inspectRenderer.setSize(width, height, false);
    this.inspectCamera.aspect = width / height;
    this.inspectCamera.updateProjectionMatrix();
    this.inspectPivot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.inspectPivot);
    this.inspectCameraBaseDistance = inspectCameraDistance(
      bounds,
      this.inspectCamera.aspect,
      this.inspectCamera.fov,
    );
    this.inspectCamera.position.set(0, 0, this.inspectCameraBaseDistance);
    this.inspectCamera.lookAt(0, 0, 0);
  }

  /** Zamyka inspekcję bez użycia przedmiotu. */
  closeInspect() {
    if (this.state.current === 'inspecting') this.closeCurrentState('playing');
  }
  /** Kończy inspekcję i uruchamia efekt przypisany do przedmiotu. */
  acceptInspect() {
    if (this.state.current !== 'inspecting' || !this.inspectId) return;
    const item = itemById.get(this.inspectId as InspectableItemId);
    if (!item) return;
    if (!this.beginItemUse(item.effect, 'world', item.id)) return;
    this.interactions?.clear();
    this.finishInspect();
  }

  /** Zabiera oglądany egzemplarz ze świata i dodaje go do pustego początkowo plecaka. */
  takeInspectedItem() {
    if (this.state.current !== 'inspecting' || !this.inspectId) return;
    const item = itemById.get(this.inspectId as InspectableItemId);
    if (!item || !this.world?.removeItem(item.id)) return;
    this.inventory.add(item.effect);
    this.interactions?.clear();
    this.finishInspect();
    this.syncInventoryUi();
    this.state.transition('playing');
    this.toast(`${item.label}: dodano do ekwipunku`);
  }

  /** Uruchamia efekt wyłącznie wtedy, gdy plecak zawiera jego egzemplarz. */
  useInventoryEffect(id: EffectId) {
    if (this.state.current !== 'inventory' || this.inventory.quantity(id) < 1) return false;
    return this.beginItemUse(id, 'inventory');
  }
  /** Przełącza pomiędzy rozgrywką i ekranem ekwipunku. */
  toggleInventory() {
    if (this.state.current === 'playing') this.state.transition('inventory');
    else if (this.state.current === 'inventory') this.state.transition('playing');
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
    if (!this.useSequence.start(id, this.player.yaw)) return false;
    this.pendingItemUse = { effect: id, source, itemId, committed: false };
    qs('#use-sequence-label').textContent = itemUseSequenceConfig[id].label;
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

    const dontShowAgain = qs<HTMLInputElement>('#warning-dont-show-again')?.checked;
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
    document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((button) => {
      const effect = button.dataset.effect as EffectId;
      const quantity = this.inventory.quantity(effect);
      button.disabled = quantity < 1;
      button.querySelector<HTMLElement>('.item-count')!.textContent = `× ${quantity}`;
      button.setAttribute('aria-label', `${effect}, liczba sztuk: ${quantity}`);
    });
    qs('#inventory-status').textContent = this.inventory.total
      ? `Przedmioty w plecaku: ${this.inventory.total}. Wybierz jeden, aby go użyć.`
      : 'Plecak jest pusty. Przedmioty możesz znaleźć w obozie.';
  }
  /** Rozpoczyna kontrolowane wygaszanie aktywnego efektu. */
  cancelEffect() {
    this.effects?.cancel();
    this.toast('Efekt wygaszany');
  }
  /** Zamyka dialog NPC i wraca do rozgrywki. */
  closeDialog() {
    if (this.state.current === 'dialog') this.state.transition('playing');
  }
  /** Włącza albo wyłącza pauzę, o ile bieżący stan pozwala na przejście. */
  setPause(on: boolean) {
    if (on && this.state.current === 'playing') this.state.transition('paused');
    else if (!on && this.state.current === 'paused') this.state.transition('playing');
  }

  /** Zapisuje częściowe ustawienia wizualne i przekazuje je do EffectManagera oraz świata. */
  updateSettings(values: Partial<VisualSettings>) {
    Object.assign(this.settings, values);
    localStorage.setItem('camp-visual-settings', JSON.stringify(this.settings));
    this.effects?.setSettings(values);
    if (values.grassQuality && this.world) {
      this.world.setGrassQuality(values.grassQuality);
    }
    if (values.matrixMode) {
      this.matrixController.setMode(this.settings.matrixMode);
    }
    if (values.matrixQuality) {
      this.matrixRain.setQuality(this.settings.matrixQuality);
    }
    this.syncSettingsUi();
  }

  /** Zapisuje częściowe ustawienia audio i natychmiast aktualizuje głośności głośnika i ambientu. */
  updateAudioSettings(values: Partial<AudioSettings>) {
    Object.assign(this.audioSettings, values);
    if (typeof values.speakerVolume === 'number') {
      this.speakerAudio.setUserVolume(this.audioSettings.speakerVolume);
    }
    if (typeof values.ambientVolume === 'number') {
      this.campAmbient.setVolume(this.audioSettings.ambientVolume);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('camp-audio-settings', JSON.stringify(this.audioSettings));
    }
    this.syncSettingsUi();
  }

  /** Odświeża kontrolki dostępności i audio na podstawie bieżących ustawień. */
  private syncSettingsUi() {
    /** Ustawia wartość pojedynczej kontrolki formularza ustawień. */
    const set = (id: string, value: boolean | number) => {
      const input = document.querySelector<HTMLInputElement>(id);
      if (!input) return;
      if (input.type === 'range') input.value = String(Math.round(Number(value) * 100));
      else input.checked = Boolean(value);
    };
    set('#setting-intensity', this.settings.intensity);
    set('#setting-speaker-volume', this.audioSettings.speakerVolume);
    set('#setting-ambient-volume', this.audioSettings.ambientVolume);
    set('#setting-reduce-motion', this.settings.reduceMotion);
    set('#setting-limit-sway', this.settings.limitSway);
    set('#setting-disable-shake', this.settings.disableShake);
    set('#setting-disable-bloom', this.settings.disableBloom);
    set('#setting-disable-flashes', this.settings.disableFlashes);
    set('#setting-disable-aberration', this.settings.disableAberration);
    const grassSelect = document.querySelector<HTMLSelectElement>('#setting-grass-quality');
    if (grassSelect) grassSelect.value = this.settings.grassQuality;
    const matrixModeSelect = document.querySelector<HTMLSelectElement>('#setting-matrix-mode');
    if (matrixModeSelect) matrixModeSelect.value = this.settings.matrixMode;
    const matrixQualitySelect = document.querySelector<HTMLSelectElement>('#setting-matrix-quality');
    if (matrixQualitySelect) matrixQualitySelect.value = this.settings.matrixQuality;
  }

  /** Synchronizuje HUD, modale, sterowanie graczem i pointer lock ze stanem aplikacji. */
  private syncState(state: AppState) {
    const gameVisible = !['start', 'loading', 'error'].includes(state);
    qs('#hud').hidden = !gameVisible;
    qs('#inspect').hidden = state !== 'inspecting';
    qs('#dialog').hidden = state !== 'dialog';
    qs('#inventory').hidden = state !== 'inventory';
    qs('#pause').hidden = state !== 'paused';
    qs('#effect-warning').hidden = state !== 'effect-warning';
    qs('#use-sequence').hidden = state !== 'using-item';
    if (state === 'paused') {
      this.campAmbient.pause();
    } else if (state === 'playing') {
      this.campAmbient.resume();
    }
    const inputMode = this.mobileInput ? 'mobile' : 'desktop';
    qs('#controls-hud').textContent = controlHintForState(state, inputMode);
    qs('#inventory-help').textContent = controlHintForState('inventory', inputMode);
    qs('#pause-help').textContent = controlHintForState('paused', inputMode);
    qs('#dialog-help').textContent = controlHintForState('dialog', inputMode);
    qs('#effect-warning-help').textContent = controlHintForState('effect-warning', inputMode);
    if (state === 'effect-warning') {
      requestAnimationFrame(() => {
        qs<HTMLButtonElement>('#warning-proceed')?.focus();
      });
    }
    if (this.mobileInput) {
      qs('#inspect-use').textContent = 'UŻYJ';
      qs('#inspect-take').textContent = 'WEŹ';
      qs('#inspect-close').textContent = 'WRÓĆ';
    }
    this.mobileControls?.setState(state);
    qs('#crosshair').hidden = state !== 'playing';
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
        if (!this.disposed && this.state.current === 'inspecting') this.resizeInspectPreview();
      });
    }
    if (state !== 'playing') {
      this.interactions?.clear();
      qs('#prompt').hidden = true;
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
        this.npcs?.update(dt, this.clock.elapsedTime, this.camera.position);
      }
      if (state === 'seated') this.seatController?.update(dt);
      this.world?.update(this.clock.elapsedTime, this.camera.position);
      this.effects?.update(dt);
      const speakerPos = this.npcs?.getSpeakerWorldPosition();
      if (speakerPos) {
        this.speakerAudio.setSpeakerPosition(speakerPos);
      }
      this.speakerAudio.update(this.camera.position, dt);
      if (state === 'using-item') {
        const event = this.useSequence?.update(dt);
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
      if (state === 'inspecting' && this.inspectRenderer && this.inspectScene && this.inspectCamera) {
        this.inspectControls?.update(dt);
        if (this.inspectPivot && this.inspectControls) {
          this.inspectPivot.rotation.set(this.inspectControls.pitch, this.inspectControls.yaw, 0);
          this.inspectCamera.position.z = this.inspectCameraBaseDistance * this.inspectControls.distanceScale;
        }
        this.inspectRenderer.render(this.inspectScene, this.inspectCamera);
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
    const interaction = this.interactions?.update(),
      prompt = qs('#prompt');
    if (!interaction) {
      prompt.hidden = true;
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
              : 'Wejdź do toi-toia';
    prompt.textContent = interactionControlHint(action, this.mobileInput ? 'mobile' : 'desktop');
    prompt.hidden = false;
  }

  /** Aktualizuje licznik efektu oraz nakładki LSD i papierosa. */
  private updateEffectHud() {
    const active = this.effects?.active;
    const phaseLabels = {
      inactive: 'nieaktywny',
      fadeIn: 'wchodzenie',
      active: 'aktywny',
      fadeOut: 'wygaszanie',
    } as const;
    qs('#effect-hud').textContent = active
      ? `${active} · ${phaseLabels[this.effects!.phase]} · ${Math.ceil(this.effects!.remaining)} s`
      : 'Brak aktywnego efektu';
    qs('#smoke').hidden = active !== 'Papieros';
    const lsdOverlay = qs('#lsd-overlay');
    lsdOverlay.hidden = active !== 'LSD';
    lsdOverlay.style.setProperty(
      '--lsd-strength',
      String(active === 'LSD' ? this.effects!.visualIntensity : 0),
    );
    lsdOverlay.classList.toggle('reduced-motion', this.effects?.settings.reduceMotion === true);
  }

  /** Kończy sekwencję toi-toia i przywraca sterowanie. */
  private finishToilet() {
    this.toiletTimer = 0;
    qs('#fade').classList.remove('show');
    if (this.player) {
      this.player.enabled = this.state.current === 'playing';
      this.player.requestPointerLock();
    }
    this.toast('Gotowe.');
  }

  /** Usuwa wyłącznie bieżący model, pozostawiając renderer do ponownego użycia. */
  private clearInspectModel() {
    if (this.inspectPivot) {
      this.inspectScene?.remove(this.inspectPivot);
      disposeObjectTree(this.inspectPivot);
    }
    this.inspectModel = undefined;
    this.inspectPivot = undefined;
  }

  /** Czyści identyfikator i zasoby klonu po każdej ścieżce zakończenia inspekcji. */
  private finishInspect() {
    this.inspectId = undefined;
    this.clearInspectModel();
  }

  /** Zwalnia renderer, model, geometrie i materiały dopiero przy zamykaniu całej gry. */
  private disposeInspectScene() {
    this.clearInspectModel();
    this.inspectControls?.dispose();
    if (this.inspectScene) disposeObjectTree(this.inspectScene);
    this.inspectRenderer?.dispose();
    this.inspectRenderer = undefined;
    this.inspectScene = undefined;
    this.inspectCamera = undefined;
    this.inspectControls = undefined;
    this.inspectCameraBaseDistance = 1;
    this.inspectId = undefined;
  }

  /** Dopasowuje kamerę i postprocessing do aktualnego rozmiaru okna. */
  resize() {
    if (this.disposed) return;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.effects?.resize(innerWidth, innerHeight);
    this.matrixRain.resize(innerWidth, innerHeight);
    if (this.state.current === 'inspecting') this.resizeInspectPreview();
  }

  /** Pokazuje krótką wiadomość HUD i odnawia jej czas wygaszenia. */
  toast(message: string) {
    const toast = qs('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  /** Deterministycznie zatrzymuje grę i zwalnia wszystkie zasoby oraz listenery. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.animationLoop.stop();
    clearTimeout(this.toastTimer);
    this.events.dispose();
    this.unsubscribeState();
    this.disposeInspectScene();
    this.useSequence?.dispose();
    this.useSequence = undefined;
    this.seatController?.dispose();
    this.seatController = undefined;
    this.pendingItemUse = undefined;
    this.pendingWarningItem = undefined;
    if (this.mediaQueryList && this.mediaQueryHandler) {
      this.mediaQueryList.removeEventListener?.('change', this.mediaQueryHandler);
      this.mediaQueryList = undefined;
      this.mediaQueryHandler = undefined;
    }
    this.interactions?.dispose();
    this.mobileControls?.dispose();
    this.mobileControls = undefined;
    this.player?.dispose();
    this.npcs?.dispose();
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
    this.voiceReactions.dispose();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    disposeObjectTree(this.scene);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.propModels.clear();
    qs('#fade').classList.remove('show');
    const lsdOverlay = qs('#lsd-overlay');
    lsdOverlay.hidden = true;
    lsdOverlay.style.removeProperty('--lsd-strength');
    qs('#prompt').hidden = true;
  }
}
