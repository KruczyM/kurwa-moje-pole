import type { ScreenRect } from './HudVisibility';
import { composeScene, paintedSoilCrop } from './SceneComposition';
import type { SceneComposition } from './SceneComposition';
import { macroRect, macroVariant, paintedWallRect, paintedWallVariant } from './Presentation';
import { CameraRig } from '../after/presentation/CameraRig';
import type { Viewport } from '../after/presentation/CameraRig';
import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import { PatrolAnimator } from './PatrolAnimator';
import { PatrolMotion } from './PatrolMotion';
import { CAMPAIGN_LEVEL_COUNT } from './Campaign';
import { colonyPose, COLONY_SHAKE_SECONDS } from './ColonyMotion';
import type { ColonyPose } from './ColonyMotion';
import type { SpriteMetadata, SpriteFrame } from '../after/presentation/SpriteAnimator';
import type { Facing } from '../after/simulation/WorldState';
import { BIOMES } from './Levels';
import { paintCaveTile } from './CaveVisuals';
import { biomeTileRect, paintBiomeTile, terrainVariant } from './BiomeTiles';
import { drawAmarena } from './AmarenaArt';
import { caveTileSize, collectibleCell, raveTabletRect } from './ArtDirection';
import { same, STEP_SECONDS } from './types';
import { DEPTH_LAYERS, depthFrame, foregroundBands } from './Depth';
import { paintSceneMotion } from './LivingScene';
import { punchSoil, terrainEdges, paintTerrainEdges } from './TerrainDetails';
import { VisualEffects } from './VisualEffects';
import { buildTerrainLayout } from './TerrainLayout';
import type { TerrainPlacement } from './TerrainLayout';
import type { SoundEvent } from './types';
import type { Body, Enemy, LooseObject, Point } from './types';
import type { World } from './types';
import type { Simulation } from './Simulation';
import type { SpriteCrop } from './SpriteBounds';
import {
  paintSceneryEdges,
  rayEnd,
  rayOpacity,
  SCENERY_PROPS,
  sceneryEdges,
  sceneryMaterial,
  sceneryTileRect,
} from './SceneryArt';
import type { SceneryArtwork } from './SceneryArt';
import {
  authoredCellRect,
  authoredColony,
  authoredEdges,
  AUTHORED_DIRECTIONS,
  isAuthoredSolid,
} from './AuthoredScenery';
import type { AuthoredEdge, AuthoredScenery } from './AuthoredScenery';
import { minimapLayout } from './MinimapLayout';
import type { MinimapBox } from './MinimapLayout';

export interface HeroAtlas {
  image: HTMLImageElement;
  metadata: SpriteMetadata;
  crop: SpriteCrop;
}
const FACINGS: Record<string, Facing> = { up: 'north', right: 'east', down: 'south', left: 'west' };

/** One Canvas 2D renderer driven by the shared host RAF, with cached decorative tiles. */
export class CaveRenderer {
  private camera = new CameraRig({ width: 1, height: 1 });
  private animator?: SpriteAnimator;
  private heroPresented?: Point;
  private readonly enemyPresented = new Map<number, Point>();
  private atlas?: HeroAtlas;
  private bushAtlas?: HeroAtlas;
  private colonyFace?: HTMLCanvasElement;
  private readonly colonyBirthIndex = new Map<number, NonNullable<World['bushBirths']>[number]>();
  private colonyBirthCount = -1;
  private readonly patrolMotion = new PatrolMotion();
  private enemyAtlases = new Map<string, HeroAtlas>();
  private enemyAnimators = new Map<number, PatrolAnimator>();
  private enemyAnimationTick = -1;
  private terrainLayout?: TerrainPlacement;
  private width = 1;
  private height = 1;
  private touch = false;
  private minimapTop = 58;
  private cameraInsets: Viewport['insets'];
  private playerBox: ScreenRect = { x: 0, y: 0, width: 0, height: 0 };
  private minimapBox?: MinimapBox;
  private tile = 40;
  private tiles = new Map<string, HTMLCanvasElement>();
  private terrainAtlases = new Map<number, HTMLImageElement>();
  private itemAtlas?: HTMLImageElement;
  private cartAtlas?: HTMLImageElement;
  private tabletAtlas?: HTMLImageElement;
  private depthAtlas?: HTMLImageElement;
  private sceneryAssets?: SceneryArtwork;
  private propFrames: { x: number; y: number; width: number; height: number }[] = [];
  private viewCells = new Set<number>();
  private depthAnchor: Point = { x: 0, y: 0 };
  private readonly motionPreference =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  private clock = 0;
  private readonly debris = new VisualEffects();
  private playHeight = 1;
  private readonly topInset = 0;
  private world?: World;
  private composition?: SceneComposition;
  showMap = false;
  private map?: HTMLCanvasElement;
  private mapTick = -1;
  private authoredTick = -1;
  private authoredWorld?: World;
  private authoredExposure: AuthoredEdge[] = [];
  private colonyLayout = { tiles: new Map<number, number>(), cores: new Set<number>() };
  private topologyUpdates = 0;

  /** Receives an existing canvas context and never owns animation scheduling or asset loading. */
  constructor(private readonly context: CanvasRenderingContext2D) {}

  /** CSS-pixel actor bounds from this rendered frame, without allocating another camera. */
  playerScreenBounds(): Readonly<ScreenRect> {
    return this.playerBox;
  }

  /** Receives sound observations from the fixed simulation step without changing the simulation. */
  effects(world: World, sounds: readonly SoundEvent[]): void {
    this.debris.observe(world, sounds);
  }

  /** Read-only counters for the existing DEV snapshot; no canvas or simulation state escapes. */
  diagnostics() {
    return {
      viewport: { x: 0, y: this.topInset, width: this.width, height: this.playHeight },
      safeViewport: {
        x: this.cameraInsets?.left ?? 0,
        y: this.cameraInsets?.top ?? 0,
        width: this.width - (this.cameraInsets?.left ?? 0) - (this.cameraInsets?.right ?? 0),
        height: this.playHeight - (this.cameraInsets?.top ?? 0) - (this.cameraInsets?.bottom ?? 0),
      },
      tileSize: this.tile,
      player: { ...this.playerBox },
      mapBounds: this.world
        ? {
            ...this.camera.project({ x: 0, y: 0 }),
            width: this.world.width * this.tile,
            height: this.world.height * this.tile,
          }
        : undefined,
      minimap: this.minimapBox ? { ...this.minimapBox, overlay: true } : undefined,
      authored: this.sceneryAssets?.authored
        ? {
            level: this.sceneryAssets.authored.level,
            rooms: this.sceneryAssets.authored.rooms.size,
            exposedEdges: this.authoredExposure.length,
            oldEdges: this.authoredExposure.filter((edge) => edge.old).length,
            freshEdges: this.authoredExposure.filter((edge) => !edge.old).length,
            colonyCells: this.colonyLayout.tiles.size,
            colonyCores: this.colonyLayout.cores.size,
            topologyUpdates: this.topologyUpdates,
            sourceCoordinates: 'fixed-map-cells',
          }
        : undefined,
      composition: this.composition
        ? {
            motif: this.composition.motif,
            roots: this.composition.roots.size,
            assemblies: this.composition.scenery.props.length,
          }
        : undefined,
      cachedTiles: this.tiles.size,
      cacheBytes:
        [...this.tiles.values()].reduce((sum, tile) => sum + tile.width * tile.height * 4, 0) +
        (this.map ? this.map.width * this.map.height * 4 : 0) +
        (this.colonyFace ? this.colonyFace.width * this.colonyFace.height * 4 : 0),
      enemyAnimators: this.enemyAnimators.size,
      decorations: this.terrainLayout
        ? {
            walls: this.terrainLayout.walls,
            directional: this.terrainLayout.directional,
            accents: this.terrainLayout.accents,
          }
        : undefined,
    };
  }

  /** Shared transparent AI sprites are loaded by the existing host image cache. */
  items(image: HTMLImageElement): void {
    this.itemAtlas = image;
  }

  /** A separately illustrated vehicle uses the same loader and renderer as other actors. */
  cart(image: HTMLImageElement | undefined): void {
    this.cartAtlas = image;
  }

