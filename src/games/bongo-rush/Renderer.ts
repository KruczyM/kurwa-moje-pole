import { CameraRig } from '../after/presentation/CameraRig';
import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import { PatrolAnimator } from './PatrolAnimator';
import type { SpriteMetadata } from '../after/presentation/SpriteAnimator';
import type { Facing } from '../after/simulation/WorldState';
import { BIOMES } from './Levels';
import { paintCaveTile } from './CaveVisuals';
import { biomeTileRect, paintBiomeTile, terrainVariant } from './BiomeTiles';
import { drawAmarena } from './AmarenaArt';
import { caveTileSize, collectibleCell, raveTabletRect } from './ArtDirection';
import { same } from './types';
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
  private atlas?: HeroAtlas;
  private bushAtlas?: HeroAtlas;
  private enemyAtlases = new Map<string, HeroAtlas>();
  private enemyAnimators = new Map<number, PatrolAnimator>();
  private enemyAnimationTick = -1;
  private terrainLayout?: TerrainPlacement;
  private width = 1;
  private height = 1;
  private tile = 40;
  private tiles = new Map<string, HTMLCanvasElement>();
  private terrainAtlases = new Map<number, HTMLImageElement>();
  private itemAtlas?: HTMLImageElement;
  private tabletAtlas?: HTMLImageElement;
  private depthAtlas?: HTMLImageElement;
  private depthAnchor: Point = { x: 0, y: 0 };
  private readonly motionPreference =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  private clock = 0;
  private readonly debris = new VisualEffects();
  private playHeight = 1;
  private readonly topInset = 58;
  private world?: World;
  showMap = true;
  private map?: HTMLCanvasElement;
  private mapTick = -1;

  /** Receives an existing canvas context and never owns animation scheduling or asset loading. */
  constructor(private readonly context: CanvasRenderingContext2D) {}

  /** Receives sound observations from the fixed simulation step without changing the simulation. */
  effects(world: World, sounds: readonly SoundEvent[]): void {
    this.debris.observe(world, sounds);
  }

  /** Read-only counters for the existing DEV snapshot; no canvas or simulation state escapes. */
  diagnostics() {
    return {
      cachedTiles: this.tiles.size,
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

  /** Rave uses pressed tablets while other biomes keep their existing item sheet. */
  tablets(image: HTMLImageElement | undefined): void {
    this.tabletAtlas = image;
  }

  /** Receives the shared transparent frame atlas, never owns a second loader or camera. */
  depth(image: HTMLImageElement): void {
    this.depthAtlas = image;
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
    this.animator = new SpriteAnimator(atlas.metadata);
  }

  /** Uses Kobra's existing artwork exclusively for the non-playable spreading Krzak. */
  bushHero(atlas: HeroAtlas): void {
    this.bushAtlas = atlas;
  }

  /** Installs baked views of the generated 3D models without loading heavy GLBs during gameplay. */
  enemyHeroes(red: HeroAtlas, blue: HeroAtlas, undercover: HeroAtlas, boss: HeroAtlas): void {
    this.enemyAtlases.set('red', red);
    this.enemyAtlases.set('blue', blue);
    this.enemyAtlases.set('undercover', undercover);
    this.enemyAtlases.set('boss', boss);
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
  resize(width: number, height: number, touch = false): void {
    this.width = width;
    this.height = height;
    const bottomInset = touch ? (height < 400 ? 115 : 150) : 12;
    this.playHeight = Math.max(90, height - this.topInset - bottomInset);
    this.tile = caveTileSize(width, this.playHeight);
    this.camera.resize({ width, height: this.playHeight, pixelsPerMeter: this.tile });
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
    this.tabletAtlas = undefined;
    this.depthAtlas = undefined;
    this.animator = undefined;
    this.atlas = undefined;
    this.bushAtlas = undefined;
    this.enemyAtlases.clear();
    this.enemyAnimators.clear();
    this.terrainLayout = undefined;
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
    if (this.world !== world) {
      this.world = world;
      this.terrainLayout = buildTerrainLayout(world, game.level.id * 4 + game.level.biome);
      this.enemyAnimators.clear();
      this.enemyAnimationTick = -1;
      this.debris.clear();
      // One active instance of the existing camera, with this cave's real bounds rather than 24x18.
      this.camera = new CameraRig({ width: world.width, height: world.height });
      this.camera.resize({ width: this.width, height: this.playHeight, pixelsPerMeter: this.tile });
      this.mapTick = -1;
      this.camera.snap({ x: playerPoint.x + 0.5, y: playerPoint.y + 0.5 });
      const origin = this.camera.project({ x: 0, y: 0 });
      this.depthAnchor = {
        x: (this.width / 2 - origin.x) / this.tile,
        y: (this.playHeight / 2 - origin.y) / this.tile,
      };
    }
    this.camera.follow({ x: playerPoint.x + 0.5, y: playerPoint.y + 0.5 }, dt, paused);
    if (this.enemyAnimationTick !== world.tick) {
      this.enemyAnimationTick = world.tick;
      for (const id of this.enemyAnimators.keys())
        if (!world.enemies.some((enemy) => enemy.id === id)) this.enemyAnimators.delete(id);
    }
    const anchor = this.camera.project(this.depthAnchor);
    const displacement = { x: this.width / 2 - anchor.x, y: this.playHeight / 2 - anchor.y };
    if (background) this.depthLayer(background, game.level.biome, 0, displacement);
    paintSceneMotion(ctx, this.width, this.height, game.level.biome, this.clock, false, reduced);
    ctx.fillStyle = '#07101855';
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.depthAtlas) this.depthLayer(this.depthAtlas, game.level.biome, 1, displacement);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.topInset, this.width, this.playHeight);
    ctx.clip();
    ctx.translate(0, this.topInset);
    const origin = this.camera.project({ x: 0, y: 0 });
    const firstX = Math.max(0, Math.floor(-origin.x / this.tile) - 1);
    const firstY = Math.max(0, Math.floor(-origin.y / this.tile) - 1);
    const lastX = Math.min(world.width, Math.ceil((this.width - origin.x) / this.tile) + 1);
    const lastY = Math.min(world.height, Math.ceil((this.playHeight - origin.y) / this.tile) + 1);
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
        const cell = world.cells[y * world.width + x];
        if (cell === 'wall' || cell === 'soil' || cell === 'buried-bush') {
          if (cell !== 'wall') {
            ctx.fillStyle = '#070b1299';
            ctx.fillRect(position.x, position.y, this.tile + 0.5, this.tile + 0.5);
          }
          ctx.drawImage(
            this.tileArt(
              game.level.biome,
              cell === 'wall' ? 'wall' : 'soil',
              this.terrainLayout?.cells[y * world.width + x] ?? terrainVariant(x, y),
              terrainEdges(world, x, y),
            ),
            position.x,
            position.y,
            this.tile + 0.5,
            this.tile + 0.5,
          );
        } else {
          ctx.fillStyle = '#090f1966';
          ctx.fillRect(position.x, position.y, this.tile + 0.5, this.tile + 0.5);
          if (cell === 'exit') this.exit(position, game.exitOpen, game.level.id === 12, biome.accent);
        }
        if (
          cell === 'bush' ||
          cell === 'buried-bush' ||
          world.bushRoots.some((root) => same(root, { x, y }))
        ) {
          ctx.save();
          ctx.translate(position.x, position.y);
          ctx.scale(this.tile / 64, this.tile / 64);
          this.bush(cell === 'buried-bush');
          ctx.restore();
        }
      }
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
      const position = this.camera.project(this.interpolate(body, alpha));
      if (
        position.x < -this.tile * 2 ||
        position.y < -this.tile * 2 ||
        position.x > this.width ||
        position.y > this.playHeight
      )
        continue;
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.scale(this.tile / 64, this.tile / 64);
      this.shadow();
      if ('kind' in body) {
        if (body.kind === 'rock') {
          if (!this.item(3)) this.rock(body.variant, biome.wall, biome.light);
        } else if (body.kind === 'pickup') {
          this.pickup(game.level.biome, body.variant);
          if (body.required) {
            ctx.strokeStyle = '#ffdf68';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(32, 31, 27, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else this.patrol(body as Enemy, world.trapped, dt, paused);
      } else if (this.atlas && this.animator) {
        const moving = !same(body, body.previous) && world.status === 'playing';
        const frame = this.animator.update(dt, FACINGS[body.direction], moving, false, paused);
        const crop = this.atlas.crop;
        const width = (58 * crop.width) / crop.height;
        ctx.drawImage(
          this.atlas.image,
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
      ctx.restore();
    }
    this.debris.update(dt, paused, reduced);
    ctx.fillStyle = biome.light;
    for (const chip of this.debris.chips) {
      const point = this.camera.project(chip);
      ctx.globalAlpha = Math.max(0, chip.life / 0.42) * 0.7;
      ctx.fillRect(point.x, point.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    this.atmosphere(playerPoint);
    if (this.depthAtlas) this.depthLayer(this.depthAtlas, game.level.biome, 2, displacement);
    if (this.showMap) this.minimap(world);
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
    const width = Math.min(
      this.width < 650 ? 96 : 156,
      ((this.playHeight - 26) * world.width) / world.height,
    );
    const scale = width / world.width,
      height = world.height * scale;
    const x = this.width - width - 14,
      y = this.topInset + 8;
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

  /** Caches rough cave textures; variants are deterministic and allocated only once per biome. */
  private tileArt(biomeIndex: number, kind: 'wall' | 'soil', variant: number, edges = 0): HTMLCanvasElement {
    const key = `${biomeIndex}:${kind}:${variant}:${edges}`;
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
    if (atlas) paintBiomeTile(context, atlas, kind, variant);
    else paintCaveTile(context, biomeIndex, kind, variant);
    if (kind === 'soil') punchSoil(context, biomeIndex, variant % 4);
    paintTerrainEdges(context, edges, biomeIndex);
    if (this.tiles.size >= 256) {
      const oldest = this.tiles.keys().next().value!;
      const evicted = this.tiles.get(oldest)!;
      evicted.width = evicted.height = 0;
      this.tiles.delete(oldest);
    }
    this.tiles.set(key, canvas);
    return canvas;
  }

  /** Grounds sprites with a subtle footprint without obscuring the logical tile. */
  private shadow(): void {
    this.context.fillStyle = '#00000055';
    this.context.beginPath();
    this.context.ellipse(32, 54, 23, 7, 0, 0, Math.PI * 2);
    this.context.fill();
  }

  /** Distinguishes a dormant rooted sprout from the solid, impassable adult bush tile. */
  private bush(buried: boolean): void {
    const ctx = this.context;
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
    if (biome === 2 && this.tabletAtlas) {
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
  private patrol(enemy: Enemy, trapped: boolean, dt = 0, paused = true): void {
    const ctx = this.context,
      boss = enemy.kind === 'boss';
    if (enemy.kind === 'sweeper') {
      ctx.fillStyle = '#17252c';
      ctx.fillRect(9, 9, 46, 46);
      ctx.strokeStyle = '#f2b45a';
      ctx.lineWidth = 3;
      ctx.strokeRect(9, 9, 46, 46);
      ctx.lineWidth = 1.5;
      for (let offset = 18; offset <= 46; offset += 9) {
        ctx.beginPath();
        ctx.moveTo(offset, 10);
        ctx.lineTo(offset, 54);
        ctx.moveTo(10, offset);
        ctx.lineTo(54, offset);
        ctx.stroke();
      }
      return;
    }
    const atlas = this.enemyAtlases.get(enemy.kind);
    if (atlas) {
      const { crop, image, metadata } = atlas;
      let animator = this.enemyAnimators.get(enemy.id);
      if (!animator) {
        animator = new PatrolAnimator(metadata);
        this.enemyAnimators.set(enemy.id, animator);
      }
      const moving = !same(enemy, enemy.previous);
      const frame = animator.update(dt, FACINGS[enemy.direction], moving, enemy.chasing, paused, trapped);
      const width = (58 * crop.width) / crop.height;
      ctx.drawImage(
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
