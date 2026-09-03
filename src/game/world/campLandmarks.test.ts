import { describe, expect, it } from 'vitest';
import { FLAG_CONFIG, MAD_DOG_CONFIG, seatLayout } from './campLandmarks';

describe('camp landmarks', () => {
  it('keeps the requested reduced Mad Dog scale and independent flag scale', () => {
    expect(MAD_DOG_CONFIG.physicalSize).toEqual([22.316, 6.576, 22.232]);
    expect(FLAG_CONFIG.height).toBe(16.4);
  });

  it('defines eight unique seats inside the canopy footprint', () => {
    expect(seatLayout).toHaveLength(8);
    expect(new Set(seatLayout.map(({ id }) => id)).size).toBe(8);
    seatLayout.forEach(({ position: [x, , z] }) => {
      expect(Math.abs(x)).toBeLessThan(MAD_DOG_CONFIG.physicalSize[0] / 2);
      expect(Math.abs(z)).toBeLessThan(MAD_DOG_CONFIG.physicalSize[2] / 2);
    });
  });

  it('rotates every seat 180 degrees from the original inward-facing layout', () => {
    seatLayout.forEach(({ position: [x, , z], rotationY }) => {
      expect(rotationY).toBeCloseTo(Math.atan2(-x, -z) + Math.PI);
    });
  });
});
