import { describe, expect, it } from 'vitest';
import { fabricWind, FLAG_CONFIG, MAD_DOG_CONFIG, seatLayout } from './campLandmarks';

describe('camp landmarks', () => {
  it('keeps Mad Dog at least 8 × 6 m and the mast clearly taller', () => {
    expect(MAD_DOG_CONFIG.size[0]).toBeGreaterThanOrEqual(8);
    expect(MAD_DOG_CONFIG.size[1]).toBeGreaterThanOrEqual(6);
    expect(FLAG_CONFIG.mastHeight).toBeGreaterThan(MAD_DOG_CONFIG.height * 2);
  });

  it('defines eight unique seats inside the canopy footprint', () => {
    expect(seatLayout).toHaveLength(8);
    expect(new Set(seatLayout.map(({ id }) => id)).size).toBe(8);
    seatLayout.forEach(({ position: [x, , z] }) => {
      expect(Math.abs(x)).toBeLessThan(MAD_DOG_CONFIG.size[0] / 2);
      expect(Math.abs(z)).toBeLessThan(MAD_DOG_CONFIG.size[1] / 2);
    });
  });

  it('uses a subtle bounded wind shared by lightweight fabrics', () => {
    const samples = Array.from({ length: 50 }, (_, index) => fabricWind(index / 10, 1.2, -0.8));
    expect(Math.max(...samples)).toBeLessThan(0.07);
    expect(Math.min(...samples)).toBeGreaterThan(-0.07);
    expect(new Set(samples.map((sample) => sample.toFixed(4))).size).toBeGreaterThan(10);
  });
});
