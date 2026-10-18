import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import { HEROES, HERO_LABELS } from './Progress';
import type { HeroAtlas } from './Renderer';

/** Uses existing cached sprite atlases and the host RAF, never another animation loop. */
export class HeroGallery {
  private entries = new Map<
    string,
    {
      button: HTMLButtonElement;
      canvas: HTMLCanvasElement;
      ready: boolean;
      atlas?: HeroAtlas;
      animator?: SpriteAnimator;
    }
  >();
  private disposed = false;
  private started = false;
  private selected = '';
  private active = false;
  private generation = 0;
  private restartRequested = false;
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly requests = new Map<string, Promise<HeroAtlas>>();

  /** Creates accessible thumbnail buttons; complete frames preserve heads and feet. */
  constructor(
    container: HTMLElement,
    private readonly load: (hero: string) => Promise<HeroAtlas>,
    private readonly preview?: HTMLCanvasElement,
    private readonly previewName?: HTMLElement,
    private readonly release: (hero: string) => void = () => {},
    private readonly changed: () => void = () => {},
  ) {
    container.replaceChildren();
    HEROES.forEach((hero, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.hero = hero;
      button.disabled = true;
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 112;
      canvas.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = HERO_LABELS[index];
      button.append(canvas, label);
      container.append(button);
      this.entries.set(hero, { button, canvas, ready: false });
    });
  }

  /** Loads at most two character images concurrently to avoid an iPhone decode spike. */
  async prepare(): Promise<void> {
    if (this.started) {
      this.restartRequested = true;
      return;
    }
    this.started = true;
    const generation = this.generation;
    const queue = [...this.entries].filter(([, entry]) => !entry.ready);
    const worker = async () => {
      while (queue.length && !this.disposed && generation === this.generation) {
        const [hero, entry] = queue.shift()!;
        try {
          const atlas = await this.request(hero);
          this.install(hero, atlas);
        } catch {
          if (!this.disposed)
            entry.button.title = 'Nie wczytano grafiki — ponownie otwórz galerię, aby spróbować.';
        }
      }
    };
    await Promise.all([worker(), worker()]);
    this.started = false;
    if (this.restartRequested && this.active && !this.disposed) {
      this.restartRequested = false;
      void this.prepare();
    }
  }

  private request(hero: string): Promise<HeroAtlas> {
    const existing = this.requests.get(hero);
    if (existing) return existing;
    const pending = (async () => {
      if (this.running < 2) this.running++;
      else await new Promise<void>((resolve) => this.waiting.push(resolve));
      try {
        return await this.load(hero);
      } finally {
        const next = this.waiting.shift();
        if (next) next();
        else this.running--;
      }
    })().finally(() => this.requests.delete(hero));
    this.requests.set(hero, pending);
    return pending;
  }

  private install(hero: string, atlas: HeroAtlas): void {
    const entry = this.entries.get(hero);
    if (this.disposed || !entry) {
      this.release(hero);
      return;
    }
    entry.atlas = atlas;
    entry.animator = new SpriteAnimator(atlas.metadata, {
      preservePhase: true,
      idleFps: atlas.metadata.idleFps ?? 3,
    });
    entry.ready = true;
    entry.button.disabled = false;
    this.paint(hero, 0, true);
    if (!this.active || hero !== this.selected) {
      entry.atlas = undefined;
      entry.animator = undefined;
      this.release(hero);
    }
    this.changed();
  }

  /** Thumbnail pixels survive closing the gallery; full atlas references do not. */
  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.generation++;
      for (const [hero, entry] of this.entries) {
        entry.atlas = undefined;
        entry.animator = undefined;
        this.release(hero);
      }
    }
  }

  retains(hero: string): boolean {
    return this.active && this.selected === hero;
  }

  /** Reuses retained thumbnail pixels in the title without retaining another full atlas. */
  copyThumbnail(hero: string, target: HTMLCanvasElement): boolean {
    const entry = this.entries.get(hero);
    if (!entry?.ready) return false;
    const context = target.getContext('2d')!;
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(entry.canvas, 0, 0, target.width, target.height);
    return true;
  }

  diagnostics() {
    return {
      fullAtlases: [...this.entries.values()].filter((entry) => entry.atlas).length,
      thumbnailBytes:
        this.entries.size * 96 * 112 * 4 + (this.preview ? this.preview.width * this.preview.height * 4 : 0),
    };
  }

  /** Keeps selection readable to assistive technologies and does not move keyboard focus. */
  select(hero: string): void {
    this.selected = hero;
    if (this.previewName)
      this.previewName.textContent = HERO_LABELS[HEROES.indexOf(hero as (typeof HEROES)[number])] ?? '';
    for (const [name, entry] of this.entries) {
      if (name !== hero && entry.atlas) {
        entry.atlas = undefined;
        entry.animator = undefined;
        this.release(name);
      }
      entry.button.setAttribute('aria-pressed', String(name === hero));
      this.paint(name, 0, true);
    }
    const entry = this.entries.get(hero);
    if (this.active && entry && !entry.atlas)
      void this.request(hero)
        .then((atlas) => this.install(hero, atlas))
        .catch(() => {
          if (!this.disposed) {
            entry.button.title = 'Nie wczytano grafiki — spróbuj ponownie.';
            this.changed();
          }
        });
    if (entry?.ready && this.preview && !entry.atlas) {
      const context = this.preview.getContext('2d')!;
      context.clearRect(0, 0, this.preview.width, this.preview.height);
      context.drawImage(entry.canvas, 0, 0, this.preview.width, this.preview.height);
    }
  }

  /** Prevents confirming a missing image after a network failure. */
  ready(hero: string): boolean {
    return Boolean(this.entries.get(hero)?.atlas);
  }

  /** Reports partial network failures without hiding the characters that are already usable. */
  loadedCount(): number {
    return [...this.entries.values()].filter((entry) => entry.ready).length;
  }

  /** Only the selected portrait animates; all other canvases remain untouched each frame. */
  update(dt: number, reducedMotion: boolean): void {
    if (this.active && !reducedMotion) this.paint(this.selected, dt, false);
  }

  /** Fits the common alpha bounds inside both dimensions, with margin around the full body. */
  private paint(hero: string, dt: number, frozen: boolean): void {
    const entry = this.entries.get(hero);
    if (!entry?.atlas || !entry.animator) return;
    const { atlas, canvas } = entry;
    const frame = entry.animator.update(dt, 'south', false, false, frozen);
    const crop = atlas.crop;
    const scale = Math.min(80 / crop.width, 96 / crop.height);
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, 96, 112);
    context.imageSmoothingEnabled = true;
    context.drawImage(
      atlas.image,
      frame.x + crop.x,
      frame.y + crop.y,
      crop.width,
      crop.height,
      (96 - crop.width * scale) / 2,
      (112 - crop.height * scale) / 2,
      crop.width * scale,
      crop.height * scale,
    );
    if (hero === this.selected && this.preview) {
      const preview = this.preview.getContext('2d')!;
      preview.clearRect(0, 0, this.preview.width, this.preview.height);
      preview.imageSmoothingEnabled = true;
      preview.drawImage(canvas, 0, 0, this.preview.width, this.preview.height);
    }
  }

  /** Disposes owned canvases while leaving the global image cache intact. */
  dispose(): void {
    this.disposed = true;
    this.setActive(false);
    for (const entry of this.entries.values()) entry.canvas.width = entry.canvas.height = 0;
    if (this.preview) this.preview.width = this.preview.height = 0;
    this.entries.clear();
  }
}
