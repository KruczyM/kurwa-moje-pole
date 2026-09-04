import * as THREE from 'three';
import { AssetLoader } from './assets/AssetLoader';
import { characterAssets, effectAssets, musicAsset } from './assets/assetManifest';
import { CampWorld } from './world/CampWorld';
import { PlayerController } from './player/PlayerController';
import { PLAYER_SPAWN_CONFIG } from './world/campLandmarks';
import { isMobileInputDevice, MobileControls } from './player/MobileControls';
import { NpcManager } from './npc/NpcManager';
import { EffectManager, EffectId, VisualSettings, defaultVisualSettings } from './effects/EffectManager';
import { InteractionManager } from './interactions/InteractionManager';
import { SpeakerAudio } from './audio/SpeakerAudio';
import { InspectableItemId, itemById } from './interactions/itemConfig';
import { itemPresentation } from './interactions/itemPresentationConfig';
import { centerInspectModel, inspectCameraDistance } from './interactions/inspectPresentation';
import { AppState, AppStateMachine, escapeTarget } from './lifecycle/AppStateMachine';
import { EventScope } from './lifecycle/EventScope';
import { cloneDisposableModel, disposeObjectTree } from './lifecycle/disposeThree';
import { AnimationLoop } from './lifecycle/AnimationLoop';
import { MushroomWireframeEffect } from './effects/MushroomWireframeEffect';
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

/** Odczytuje ustawienia efektów z localStorage i uzupełnia brakujące wartości domyślne. */
function loadVisualSettings(): VisualSettings {
  try {
    return { ...defaultVisualSettings, ...JSON.parse(localStorage.getItem('camp-visual-settings') || '{}') };
  } catch {
    return { ...defaultVisualSettings };
  }
}

export class Game {
  readonly canvas = qs<HTMLCanvasElement>('#game');
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
  readonly clock = new THREE.Clock();
  readonly speakerAudio = new SpeakerAudio(musicAsset);
  readonly voiceReactions = new VoiceReactionManager();
  player?: PlayerController;
  world?: CampWorld;
  npcs?: NpcManager;
  effects?: EffectManager;
  interactions?: InteractionManager;
  toiletTimer = 0;
  private settings = loadVisualSettings();
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
  private speakerReactionPlayed = false;
  private pointerLockPause = new PointerLockPauseGate();
  private readonly mobileInput = isMobileInputDevice();
  private mobileControls?: MobileControls;
  private readonly inventory = new ConsumableInventory();
  private useSequence?: ItemUseSequence;
  private seatController?: SeatController;
  private pendingItemUse?: PendingItemUse;

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
    this.scene.fog = new THREE.Fog(0x9bb9d0, 24, 58);
    this.events.listen(window, 'resize', () => this.resize());
    this.events.listen(window, 'keydown', (event) => this.key(event as KeyboardEvent));
    this.events.listen(document, 'pointerlockchange', () => this.pointerLockChanged());
    this.unsubscribeState = this.state.subscribe(({ to }) => this.syncState(to));
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
      this.npcs = new NpcManager(this.scene, assets.characters, assets.speaker, (x, z) =>
        this.world!.canMove(x, z),
      );
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
      this.speakerAudio
        .toggle()
        .then((playing) => this.toast(playing ? 'Głośnik: muzyka włączona' : 'Głośnik: muzyka wyłączona'));
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
  /** Weryfikuje ostrzeżenie dostępności przed rozpoczęciem sekwencji. */
  private confirmItemUse(id: EffectId) {
    if ((id === 'Grzyb' || id === 'MDMA' || id === 'LSD') && !localStorage.getItem('camp-effect-warning')) {
      const proceed = window.confirm(
        'Ten fikcyjny efekt zawiera intensywne ruchy obrazu i światło. Kontynuować?',
      );
      localStorage.setItem('camp-effect-warning', '1');
      if (!proceed) return false;
    }
    return true;
  }

