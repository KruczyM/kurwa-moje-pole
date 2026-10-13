import { afterEach, expect, it, vi } from 'vitest';
import { CaveRenderer } from './Renderer';

afterEach(() => vi.unstubAllGlobals());

it('bounds cached tiles, refreshes LRU entries and releases backing stores on eviction/dispose', () => {
  const context = new Proxy({}, { set: () => true, get: () => () => context }) as CanvasRenderingContext2D;
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const renderer = new CaveRenderer(context);
  const art = renderer as unknown as {
    tileArt: (biome: number, kind: 'wall', variant: number) => HTMLCanvasElement;
  };
  const tiles = Array.from({ length: 300 }, (_, index) => art.tileArt(0, 'wall', index));
  expect(renderer.diagnostics().cachedTiles).toBe(256);
  expect(tiles[0].width).toBe(0);
  expect(art.tileArt(0, 'wall', 44)).toBe(tiles[44]);
  art.tileArt(0, 'wall', 300);
  expect(tiles[44].width).toBe(64);
  expect(tiles[45].width).toBe(0);
  renderer.dispose();
  expect(renderer.diagnostics().cachedTiles).toBe(0);
  for (const tile of tiles) expect(tile.width).toBe(0);
});
