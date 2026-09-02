import { describe, expect, it } from 'vitest';
import { interactionDebugEnabled, terrainHeight, TOILET_HEIGHT_METERS } from './CampWorld';

describe('CampWorld terrain placement', () => {
  it('places wcTron on the same procedural surface that is rendered below it', () => {
    const height = terrainHeight(-12, 10);

    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(-0.3);
    expect(height).toBeLessThan(0.3);
  });

  it('keeps wcTron at least twice as tall as a nominal 1.8 m character', () => {
    expect(TOILET_HEIGHT_METERS).toBeGreaterThanOrEqual(1.8 * 2);
  });

  it('enables interaction hitboxes only through an explicit URL flag', () => {
    expect(interactionDebugEnabled('?debugInteractions=1')).toBe(true);
    expect(interactionDebugEnabled('?debugInteractions=0')).toBe(false);
    expect(interactionDebugEnabled('')).toBe(false);
  });
});
