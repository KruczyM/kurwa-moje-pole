import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaveRenderer } from './Renderer';
import { Simulation } from './Simulation';
import { LEVELS } from './Levels';

afterEach(() => vi.unstubAllGlobals());

describe('reopening the same cave on a phone', () => {
  it('retains valid terrain caches and gameplay-only clipping after repeated runs and resizes', () => {
    const images: unknown[][] = [],
      clips: number[][] = [];
    const makeContext = (record: boolean) =>
      new Proxy(
        {},
        {
          set: () => true,
          get: (_, key) => {
            if (key === 'createRadialGradient' || key === 'createLinearGradient')
              return () => ({ addColorStop() {} });
            if (key === 'drawImage')
              return (...args: unknown[]) => {
                if (record) images.push(args);
              };
            if (key === 'rect')
              return (...args: number[]) => {
                if (record) clips.push(args);
              };
            return () => {};
          },
        },
      ) as CanvasRenderingContext2D;
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => makeContext(false) }),
    });
    const renderer = new CaveRenderer(makeContext(true));
    const terrain = { naturalWidth: 1024, naturalHeight: 1024 } as HTMLImageElement;
    for (const [width, height] of [
      [390, 700],
      [390, 700],
      [390, 650],
      [800, 320],
      [667, 230],
    ]) {
      renderer.resize(width, height, true);
      renderer.terrain(0, terrain);
      renderer.draw(new Simulation(LEVELS[0]), undefined, 0, 0, true);
      const viewport = renderer.diagnostics().viewport;
      expect(clips).toContainEqual([0, 58, width, viewport.height]);
      expect(viewport.y + viewport.height).toBeLessThanOrEqual(height - (height < 400 ? 160 : 220));
      const map = renderer.diagnostics().minimap;
      if (map) expect(map.y - 5).toBeGreaterThanOrEqual(viewport.y + viewport.height);
    }
    // The measured compact CSS strips leave three full 40px rows on small phone landscape.
    for (const [width, height] of [
      [568, 272],
      [640, 312],
      [667, 327],
    ]) {
      renderer.resize(width, height, true, 88, 0, 64);
      renderer.draw(new Simulation(LEVELS[0]), undefined, 0, 0, true);
      const { viewport, minimap } = renderer.diagnostics();
      expect(viewport.height).toBeGreaterThanOrEqual(120);
      expect(clips).toContainEqual([0, 64, width, viewport.height]);
      expect(minimap!.y - 5).toBeGreaterThanOrEqual(viewport.y + viewport.height);
    }
    const cachedTerrain = images
      .map((args) => args[0])
      .filter(
        (image): image is HTMLCanvasElement =>
          typeof image === 'object' &&
          image !== null &&
          'getContext' in image &&
          (image as HTMLCanvasElement).width === 64,
      );
    expect(cachedTerrain.length).toBeGreaterThan(100);
    // Two materials × two variants × sixteen exposed-edge masks is still a bounded cache.
    expect(new Set(cachedTerrain).size).toBeLessThanOrEqual(64);
    renderer.dispose();
    expect(cachedTerrain.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });
});