  /** Rozpoczyna transakcyjne użycie przedmiotu bez usuwania go przed markerem animacji. */
  private beginItemUse(id: EffectId, source: PendingItemUse['source'], itemId?: InspectableItemId) {
    if (!this.effects || !this.player || !this.useSequence || !this.confirmItemUse(id)) return false;
    if (this.state.current !== 'inspecting' && this.state.current !== 'inventory') return false;
    if (!this.useSequence.start(id, this.player.yaw)) return false;
    this.pendingItemUse = { effect: id, source, itemId, committed: false };
    qs('#use-sequence-label').textContent = itemUseSequenceConfig[id].label;
    this.state.transition('using-item');
    return true;
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
  /** Włącza lub wyłącza pauzę bez omijania maszyny stanów. */
  /** Włącza albo wyłącza pauzę, o ile bieżący stan pozwala na przejście. */
  setPause(on: boolean) {
    if (on && this.state.current === 'playing') this.state.transition('paused');
    else if (!on && this.state.current === 'paused') this.state.transition('playing');
  }

  /** Zapisuje częściowe ustawienia wizualne i przekazuje je do EffectManagera. */
  updateSettings(values: Partial<VisualSettings>) {
    Object.assign(this.settings, values);
    localStorage.setItem('camp-visual-settings', JSON.stringify(this.settings));
    this.effects?.setSettings(values);
    this.syncSettingsUi();
  }

  /** Odświeża kontrolki dostępności na podstawie bieżących ustawień. */
  private syncSettingsUi() {
    /** Ustawia wartość pojedynczej kontrolki formularza ustawień. */
    const set = (id: string, value: boolean | number) => {
      const input = qs<HTMLInputElement>(id);
      if (input.type === 'range') input.value = String(Number(value) * 100);
      else input.checked = Boolean(value);
    };
    set('#setting-intensity', this.settings.intensity);
    set('#setting-reduce-motion', this.settings.reduceMotion);
    set('#setting-limit-sway', this.settings.limitSway);
    set('#setting-disable-shake', this.settings.disableShake);
    set('#setting-disable-bloom', this.settings.disableBloom);
  }

  /** Synchronizuje HUD, modale, sterowanie graczem i pointer lock ze stanem aplikacji. */
  private syncState(state: AppState) {
    const gameVisible = !['start', 'loading', 'error'].includes(state);
    qs('#hud').hidden = !gameVisible;
    qs('#inspect').hidden = state !== 'inspecting';
    qs('#dialog').hidden = state !== 'dialog';
    qs('#inventory').hidden = state !== 'inventory';
    qs('#pause').hidden = state !== 'paused';
    qs('#use-sequence').hidden = state !== 'using-item';
    const inputMode = this.mobileInput ? 'mobile' : 'desktop';
    qs('#controls-hud').textContent = controlHintForState(state, inputMode);
    qs('#inventory-help').textContent = controlHintForState('inventory', inputMode);
    qs('#pause-help').textContent = controlHintForState('paused', inputMode);
    qs('#dialog-help').textContent = controlHintForState('dialog', inputMode);
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
      if (state === 'playing' || state === 'seated') this.npcs?.update(dt, this.clock.elapsedTime);
      if (state === 'seated') this.seatController?.update(dt);
      this.world?.update(this.clock.elapsedTime);
      this.effects?.update(dt);
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
      if (state === 'inspecting' && this.inspectRenderer && this.inspectScene && this.inspectCamera) {
        this.inspectControls?.update(dt);
        if (this.inspectPivot && this.inspectControls) {
          this.inspectPivot.rotation.set(this.inspectControls.pitch, this.inspectControls.yaw, 0);
          this.inspectCamera.position.z = this.inspectCameraBaseDistance * this.inspectControls.distanceScale;
        }
        this.inspectRenderer.render(this.inspectScene, this.inspectCamera);
      }
    }
    if (state === 'paused' || state === 'error') this.mushroomWireframe.update(false, 0, 0, false);
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
    this.interactions?.dispose();
    this.mobileControls?.dispose();
    this.mobileControls = undefined;
    this.player?.dispose();
    this.npcs?.dispose();
    this.world?.dispose();
    this.effects?.dispose();
    this.mushroomWireframe.dispose();
    this.speakerAudio.dispose();
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
