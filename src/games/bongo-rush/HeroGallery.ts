import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import { HEROES, HERO_LABELS } from './Progress';
import type { HeroAtlas } from './Renderer';

/** Uses existing cached sprite atlases and the host RAF, never another animation loop. */
export class HeroGallery {
  private entries = new Map<
    string,
    { button: HTMLButtonElement; canvas: HTMLCanvasElement; atlas?: HeroAtlas; animator?: SpriteAnimator }
  >();
  private disposed = false;
  private started = false;
  private selected = '';

  /** Creates accessible thumbnail buttons; complete frames preserve heads and feet. */
  constructor(
    container: HTMLElement,
    private readonly load: (hero: string) => Promise<HeroAtlas>,
    private readonly preview?: HTMLCanvasElement,
    private readonly previewName?: HTMLElement,
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
      this.entries.set(hero, { button, canvas });
    });
  }

  /** Loads at most two character images concurrently to avoid an iPhone decode spike. */
  async prepare(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const queue = [...this.entries].filter(([, entry]) => !entry.atlas);
    const worker = async () => {
      while (queue.length && !this.disposed) {
        const [hero, entry] = queue.shift()!;
        try {
          const atlas = await this.load(hero);
          if (this.disposed) return;
          entry.atlas = atlas;
          entry.animator = new SpriteAnimator(atlas.metadata, {
            preservePhase: true,
            idleFps: 2,
            walkFps: 10,
          });
          entry.button.disabled = false;
          this.paint(hero, 0, true);
        } catch {
          if (!this.disposed)
            entry.button.title = 'Nie wczytano grafiki — ponownie otwórz galerię, aby spróbować.';
        }
      }
    };
    await Promise.all([worker(), worker()]);
    this.started = false;
  }

  /** Keeps selection readable to assistive technologies and does not move keyboard focus. */
  select(hero: string): void {
    this.selected = hero;
    if (this.previewName)
      this.previewName.textContent = HERO_LABELS[HEROES.indexOf(hero as (typeof HEROES)[number])] ?? '';
    for (const [name, entry] of this.entries) {
      entry.button.setAttribute('aria-pressed', String(name === hero));
      this.paint(name, 0, true);
    }
  }

  /** Prevents confirming a missing image after a network failure. */
  ready(hero: string): boolean {
    return Boolean(this.entries.get(hero)?.atlas);
  }

  /** Reports partial network failures without hiding the characters that are already usable. */
  loadedCount(): number {
    return [...this.entries.values()].filter((entry) => entry.atlas).length;
  }

  /** Only the selected portrait animates; all other canvases remain untouched each frame. */
  update(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) this.paint(this.selected, dt, false);
  }

  /** Fits the common alpha bounds inside both dimensions, with margin around the full body. */
  private paint(hero: string, dt: number, frozen: boolean): void {
    const entry = this.entries.get(hero);
    if (!entry?.atlas || !entry.animator) return;
    const { atlas, canvas } = entry;
    const frame = entry.animator.update(dt, 'south', !frozen, false, frozen);
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
    for (const entry of this.entries.values()) entry.canvas.width = entry.canvas.height = 0;
    if (this.preview) this.preview.width = this.preview.height = 0;
    this.entries.clear();
  }
}
