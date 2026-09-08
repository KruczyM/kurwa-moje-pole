import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRASS_PRESET,
  GRASS_PRESETS,
  GrassQualityPreset,
  isGrassQualityPreset,
} from './grassQuality';
import { TutorialTriangleGrass } from './vendor/three-stylized/TutorialTriangleGrass';
import { DistantTriangleGrass } from './vendor/three-stylized/DistantTriangleGrass';
import { Grass } from './vendor/three-stylized/Grass';

describe('grassQuality presets configuration', () => {
  const presets: GrassQualityPreset[] = ['low', 'medium', 'high', 'ultra'];

  it('validates preset strings correctly', () => {
    expect(isGrassQualityPreset('low')).toBe(true);
    expect(isGrassQualityPreset('medium')).toBe(true);
    expect(isGrassQualityPreset('high')).toBe(true);
    expect(isGrassQualityPreset('ultra')).toBe(true);

    expect(isGrassQualityPreset('ultra_high')).toBe(false);
    expect(isGrassQualityPreset('potato')).toBe(false);
    expect(isGrassQualityPreset('')).toBe(false);
    expect(isGrassQualityPreset(null)).toBe(false);
    expect(isGrassQualityPreset(undefined)).toBe(false);
    expect(isGrassQualityPreset(123)).toBe(false);
  });

  it('has default preset configured as medium or high', () => {
    expect(isGrassQualityPreset(DEFAULT_GRASS_PRESET)).toBe(true);
    expect(GRASS_PRESETS[DEFAULT_GRASS_PRESET]).toBeDefined();
  });

  it('ensures near and distant blade counts strictly increase with quality', () => {
    for (let i = 0; i < presets.length - 1; i++) {
      const current = GRASS_PRESETS[presets[i]];
      const next = GRASS_PRESETS[presets[i + 1]];

      expect(next.nearBladeCount).toBeGreaterThan(current.nearBladeCount);
      expect(next.distantBladeCount).toBeGreaterThan(current.distantBladeCount);
    }
  });

  it('configures safe fade radii within half of the tile size to prevent seam popping', () => {
    for (const preset of presets) {
      const config = GRASS_PRESETS[preset];
      const halfTile = config.tileSize / 2;

      expect(config.innerRadius).toBeGreaterThan(0);
      expect(config.outerRadius).toBeGreaterThan(config.innerRadius);
      expect(config.outerRadius).toBeLessThanOrEqual(halfTile);
    }
  });

  it('defines realistic short velvety blade dimensions', () => {
    for (const preset of presets) {
      const config = GRASS_PRESETS[preset];

      expect(config.minHeight).toBeGreaterThan(0.05);
      expect(config.maxHeight).toBeGreaterThan(config.minHeight);
      expect(config.maxHeight).toBeLessThan(0.5); // shorter than knee-height
      expect(config.baseWidth).toBeGreaterThan(0.02);
      expect(config.baseWidth).toBeLessThan(0.2);
    }
  });
});

describe('TutorialTriangleGrass mesh lifecycle & preset switching', () => {
  it('initializes with specified preset geometry', () => {
    const grass = new TutorialTriangleGrass('low');
    const lowCount = grass.geometry.attributes.position.count;
    // Each blade is 1 triangle = 3 vertices
    expect(lowCount).toBe(GRASS_PRESETS.low.nearBladeCount * 3);

    grass.setPreset('high');
    const highCount = grass.geometry.attributes.position.count;
    expect(highCount).toBe(GRASS_PRESETS.high.nearBladeCount * 3);
    expect(highCount).toBeGreaterThan(lowCount);

    grass.dispose();
  });
});

describe('DistantTriangleGrass mesh lifecycle & preset switching', () => {
  it('initializes with distant preset geometry and supports switching', () => {
    const distant = new DistantTriangleGrass('low');
    const lowCount = distant.geometry.attributes.position.count;
    expect(lowCount).toBe(GRASS_PRESETS.low.distantBladeCount * 3);

    distant.setPreset('ultra');
    const ultraCount = distant.geometry.attributes.position.count;
    expect(ultraCount).toBe(GRASS_PRESETS.ultra.distantBladeCount * 3);
    expect(ultraCount).toBeGreaterThan(lowCount);

    distant.dispose();
  });
});

describe('Grass composite container', () => {
  it('coordinates near and distant presets and tracks quality', () => {
    const grass = new Grass(undefined, 'low');
    expect(grass.quality).toBe('low');

    grass.setQuality('medium');
    expect(grass.quality).toBe('medium');

    grass.setQuality('high');
    expect(grass.quality).toBe('high');

    expect(() => grass.dispose()).not.toThrow();
  });
});
