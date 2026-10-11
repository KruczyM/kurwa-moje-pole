import './game.css';
import { AnimationLoop } from '../../game/lifecycle/AnimationLoop';
import { EventScope } from '../../game/lifecycle/EventScope';
import { loadCachedImage } from '../shared/ImageCache';
import type { SpriteMetadata } from '../after/presentation/SpriteAnimator';
import { ArcadeAudio } from './Audio';
import { GridInput } from './Input';
import { BIOMES, LEVELS } from './Levels';
import { HEROES, HERO_LABELS, loadProgress, saveProgress } from './Progress';
import type { Progress } from './Progress';
import { CaveRenderer } from './Renderer';
import type { HeroAtlas } from './Renderer';
import { Simulation } from './Simulation';
import { STEP_SECONDS } from './types';
import { measureSpriteCrop } from './SpriteBounds';

type Mode = 'menu' | 'playing' | 'paused' | 'lost' | 'won' | 'victory';
const BASE = import.meta.env.BASE_URL;

/** Resolves required markup once and reports missing markup explicitly instead of a blank canvas. */
function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Brak elementu interfejsu: ${id}`);
  return node as T;
}

/** Access to localStorage itself can throw on locked-down browsers, not just getItem/setItem. */
function storage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}

/** Hosts the standalone offline game using the existing lifecycle, sprite, cache and joystick mechanisms. */
class BongoRush {
  private readonly events = new EventScope();
  private readonly canvas = element<HTMLCanvasElement>('cave');
  private readonly context = this.canvas.getContext('2d');
  private readonly renderer = this.context ? new CaveRenderer(this.context) : undefined;
  private readonly input = new GridInput();
  private readonly audio = new ArcadeAudio();
  private readonly progress: Progress = loadProgress(storage());
  private readonly atlases = new Map<string, Promise<HeroAtlas>>();
  private readonly backgrounds = new Map<number, HTMLImageElement>();
  private readonly observer = new ResizeObserver(() => this.resize());
  private readonly loop = new AnimationLoop((time) => this.frame(time));
  private game = new Simulation(LEVELS[0]);
  private mode: Mode = 'menu';
  private selected = this.progress.unlocked - 1;
  private accumulator = 0;
  private lastTime = 0;
  private width = 1;
  private height = 1;
  private victoryTime = 0;
  private loading = false;
  private loadToken = 0;
  private disposed = false;
  private frames = 0;

  /** Loads the chosen hero, Krzak and first backdrop; later selections and biomes reuse the cache. */
  async start(): Promise<void> {
    if (!this.renderer) throw new Error('Ta przeglądarka nie udostępnia Canvas 2D.');
    this.audio.muted = this.progress.muted;
    HEROES.forEach((hero, index) => {
      const option = document.createElement('option');
      option.value = hero;
      option.textContent = HERO_LABELS[index];
      element<HTMLSelectElement>('hero').append(option);
    });
    element<HTMLSelectElement>('hero').value = this.progress.hero;
    this.renderLevels();
    this.bind();
    this.updateMute();
    this.observer.observe(element('board'));
    this.resize();
    this.setMode('menu');
    await this.loadRun(this.selected);
    if (this.disposed) return;
    this.loop.start();
  }

  /** Resolves dedicated Idle/Walk atlases once per hero, using the exporter’s explicit direction rows. */
  private atlas(hero: string): Promise<HeroAtlas> {
    let pending = this.atlases.get(hero);
    if (!pending) {
      const path = `${BASE}game-assets/2d/bongo-rush/characters/${hero}`;
      pending = Promise.all([
        loadCachedImage(`${path}/spritesheet.png`),
        fetch(`${path}/meta.json`, { cache: 'no-cache' }).then(async (response) => {
          if (!response.ok) throw new Error(`Nie wczytano postaci: ${hero}`);
          const metadata = (await response.json()) as SpriteMetadata;
          return metadata;
        }),
      ])
        .then(([image, metadata]) => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const crop = measureSpriteCrop(
            context.getImageData(0, 0, image.width, image.height).data,
            image.width,
            image.height,
            metadata.frameWidth,
            metadata.frameHeight,
          );
          canvas.width = canvas.height = 0;
          return { image, metadata, crop };
        })
        .catch((error) => {
          this.atlases.delete(hero);
          throw error;
        });
      this.atlases.set(hero, pending);
    }
    return pending;
  }

  /** Loads a run atomically; stale async responses cannot replace newer selections or revive a disposed host. */
  private async loadRun(index: number): Promise<boolean> {
    const token = ++this.loadToken;
    this.loading = true;
    element<HTMLButtonElement>('begin').disabled = true;
    element<HTMLButtonElement>('hero').disabled = true;
    element('load-status').textContent = 'Wczytywanie postaci i biomu…';
    const hero = element<HTMLSelectElement>('hero').value;
    try {
      const level = LEVELS[index];
      const [atlas, background, bushAtlas, patrolAtlas, bossAtlas] = await Promise.all([
        this.atlas(hero),
        loadCachedImage(`${BASE}game-assets/2d/bongo-rush/${BIOMES[level.biome].background}`),
        this.atlas('kobra'),
        this.atlas('patrol'),
        this.atlas('owsiak'),
      ]);
      if (this.disposed || token !== this.loadToken) return false;
      this.backgrounds.set(level.biome, background);
      this.renderer!.hero(atlas);
      this.renderer!.bushHero(bushAtlas);
      this.renderer!.enemyHeroes(patrolAtlas, bossAtlas);
      this.game = new Simulation(level);
      this.accumulator = 0;
      this.lastTime = 0;
      this.progress.hero = hero;
      saveProgress(storage(), this.progress);
      element('load-status').textContent =
        'Bez limitu prób. Uważaj na zarastające przejścia. Postęp zapisuje się na tym urządzeniu.';
      this.updateHud();
      return true;
    } catch (error) {
      if (!this.disposed && token === this.loadToken)
        element('load-status').textContent =
          error instanceof Error ? error.message : 'Błąd ładowania. Spróbuj ponownie.';
      return false;
    } finally {
      if (!this.disposed && token === this.loadToken) {
        this.loading = false;
        element<HTMLButtonElement>('begin').disabled = false;
        element<HTMLSelectElement>('hero').disabled = false;
        element('begin').textContent = 'Wejdź do jaskini →';
      }
    }
  }

  /** Starts a selected unlocked cave from a real user gesture so mobile audio is immediately available. */
  private async begin(index = this.selected): Promise<void> {
    if (this.loading || index < 0 || index >= this.progress.unlocked) return;
    this.audio.unlock();
    this.audio.silence();
    this.input.reset();
    this.selected = index;
    const ready = await this.loadRun(index);
    if (!ready) {
      if (!this.disposed) this.setMode('menu');
      return;
    }
    this.setMode('playing');
  }

  /** Rebuilds fresh simulation state from the current level, retaining already loaded graphics. */
  private restart(): void {
    if (this.loading || this.mode === 'menu') return;
    this.game = new Simulation(this.game.level);
    this.accumulator = 0;
    this.lastTime = 0;
    this.audio.silence();
    this.setMode('playing');
    this.updateHud();
  }

  /** Switches overlays without changing the RAF, duplicating input listeners or triggering nested pause menus. */
  private setMode(mode: Mode): void {
    this.mode = mode;
    element('help-panel').hidden = true;
    this.input.reset();
    this.updateKnob();
    this.lastTime = 0;
    element('menu').hidden = mode !== 'menu';
    element('pause-panel').hidden = mode !== 'paused';
    element('result').hidden = mode !== 'lost' && mode !== 'won';
    element('victory').hidden = mode !== 'victory';
    element('touch-controls').hidden = mode !== 'playing';
    element<HTMLButtonElement>('pause').disabled = mode !== 'playing' && mode !== 'paused';
    element('pause').textContent = mode === 'paused' ? 'Wznów' : 'Pauza';
    if (mode === 'playing') {
      this.audio.unlock();
      this.canvas.focus({ preventScroll: true });
    } else this.audio.silence();
    if (mode === 'menu') this.renderLevels();
    const focusTarget =
      mode === 'paused'
        ? 'resume'
        : mode === 'lost'
          ? 'retry'
          : mode === 'won'
            ? 'next'
            : mode === 'victory'
              ? 'victory-menu'
              : undefined;
    if (focusTarget) element(focusTarget).focus({ preventScroll: true });
  }

  /** Escape only toggles pause while in a run; it never sends the player straight to the main menu. */
  private togglePause(): void {
    if (this.loading) return;
    if (this.mode === 'playing') this.setMode('paused');
    else if (this.mode === 'paused') this.setMode('playing');
  }

  /** Renders unlocked level buttons with biome accents, preserving keyboard navigation. */
  private renderLevels(): void {
    const container = element('levels');
    container.replaceChildren();
    LEVELS.forEach((level, index) => {
      const button = document.createElement('button');
      button.textContent = String(level.id).padStart(2, '0');
      button.disabled = level.id > this.progress.unlocked;
      button.dataset.level = String(index);
      button.title = `${BIOMES[level.biome].name}: ${level.title}`;
      button.setAttribute(
        'aria-label',
        `Poziom ${level.id}: ${level.title}${button.disabled ? ' — zablokowany' : ''}`,
      );
      button.setAttribute('aria-pressed', String(index === this.selected));
      button.style.setProperty('--biome', BIOMES[level.biome].accent);
      container.append(button);
    });
    element('selected-level').textContent =
      `${this.selected + 1}. ${LEVELS[this.selected].title} · ${LEVELS[this.selected].rows[0].length} × ${LEVELS[this.selected].rows.length} pól · ${BIOMES[LEVELS[this.selected].biome].name}`;
  }

  /** Updates textual goals only when state changes, keeping per-frame DOM work minimal. */
  private updateHud(): void {
    const level = this.game.level,
      world = this.game.world;
    element('level-title').textContent = `${level.id} / 12 · ${level.title}`;
    element('counter').textContent = `${BIOMES[level.biome].item}: ${world.collected} / ${level.quota}`;
    const seconds = Math.ceil(this.game.remainingSeconds ?? 0);
    element('timer').textContent =
      `Czas ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    element('timer').classList.toggle('urgent', seconds <= 30);
    element('exit-status').textContent = this.game.exitOpen
      ? 'Wyjście odblokowane →'
      : this.game.requiredRemaining > 0 && world.collected >= level.quota
        ? `Łup ze złotą obwódką: pozostało ${this.game.requiredRemaining}`
        : level.gate && world.collected >= level.quota
          ? 'Zamknij zagrodę złotą skałą'
          : 'Zbierz dostawę';
    const stage =
      level.vault?.stages?.filter((part) => world.player.x >= part.entry.x - 3).pop() ?? level.vault;
    const hint = stage && world.player.x >= stage.entry.x - 3 ? `${stage.name}: ${stage.hint}` : level.hint;
    element('hint').textContent =
      world.nextBushGrowth === undefined
        ? `${hint} Krzak z korzeniami: odkopanie uruchamia zarastanie przejść.`
        : `${hint} Krzak rośnie — fala za ${Math.ceil((world.nextBushGrowth - world.tick) * STEP_SECONDS)} s. R / ↻: restart.`;
  }

  /** Unlocks the next cave once and presents loss, normal completion or the final short scene. */
  private finish(): void {
    const won = this.game.world.status === 'won';
    if (won) {
      this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(12, this.game.level.id + 1));
      if (this.game.level.id === 12) this.progress.completed = true;
      saveProgress(storage(), this.progress);
    }
    if (won && this.game.level.id === 12) {
      this.victoryTime = 0;
      this.setMode('victory');
      return;
    }
    element('result-label').textContent = won ? 'DOSTAWA ODEBRANA' : 'JESZCZE JEDNA PRÓBA';
    element('result-title').textContent = won ? 'Jaskinia za Tobą!' : 'Ups. Spróbuj jeszcze raz.';
    element('result-text').textContent = won
      ? `Ukończono: ${this.game.level.title}. Następny poziom jest odblokowany.`
      : this.game.world.reason;
    element('next').hidden = !won;
    this.setMode(won ? 'won' : 'lost');
  }

  /** Binds controls once through EventScope, including pointer capture and automatic blur/visibility pause. */
  private bind(): void {
    const click = (id: string, callback: () => void) => this.events.listen(element(id), 'click', callback);
    click('begin', () => {
      void this.begin();
    });
    click('pause', () => this.togglePause());
    click('map', () => this.toggleMap());
    click('help', () => {
      if (this.mode === 'playing') this.setMode('paused');
      if (this.mode === 'paused') element('pause-panel').hidden = true;
      element('help-panel').hidden = false;
      element('help-close').focus({ preventScroll: true });
    });
    click('help-close', () => this.closeHelp());
    click('resume', () => this.togglePause());
    click('pause-restart', () => this.restart());
    click('retry', () => this.restart());
    click('touch-restart', () => this.restart());
    click('next', () => {
      void this.begin(this.game.level.id);
    });
    for (const id of ['to-menu', 'result-menu', 'victory-menu']) click(id, () => this.setMode('menu'));
    click('mute', () => {
      this.audio.unlock();
      this.progress.muted = !this.progress.muted;
      this.audio.muted = this.progress.muted;
      if (this.audio.muted) this.audio.silence();
      saveProgress(storage(), this.progress);
      this.updateMute();
    });
    this.events.listen(element('levels'), 'click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-level]');
      if (!button || button.disabled || this.loading) return;
      this.selected = Number(button.dataset.level);
      this.renderLevels();
      void this.loadRun(this.selected);
    });
    this.events.listen(element('hero'), 'change', () => {
      if (!this.loading) void this.loadRun(this.selected);
    });
    this.events.listen(window, 'keydown', (event) => {
      const key = event as KeyboardEvent;
      if (key.code === 'KeyM' && !key.repeat) {
        key.preventDefault();
        this.toggleMap();
        return;
      }
      if (key.code === 'Escape') {
        key.preventDefault();
        if (!element('help-panel').hidden) {
          if (!key.repeat) this.closeHelp();
          return;
        }
        if (!key.repeat) this.togglePause();
        return;
      }
      if (this.mode !== 'playing') return;
      if (key.code === 'KeyR' && !key.repeat) {
        key.preventDefault();
        this.restart();
        return;
      }
      if (
        ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'KeyW', 'KeyD', 'KeyS', 'KeyA'].includes(key.code)
      ) {
        key.preventDefault();
        this.input.keys.add(key.code);
      }
    });
    this.events.listen(window, 'keyup', (event) => this.input.keys.delete((event as KeyboardEvent).code));
    this.events.listen(window, 'blur', () => {
      if (this.mode === 'playing') this.setMode('paused');
      else this.input.reset();
    });
    this.events.listen(document, 'visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.setMode('paused');
    });
    const stick = element('joystick');
    this.events.listen(stick, 'pointerdown', (event) => {
      const pointer = event as PointerEvent;
      if (this.mode !== 'playing' || !this.input.joystick.begin(pointer.pointerId)) return;
      pointer.preventDefault();
      stick.setPointerCapture(pointer.pointerId);
      this.moveStick(pointer);
    });
    this.events.listen(stick, 'pointermove', (event) => this.moveStick(event as PointerEvent));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.events.listen(stick, type, (event) => {
        this.input.joystick.end((event as PointerEvent).pointerId);
        this.updateKnob();
      });
    this.events.listen(window, 'pagehide', (event) => {
      if ((event as PageTransitionEvent).persisted) {
        if (this.mode === 'playing') this.setMode('paused');
      } else this.dispose();
    });
  }

  /** Closes help without accidentally toggling pause twice; a running game remains safely paused. */
  private closeHelp(): void {
    element('help-panel').hidden = true;
    if (this.mode === 'paused') {
      element('pause-panel').hidden = false;
      element('resume').focus({ preventScroll: true });
    } else if (this.mode === 'menu') element('begin').focus({ preventScroll: true });
  }

  /** Toggles the same cached overview for keyboard and touch, preserving movement focus. */
  private toggleMap(): void {
    if (!this.renderer) return;
    this.renderer.showMap = !this.renderer.showMap;
    element('map').setAttribute('aria-pressed', String(this.renderer.showMap));
    if (this.mode === 'playing') this.canvas.focus({ preventScroll: true });
  }

  /** Converts pointer coordinates to existing radial joystick input; foreign fingers are ignored by ownership. */
  private moveStick(pointer: PointerEvent): void {
    if (this.mode !== 'playing') return;
    const rect = element('joystick').getBoundingClientRect();
    this.input.joystick.move(
      pointer.pointerId,
      pointer.clientX - rect.left - rect.width / 2,
      pointer.clientY - rect.top - rect.height / 2,
      rect.width * 0.28,
    );
    this.updateKnob();
  }

  /** Updates only the knob transform; CSS handles responsive control placement. */
  private updateKnob(): void {
    const { knobX, knobY } = this.input.joystick.snapshot();
    element('knob').style.transform = `translate(${knobX}px, ${knobY}px)`;
  }

  /** Keeps mute state accessible and visible independently of platform audio availability. */
  private updateMute(): void {
    element('mute').textContent = this.progress.muted ? 'Dźwięk: wył.' : 'Dźwięk: wł.';
    element('mute').setAttribute('aria-pressed', String(this.progress.muted));
  }

  /** Caps backing-store memory on high-DPI phones and reflows the existing camera rather than recreating it. */
  private resize(): void {
    const rect = element('board').getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width);
    const widthChanged = Math.abs(nextWidth - this.width) > 1;
    this.width = nextWidth;
    this.height = Math.max(1, rect.height);
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      2,
      Math.sqrt(2_000_000 / (this.width * this.height)),
    );
    this.canvas.width = Math.max(1, Math.round(this.width * ratio));
    this.canvas.height = Math.max(1, Math.round(this.height * ratio));
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.renderer?.resize(this.width, this.height, window.matchMedia('(pointer: coarse)').matches);
    // Contextual hints can reflow the footer. A height-only board resize must not release held movement.
    // Width/orientation changes still reset pointer ownership; blur/visibility retain their own cleanup.
    if (widthChanged) {
      this.input.reset();
      this.updateKnob();
    }
  }

  /** Uses a fixed physics accumulator and interpolated rendering; pause never stops requestAnimationFrame. */
  private frame(time: number): void {
    this.frames++;
    const dt = this.lastTime ? Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000)) : 0;
    this.lastTime = time;
    this.audio.updateMusic(this.game.level.biome, this.mode === 'playing' && !this.loading);
    if (this.mode === 'playing' && !this.loading) {
      this.accumulator += dt;
      while (this.accumulator >= STEP_SECONDS && this.mode === 'playing') {
        this.accumulator -= STEP_SECONDS;
        this.game.step(this.input.direction());
        this.updateHud();
        const sounds = this.game.drainSounds();
        if (this.game.world.status !== 'playing') this.finish();
        for (const sound of sounds) this.audio.play(sound, this.game.level.biome);
      }
    }
    this.renderer?.draw(
      this.game,
      this.backgrounds.get(this.game.level.biome),
      this.accumulator / STEP_SECONDS,
      dt,
      this.mode !== 'playing',
    );
    if (this.mode === 'victory') {
      this.victoryTime += dt;
      this.renderer?.victory(this.victoryTime);
    }
  }

  /** Removes the one loop, observer, listeners, audio and renderer-owned resources on HMR/navigation. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadToken++;
    this.loop.stop();
    this.events.dispose();
    this.observer.disconnect();
    this.input.reset();
    this.audio.dispose();
    this.renderer?.dispose();
    this.atlases.clear();
    this.backgrounds.clear();
    this.canvas.width = this.canvas.height = 1;
  }

  /** Exposes a read-only diagnostic snapshot in development builds only, never a teleport or save bypass. */
  snapshot() {
    return {
      mode: this.mode,
      level: this.game.level.id,
      world: structuredClone(this.game.world),
      input: this.input.direction(),
      rafActive: this.loop.active,
      frames: this.frames,
      loading: this.loading,
    };
  }
}

const app = new BongoRush();
if (import.meta.env.DEV && new URLSearchParams(location.search).has('verify'))
  Object.assign(window, { __bongoSnapshot: () => app.snapshot() });
void app.start().catch((error: unknown) => {
  element('load-status').textContent =
    error instanceof Error ? error.message : 'Nie udało się uruchomić gry.';
  app.dispose();
});
if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
