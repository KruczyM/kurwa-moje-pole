import { CameraRig } from '../after/presentation/CameraRig';
import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import type { SpriteMetadata } from '../after/presentation/SpriteAnimator';
import type { Facing } from '../after/simulation/WorldState';
import { BIOMES } from './Levels';
import { paintCaveTile } from './CaveVisuals';
import { same } from './types';
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
  private width = 1;
  private height = 1;
  private tile = 40;
  private tiles = new Map<string, HTMLCanvasElement>();
  private clock = 0;
  private playHeight = 1;
  private readonly topInset = 58;
  private world?: World;
  showMap = true;
  private map?: HTMLCanvasElement;
  private mapTick = -1;

  /** Receives an existing canvas context and never owns animation scheduling or asset loading. */
  constructor(private readonly context: CanvasRenderingContext2D) {}

  /** Swaps cosmetic art only; there is no character-specific simulation configuration. */
  hero(atlas: HeroAtlas): void {
    this.atlas = atlas;
    this.animator = new SpriteAnimator(atlas.metadata);
  }

  /** Uses Kobra's existing artwork exclusively for the non-playable spreading Krzak. */
  bushHero(atlas: HeroAtlas): void {
    this.bushAtlas = atlas;
  }

  /** Fits desktop caves and keeps mobile tiles large enough to read while the camera follows. */
  resize(width: number, height: number, touch = false): void {
    this.width = width;
    this.height = height;
    const bottomInset = touch ? (height < 400 ? 115 : 150) : 12;
    this.playHeight = Math.max(90, height - this.topInset - bottomInset);
    this.tile = Math.max(34, Math.min(58, width / 25, this.playHeight / 19));
    this.camera.resize({ width, height: this.playHeight, pixelsPerMeter: this.tile });
  }

  /** Clears only renderer-owned canvases and animation state; shared images remain cached. */
  dispose(): void {
    for (const tile of this.tiles.values()) {
      tile.width = 0;
      tile.height = 0;
    }
    this.tiles.clear();
    this.animator = undefined;
    this.atlas = undefined;
    this.bushAtlas = undefined;
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
  ): void {
    const ctx = this.context,
      world = game.world,
      biome = BIOMES[game.level.biome];
    if (!paused) this.clock += dt;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#101725';
    ctx.fillRect(0, 0, this.width, this.height);
    if (background) {
      const scale = Math.max(this.width / background.width, this.height / background.height);
      const width = background.width * scale,
        height = background.height * scale;
      ctx.drawImage(background, (this.width - width) / 2, (this.height - height) / 2, width, height);
    }
    ctx.fillStyle = '#071018a8';
    ctx.fillRect(0, 0, this.width, this.height);
    const playerPoint = this.interpolate(world.player, alpha);
    if (this.world !== world) {
      this.world = world;
      // One active instance of the existing camera, with this cave's real bounds rather than 24x18.
      this.camera = new CameraRig({ width: world.width, height: world.height });
      this.camera.resize({ width: this.width, height: this.playHeight, pixelsPerMeter: this.tile });
      this.mapTick = -1;
      this.camera.snap({ x: playerPoint.x + 0.5, y: playerPoint.y + 0.5 });
    }
    this.camera.follow({ x: playerPoint.x + 0.5, y: playerPoint.y + 0.5 }, dt, paused);
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
          ctx.drawImage(
            this.tileArt(game.level.biome, cell === 'wall' ? 'wall' : 'soil', (x + y * 3) % 3),
            position.x,
            position.y,
            this.tile + 0.5,
            this.tile + 0.5,
          );
        } else {
          ctx.fillStyle = '#090f19c9';
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
        if (body.kind === 'rock') this.rock(body.variant, biome.wall, biome.light);
        else if (body.kind === 'pickup') this.pickup(game.level.biome, body.variant);
        else this.patrol(body as Enemy, world.trapped);
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
    ctx.restore();
    this.atmosphere(playerPoint);
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
        map.fillStyle = body.kind === 'pickup' ? '#e5c795' : '#384850';
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
  private tileArt(biomeIndex: number, kind: 'wall' | 'soil', variant: number): HTMLCanvasElement {
    const key = `${biomeIndex}:${kind}:${variant}`;
    const cached = this.tiles.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    paintCaveTile(canvas.getContext('2d')!, biomeIndex, kind, variant);
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
    if (biome === 0) {
      ctx.fillStyle = ['#a6315e', '#9a3d8f', '#bd7539', '#7f3d74'][variant];
      ctx.strokeStyle = '#f3c090';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(19, 23, 26, 34, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(26, 8, 12, 20);
      ctx.fillStyle = '#d6ac82';
      ctx.fillRect(25, 7, 14, 6);
      ctx.fillStyle = '#f6e6c8';
      ctx.fillRect(21, 33, 22, 13);
      ctx.fillStyle = '#83364e';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', 32, 43);
      ctx.strokeStyle = '#ffffff77';
      ctx.beginPath();
      ctx.moveTo(23, 25);
      ctx.lineTo(23, 31);
      ctx.stroke();
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
  private patrol(enemy: Enemy, trapped: boolean): void {
    const ctx = this.context,
      boss = enemy.kind === 'boss';
    ctx.fillStyle = '#24263a';
    ctx.beginPath();
    ctx.roundRect(13, 44, 15, 14, 5);
    ctx.roundRect(36, 44, 15, 14, 5);
    ctx.fill();
    ctx.fillStyle = boss
      ? '#df554e'
      : enemy.kind === 'red'
        ? '#cf5465'
        : enemy.kind === 'blue'
          ? '#5484cf'
          : '#777489';
    ctx.strokeStyle = '#111725';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(12, 25, 40, 28, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8b48d';
    ctx.beginPath();
    ctx.ellipse(32, 19, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = boss ? '#d4c5a5' : '#29283d';
    ctx.beginPath();
    ctx.ellipse(32, 8, 18, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = boss ? '#f0dc59' : '#111725';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 16, 12, 8);
    ctx.strokeRect(34, 16, 12, 8);
    ctx.beginPath();
    ctx.moveTo(30, 19);
    ctx.lineTo(34, 19);
    ctx.stroke();
    ctx.fillStyle = boss ? '#ffe98d' : '#ffffffaa';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(boss ? '♥' : enemy.kind === 'undercover' ? '?' : 'P', 32, 43);
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
