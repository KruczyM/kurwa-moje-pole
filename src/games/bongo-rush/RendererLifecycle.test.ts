import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaveRenderer } from './Renderer';
import { Simulation } from './Simulation';
import { LEVELS } from './Levels';

afterEach(() => vi.unstubAllGlobals());

describe('reopening the same cave on a phone', () => {
  it('retains valid terrain caches and full-canvas clipping after repeated runs and resizes', () => {
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
      expect(viewport).toEqual({ x: 0, y: 0, width, height });
      expect(clips).toContainEqual([0, 0, width, height]);
      expect(renderer.diagnostics().minimap).toBeUndefined();
    }
    // Showing or hiding the overlay must never resize or recenter the cave.
    const game = new Simulation(LEVELS[2]);
    renderer.resize(1912, 760, false);
    renderer.draw(game, undefined, 0, 0, true);
    const before = renderer.diagnostics();
    expect(before.mapBounds!.x).toBeLessThanOrEqual(0.001);
    expect(before.mapBounds!.x + before.mapBounds!.width).toBeGreaterThanOrEqual(1912 - 0.001);
    expect(before.mapBounds!.y).toBeLessThanOrEqual(0.001);
    expect(before.mapBounds!.y + before.mapBounds!.height).toBeGreaterThanOrEqual(760 - 0.001);
    renderer.showMap = true;
    renderer.draw(game, undefined, 0, 0, true);
    expect(renderer.diagnostics().minimap).toBeDefined();
    expect(renderer.diagnostics().viewport).toEqual(before.viewport);
    expect(renderer.diagnostics().mapBounds).toEqual(before.mapBounds);
    expect(renderer.diagnostics().tileSize).toBe(before.tileSize);
    renderer.showMap = false;
    renderer.draw(game, undefined, 0, 0, true);
    expect(renderer.diagnostics().minimap).toBeUndefined();
    expect(renderer.diagnostics().mapBounds).toEqual(before.mapBounds);
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
