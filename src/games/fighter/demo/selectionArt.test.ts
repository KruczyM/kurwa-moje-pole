import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { ROSTER_KEYS } from '../data/fighters/roster';
import { selectionArtUrl } from './selectionArt';

describe('fighter selection illustrations', () => {
  it('supports dev and nested deployment URLs', () => {
    expect(selectionArtUrl('/', 'amper', 'thumb')).toBe(
      '/game-assets/2d/fighter/selection-v1/amper-thumb.webp',
    );
    expect(selectionArtUrl('/kurwa-moje-pole', 'korba', 'full')).toBe(
      '/kurwa-moje-pole/game-assets/2d/fighter/selection-v1/korba-full.webp',
    );
  });

  it('ships both lightweight WebP derivatives for every playable fighter', () => {
    expect(ROSTER_KEYS).toHaveLength(16);
    let total = 0;
    for (const id of ROSTER_KEYS) {
      for (const size of ['thumb', 'full'] as const) {
        const file = `public${selectionArtUrl('/', id, size)}`;
        const bytes = readFileSync(file);
        expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
        expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
        expect(statSync(file).size).toBeLessThan(100_000);
        total += bytes.length;
      }
    }
    expect(total).toBeLessThan(1_000_000);
  });
});