  /** Rave uses pressed tablets while other biomes keep their existing item sheet. */
  tablets(image: HTMLImageElement | undefined): void {
    this.tabletAtlas = image;
  }

  /** Receives the shared transparent frame atlas, never owns a second loader or camera. */
  depth(image: HTMLImageElement): void {
    this.depthAtlas = image;
  }

  /** Installs one active illustrated biome in the existing renderer and bounded tile cache. */
  sceneryArtwork(artwork: SceneryArtwork | undefined): void {
    const frames: typeof this.propFrames = [];
    if (artwork?.presentation) {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 512;
      const c = probe.getContext('2d')!;
      c.drawImage(artwork.props, 0, 0, 512, 512);
      const pixels = c.getImageData(0, 0, 512, 512).data;
      for (let cell = 0; cell < 16; cell++) {
        const ox = (cell % 4) * 128,
          oy = Math.floor(cell / 4) * 128;
        let left = 128,
          top = 128,
          right = 0,
          bottom = 0;
        for (let y = 0; y < 128; y++)
          for (let x = 0; x < 128; x++)
            if (pixels[((oy + y) * 512 + ox + x) * 4 + 3] > 8) {
              left = Math.min(left, x);
              right = Math.max(right, x + 1);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y + 1);
            }
        frames.push({
          x: ox + left,
          y: oy + top,
          width: Math.max(1, right - left),
          height: Math.max(1, bottom - top),
        });
      }
      probe.width = probe.height = 0;
    }
    this.sceneryAssets = artwork;
    this.authoredTick = -1;
    this.authoredWorld = undefined;
    this.authoredExposure = [];
    this.colonyLayout = { tiles: new Map(), cores: new Set() };
    this.propFrames = frames;
    for (const tile of this.tiles.values()) tile.width = tile.height = 0;
    this.tiles.clear();
    this.terrainAtlases.clear();
    if (artwork) {
      this.terrainAtlases.set(artwork.biome, artwork.terrain);
      this.depthAtlas = undefined;
    }
  }

  private depthLayer(image: HTMLImageElement, biome: number, layer: number, displacement: Point): void {
    const ctx = this.context;
    const config = DEPTH_LAYERS[layer];
    const columns = layer === 0 ? 1 : 2;
    const sw = image.naturalWidth / columns,
      sh = image.naturalHeight / columns;
    const frame = depthFrame(
      { x: this.width, y: this.playHeight },
      { x: sw, y: sh },
      displacement,
      config.factor,
      this.motionPreference?.matches ?? false,
    );
    ctx.save();
    ctx.beginPath();
    if (layer === 2) {
      for (const band of foregroundBands(this.width, this.playHeight))
        ctx.rect(band.x, band.y + this.topInset, band.width, band.height);
    } else ctx.rect(0, this.topInset, this.width, this.playHeight);
    ctx.clip();
    ctx.globalAlpha = config.opacity;
    ctx.drawImage(
      image,
      layer === 0 ? 0 : (biome % 2) * sw,
      layer === 0 ? 0 : Math.floor(biome / 2) * sh,
      sw,
      sh,
      frame.x,
      frame.y + this.topInset,
      frame.width,
      frame.height,
    );
    ctx.restore();
  }

  private item(cell: number): boolean {
    const image = this.itemAtlas;
    if (!image) return false;
    const size = image.naturalWidth / 4;
    this.context.drawImage(image, (cell % 4) * size, Math.floor(cell / 4) * size, size, size, 0, 0, 64, 64);
    return true;
  }

  /** Swaps cosmetic art only; there is no character-specific simulation configuration. */
  hero(atlas: HeroAtlas): void {
    this.atlas = atlas;
    this.animator = new SpriteAnimator(atlas.metadata, {
      preservePhase: true,
      idleFps: atlas.metadata.idleFps ?? 2,
      walkFps: 10,
    });
    this.heroPresented = undefined;
  }

  /** Uses Kobra's existing artwork exclusively for the non-playable spreading Krzak. */
  bushHero(atlas: HeroAtlas): void {
    this.bushAtlas = atlas;
  }

  bushFace(image: HTMLImageElement | undefined): void {
    if (this.colonyFace) this.colonyFace.width = this.colonyFace.height = 0;
    this.colonyFace = undefined;
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    canvas.getContext('2d')!.drawImage(image, 0, 0, 128, 128);
    this.colonyFace = canvas;
  }

  /** Installs baked views of the generated 3D models without loading heavy GLBs during gameplay. */
  enemyHeroes(red?: HeroAtlas, blue?: HeroAtlas, undercover?: HeroAtlas, boss?: HeroAtlas): void {
    this.enemyAtlases.clear();
    if (red) this.enemyAtlases.set('red', red);
    if (blue) this.enemyAtlases.set('blue', blue);
    if (undercover) this.enemyAtlases.set('undercover', undercover);
    if (boss) this.enemyAtlases.set('boss', boss);
    this.enemyAnimators.clear();
  }

  /** Installs a lazily loaded shared atlas and invalidates only this biome's old baked terrain. */
  terrain(biome: number, image: HTMLImageElement): void {
    biomeTileRect(image.naturalWidth, image.naturalHeight, 'wall', 0);
    if (this.terrainAtlases.get(biome) === image) return;
    this.terrainAtlases.set(biome, image);
    for (const [key, tile] of this.tiles) {
      if (!key.startsWith(`${biome}:`)) continue;
      tile.width = tile.height = 0;
      this.tiles.delete(key);
    }
  }

  /** Fits desktop caves and keeps mobile tiles large enough to read while the camera follows. */
  resize(width: number, height: number, touch = false, minimapTop = 58, insets?: Viewport['insets']): void {
    this.touch = touch;
    this.minimapTop = minimapTop;
    this.cameraInsets = insets;
    this.width = width;
    this.height = height;
    this.playHeight = Math.max(1, height);
    this.tile = caveTileSize(width, this.playHeight);
    this.camera.resize({ width, height: this.playHeight, pixelsPerMeter: this.tile, insets });
  }

  /** Clears only renderer-owned canvases and animation state; shared images remain cached. */
  dispose(): void {
    this.debris.clear();
    for (const tile of this.tiles.values()) {
      tile.width = 0;
      tile.height = 0;
    }
    this.tiles.clear();
    this.terrainAtlases.clear();
    this.itemAtlas = undefined;
    this.cartAtlas = undefined;
    this.tabletAtlas = undefined;
    this.depthAtlas = undefined;
    this.sceneryAssets = undefined;
    this.authoredWorld = undefined;
    this.authoredExposure = [];
    this.colonyLayout = { tiles: new Map(), cores: new Set() };
    this.viewCells.clear();
    this.animator = undefined;
    this.atlas = undefined;
    this.bushAtlas = undefined;
    if (this.colonyFace) this.colonyFace.width = this.colonyFace.height = 0;
    this.colonyFace = undefined;
    this.colonyBirthIndex.clear();
    this.patrolMotion.clear();
    this.enemyAtlases.clear();
    this.enemyAnimators.clear();
    this.terrainLayout = undefined;
    this.heroPresented = undefined;
    this.enemyPresented.clear();
    this.world = undefined;
    if (this.map) this.map.width = this.map.height = 0;
    this.map = undefined;
  }

  /** Renders the short fictional reward scene in the same canvas and RAF as gameplay. */
  victory(time: number): void {
    const ctx = this.context;
    const mobile = this.width < 650;
    const centerX = this.width * (mobile ? 0.5 : 0.73),
      centerY = this.height * (mobile ? 0.26 : 0.48);
    const scale = Math.min(3.8, this.width / (mobile ? 180 : 360), this.height / (mobile ? 300 : 180));
    ctx.fillStyle = '#0b1527bb';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f4cc8033';
    ctx.beginPath();
    ctx.ellipse(0, 60, 90, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let star = 0; star < 12; star++) {
      const angle = (star * Math.PI) / 6 + time * 0.15;
      ctx.fillStyle = ['#f5cf88', '#8be2d9', '#ec98c1'][star % 3];
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * 95,
        Math.sin(angle) * 63,
        1.5 + Math.sin(time * 3 + star) * 0.7,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.save();
    ctx.translate(20, -5);
    this.patrol(
      { id: -1, x: 0, y: 0, previous: { x: 0, y: 0 }, kind: 'boss', direction: 'left', chasing: false },
      true,
    );
    ctx.restore();
    if (this.atlas) {
      const meta = this.atlas.metadata;
      const crop = this.atlas.crop;
      const width = (78 * crop.width) / crop.height;
      ctx.drawImage(
        this.atlas.image,
        crop.x,
        meta.rows.down * meta.frameHeight + crop.y,
        crop.width,
        crop.height,
        -60 - width / 2,
        -13,
        width,
        78,
      );
    }
    if (this.sceneryAssets?.presentation?.collectibleStyle === 'fantasy') {
      ctx.save();
      ctx.translate(-40, -6);
      ctx.scale(1.3, 1.3);
      this.pickup(3, 2);
      ctx.restore();
      ctx.restore();
      return;
    }
    this.bong(0, 33, 1.3, 2);
    const flame = 4 + Math.sin(time * 14) * 2;
    ctx.fillStyle = '#ffb867';
    ctx.beginPath();
    ctx.moveTo(21, 20);
    ctx.quadraticCurveTo(16, 15, 22, 8 - flame);
    ctx.quadraticCurveTo(30, 15, 21, 20);
    ctx.fill();
    ctx.strokeStyle = '#d8e9e980';
    ctx.lineWidth = 2;
    for (let index = 0; index < 3; index++) {
      const rise = (time * 15 + index * 18) % 55;
      ctx.globalAlpha = (1 - rise / 55) * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 3 - rise);
      ctx.quadraticCurveTo(12 * Math.sin(time + index), -8 - rise, 3, -22 - rise);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Draws interpolated bodies, original vector tiles and the biome backdrop without affecting physics. */
  draw(
    game: Simulation,
    background: HTMLImageElement | undefined,
    alpha: number,
    dt: number,
    paused: boolean,
    menu = false,
  ): void {
    const ctx = this.context,
      world = game.world,
      biome = BIOMES[game.level.biome];
    const reduced = this.motionPreference?.matches ?? false;
    this.minimapBox = undefined;
    if ((!paused || menu) && !reduced) this.clock += dt;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#101725';
    ctx.fillRect(0, 0, this.width, this.height);
    if (menu) {
      if (background) {
        const frame = depthFrame(
          { x: this.width, y: this.height },
          { x: background.naturalWidth, y: background.naturalHeight },
          { x: Math.sin(this.clock * 0.08) * 45, y: Math.cos(this.clock * 0.06) * 20 },
          0.4,
          reduced,
        );
        ctx.drawImage(background, frame.x, frame.y, frame.width, frame.height);
      }
      paintSceneMotion(ctx, this.width, this.height, game.level.biome, this.clock, true, reduced);
      if (this.depthAtlas)
        this.depthLayer(this.depthAtlas, game.level.biome, 2, { x: Math.sin(this.clock * 0.08) * 70, y: 0 });
      return;
    }
    const playerPoint = this.interpolate(world.player, alpha);
    const authored = this.sceneryAssets?.authored;
    const scene = authored?.level === game.level.id ? authored.rooms.get(game.chamberId) : undefined;
    if (scene && (scene.width !== world.width || scene.height !== world.height))
      throw new Error('Scenografia nie pasuje do wymiarów mapy.');
    if (scene && (this.authoredWorld !== world || this.authoredTick !== world.tick)) {
      this.authoredExposure = authoredEdges(world, scene.initial);
      this.colonyLayout = authoredColony(world, scene.initial);
      this.authoredWorld = world;
      this.authoredTick = world.tick;
      this.topologyUpdates++;
    }
    if (this.world !== world) {
      this.composition = composeScene(game.level, game.chamberId, game.currentScenery);
      this.viewCells = new Set(
        this.composition?.scenery?.views.flatMap((view) => view.mask.map((p) => p.y * world.width + p.x)) ??
          [],
      );
      this.heroPresented = undefined;
      this.enemyPresented.clear();
      this.animator?.reset();
      this.colonyBirthCount = -1;
      this.world = world;
      this.terrainLayout = buildTerrainLayout(
        world,
        game.level.id * 4 + game.level.biome,
        game.currentTerrainTheme,
        game.currentDecorations,
      );
      this.enemyAnimators.clear();
      this.patrolMotion.clear();
      this.enemyAnimationTick = -1;
      this.debris.clear();
      // One active instance of the existing camera, with this cave's real bounds rather than 24x18.
      this.tile = caveTileSize(this.width, this.playHeight);
      this.camera = new CameraRig({ width: world.width, height: world.height });
      this.camera.resize({
        width: this.width,
        height: this.playHeight,
        pixelsPerMeter: this.tile,
        insets: this.cameraInsets,
      });
      this.mapTick = -1;
      this.camera.snap({ x: playerPoint.x + 0.5, y: playerPoint.y + 0.5 });
      const origin = this.camera.project({ x: 0, y: 0 });
      this.depthAnchor = {
        x: (this.width / 2 - origin.x) / this.tile,
        y: (this.playHeight / 2 - origin.y) / this.tile,
      };
    }
    this.camera.follow({ x: playerPoint.x + 0.5, y: playerPoint.y + 0.5 }, dt, paused);
    const playerScreen = this.camera.project(playerPoint);
    this.playerBox = { x: playerScreen.x, y: playerScreen.y, width: this.tile, height: this.tile };
    if (this.enemyAnimationTick !== world.tick) {
      this.enemyAnimationTick = world.tick;
      this.patrolMotion.retain(world.enemies);
      for (const id of this.enemyAnimators.keys())
        if (!world.enemies.some((enemy) => enemy.id === id)) this.enemyAnimators.delete(id);
      for (const id of this.enemyPresented.keys())
        if (!world.enemies.some((enemy) => enemy.id === id)) this.enemyPresented.delete(id);
    }
    const anchor = this.camera.project(this.depthAnchor);
    const displacement = { x: this.width / 2 - anchor.x, y: this.playHeight / 2 - anchor.y };
    if (scene && background) {
      // Small maps retain readable scale; painted, shaded surroundings fill the full canvas.
      this.depthLayer(background, game.level.biome, 0, displacement);
      ctx.fillStyle = '#071018b8';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    if (background && !scene) this.depthLayer(background, game.level.biome, 0, displacement);
    if (!this.sceneryAssets)
      paintSceneMotion(ctx, this.width, this.height, game.level.biome, this.clock, false, reduced);
    if (!scene) {
      ctx.fillStyle = '#07101855';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    if (this.depthAtlas) this.depthLayer(this.depthAtlas, game.level.biome, 1, displacement);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.topInset, this.width, this.playHeight);
    ctx.clip();
    ctx.translate(0, this.topInset);
    const origin = this.camera.project({ x: 0, y: 0 });
    if (scene && authored) {
      ctx.drawImage(scene.background, origin.x, origin.y, world.width * this.tile, world.height * this.tile);
      this.authoredShadows(authored, world, origin);
    } else if (this.sceneryAssets && background) this.sceneryViews(game, background);
    if (this.colonyBirthCount !== (world.bushBirths?.length ?? 0)) {
      this.colonyBirthIndex.clear();
      for (const birth of world.bushBirths ?? [])
        this.colonyBirthIndex.set(birth.at.y * world.width + birth.at.x, birth);
      this.colonyBirthCount = world.bushBirths?.length ?? 0;
    }
    const firstX = Math.floor(-origin.x / this.tile) - 1;
    const firstY = Math.floor(-origin.y / this.tile) - 1;
    const lastX = Math.ceil((this.width - origin.x) / this.tile) + 1;
    const lastY = Math.ceil((this.playHeight - origin.y) / this.tile) + 1;
    for (let y = firstY; y < lastY; y++)
      for (let x = firstX; x < lastX; x++) {
        const position = this.camera.project({ x, y });
        if (
          position.x < -this.tile ||
          position.y < -this.tile ||
          position.x > this.width ||
          position.y > this.playHeight
        )
          continue;
        const inside = x >= 0 && y >= 0 && x < world.width && y < world.height;
        if (!inside && this.sceneryAssets?.presentation?.visualTheme === 'storybook') continue;
        const cell = inside ? world.cells[y * world.width + x] : 'wall';
        if (
          !scene &&
          this.sceneryAssets &&
          inside &&
          cell === 'wall' &&
          this.viewCells.has(y * world.width + x)
        )
          continue;
        if (cell === 'wall' || cell === 'soil' || cell === 'buried-bush') {
          if (scene) {
            const crop = authoredCellRect(x, y);
            ctx.drawImage(
              cell === 'wall' ? scene.walls : scene.soil,
              ...crop,
              position.x,
              position.y,
              this.tile + 0.5,
              this.tile + 0.5,
            );
          } else {
            if (cell !== 'wall') {
              if (this.sceneryAssets?.floor)
                ctx.drawImage(
                  this.tileArt(game.level.biome, 'floor', macroVariant(x, y)),
                  position.x,
                  position.y,
                  this.tile + 0.5,
                  this.tile + 0.5,
                );
              ctx.fillStyle = this.sceneryAssets?.floor ? '#070b1222' : '#070b1299';
              ctx.fillRect(position.x, position.y, this.tile + 0.5, this.tile + 0.5);
            }
            const painting = cell !== 'wall' ? this.sceneryAssets?.soil : undefined;
            if (painting) {
              const bounds = this.composition?.soilBounds ?? {
                x: 0,
                y: 0,
                width: world.width,
                height: world.height,
              };
              const crop = paintedSoilCrop(bounds, x, y, painting.naturalWidth, painting.naturalHeight);
              ctx.drawImage(
                painting,
                crop.x,
                crop.y,
                crop.width,
                crop.height,
                position.x,
                position.y,
                this.tile + 0.5,
                this.tile + 0.5,
              );
              // A narrow depth seam follows actual excavations; all bark, moss and foliage come from the painting.
              const edges = terrainEdges(world, x, y);
              ctx.fillStyle = '#080b14a0';
              const lip = Math.max(1, this.tile * 0.035);
              if (edges & 1) ctx.fillRect(position.x, position.y, this.tile, lip);
              if (edges & 2) ctx.fillRect(position.x + this.tile - lip, position.y, lip, this.tile);
              if (edges & 4) ctx.fillRect(position.x, position.y + this.tile - lip, this.tile, lip);
              if (edges & 8) ctx.fillRect(position.x, position.y, lip, this.tile);
            } else {
              ctx.drawImage(
                this.tileArt(
                  game.level.biome,
                  cell === 'wall' ? 'wall' : 'soil',
                  this.sceneryAssets
                    ? cell === 'wall'
                      ? this.sceneryAssets.walls
                        ? this.sceneryAssets.presentation?.visualTheme === 'storybook'
                          ? paintedWallVariant(x, y, sceneryMaterial(this.composition?.scenery, x, y))
                          : macroVariant(x, y, sceneryMaterial(this.composition?.scenery, x, y))
                        : sceneryMaterial(this.composition?.scenery, x, y) * 4 + (((x % 4) + 4) % 4)
                      : this.sceneryAssets.presentation?.visualTheme === 'storybook'
                        ? macroVariant(x, y)
                        : ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 3) % 4
                    : inside
                      ? (this.terrainLayout?.cells[y * world.width + x] ?? terrainVariant(x, y))
                      : (game.currentTerrainTheme % 4) * 2 + (terrainVariant(x, y) % 2),
                  terrainEdges(world, x, y),
                  this.sceneryAssets && cell === 'wall' ? sceneryEdges(world, x, y).corners : 0,
                  this.sceneryAssets && cell === 'wall' ? sceneryEdges(world, x, y).sides : undefined,
                ),
                position.x,
                position.y,
                this.tile + 0.5,
                this.tile + 0.5,
              );
            }
          }
        } else {
          if (this.sceneryAssets && !scene)
            ctx.drawImage(
              this.tileArt(
                game.level.biome,
                'floor',
                this.sceneryAssets.walls ? macroVariant(x, y) : (((x + 3 * y) % 4) + 4) % 4,
              ),
              position.x,
              position.y,
              this.tile + 0.5,
              this.tile + 0.5,
            );
          else if (!scene) {
            ctx.fillStyle = '#090f1966';
            ctx.fillRect(position.x, position.y, this.tile + 0.5, this.tile + 0.5);
          }
          if (cell === 'exit')
            this.exit(position, game.exitOpen, game.level.id === CAMPAIGN_LEVEL_COUNT, biome.accent);
          if (cell === 'portal') {
            const portal = game.activePortals.find((end) => same(end, { x, y }));
            ctx.strokeStyle = portal?.name.startsWith('Wymagany') ? '#f6c85f' : '#9fe9ec';
            ctx.lineWidth = Math.max(2, this.tile * 0.06);
            ctx.beginPath();
            ctx.ellipse(
              position.x + this.tile / 2,
              position.y + this.tile / 2,
              this.tile * 0.3,
              this.tile * 0.4,
              0,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
            ctx.fillStyle = '#25516e88';
            ctx.fill();
            ctx.fillStyle = '#e9ffff';
            ctx.font = `bold ${this.tile * 0.3}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('↔', position.x + this.tile / 2, position.y + this.tile * 0.6);
          }
        }

        const source = world.lootSources?.find((entry) => same(entry.definition.tile, { x, y }));
        if (source && !source.activated) {
          ctx.fillStyle = '#f6c85f';
          ctx.strokeStyle = '#f6c85f';
          ctx.lineWidth = 2;
          ctx.strokeRect(position.x + 3, position.y + 3, this.tile - 6, this.tile - 6);
          ctx.font = `bold ${this.tile * 0.28}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(`${source.remaining} K`, position.x + this.tile / 2, position.y + this.tile * 0.6);
        }
        if (
          cell === 'bush' ||
          cell === 'buried-bush' ||
          world.bushRoots.some((root) => same(root, { x, y }))
        ) {
          ctx.save();
          ctx.translate(position.x, position.y);
          ctx.scale(this.tile / 64, this.tile / 64);
          const point = { x, y };
          const closeToWave =
            world.nextBushGrowth !== undefined &&
            (world.nextBushGrowth - world.tick - alpha) * STEP_SECONDS <= COLONY_SHAKE_SECONDS;
          const birth = this.colonyBirthIndex.get(y * world.width + x);
          const pose = colonyPose(
            point,
            world.tick,
            alpha,
            world.nextBushGrowth,
            !reduced && closeToWave && game.canSpreadFrom(point),
            birth,
            reduced,
          );
          if (scene && authored) {
            const index = y * world.width + x;
            if (cell === 'bush') {
              const bits = this.colonyLayout.tiles.get(index)!;
              ctx.drawImage(this.authoredColonyTile(authored, bits, x, y), 0, 0, 64, 64);
              if (this.colonyLayout.cores.has(index)) {
                ctx.save();
                ctx.translate(32 + pose.x, 32 + pose.y);
                ctx.rotate(pose.angle);
                ctx.scale(pose.scaleX, pose.scaleY);
                ctx.drawImage(authored.colonyCores, 120, 0, 40, 40, -32, -32, 64, 64);
                ctx.restore();
              }
            } else ctx.drawImage(authored.colonyCores, 0, 0, 40, 40, 0, 0, 64, 64);
          } else this.bush(cell === 'buried-bush', pose);
          ctx.restore();
        }
      }
    if (scene && authored) this.authoredLips(authored, world, origin);
    else if (this.sceneryAssets) this.sceneryLight(game, reduced);
    if (game.level.gate && !world.trapped) {
      const point = this.camera.project(game.level.gate);
      ctx.strokeStyle = '#ffdb78';
      ctx.lineWidth = 3;
      ctx.strokeRect(point.x + 3, point.y + 3, this.tile - 6, this.tile - 6);
    }
    const bodies: (LooseObject | Enemy | typeof world.player)[] = [
      ...world.objects,
      ...world.enemies,
      world.player,
    ];
    bodies.sort((a, b) => this.interpolate(a, alpha).y - this.interpolate(b, alpha).y || a.id - b.id);
    for (const body of bodies) {
      const isEnemy = 'kind' in body && !['rock', 'pickup'].includes(body.kind);
      const rendered = isEnemy
        ? this.patrolMotion.position(body as Enemy, world.tick, alpha)
        : this.interpolate(body, alpha);
      const position = this.camera.project(rendered);
      if (
        position.x < -this.tile * 2 ||
        position.y < -this.tile * 2 ||
        position.x > this.width ||
        position.y > this.playHeight
      )
        continue;
      ctx.save();
      if (isEnemy && !same(rendered, body)) {
        const logical = this.camera.project(body);
        ctx.strokeStyle = '#ffb66b88';
        ctx.lineWidth = 2;
        ctx.strokeRect(logical.x + 5, logical.y + 5, this.tile - 10, this.tile - 10);
      }
      ctx.translate(position.x, position.y);
      ctx.scale(this.tile / 64, this.tile / 64);
      this.shadow();
      if ('kind' in body) {
        if (body.kind === 'rock') {
          if (authored) ctx.drawImage(authored.actors, (body.variant % 4) * 128, 0, 128, 128, 0, 0, 64, 64);
          else if (this.sceneryAssets) this.sceneryProp(`rock-${body.variant % 4}`, 0, 0, 64, 64);
          else if (!this.item(3)) this.rock(body.variant, biome.wall, biome.light);
        } else if (body.kind === 'pickup') {
          this.pickup(game.level.biome, body.variant);
          if (body.required) {
            ctx.fillStyle = '#ffdf68';
            ctx.strokeStyle = '#3b2c0e';
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(50, 7);
            ctx.lineTo(55, 13);
            ctx.lineTo(50, 19);
            ctx.lineTo(45, 13);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else {
          const prior = this.enemyPresented.get(body.id);
          const travel = prior ? Math.hypot(rendered.x - prior.x, rendered.y - prior.y) : 0;
          this.enemyPresented.set(body.id, { ...rendered });
          this.patrol(
            body as Enemy,
            world.trapped,
            dt,
            paused,
            !same(rendered, body),
            travel <= 1.1 ? travel : 0,
          );
        }
      } else if (this.atlas && this.animator) {
        const travel = this.heroPresented
          ? Math.hypot(rendered.x - this.heroPresented.x, rendered.y - this.heroPresented.y)
          : 0;
        this.heroPresented = { ...rendered };
        const distance = travel <= 1.1 ? travel : 0;
        const moving =
          (this.atlas.metadata.walkTilesPerCycle !== undefined
            ? distance > 1e-8
            : !same(body, body.previous)) && world.status === 'playing';
        const frame = this.animator.update(dt, FACINGS[body.direction], moving, false, paused, distance);
        this.humanoid(this.atlas, frame);
      }
      ctx.restore();
    }
    this.debris.update(dt, paused, reduced);
    ctx.fillStyle = biome.light;
    for (const chip of this.debris.chips) {
      const point = this.camera.project(chip);
      ctx.globalAlpha = Math.max(0, chip.life / 0.42) * 0.7;
      if (chip.kind === 'dig' && this.sceneryAssets?.presentation) {
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(chip.life * 9 + chip.vx);
        if (scene) {
          const crop = authoredCellRect(
            Math.max(0, Math.min(world.width - 1, Math.floor(chip.x))),
            Math.max(0, Math.min(world.height - 1, Math.floor(chip.y))),
          );
          ctx.drawImage(scene.soil, ...crop, -3, -5, 6, 10);
        } else ctx.drawImage(this.sceneryAssets.terrain, 24, 24, 48, 48, -3, -5, 6, 10);
        ctx.restore();
      } else ctx.fillRect(point.x, point.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    if (this.sceneryAssets && !scene) this.sceneryProps(game, 'frame');
    ctx.restore();
    if (!this.sceneryAssets) this.atmosphere(playerPoint);
    if (this.depthAtlas) this.depthLayer(this.depthAtlas, game.level.biome, 2, displacement);
    if (this.showMap) this.minimap(world);
  }

  private authoredVisible(
    world: World,
    origin: Point,
    visit: (i: number, x: number, y: number) => void,
  ): void {
    const x0 = Math.max(0, Math.floor(-origin.x / this.tile) - 1),
      y0 = Math.max(0, Math.floor(-origin.y / this.tile) - 1);
    const x1 = Math.min(world.width, Math.ceil((this.width - origin.x) / this.tile) + 1);
    const y1 = Math.min(world.height, Math.ceil((this.playHeight - origin.y) / this.tile) + 1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) visit(y * world.width + x, x, y);
  }

  /** Source strips stay upright; only their saved raster rectangles are scaled. */
  private authoredFragment(art: AuthoredScenery, key: string, x: number, y: number, origin: Point): void {
    const rect = art.edgeRects[key];
    this.context.drawImage(
      art.edges,
      ...rect,
      origin.x + (x * this.tile) / 80,
      origin.y + (y * this.tile) / 80,
      (rect[2] * this.tile) / 80,
      (rect[3] * this.tile) / 80,
    );
  }

  private authoredShadows(art: AuthoredScenery, world: World, origin: Point): void {
    const ctx = this.context;
    ctx.save();
    ctx.beginPath();
    this.authoredVisible(world, origin, (i, x, y) => {
      if (!isAuthoredSolid(world.cells[i]))
        ctx.rect(origin.x + x * this.tile, origin.y + y * this.tile, this.tile + 0.5, this.tile + 0.5);
    });
    ctx.clip();
    for (const { x, y, side } of this.authoredExposure) {
      const offsets = [
        [-6, -18],
        [80, -6],
        [-6, 80],
        [-18, -6],
      ][side];
      if (
        origin.x + x * this.tile < -2 * this.tile ||
        origin.y + y * this.tile < -2 * this.tile ||
        origin.x + x * this.tile > this.width ||
        origin.y + y * this.tile > this.playHeight
      )
        continue;
      this.authoredFragment(art, `shadow-${side}`, x * 80 + offsets[0], y * 80 + offsets[1], origin);
    }
    ctx.restore();
  }

  /** Draw after every body, so fresh lips cover root cuts instead of being overpainted. */
  private authoredLips(art: AuthoredScenery, world: World, origin: Point): void {
    for (const { x, y, side, wall, old } of this.authoredExposure) {
      if (
        origin.x + x * this.tile < -2 * this.tile ||
        origin.y + y * this.tile < -2 * this.tile ||
        origin.x + x * this.tile > this.width ||
        origin.y + y * this.tile > this.playHeight
      )
        continue;
      for (const row of [wall ? 2 : 0, ...(old ? [1] : [])]) {
        const key = `edge-${row}-${side}-${(x + y) % 2}`,
          rect = art.edgeRects[key];
        const offsets = [
          [0, -4],
          [80 - rect[2] + 4, 0],
          [0, 80 - rect[3] + 4],
          [-4, 0],
        ][side];
        this.authoredFragment(art, key, x * 80 + offsets[0], y * 80 + offsets[1], origin);
      }
    }
    const ctx = this.context;
    ctx.save();
    ctx.beginPath();
    this.authoredVisible(world, origin, (i, x, y) => {
      if (isAuthoredSolid(world.cells[i]) || world.cells[i] === 'bush')
        ctx.rect(origin.x + x * this.tile, origin.y + y * this.tile, this.tile + 0.5, this.tile + 0.5);
    });
    ctx.clip();
    this.authoredVisible(world, origin, (i, x, y) => {
      const cell = world.cells[i];
      if (cell !== 'soil' && cell !== 'buried-bush' && cell !== 'bush') return;
      const family = cell === 'bush' ? 'colony' : 'soil',
        depth = family === 'colony' ? 22 : 16;
      for (const [side, [dx, dy]] of AUTHORED_DIRECTIONS.entries()) {
        const nx = x + dx,
          ny = y + dy;
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= world.width ||
          ny >= world.height ||
          world.cells[ny * world.width + nx] !== 'wall'
        )
          continue;
        const offsets = [
          [0, -depth / 2],
          [80 - depth / 2, 0],
          [0, 80 - depth / 2],
          [-depth / 2, 0],
        ][side];
        this.authoredFragment(
          art,
          `contact-${family}-${side}`,
          x * 80 + offsets[0],
          y * 80 + offsets[1],
          origin,
        );
      }
    });
    ctx.restore();
  }

  private authoredColonyTile(art: AuthoredScenery, bits: number, x: number, y: number): HTMLCanvasElement {
    const key = `colony:${art.biome}:${bits}:${x % 8}:${y % 8}`,
      existing = this.tiles.get(key);
    if (existing) {
      this.tiles.delete(key);
      this.tiles.set(key, existing);
      return existing;
    }
    const tile = document.createElement('canvas');
    tile.width = tile.height = 64;
    const ctx = tile.getContext('2d')!,
      slot = art.colonyTopologies.indexOf(bits),
      sx = (slot % 8) * 40,
      sy = Math.floor(slot / 8) * 40;
    if (slot < 0) throw new Error('Brak konfiguracji połączenia kolonii.');
    ctx.drawImage(art.colonyBody, (x % 8) * 40, (y % 8) * 40, 40, 40, 0, 0, 64, 64);
    ctx.drawImage(art.colonyOverlays, sx, sy, 40, 40, 0, 0, 64, 64);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(art.colonyMasks, sx, sy, 40, 40, 0, 0, 64, 64);
    this.rememberTile(key, tile);
    return tile;
  }

  /** Adds soft local depth without hiding the readable tiles, obstacles or opponents. */
  private atmosphere(player: Point): void {
    const ctx = this.context;
    const p = this.camera.project({ x: player.x + 0.5, y: player.y + 0.5 });
    const radius = Math.max(160, Math.min(this.width, this.playHeight) * 0.85);
    const shade = ctx.createRadialGradient(p.x, p.y + this.topInset, 24, p.x, p.y + this.topInset, radius);
    shade.addColorStop(0, '#00000000');
    shade.addColorStop(0.55, '#0209100c');
    shade.addColorStop(1, '#02091055');
    ctx.fillStyle = shade;
    ctx.fillRect(0, this.topInset, this.width, this.playHeight);
  }

  /** Refreshes a tiny terrain overview at physics rate, then draws a cheap cached image each frame. */
  private minimap(world: World): void {
    const ctx = this.context;
    this.map ??= document.createElement('canvas');
    if (this.mapTick !== world.tick) {
      this.map.width = world.width;
      this.map.height = world.height;
      const map = this.map.getContext('2d')!;
      world.cells.forEach((cell, index) => {
        map.fillStyle =
          cell === 'wall'
            ? '#1a2530'
            : cell === 'soil' || cell === 'buried-bush'
              ? '#63716b'
              : cell === 'bush'
                ? '#69a446'
                : cell === 'portal'
                  ? '#7ce7ee'
                  : cell === 'exit'
                    ? '#fff0aa'
                    : '#101820';
        map.fillRect(index % world.width, Math.floor(index / world.width), 1, 1);
      });
      for (const body of world.objects) {
        map.fillStyle = body.required ? '#ffdf68' : body.kind === 'pickup' ? '#e5c795' : '#384850';
        map.fillRect(body.x, body.y, 1, 1);
      }
      this.mapTick = world.tick;
    }
    const box = minimapLayout(
      this.width - Math.max(0, (this.cameraInsets?.right ?? 8) - 8),
      this.height - (this.cameraInsets?.bottom ?? 0),
      this.minimapTop,
      world.width,
      world.height,
      this.touch || this.width <= 650,
    );
    this.minimapBox = box;
    if (!box) return;
    const { width, height, scale, x, y } = box;
    ctx.fillStyle = '#0a111be8';
    ctx.fillRect(x - 5, y - 5, width + 10, height + 10);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.map, x, y, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#fff8d8';
    ctx.fillRect(
      x + world.player.x * scale - 1,
      y + world.player.y * scale - 1,
      Math.max(3, scale),
      Math.max(3, scale),
    );
    ctx.strokeStyle = '#ffffff48';
    ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);
  }

  /** Blends previous/current positions consistently for player, rocks, collectibles and enemies. */
  private interpolate(body: Body, alpha: number): Point {
    const blend = Math.max(0, Math.min(1, alpha));
    return {
      x: body.previous.x + (body.x - body.previous.x) * blend,
      y: body.previous.y + (body.y - body.previous.y) * blend,
    };
  }

  private sceneryProp(asset: string, x: number, y: number, width: number, height: number): void {
    const art = this.sceneryAssets;
    if (!art) return;
    const index = asset === 'throne' ? 15 : SCENERY_PROPS.findIndex((name) => name === asset);
    if (index < 0) return;
    if (art.presentation && this.propFrames[index]) {
      const f = this.propFrames[index],
        scale = Math.min(width / f.width, height / f.height);
      this.context.drawImage(
        art.props,
        f.x,
        f.y,
        f.width,
        f.height,
        x + (width - f.width * scale) / 2,
        y + (height - f.height * scale) / 2,
        f.width * scale,
        f.height * scale,
      );
      return;
    }
    this.context.drawImage(
      art.props,
      (index % 4) * 128,
      Math.floor(index / 4) * 128,
      128,
      128,
      x,
      y,
      width,
      height,
    );
  }

  /** Every architectural prop is clipped to actual walls, keeping all gameplay silhouettes clear. */
  private sceneryProps(game: Simulation, layer: 'depth' | 'frame'): void {
    const ctx = this.context;
    for (const prop of this.composition?.scenery?.props ?? []) {
      if (prop.layer !== layer) continue;
      const p = this.camera.project(prop.at),
        width = prop.width * this.tile,
        height = prop.height * this.tile;
      if (p.x + width < 0 || p.y + height < 0 || p.x > this.width || p.y > this.playHeight) continue;
      ctx.save();
      ctx.beginPath();
      for (let y = Math.floor(prop.at.y); y < Math.ceil(prop.at.y + prop.height); y++)
        for (let x = Math.floor(prop.at.x); x < Math.ceil(prop.at.x + prop.width); x++)
          if (game.world.cells[y * game.world.width + x] === 'wall') {
            const at = this.camera.project({ x, y });
            ctx.rect(at.x, at.y, this.tile + 0.5, this.tile + 0.5);
          }
      ctx.clip();
      this.sceneryProp(prop.asset, p.x, p.y, width, height);
      ctx.restore();
    }
  }

  private sceneryViews(game: Simulation, background: HTMLImageElement): void {
    const ctx = this.context;
    for (const view of this.composition?.scenery?.views ?? []) {
      const b = view.bounds,
        p = this.camera.project(b),
        width = b.width * this.tile,
        height = b.height * this.tile;
      if (p.x + width < 0 || p.y + height < 0 || p.x > this.width || p.y > this.playHeight) continue;
      ctx.save();
      ctx.beginPath();
      for (const cell of view.mask) {
        const at = this.camera.project(cell);
        if (at.x + this.tile >= 0 && at.y + this.tile >= 0 && at.x <= this.width && at.y <= this.playHeight)
          ctx.rect(at.x, at.y, this.tile + 0.5, this.tile + 0.5);
      }
      ctx.clip();
      const scale = Math.max(width / background.naturalWidth, height / background.naturalHeight);
      ctx.drawImage(
        background,
        p.x + (width - background.naturalWidth * scale) / 2,
        p.y + (height - background.naturalHeight * scale) / 2,
        background.naturalWidth * scale,
        background.naturalHeight * scale,
      );
      if (this.sceneryAssets) {
        if (!this.sceneryAssets.presentation) ctx.drawImage(this.sceneryAssets.mid, p.x, p.y, width, height);
      }
      ctx.fillStyle = '#131b2430';
      ctx.fillRect(p.x, p.y, width, height);
      // A continuous frame and sparse bars communicate that the visible depth is solid.
      ctx.strokeStyle = '#121b20';
      ctx.lineWidth = this.tile * 0.12;
      ctx.strokeRect(p.x + 1, p.y + 1, width - 2, height - 2);
      ctx.strokeStyle = '#b4c3a377';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        p.x + this.tile * 0.14,
        p.y + this.tile * 0.14,
        width - this.tile * 0.28,
        height - this.tile * 0.28,
      );
      ctx.strokeStyle = '#343e3ce8';
      ctx.lineWidth = Math.max(3, this.tile * 0.065);
      ctx.beginPath();
      for (let x = b.x + 1; x < b.x + b.width; x += 3) {
        const at = this.camera.project({ x, y: b.y });
        ctx.moveTo(at.x, at.y);
        ctx.lineTo(at.x, at.y + height);
      }
      ctx.moveTo(p.x, p.y + height - this.tile * 0.25);
      ctx.lineTo(p.x + width, p.y + height - this.tile * 0.25);
      ctx.stroke();
      ctx.restore();
    }
    this.sceneryProps(game, 'depth');
  }

  private sceneryLight(game: Simulation, reduced: boolean): void {
    const ctx = this.context;
    for (const detail of this.composition?.scenery?.floorDetails ?? []) {
      const p = this.camera.project(detail.at);
      if (p.x + this.tile < 0 || p.y + this.tile < 0 || p.x > this.width || p.y > this.playHeight) continue;
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.drawImage(this.tileArt(game.level.biome, 'floor', 1), p.x, p.y, this.tile, this.tile);
      ctx.restore();
    }
    for (const [index, ray] of (this.composition?.scenery?.rays ?? []).entries()) {
      const start = this.camera.project(ray.at),
        end = this.camera.project(rayEnd(ray));
      const radius = (ray.width * this.tile) / 2;
      if (
        Math.max(start.x, end.x) + radius < 0 ||
        Math.max(start.y, end.y) + radius < 0 ||
        Math.min(start.x, end.x) - radius > this.width ||
        Math.min(start.y, end.y) - radius > this.playHeight
      )
        continue;
      const length = Math.hypot(end.x - start.x, end.y - start.y),
        nx = -(end.y - start.y) / length,
        ny = (end.x - start.x) / length;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = rayOpacity(this.touch, reduced, this.clock, index);
      const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      gradient.addColorStop(0, '#ffeebccc');
      gradient.addColorStop(0.8, '#e8d69a35');
      gradient.addColorStop(1, '#e8d69a00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(start.x + nx * 2, start.y + ny * 2);
      ctx.lineTo(end.x + nx * radius, end.y + ny * radius);
      ctx.lineTo(end.x - nx * radius, end.y - ny * radius);
      ctx.lineTo(start.x - nx * 2, start.y - ny * 2);
      ctx.closePath();
      ctx.fill();
      if (!reduced)
        for (let particle = 0; particle < (this.touch ? (index === 0 ? 3 : 0) : 6); particle++) {
          const phase = (this.clock * 0.04 + particle * 0.17 + index * 0.13) % 1,
            side = Math.sin(particle * 3.1) * radius * 0.5 * phase;
          ctx.globalAlpha =
            Math.min(0.12, rayOpacity(this.touch, reduced, this.clock, index) * 0.6) * (1 - phase);
          ctx.fillStyle = '#fff3cc';
          ctx.beginPath();
          ctx.arc(
            start.x + (end.x - start.x) * phase + nx * side,
            start.y + (end.y - start.y) * phase + ny * side,
            1.1,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      ctx.restore();
    }
  }

  /** Caches rough cave textures; variants are deterministic and allocated only once per biome. */
  private tileArt(
    biomeIndex: number,
    kind: 'wall' | 'soil' | 'floor',
    variant: number,
    edges = 0,
    corners = 0,
    wallSides?: number,
  ): HTMLCanvasElement {
    const key = `${this.sceneryAssets?.presentation?.visualTheme ?? 'v6'}:${biomeIndex}:${kind}:${variant}:${wallSides ?? edges}:${corners}`;
    const cached = this.tiles.get(key);
    if (cached) {
      this.tiles.delete(key);
      this.tiles.set(key, cached);
      return cached;
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const atlas = this.terrainAtlases.get(biomeIndex);
    if (this.sceneryAssets?.walls && this.sceneryAssets.floor) {
      const art = this.sceneryAssets;
      const rect =
        kind === 'soil'
          ? { x: (variant % 4) * 128, y: 0, width: 128, height: 128 }
          : kind === 'wall' && art.presentation?.visualTheme === 'storybook'
            ? paintedWallRect(variant)
            : macroRect(kind, variant);
      const image = kind === 'wall' ? art.walls! : kind === 'floor' ? art.floor! : art.terrain;
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, 64, 64);
      if (kind !== 'soil') {
        context.fillStyle = kind === 'floor' ? '#080f1baa' : '#14202a24';
        context.fillRect(0, 0, 64, 64);
      }
      if (kind === 'wall')
        paintSceneryEdges(
          context,
          wallSides ?? edges,
          corners,
          biomeIndex,
          this.sceneryAssets?.presentation?.visualTheme,
          variant,
        );
      if (kind === 'soil') paintTerrainEdges(context, edges, biomeIndex);
    } else if (this.sceneryAssets && atlas) {
      const rect = sceneryTileRect(kind, variant);
      context.drawImage(atlas, rect.x, rect.y, rect.width, rect.height, 0, 0, 64, 64);
      if (kind === 'wall')
        paintSceneryEdges(
          context,
          wallSides ?? edges,
          corners,
          biomeIndex,
          this.sceneryAssets?.presentation?.visualTheme,
          variant,
        );
    } else if (kind !== 'floor') {
      if (atlas) paintBiomeTile(context, atlas, kind, variant);
      else paintCaveTile(context, biomeIndex, kind, variant);
      if (kind === 'soil') punchSoil(context, biomeIndex, variant % 4);
      paintTerrainEdges(context, edges, biomeIndex);
    }
    this.rememberTile(key, canvas);
    return canvas;
  }

  private rememberTile(key: string, canvas: HTMLCanvasElement): void {
    if (this.tiles.size >= 256) {
      const oldest = this.tiles.keys().next().value!;
      const evicted = this.tiles.get(oldest)!;
      evicted.width = evicted.height = 0;
      this.tiles.delete(oldest);
    }
    this.tiles.set(key, canvas);
  }

  /** Grounds sprites with a subtle footprint without obscuring the logical tile. */
  private shadow(): void {
    this.context.fillStyle = '#00000055';
    this.context.beginPath();
    this.context.ellipse(32, 54, 23, 7, 0, 0, Math.PI * 2);
    this.context.fill();
  }

  /** Distinguishes a dormant rooted sprout from the solid, impassable adult bush tile. */
  private bush(buried: boolean, pose?: ColonyPose): void {
    const ctx = this.context;
    if (!buried && this.colonyFace) {
      ctx.save();
      ctx.translate(32 + (pose?.x ?? 0), 32 + (pose?.y ?? 0));
      ctx.rotate(pose?.angle ?? 0);
      ctx.scale(pose?.scaleX ?? 1, pose?.scaleY ?? 1);
      ctx.drawImage(this.colonyFace, -31, -31, 62, 62);
      if (pose && pose.crack > 0) {
        ctx.strokeStyle = `rgba(226,255,135,${pose.crack * 0.9})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-3, -24);
        ctx.lineTo(3, -10);
        ctx.lineTo(-2, 2);
        ctx.lineTo(4, 13);
        ctx.lineTo(0, 25);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.strokeStyle = '#b9cb7e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.lineTo(32, buried ? 35 : 24);
    ctx.moveTo(32, 48);
    ctx.lineTo(19, 58);
    ctx.moveTo(32, 49);
    ctx.lineTo(46, 58);
    ctx.stroke();
    for (const [x, y, radius] of buried
      ? [
          [25, 37, 8],
          [38, 32, 9],
        ]
      : [
          [15, 36, 13],
          [49, 36, 13],
          [23, 21, 15],
          [42, 20, 15],
          [32, 36, 20],
        ]) {
      ctx.fillStyle = buried ? '#91c45b' : '#427e39';
      ctx.strokeStyle = '#afe271';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (!buried) {
      ctx.fillStyle = '#ffe49b';
      ctx.fillRect(23, 32, 5, 5);
      ctx.fillRect(37, 32, 5, 5);
      if (this.bushAtlas) {
        const { image, metadata, crop } = this.bushAtlas;
        const width = (58 * crop.width) / crop.height;
        ctx.drawImage(
          image,
          crop.x,
          metadata.rows.down * metadata.frameHeight + crop.y,
          crop.width,
          crop.height,
          32 - width / 2,
          0,
          width,
          58,
        );
      }
    }
  }

  /** Draws a distinct rounded faceted boulder with the biome palette, never resembling dirt. */
  private rock(variant: number, color: string, light: string): void {
    const ctx = this.context;
    const gradient = ctx.createLinearGradient(10, 8, 45, 58);
    gradient.addColorStop(0, light);
    gradient.addColorStop(0.4, color);
    gradient.addColorStop(1, '#242435');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#0c1020';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(9, 20);
    ctx.lineTo(20 + variant, 7);
    ctx.lineTo(43, 8);
    ctx.lineTo(57, 25);
    ctx.lineTo(53, 47);
    ctx.lineTo(36, 57);
    ctx.lineTo(15, 51);
    ctx.lineTo(6, 35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 12);
    ctx.lineTo(16, 29);
    ctx.lineTo(35, 25);
    ctx.lineTo(47, 15);
    ctx.moveTo(35, 25);
    ctx.lineTo(45, 44);
    ctx.stroke();
  }

  /** Creates four collectible silhouettes and flavour/shape variations using original vector artwork. */
  private pickup(biome: number, variant: number): void {
    const ctx = this.context;
    if (this.sceneryAssets?.authored && this.sceneryAssets.presentation?.collectibleStyle === 'fantasy') {
      ctx.drawImage(
        this.sceneryAssets.authored.actors,
        (Math.abs(variant) % 4) * 128,
        256,
        128,
        128,
        3,
        3,
        58,
        58,
      );
    } else if (this.sceneryAssets?.presentation) {
      const image = this.sceneryAssets.terrain;
      const row = this.sceneryAssets.presentation.collectibleStyle === 'fantasy' ? 3 : 2;
      ctx.drawImage(image, (Math.abs(variant) % 4) * 128, row * 128, 128, 128, 3, 3, 58, 58);
    } else if (biome === 2 && this.tabletAtlas) {
      const image = this.tabletAtlas;
      const rect = raveTabletRect(image.naturalWidth, image.naturalHeight, variant);
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, 64, 64);
    } else if (this.item(collectibleCell(biome, variant))) {
      // Generated art retains the existing glint and required-loot indicator below.
    } else if (biome === 0) {
      drawAmarena(ctx, variant);
    } else if (biome === 1) {
      ctx.save();
      ctx.translate(32, 53);
      ctx.strokeStyle = '#b6e887';
      ctx.lineWidth = 2;
      for (let leaf = -3; leaf <= 3; leaf++) {
        ctx.save();
        ctx.rotate(leaf * 0.38);
        ctx.fillStyle = leaf % 2 ? '#6abd72' : '#9ee17d';
        const length = 44 - Math.abs(leaf) * 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-12, -length * 0.45, 0, -length);
        ctx.quadraticCurveTo(12, -length * 0.45, 0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -length);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } else if (biome === 2) {
      ctx.fillStyle = ['#f08dcc', '#77dcec', '#ffd475', '#a79aff'][variant];
      ctx.strokeStyle = '#fff3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (variant === 1) {
        for (let index = 0; index < 10; index++) {
          const angle = (index * Math.PI) / 5 - Math.PI / 2,
            r = index % 2 ? 12 : 25;
          ctx.lineTo(32 + Math.cos(angle) * r, 32 + Math.sin(angle) * r);
        }
        ctx.closePath();
      } else ctx.roundRect(10, 12, 44, 40, variant === 0 ? 20 : 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#33234566';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(['♥', '★', '+', '•'][variant], 32, 39);
    } else this.bong(32, 36, 1, variant);
    // Small mineral glints stay phase-stable in pause and distinguish loot from dull rock silhouettes.
    const shine = (Math.sin(this.clock * 2.2 + variant * 1.7) + 1) / 2;
    ctx.strokeStyle = `rgba(231,248,255,${0.25 + shine * 0.55})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(48, 7 - shine * 3);
    ctx.lineTo(48, 15 + shine * 3);
    ctx.moveTo(44 - shine * 3, 11);
    ctx.lineTo(52 + shine * 3, 11);
    ctx.stroke();
  }

  /** Draws a readable glass bong, also used at enlarged scale in the victory sequence. */
  bong(x: number, y: number, scale: number, variant = 0): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x - 32 * scale, y - 36 * scale);
    ctx.scale(scale, scale);
    if (this.sceneryAssets?.presentation) {
      this.pickup(3, variant);
      ctx.restore();
      return;
    }
    if (this.item(4 + (Math.abs(Math.trunc(variant)) % 4))) {
      ctx.restore();
      return;
    }
    ctx.fillStyle = ['#65d7d880', '#ac8fe580', '#e5bd7580', '#80db9c80'][variant];
    ctx.strokeStyle = '#c4fff0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(25, 8);
    ctx.lineTo(39, 8);
    ctx.lineTo(39, 32);
    ctx.quadraticCurveTo(57, 52, 42, 57);
    ctx.lineTo(22, 57);
    ctx.quadraticCurveTo(7, 51, 25, 32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(39, 38);
    ctx.lineTo(52, 27);
    ctx.lineTo(57, 33);
    ctx.lineTo(44, 45);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffffffaa';
    ctx.beginPath();
    ctx.moveTo(29, 13);
    ctx.lineTo(29, 31);
    ctx.stroke();
    ctx.fillStyle = '#7ae0df77';
    ctx.fillRect(23, 46, 18, 6);
    ctx.restore();
  }

  /** Draws original uniformed cartoon patrols; the finale character is clearly a fictional caricature. */
  private humanoid(atlas: HeroAtlas, frame: SpriteFrame): void {
    const { image, metadata, crop } = atlas;
    if (metadata.pivot) {
      const scale = 58 / metadata.pivot.y;
      this.context.drawImage(
        image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        32 - metadata.pivot.x * scale,
        58 - metadata.pivot.y * scale,
        frame.width * scale,
        frame.height * scale,
      );
    } else {
      const width = (58 * crop.width) / crop.height;
      this.context.drawImage(
        image,
        frame.x + crop.x,
        frame.y + crop.y,
        crop.width,
        crop.height,
        32 - width / 2,
        0,
        width,
        58,
      );
    }
  }

  private patrol(
    enemy: Enemy,
    trapped: boolean,
    dt = 0,
    paused = true,
    visualMoving?: boolean,
    distance = 0,
  ): void {
    const ctx = this.context,
      boss = enemy.kind === 'boss';
    if (enemy.kind === 'sweeper') {
      if (!this.cartAtlas) throw new Error('Brak grafiki wózka');
      const index = { down: 0, right: 1, up: 2, left: 3 }[enemy.direction];
      ctx.drawImage(this.cartAtlas, (index % 2) * 128, Math.floor(index / 2) * 128, 128, 128, 0, 0, 64, 64);
      return;
    }
    const atlas = this.enemyAtlases.get(enemy.kind);
    if (atlas) {
      const { metadata } = atlas;
      let animator = this.enemyAnimators.get(enemy.id);
      if (!animator) {
        animator = new PatrolAnimator(metadata);
        this.enemyAnimators.set(enemy.id, animator);
      }
      const moving = visualMoving ?? !same(enemy, enemy.previous);
      const frame = animator.update(
        dt,
        FACINGS[enemy.direction],
        moving,
        enemy.chasing,
        paused,
        trapped,
        visualMoving !== undefined,
        distance,
      );
      this.humanoid(atlas, frame);
      if (enemy.chasing) {
        ctx.fillStyle = '#ffdf7e';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('!', 53, 12);
      }
      if (boss && trapped) {
        ctx.fillStyle = '#ffecab';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('♪', 52, 10);
      }
      return;
    }
    // Missing humanoid atlases are a load error, never silently replaced by a stick figure.
    throw new Error(`Brak atlasu przeciwnika: ${enemy.kind}`);
  }

  /** Highlights unlocked exits and distinguishes the final prize from ordinary cave doors. */
  private exit(point: Point, open: boolean, final: boolean, accent: string): void {
    const ctx = this.context,
      tile = this.tile;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(tile / 64, tile / 64);
    ctx.fillStyle = open ? `${accent}33` : '#9a9baa22';
    ctx.strokeStyle = open ? accent : '#818392';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(8, 5, 48, 54, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = open ? accent : '#858896';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(final ? '★' : open ? '↑' : '×', 32, 41);
    if (open) {
      ctx.globalAlpha = 0.2 + Math.sin(this.clock * 3) * 0.1;
      ctx.fillRect(4, 1, 56, 62);
    }
    ctx.restore();
  }
}
