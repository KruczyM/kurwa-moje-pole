import {
  presentationPath,
  paintedSoilPath,
  presentationPreferences,
  collectibleName,
  collectiblePreviewPath,
  MENU_VISUAL_THEMES,
  THEME_LABELS,
  THEME_ACCENTS,
} from './Presentation';
import type { PresentationPreferences } from './Presentation';
import './game.css';
import { AnimationLoop } from '../../game/lifecycle/AnimationLoop';
import { EventScope } from '../../game/lifecycle/EventScope';
import {
  cachedImageDiagnostics,
  loadCachedImage,
  releaseCachedImages,
  settleImageBatch,
} from '../shared/ImageCache';
import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import type { SpriteMetadata } from '../after/presentation/SpriteAnimator';
import { ArcadeAudio } from './Audio';
import { levelSoundtrack } from './Soundtrack';
import { GridInput } from './Input';
import { BIOMES, LEVELS } from './Levels';
import { HEROES, HERO_LABELS, loadProgress, saveProgress } from './Progress';
import type { Progress } from './Progress';
import { CaveRenderer } from './Renderer';
import type { HeroAtlas } from './Renderer';
import { Simulation } from './Simulation';
import { STEP_SECONDS } from './types';
import { CAMPAIGN_LEVEL_COUNT } from './Campaign';
import { measureSpriteCrop } from './SpriteBounds';
import { BIOME_TILE_ATLASES } from './BiomeTiles';
import { MenuFlow } from './MenuFlow';
import { HeroGallery } from './HeroGallery';
import { SCENES } from './LivingScene';
import { loadAuthoredScenery, authoredImages } from './AuthoredScenery';

