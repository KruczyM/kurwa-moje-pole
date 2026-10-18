import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIOME_TILE_ATLASES, biomeTileRect, paintBiomeTile, terrainVariant } from './BiomeTiles';

describe('generated biome terrain atlases', () => {
  it.each(BIOME_TILE_ATLASES)('ships a valid square PNG containing all four regions: %s', (file) => {
    const png = readFileSync(`public/game-assets/2d/bongo-rush/tiles-ai/${file}`);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const width = png.readUInt32BE(16),
      height = png.readUInt32BE(20);
    expect(width).toBeGreaterThanOrEqual(512);
    const rects = ['wall', 'soil'].flatMap((kind) =>
      [0, 1].map((variant) => biomeTileRect(width, height, kind as 'wall' | 'soil', variant)),
    );
    expect(new Set(rects.map((rect) => `${rect.x},${rect.y}`)).size).toBe(4);
    for (const rect of rects) {
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    }
  });

  it('maps top regions to walls and bottom regions to diggable earth, independent of display resolution', () => {
    expect(biomeTileRect(1024, 1024, 'wall', 0)).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(biomeTileRect(1024, 1024, 'soil', 1)).toEqual({ x: 512, y: 512, width: 512, height: 512 });
    expect(() => biomeTileRect(1001, 1001, 'wall', 0)).toThrow();
    expect(() => biomeTileRect(1024, 512, 'wall', 0)).toThrow();
  });

  it('keeps scattered variant choice repeatable across redraws and restarts', () => {
    const values = Array.from({ length: 100 }, (_, i) => terrainVariant(i % 10, Math.floor(i / 10)));
    expect(new Set(values)).toEqual(new Set([0, 1]));
    expect(values).toEqual(Array.from({ length: 100 }, (_, i) => terrainVariant(i % 10, Math.floor(i / 10))));
    expect(values.slice(0, 10)).not.toEqual(values.slice(10, 20));
  });

  it('samples only its quadrant and restores drawing state after a single cache bake', () => {
    const calls: unknown[] = [];
    const context = new Proxy(
      {},
      {
        set: () => true,
        get:
          (_, name) =>
          (...args: unknown[]) =>
            calls.push([name, ...args]),
      },
    ) as CanvasRenderingContext2D;
    const image = { naturalWidth: 1024, naturalHeight: 1024 } as HTMLImageElement;
    paintBiomeTile(context, image, 'soil', 1);
    expect(calls).toContainEqual(['drawImage', image, 512, 512, 512, 512, 0, 0, 64, 64]);
    expect(calls[0]).toEqual(['save']);
    expect(calls.at(-1)).toEqual(['restore']);
  });
});
