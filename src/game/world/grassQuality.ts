export type GrassQualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export type GrassQualityConfig = {
  nearBladeCount: number;
  distantBladeCount: number;
  grassLayerDensity: number;
  minHeight: number;
  maxHeight: number;
  baseWidth: number;
  innerRadius: number;
  outerRadius: number;
  tileSize: number;
};

export const GRASS_PRESETS: Record<GrassQualityPreset, GrassQualityConfig> = {
  low: {
    nearBladeCount: 400_000,
    distantBladeCount: 50_000,
    grassLayerDensity: 10,
    minHeight: 0.13,
    maxHeight: 0.26,
    baseWidth: 0.044,
    innerRadius: 18.0,
    outerRadius: 25.5,
    tileSize: 52.0,
  },
  medium: {
    nearBladeCount: 650_000,
    distantBladeCount: 75_000,
    grassLayerDensity: 16,
    minHeight: 0.13,
    maxHeight: 0.27,
    baseWidth: 0.04,
    innerRadius: 19.0,
    outerRadius: 25.5,
    tileSize: 52.0,
  },
  high: {
    nearBladeCount: 946_400,
    distantBladeCount: 90_000,
    grassLayerDensity: 24,
    minHeight: 0.13,
    maxHeight: 0.28,
    baseWidth: 0.036,
    innerRadius: 20.0,
    outerRadius: 25.5,
    tileSize: 52.0,
  },
  ultra: {
    nearBladeCount: 1_200_000,
    distantBladeCount: 120_000,
    grassLayerDensity: 32,
    minHeight: 0.13,
    maxHeight: 0.29,
    baseWidth: 0.034,
    innerRadius: 21.0,
    outerRadius: 25.5,
    tileSize: 52.0,
  },
};

export const DEFAULT_GRASS_PRESET: GrassQualityPreset = 'high';

/** Sprawdza, czy przekazany ciąg znaków jest poprawną nazwą presetu jakości trawy. */
export function isGrassQualityPreset(value: unknown): value is GrassQualityPreset {
  return typeof value === 'string' && value in GRASS_PRESETS;
}