type Mode = 'menu' | 'playing' | 'paused' | 'lost' | 'won' | 'victory';
const BASE = import.meta.env.BASE_URL;
const ILLUSTRATED_HEROES = new Set<string>([
  ...HEROES,
  'patrol-red-v3',
  'patrol-blue-v3',
  'undercover-v3',
  'owsiak',
]);
const ILLUSTRATED_BIOMES = new Set([0, 1, 2, 3]);

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
  private readonly audio = new ArcadeAudio(BASE);
  private readonly progress: Progress = {
    ...loadProgress(storage()),
    ...(new URLSearchParams(location.search).get('theme') === 'storybook'
      ? { visualTheme: 'storybook' as const }
      : {}),
  };
  private readonly artPreview = new URLSearchParams(location.search).has('art-preview');
  private get availableLevels(): number {
    return this.artPreview ? LEVELS.length : this.progress.unlocked;
  }
  private readonly motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly menu = new MenuFlow(this.progress.hero);
  private readonly gallery = new HeroGallery(
    element('hero-gallery'),
    (hero) => this.atlas(hero),
    element<HTMLCanvasElement>('hero-preview'),
    element('hero-preview-name'),
    (hero) => this.releaseAtlas(hero),
    () => {
      if (!this.disposed && this.menu.screen === 'heroes')
        element<HTMLButtonElement>('hero-confirm').disabled = !this.gallery.ready(this.menu.hero);
    },
  );
  private readonly atlases = new Map<string, Promise<HeroAtlas>>();
  private readonly backgrounds = new Map<number, HTMLImageElement>();
  private readonly observer = new ResizeObserver(() => this.resize());
  private readonly loop = new AnimationLoop((time) => this.frame(time));
  private game = new Simulation(LEVELS[0]);
  private mode: Mode = 'menu';
  private selected = this.artPreview ? 5 : this.progress.unlocked - 1;
  private accumulator = 0;
  private lastTime = 0;
  private width = 1;
  private height = 1;
  private victoryTime = 0;
  private loading = false;
  private loadToken = 0;
  private disposed = false;
  private frames = 0;
  private pendingLoads = 0;
  private activeHeroes = new Set<string>();
  private activeAssetUrls = new Set<string>();
  private appearancePreview = false;
  private musicPosition?: ReturnType<ArcadeAudio['position']>;
  private appearanceReturnFocus?: HTMLElement;
  private draftAppearance: PresentationPreferences = presentationPreferences(this.progress);

  /** Loads the chosen hero, Krzak and first backdrop; later selections and biomes reuse the cache. */
  async start(): Promise<void> {
    if (!this.renderer) throw new Error('Ta przeglądarka nie udostępnia Canvas 2D.');
    if (this.artPreview)
      document.querySelector<HTMLElement>('.menu-note')!.textContent =
        'Podgląd grafik · wszystkie 24 poziomy dostępne. Oprawę zmienisz także w pauzie.';
    this.audio.muted = this.progress.muted;
    this.gallery.select(this.menu.hero);
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
      const illustrated = ILLUSTRATED_HEROES.has(hero);
      const path = `${BASE}game-assets/2d/bongo-rush/characters-${illustrated ? 'v6' : 'v5'}/${hero}`;
      pending = settleImageBatch([
        loadCachedImage(`${path}/spritesheet.png`),
        fetch(`${path}/meta.json`, { cache: 'no-cache' }).then(async (response) => {
          if (!response.ok) throw new Error(`Nie wczytano postaci: ${hero}`);
          const metadata = (await response.json()) as SpriteMetadata;
          return metadata;
        }),
      ])
        .then(([image, metadata]) => {
          new SpriteAnimator(metadata);
          if (
            image.width !== metadata.frameWidth * metadata.framesPerDirection ||
            image.height !== metadata.frameHeight * 4
          )
            throw new Error(`Niepoprawny rozmiar atlasu: ${hero}`);
          if (
            !illustrated &&
            hero.endsWith('-v3') &&
            (metadata.animationColumns.idle.length !== 2 || metadata.animationColumns.walk.length !== 8)
          )
            throw new Error(`Brak pełnej animacji przeciwnika: ${hero}`);
          if (
            illustrated &&
            (metadata.frameWidth !== 128 ||
              metadata.frameHeight !== 128 ||
              metadata.framesPerDirection !== 12 ||
              metadata.animationColumns.idle.length !== 4 ||
              metadata.animationColumns.walk.length !== 8 ||
              metadata.margin !== 6 ||
              metadata.idleFps !== 3 ||
              metadata.walkTilesPerCycle !== 4 ||
              metadata.pivot?.x !== 64 ||
              metadata.pivot.y !== 116)
          )
            throw new Error(`Niekompletny ilustrowany atlas: ${hero}`);
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
          this.pruneAssets();
          throw error;
        });
      this.atlases.set(hero, pending);
    }
    return pending;
  }

  private releaseAtlas(hero: string): void {
    if (this.pendingLoads || this.activeHeroes.has(hero) || this.gallery.retains(hero)) return;
    this.atlases.delete(hero);
    releaseCachedImages(
      (url) => url.includes('/bongo-rush/characters-') && url.endsWith(`/${hero}/spritesheet.png`),
    );
  }

  private pruneAssets(): void {
    if (this.pendingLoads) return;
    const keep = new Set(this.activeAssetUrls);
    for (const hero of this.atlases.keys()) {
      if (this.gallery.retains(hero))
        keep.add(
          new URL(
            `${BASE}game-assets/2d/bongo-rush/characters-${ILLUSTRATED_HEROES.has(hero) ? 'v6' : 'v5'}/${hero}/spritesheet.png`,
            location.href,
          ).href,
        );
      else if (!this.activeHeroes.has(hero)) this.atlases.delete(hero);
    }
    releaseCachedImages(
      (url) => url.includes('/game-assets/2d/bongo-rush/') && !keep.has(new URL(url, location.href).href),
    );
  }

  /** Loads a run atomically; stale async responses cannot replace newer selections or revive a disposed host. */
  private async loadRun(index: number): Promise<boolean> {
    this.pendingLoads++;
    const token = ++this.loadToken;
    this.loading = true;
    element<HTMLButtonElement>('begin').disabled = true;
    element('load-status').textContent = 'Wczytywanie postaci i biomu…';
    const hero = this.menu.hero;
    let loaded = false;
    try {
      const level = LEVELS[index];
      const illustratedBiome =
        this.progress.visualTheme !== 'standard' && ILLUSTRATED_BIOMES.has(level.biome);
      const sceneryPath = presentationPath(BASE, this.progress, level.biome);
      const authoredRequest = loadAuthoredScenery(BASE, this.progress, level.id);
      const symbols = [level, ...(level.chambers ?? [])].map((room) => room.rows.join('')).join('');
      const kobra =
        symbols.includes('V') ||
        [level, ...(level.chambers ?? [])].some((room) =>
          room.lootSources?.some((source) => source.roots.length),
        );
      const [
        atlas,
        background,
        bushAtlas,
        patrolAtlas,
        blueAtlas,
        undercoverAtlas,
        bossAtlas,
        terrain,
        items,
        tablets,
        depth,
        props,
        cart,
        walls,
        floor,
        soil,
        authored,
      ] = await settleImageBatch([
        this.atlas(hero),
        authoredRequest.then(
          (pack) =>
            pack?.rooms.get('main')?.background ??
            loadCachedImage(
              illustratedBiome
                ? `${sceneryPath}/far.png`
                : `${BASE}game-assets/2d/bongo-rush/living/${SCENES[level.biome].file}`,
            ),
        ),
        kobra ? loadCachedImage(`${BASE}game-assets/2d/bongo-rush/kobra-face/face.png`) : undefined,
        symbols.includes('C') ? this.atlas('patrol-red-v3') : undefined,
        symbols.includes('B') ? this.atlas('patrol-blue-v3') : undefined,
        symbols.includes('U') ? this.atlas('undercover-v3') : undefined,
        symbols.includes('J') ? this.atlas('owsiak') : undefined,
        loadCachedImage(
          illustratedBiome
            ? `${sceneryPath}/sprites.png`
            : `${BASE}game-assets/2d/bongo-rush/tiles-ai/${BIOME_TILE_ATLASES[level.biome]}`,
        ),
        loadCachedImage(
          illustratedBiome
            ? `${sceneryPath}/sprites.png`
            : `${BASE}game-assets/2d/bongo-rush/art-v2/items.png`,
        ),
        !illustratedBiome && level.biome === 2
          ? loadCachedImage(`${BASE}game-assets/2d/bongo-rush/art-v2/rave-tablets.png`)
          : undefined,
        loadCachedImage(
          illustratedBiome
            ? `${sceneryPath}/sprites.png`
            : `${BASE}game-assets/2d/bongo-rush/art-v2/depth.png`,
        ),
        illustratedBiome ? loadCachedImage(`${sceneryPath}/props.png`) : undefined,
        symbols.includes('S')
          ? loadCachedImage(`${BASE}game-assets/2d/bongo-rush/characters-v6/cart.png`)
          : undefined,
        illustratedBiome
          ? authoredRequest.then(
              (pack) => pack?.rooms.get('main')?.walls ?? loadCachedImage(`${sceneryPath}/walls.png`),
            )
          : undefined,
        illustratedBiome
          ? authoredRequest.then(
              (pack) => pack?.rooms.get('main')?.background ?? loadCachedImage(`${sceneryPath}/floor.png`),
            )
          : undefined,
        this.soilArtwork(this.progress, level.id, level.biome),
        authoredRequest,
      ]);
      if (this.disposed || token !== this.loadToken) return false;
      this.activeHeroes = new Set([
        hero,
        ...(symbols.includes('C') ? ['patrol-red-v3'] : []),
        ...(symbols.includes('B') ? ['patrol-blue-v3'] : []),
        ...(symbols.includes('U') ? ['undercover-v3'] : []),
        ...(symbols.includes('J') ? ['owsiak'] : []),
      ]);
      this.activeAssetUrls = new Set(
        [
          atlas.image,
          background,
          bushAtlas,
          patrolAtlas?.image,
          blueAtlas?.image,
          undercoverAtlas?.image,
          bossAtlas?.image,
          terrain,
          items,
          tablets,
          depth,
          props,
          cart,
          walls,
          floor,
          soil,
          ...authoredImages(authored),
        ]
          .filter((image): image is HTMLImageElement => Boolean(image))
          .map((image) => image.src),
      );
      this.backgrounds.clear();
      this.backgrounds.set(level.biome, background);
      this.renderer!.hero(atlas);
      this.renderer!.bushFace(bushAtlas);
      this.renderer!.enemyHeroes(patrolAtlas, blueAtlas, undercoverAtlas, bossAtlas);
      this.renderer!.sceneryArtwork(
        illustratedBiome
          ? {
              biome: level.biome,
              terrain,
              props: props!,
              mid: depth,
              walls,
              floor,
              soil,
              authored,
              presentation: presentationPreferences(this.progress),
            }
          : undefined,
      );
      if (!illustratedBiome) this.renderer!.terrain(level.biome, terrain);
      this.renderer!.items(items);
      this.renderer!.cart(cart);
      this.renderer!.tablets(tablets);
      if (!illustratedBiome) this.renderer!.depth(depth);
      const app = element('bongo-app');
      app.style.setProperty('--scene-accent', THEME_ACCENTS[this.progress.visualTheme]);
      app.style.setProperty('--scene-image', `url("${background.src}")`);
      this.game = new Simulation(level);
      this.accumulator = 0;
      this.lastTime = 0;
      element('load-status').textContent =
        'Bez limitu prób. Uważaj na zarastające przejścia. Postęp zapisuje się na tym urządzeniu.';
      this.updateHud();
      loaded = true;
      return true;
    } catch (error) {
      if (!this.disposed && token === this.loadToken)
        element('load-status').textContent =
          error instanceof Error ? error.message : 'Błąd ładowania. Spróbuj ponownie.';
      return false;
    } finally {
      this.pendingLoads--;
      if (!this.disposed && token === this.loadToken) {
        this.loading = false;
        element<HTMLButtonElement>('begin').disabled = false;
        element('begin').textContent = loaded ? 'Wejdź do jaskini →' : 'Ponów wczytywanie →';
      }
      this.pruneAssets();
    }
  }

  private soilArtwork(
    preferences: PresentationPreferences,
    level: number,
    biome: number,
  ): Promise<HTMLImageElement> | undefined {
    if (preferences.visualTheme === 'storybook') return undefined;
    const path = paintedSoilPath(BASE, preferences, level, biome);
    return path ? loadCachedImage(path) : undefined;
  }

  private updateAppearanceText(): void {
    const fantasy = this.progress.collectibleStyle === 'fantasy';
    element('collectible-help').textContent =
      `Zbierasz: ${collectibleName(this.progress, this.game.level.biome)}. Złoty romb oznacza cel obowiązkowy.`;
    element('victory-heading').textContent = fantasy ? 'Skarb podziemi' : 'Bongo Tasiora';
    element('victory-description').textContent = fantasy
      ? 'Legendarny skarb jest Twój! Czekają jeszcze cztery dodatkowe wyzwania.'
      : 'Dostawa odebrana! Legendarne Bongo Tasiora jest Twoje! Czekają jeszcze cztery dodatkowe wyzwania.';
    const path = collectiblePreviewPath(BASE, this.progress, this.game.level.biome);
    element('counter-icon').style.backgroundImage = `url("${path}")`;
    element('counter-icon').style.backgroundSize = '400% 200%';
    element('counter-icon').style.backgroundPosition = `0 ${fantasy ? 100 : 0}%`;
  }

  private openAppearance(): void {
    if (this.loading || !['menu', 'paused'].includes(this.mode)) return;
    this.appearanceReturnFocus = document.activeElement as HTMLElement;
    this.draftAppearance = presentationPreferences(this.progress);
    this.musicPosition = this.audio.position();
    this.audio.silence(false);
    const choices = element('theme-choices');
    choices.replaceChildren();
    for (const theme of MENU_VISUAL_THEMES) {
      const label = document.createElement('label');
      label.className = 'theme-card';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'visual-theme';
      input.value = theme;
      input.checked = theme === (this.progress.visualTheme === 'standard' ? 'standard' : 'storybook');
      const image = document.createElement('img');
      image.src =
        theme === 'standard'
          ? `${BASE}game-assets/2d/bongo-rush/authored-v6/standard-preview.webp`
          : `${BASE}game-assets/2d/bongo-rush/authored-v6/artistic-preview.webp`;
      image.alt = '';
      image.width = 240;
      image.height = 150;
      const title = document.createElement('span');
      title.textContent = THEME_LABELS[theme];
      label.append(input, image, title);
      choices.append(label);
    }
    for (const input of Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="collectible-style"]'),
    ))
      input.checked = input.value === this.progress.collectibleStyle;
    element('appearance-status').textContent =
      'Standardowy: klasyczna oprawa i festiwalowe znajdźki. Artystyczny: malarskie podziemia. Wybór zapisuje się na tym urządzeniu i zachowuje postęp.';
    this.appearancePreview = false;
    element('appearance-listen').textContent = 'Posłuchaj motywu';
    element<HTMLDialogElement>('appearance-panel').showModal();
    this.readAppearance();
  }

  private readAppearance(): void {
    this.draftAppearance = presentationPreferences({
      visualTheme: document.querySelector<HTMLInputElement>('input[name="visual-theme"]:checked')
        ?.value as PresentationPreferences['visualTheme'],
      collectibleStyle: document.querySelector<HTMLInputElement>('input[name="collectible-style"]:checked')
        ?.value as PresentationPreferences['collectibleStyle'],
    });
    const standard = this.draftAppearance.visualTheme === 'standard';
    for (const input of Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="collectible-style"]'),
    )) {
      input.disabled = standard && input.value === 'fantasy';
      input.checked = input.value === this.draftAppearance.collectibleStyle;
    }
    const path = collectiblePreviewPath(BASE, this.draftAppearance, this.game.level.biome);
    element('collectible-preview').style.backgroundImage = `url("${path}")`;
    element('collectible-preview').style.backgroundPosition =
      this.draftAppearance.collectibleStyle === 'fantasy' ? 'bottom' : 'top';
    element('collectible-preview-label').textContent = collectibleName(
      this.draftAppearance,
      this.game.level.biome,
    );
    const track = levelSoundtrack(this.game.level.id);
    element('soundtrack-title').textContent = `Motyw planszy: ${track.title} · ${track.artist}`;
    if (this.audio.muted)
      element('appearance-status').textContent =
        'Dźwięk jest wyciszony. Włącz go przyciskiem Dźwięk po zamknięciu panelu.';
  }

  private closeAppearance(): void {
    if (this.loading) return;
    this.appearancePreview = false;
    this.audio.silence();
    if (this.musicPosition) this.audio.restorePosition(this.musicPosition);
    element<HTMLDialogElement>('appearance-panel').close();
    this.appearanceReturnFocus?.focus({ preventScroll: true });
  }

  /** Swaps only presentation; never constructs or steps a simulation. */
  private async applyAppearance(): Promise<void> {
    if (this.loading) return;
    const preferences = { ...this.draftAppearance };
    const path = presentationPath(BASE, preferences, this.game.level.biome);
    const token = ++this.loadToken;
    this.loading = true;
    this.pendingLoads++;
    element<HTMLButtonElement>('appearance-apply').disabled = true;
    element('appearance-status').textContent = 'Wczytywanie wybranej oprawy…';
    try {
      const standard = preferences.visualTheme === 'standard',
        biome = this.game.level.biome;
      const authoredRequest = loadAuthoredScenery(BASE, preferences, this.game.level.id);
      const [walls, floor, sprites, far, props, soil, authored, terrain, depth, tablets] =
        await settleImageBatch([
          standard
            ? undefined
            : authoredRequest.then(
                (pack) => pack?.rooms.get('main')?.walls ?? loadCachedImage(`${path}/walls.png`),
              ),
          standard
            ? undefined
            : authoredRequest.then(
                (pack) => pack?.rooms.get('main')?.background ?? loadCachedImage(`${path}/floor.png`),
              ),
          loadCachedImage(
            standard ? `${BASE}game-assets/2d/bongo-rush/art-v2/items.png` : `${path}/sprites.png`,
          ),
          authoredRequest.then(
            (pack) =>
              pack?.rooms.get('main')?.background ??
              loadCachedImage(
                standard
                  ? `${BASE}game-assets/2d/bongo-rush/living/${SCENES[biome].file}`
                  : `${path}/far.png`,
              ),
          ),
          standard ? undefined : loadCachedImage(`${path}/props.png`),
          this.soilArtwork(preferences, this.game.level.id, this.game.level.biome),
          authoredRequest,
          standard
            ? loadCachedImage(`${BASE}game-assets/2d/bongo-rush/tiles-ai/${BIOME_TILE_ATLASES[biome]}`)
            : loadCachedImage(`${path}/sprites.png`),
          standard ? loadCachedImage(`${BASE}game-assets/2d/bongo-rush/art-v2/depth.png`) : undefined,
          standard && biome === 2
            ? loadCachedImage(`${BASE}game-assets/2d/bongo-rush/art-v2/rave-tablets.png`)
            : undefined,
        ] as const);
      if (this.disposed || token !== this.loadToken) return;
      this.renderer!.sceneryArtwork(
        standard
          ? undefined
          : {
              biome: this.game.level.biome,
              walls,
              floor,
              soil,
              terrain,
              props: props!,
              mid: sprites,
              presentation: preferences,
              authored,
            },
      );
      if (standard) {
        this.renderer!.terrain(biome, terrain);
        this.renderer!.depth(depth!);
      }
      const keep = [...this.activeAssetUrls].filter(
        (url) => url.includes('/bongo-rush/characters-') || url.includes('/bongo-rush/kobra-face/'),
      );
      this.activeAssetUrls = new Set([
        ...keep,
        ...[walls, floor, props, soil, depth, tablets]
          .filter((image): image is HTMLImageElement => Boolean(image))
          .map((image) => image.src),
        sprites.src,
        far.src,
        terrain.src,
        ...authoredImages(authored).map((image) => image.src),
      ]);
      this.backgrounds.set(this.game.level.biome, far);
      this.renderer!.items(sprites);
      this.renderer!.tablets(tablets);
      Object.assign(this.progress, preferences);
      saveProgress(storage(), this.progress);
      element('bongo-app').style.setProperty('--scene-accent', THEME_ACCENTS[preferences.visualTheme]);
      element('bongo-app').style.setProperty('--scene-image', `url("${far.src}")`);
      this.updateHud();
      element('appearance-status').textContent = 'Oprawa zastosowana. Wróć do gry, kiedy zechcesz.';
    } catch {
      if (!this.disposed && token === this.loadToken)
        element('appearance-status').textContent =
          'Nie udało się wczytać oprawy. Poprzedni wygląd jest zachowany. Spróbuj ponownie.';
    } finally {
      this.pendingLoads--;
      if (!this.disposed && token === this.loadToken) {
        this.loading = false;
        element<HTMLButtonElement>('appearance-apply').disabled = false;
      }
      this.pruneAssets();
    }
  }

  /** Starts a selected unlocked cave from a real user gesture so mobile audio is immediately available. */
  private async begin(index = this.selected): Promise<void> {
    if (this.loading || index < 0 || index >= this.availableLevels) return;
    if (this.mode === 'menu' && !this.menu.canStart(index, this.availableLevels)) return;
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
    this.updateHud();
    this.progress.hero = this.menu.hero;
    saveProgress(storage(), this.progress);
    this.resize();
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
    if (mode !== 'menu' || this.menu.screen !== 'heroes') this.gallery.setActive(false);
    element('help-panel').hidden = true;
    this.input.reset();
    this.updateKnob();
    this.lastTime = 0;
    element('menu').hidden = mode !== 'menu' || this.menu.screen !== 'title';
    element('hero-panel').hidden = mode !== 'menu' || this.menu.screen !== 'heroes';
    element('level-panel').hidden = mode !== 'menu' || this.menu.screen !== 'levels';
    element('bongo-app').dataset.screen = mode === 'menu' ? this.menu.screen : mode;
    document.querySelector<HTMLElement>('.hud')!.hidden = mode === 'menu';
    element('pause-panel').hidden = mode !== 'paused';
    element('result').hidden = mode !== 'lost' && mode !== 'won';
    element('victory').hidden = mode !== 'victory';
    element('touch-controls').hidden = mode !== 'playing';
    element<HTMLButtonElement>('pause').disabled = mode !== 'playing' && mode !== 'paused';
    element('pause').textContent = mode === 'paused' ? 'Wznów' : 'Pauza';
    if (mode === 'playing') {
      this.audio.unlock();
      this.canvas.focus({ preventScroll: true });
    } else this.audio.silence(mode !== 'paused');
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

  /** Changes only cosmetic menu pages; Escape never changes a running world's state. */
  private showMenu(): void {
    this.setMode('menu');
    this.gallery.setActive(this.menu.screen === 'heroes');
    this.gallery.select(this.menu.hero);
    element('chosen-hero').textContent =
      `Postać: ${HERO_LABELS[HEROES.indexOf(this.menu.hero as (typeof HEROES)[number])]}`;
    element<HTMLButtonElement>('hero-confirm').disabled = !this.gallery.ready(this.menu.hero);
    if (this.menu.screen === 'heroes') {
      element('hero-back').focus({ preventScroll: true });
      void this.gallery.prepare().then(() => {
        if (this.disposed) return;
        element<HTMLButtonElement>('hero-confirm').disabled = !this.gallery.ready(this.menu.hero);
        element('hero-status').textContent = this.gallery.ready(this.menu.hero)
          ? this.gallery.loadedCount() === HEROES.length
            ? 'Zaznacz bohatera i zatwierdź wybór.'
            : `Miniatury: ${this.gallery.loadedCount()} / ${HEROES.length}. Brakujące: wróć i otwórz galerię ponownie.`
          : 'Nie wczytano miniatury. Wróć i otwórz galerię ponownie.';
      });
    } else element(this.menu.screen === 'title' ? 'play' : 'begin').focus({ preventScroll: true });
  }

  /** Reopens level selection with the current hero, matching the quick-level entry on main. */
  private returnToMenu(): void {
    this.menu.openLevels();
    this.selected = this.game.level.id - 1;
    this.showMenu();
    void this.loadRun(this.selected);
  }

  /** Escape only toggles pause while in a run; it never sends the player straight to the main menu. */
  private togglePause(): void {
    if (this.loading || element<HTMLDialogElement>('appearance-panel').open) return;
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
      button.dataset.style = level.style ?? 'challenge';
      const styleLabel =
        level.style === 'exploration' ? 'Eksploracja' : level.style === 'puzzle' ? 'Łamigłówka' : 'Wyzwanie';
      button.disabled = level.id > this.availableLevels;
      button.dataset.level = String(index);
      button.title = `${BIOMES[level.biome].name}: ${level.title}`;
      button.setAttribute(
        'aria-label',
        `Poziom ${level.id}: ${level.title} — ${styleLabel}${button.disabled ? ' — zablokowany' : ''}`,
      );
      button.setAttribute('aria-pressed', String(index === this.selected));
      button.style.setProperty('--biome', BIOMES[level.biome].accent);
      container.append(button);
    });
    element('selected-level').textContent =
      `${this.selected + 1}. ${LEVELS[this.selected].title} · ${LEVELS[this.selected].style === 'exploration' ? 'Kopanie i eksploracja' : LEVELS[this.selected].style === 'puzzle' ? 'Łamigłówka' : 'Wyzwanie'} · ${BIOMES[LEVELS[this.selected].biome].name}`;
  }

  /** Updates textual goals only when state changes, keeping per-frame DOM work minimal. */
  private updateHud(): void {
    const level = this.game.level,
      world = this.game.world;
    element('level-title').textContent = `${level.id} / ${LEVELS.length} · ${this.game.chamberName}`;
    element('counter').textContent =
      `${collectibleName(this.progress, level.biome)}: ${world.collected} / ${level.quota}`;
    this.updateAppearanceText();
    element('timer').hidden = this.game.remainingSeconds === undefined;
    const seconds = Math.ceil(this.game.remainingSeconds ?? 0);
    element('timer').textContent =
      `Czas ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    element('timer').classList.toggle('urgent', seconds <= 30);
    element('exit-status').textContent = this.game.exitOpen
      ? 'Wyjście odblokowane →'
      : world.kills < (level.requiredKills ?? 0)
        ? `Pułapki skalne: ${world.kills} / ${level.requiredKills} · zbierz też wypadający łup`
        : this.game.requiredRemaining > 0 && world.collected >= level.quota
          ? `Łup ze złotym znacznikiem: pozostało ${this.game.requiredRemaining}`
          : level.gate && world.collected >= level.quota
            ? 'Zamknij zagrodę złotą skałą'
            : 'Zbierz dostawę';
    const stage =
      level.vault?.stages?.filter((part) => world.player.x >= part.entry.x - 3).pop() ?? level.vault;
    const hint =
      this.game.chamberId !== 'main'
        ? `${this.game.chamberName}: ${this.game.chamberHint}`
        : stage && world.player.x >= stage.entry.x - 3
          ? `${stage.name}: ${stage.hint}`
          : level.hint;
    element('hint').textContent =
      world.nextBushGrowth === undefined
        ? hint
        : `${hint} Krzak rośnie — fala za ${Math.ceil((world.nextBushGrowth - world.tick) * STEP_SECONDS)} s. R / ↻: restart.`;
    if (this.mode === 'menu')
      element('hint').textContent =
        'Wybierz bohatera, potem odblokowaną jaskinię. Zbieraj dostawę i przygotuj bezpieczny odwrót. Pomoc: ?';
  }

  /** Unlocks the next cave once and presents loss, normal completion or the final short scene. */
  private finish(): void {
    const won = this.game.world.status === 'won';
    if (won && !this.artPreview) {
      this.progress.unlocked = Math.max(
        this.progress.unlocked,
        Math.min(LEVELS.length, this.game.level.id + 1),
      );
      if (this.game.level.id === CAMPAIGN_LEVEL_COUNT) this.progress.completed = true;
      saveProgress(storage(), this.progress);
    }
    if (won && this.game.level.id === CAMPAIGN_LEVEL_COUNT) {
      this.victoryTime = 0;
      this.setMode('victory');
      return;
    }
    element('result-label').textContent = won ? 'DOSTAWA ODEBRANA' : 'JESZCZE JEDNA PRÓBA';
    element('result-title').textContent = won ? 'Jaskinia za Tobą!' : 'Ups. Spróbuj jeszcze raz.';
    element('result-text').textContent = won
      ? this.game.level.id === LEVELS.length
        ? 'Ukończono wszystkie poziomy i wyzwania! Możesz wrócić do wyboru planszy.'
        : `Ukończono: ${this.game.level.title}. Następny poziom jest odblokowany.`
      : this.game.world.reason;
    element('next').hidden = !won || this.game.level.id === LEVELS.length;
    this.setMode(won ? 'won' : 'lost');
  }

  /** Binds controls once through EventScope, including pointer capture and automatic blur/visibility pause. */
  private bind(): void {
    const click = (id: string, callback: () => void) => this.events.listen(element(id), 'click', callback);
    click('appearance-open', () => this.openAppearance());
    click('pause-appearance', () => this.openAppearance());
    click('appearance-close', () => this.closeAppearance());
    click('appearance-apply', () => {
      void this.applyAppearance();
    });
    click('appearance-listen', () => {
      this.appearancePreview = !this.appearancePreview;
      this.audio.silence();
      this.audio.unlock();
      element('appearance-listen').textContent = this.appearancePreview
        ? 'Zatrzymaj odsłuch'
        : 'Posłuchaj motywu';
    });
    this.events.listen(element('appearance-panel'), 'cancel', (event) => {
      event.preventDefault();
      this.closeAppearance();
    });
    this.events.listen(element('appearance-panel'), 'change', () => {
      this.readAppearance();
    });
    click('begin', () => {
      void this.begin();
    });
    click('play', () => {
      this.audio.unlock();
      this.menu.openHeroes();
      this.showMenu();
    });
    click('choose-level', () => {
      this.audio.unlock();
      this.returnToMenu();
    });
    click('hero-confirm', () => {
      if (!this.gallery.ready(this.menu.hero)) return;
      this.menu.confirm();
      this.showMenu();
      void this.loadRun(this.selected);
    });
    for (const id of ['hero-back', 'level-back'])
      click(id, () => {
        this.menu.back();
        this.showMenu();
      });
    click('title-help', () => element('help').click());
    click('pause', () => this.togglePause());
    click('map', () => this.toggleMap());
    click('help', () => {
      element('context-hint').textContent = `${this.game.chamberName}: ${this.game.chamberHint}`;
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
    for (const id of ['to-menu', 'result-menu', 'victory-menu']) click(id, () => this.returnToMenu());
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
    this.events.listen(element('hero-gallery'), 'click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-hero]');
      if (!button || button.disabled || !this.menu.choose(button.dataset.hero!)) return;
      this.gallery.select(this.menu.hero);
      element<HTMLButtonElement>('hero-confirm').disabled = !this.gallery.ready(this.menu.hero);
    });
    this.events.listen(window, 'keydown', (event) => {
      const key = event as KeyboardEvent;
      if (element<HTMLDialogElement>('appearance-panel').open) {
        if (key.code === 'Escape') {
          key.preventDefault();
          if (!key.repeat) this.closeAppearance();
        }
        return;
      }
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
        if (!key.repeat) {
          if (this.mode === 'menu') {
            this.menu.back();
            this.showMenu();
          } else this.togglePause();
        }
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
      else if (document.hidden) this.audio.silence(false);
    });
    const stick = element('joystick-zone');
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
    } else if (this.mode === 'menu') this.showMenu();
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
    this.renderer?.resize(
      this.width,
      this.height,
      window.matchMedia('(pointer: coarse)').matches,
      element('touch-controls').getBoundingClientRect().height ||
        Number.parseFloat(getComputedStyle(element('touch-controls')).height) ||
        undefined,
      document.querySelector('footer')?.getBoundingClientRect().height ?? 52,
      Number.parseFloat(getComputedStyle(element('board')).getPropertyValue('--cave-top-inset')) || 58,
    );
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
    const appearanceOpen = element<HTMLDialogElement>('appearance-panel').open;
    this.audio.updateMusic(
      this.game.level.biome,
      (appearanceOpen ? this.appearancePreview : this.mode === 'playing' || this.mode === 'menu') &&
        !this.loading &&
        !document.hidden,
      this.mode === 'menu' && !appearanceOpen,
      {
        level: this.game.level.id,
        biome: this.game.level.biome,
        theme: appearanceOpen ? this.draftAppearance.visualTheme : this.progress.visualTheme,
      },
    );
    const reduced = this.motionPreference.matches;
    if (this.mode === 'menu' && this.menu.screen === 'heroes' && element('help-panel').hidden)
      this.gallery.update(dt, reduced);
    if (this.mode === 'playing' && !this.loading) {
      this.accumulator += dt;
      while (this.accumulator >= STEP_SECONDS && this.mode === 'playing') {
        this.accumulator -= STEP_SECONDS;
        this.game.step(this.input.direction());
        this.updateHud();
        const sounds = this.game.drainSounds();
        this.renderer?.effects(this.game.world, sounds);
        if (this.game.world.status !== 'playing') this.finish();
        for (const sound of sounds) this.audio.play(sound, this.game.level.biome);
      }
    }
    // Canvas state can be reset by backing-store resize when menu/footer layout changes.
    this.context?.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    this.renderer?.draw(
      this.game,
      this.backgrounds.get(this.game.level.biome),
      this.accumulator / STEP_SECONDS,
      dt,
      this.mode !== 'playing',
      this.mode === 'menu',
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
    this.gallery.dispose();
    this.renderer?.dispose();
    this.atlases.clear();
    this.backgrounds.clear();
    this.activeHeroes.clear();
    this.activeAssetUrls.clear();
    this.pruneAssets();
    this.canvas.width = this.canvas.height = 1;
  }

  /** Read-only observations for development and explicitly selected browser-verification builds. */
  snapshot() {
    return {
      artPreview: this.artPreview,
      presentation: presentationPreferences(this.progress),
      mode: this.mode,
      level: this.game.level.id,
      chamber: this.game.chamberId,
      steps: this.game.ticks,
      world: structuredClone(this.game.world),
      input: this.input.direction(),
      rafActive: this.loop.active,
      frames: this.frames,
      loading: this.loading,
      menuScreen: this.menu.screen,
      heroConfirmed: this.menu.confirmed,
      rendering: this.renderer?.diagnostics(),
      gallery: this.gallery.diagnostics(),
      assets: cachedImageDiagnostics((url) => url.includes('/game-assets/2d/bongo-rush/')),
      audio: this.audio.diagnostics(),
    };
  }
}

const app = new BongoRush();
if (
  (import.meta.env.DEV || import.meta.env.MODE === 'verification') &&
  new URLSearchParams(location.search).has('verify')
)
  Object.assign(window, { __bongoSnapshot: () => app.snapshot() });
void app.start().catch((error: unknown) => {
  element('load-status').textContent =
    error instanceof Error ? error.message : 'Nie udało się uruchomić gry.';
  app.dispose();
});
if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
