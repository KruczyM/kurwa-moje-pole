import { describe, expect, it } from 'vitest';
import { terrainHeight } from './CampWorld';

describe('CampWorld terrain placement', () => {
  it('places wcTron on the same procedural surface that is rendered below it', () => {
    const height = terrainHeight(-12, 10);

    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(-0.3);
    expect(height).toBeLessThan(0.3);
  });
});
