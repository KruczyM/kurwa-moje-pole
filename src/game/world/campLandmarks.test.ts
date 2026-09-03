import { describe, expect, it } from 'vitest';
import { FLAG_CONFIG, MAD_DOG_CONFIG, seatLayout } from './campLandmarks';

describe('camp landmarks', () => {
  it('keeps Mad Dog at least 8 × 6 m and the complete flag model taller than it', () => {
    expect(MAD_DOG_CONFIG.physicalSize[0]).toBeGreaterThanOrEqual(7.9);
    expect(MAD_DOG_CONFIG.physicalSize[2]).toBeGreaterThanOrEqual(6);
    expect(FLAG_CONFIG.height).toBeGreaterThan(MAD_DOG_CONFIG.physicalSize[1] * 4);
  });

  it('defines eight unique seats inside the canopy footprint', () => {
    expect(seatLayout).toHaveLength(8);
    expect(new Set(seatLayout.map(({ id }) => id)).size).toBe(8);
    seatLayout.forEach(({ position: [x, , z] }) => {
      expect(Math.abs(x)).toBeLessThan(MAD_DOG_CONFIG.physicalSize[0] / 2);
      expect(Math.abs(z)).toBeLessThan(MAD_DOG_CONFIG.physicalSize[2] / 2);
    });
  });
});
