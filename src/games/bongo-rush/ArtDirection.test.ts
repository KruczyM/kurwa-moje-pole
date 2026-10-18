import { describe, expect, it } from 'vitest';
import { caveTileSize, collectibleCell, raveTabletRect } from './ArtDirection';

describe('closer cave artwork', () => {
  it('samples four separate tablet designs and wraps variants inside the sheet', () => {
    expect(raveTabletRect(1024, 1024, 0)).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(raveTabletRect(1024, 1024, 1)).toEqual({ x: 512, y: 0, width: 512, height: 512 });
    expect(raveTabletRect(1024, 1024, 2)).toEqual({ x: 0, y: 512, width: 512, height: 512 });
    expect(raveTabletRect(1024, 1024, 3)).toEqual({ x: 512, y: 512, width: 512, height: 512 });
    expect(raveTabletRect(1024, 1024, 7)).toEqual(raveTabletRect(1024, 1024, 3));
  });
  it('keeps desktop tiles larger without hiding nearby hazards on mobile', () => {
    expect(caveTileSize(1440, 790)).toBeGreaterThan(60);
    expect(caveTileSize(390, 540)).toBe(40);
    expect(caveTileSize(3840, 2000)).toBe(80);
    for (const [width, height] of [
      [1912, 760],
      [390, 747],
      [568, 272],
      [3840, 2000],
    ]) {
      for (const [columns, rows] of [
        [15, 24],
        [21, 39],
        [35, 15],
      ]) {
        const tile = caveTileSize(width, height, columns, rows);
        expect(tile * columns).toBeGreaterThanOrEqual(width);
        expect(tile * rows).toBeGreaterThanOrEqual(height);
        expect(tile).toBeGreaterThanOrEqual(40);
      }
    }
  });
  it('uses separate bottle, leaf, candy and glass cells for all variants', () => {
    for (let variant = 0; variant < 8; variant++) {
      expect(collectibleCell(0, variant)).toBeLessThan(3);
      expect([8, 9]).toContain(collectibleCell(1, variant));
      expect([12, 11, 13, 14]).toContain(collectibleCell(2, variant));
      expect([4, 5, 6, 7]).toContain(collectibleCell(3, variant));
    }
  });
});
