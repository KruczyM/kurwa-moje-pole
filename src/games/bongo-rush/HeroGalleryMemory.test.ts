import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroGallery } from './HeroGallery';
import { HEROES } from './Progress';
import metadata from '../../../public/game-assets/2d/bongo-rush/characters-v6/amper/meta.json';
import type { HeroAtlas } from './Renderer';
class Element {
  children: Element[] = [];
  dataset: Record<string, string> = {};
  width = 0;
  height = 0;
  disabled = false;
  type = '';
  textContent = '';
  title = '';
  append(...children: Element[]) {
    this.children.push(...children);
  }
  replaceChildren() {
    this.children = [];
  }
  setAttribute() {}
  getContext() {
    return { clearRect() {}, drawImage() {}, imageSmoothingEnabled: true };
  }
}
afterEach(() => vi.unstubAllGlobals());
describe('gallery atlas ownership', () => {
  it('retains thumbnail pixels, at most one preview atlas, and releases every full atlas when closed', async () => {
    vi.stubGlobal('document', { createElement: () => new Element() });
    const requests = new Map<string, number>(),
      released = new Set<string>();
    let active = 0,
      maximum = 0;
    const gallery = new HeroGallery(
      new Element() as unknown as HTMLElement,
      async (hero) => {
        requests.set(hero, (requests.get(hero) ?? 0) + 1);
        active++;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active--;
        return {
          image: {} as HTMLImageElement,
          metadata,
          crop: { x: 0, y: 0, width: 128, height: 128 },
        } satisfies HeroAtlas;
      },
      new Element() as unknown as HTMLCanvasElement,
      undefined,
      (hero) => released.add(hero),
    );
    gallery.setActive(true);
    gallery.select('amper');
    await gallery.prepare();
    expect(gallery.loadedCount()).toBe(15);
    expect(gallery.ready('amper')).toBe(true);
    expect(gallery.diagnostics().fullAtlases).toBe(1);
    expect(maximum).toBeLessThanOrEqual(2);
    expect(released.has('antena')).toBe(true);
    expect(released.has('amper')).toBe(false);
    gallery.setActive(false);
    expect(gallery.diagnostics().fullAtlases).toBe(0);
    expect(gallery.loadedCount()).toBe(15);
    expect(released.size).toBe(HEROES.length);
    gallery.setActive(true);
    gallery.select('antena');
    await gallery.prepare();
    for (let i = 0; i < 20 && !gallery.ready('antena'); i++) await Promise.resolve();
    expect(gallery.ready('antena')).toBe(true);
    expect(gallery.diagnostics().fullAtlases).toBe(1);
    expect(requests.get('antena')).toBe(2);
    expect(requests.get('korba')).toBe(1);
    gallery.dispose();
    expect(gallery.diagnostics().fullAtlases).toBe(0);
  });
});
