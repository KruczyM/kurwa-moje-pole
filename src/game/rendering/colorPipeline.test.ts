import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_PIPELINE_EXPOSURE, configureColorPipeline } from './colorPipeline';

describe('color pipeline', () => {
  it.each(['world', 'characterPreview', 'itemInspect'] as const)(
    'uses ACES, sRGB and an explicit safe exposure for %s',
    (pipeline) => {
      const renderer = {
        outputColorSpace: THREE.NoColorSpace,
        toneMapping: THREE.NoToneMapping,
        toneMappingExposure: 0,
      };
      configureColorPipeline(renderer, pipeline);
      expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
      expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
      expect(renderer.toneMappingExposure).toBe(COLOR_PIPELINE_EXPOSURE[pipeline]);
      expect(renderer.toneMappingExposure).toBeGreaterThanOrEqual(1);
      expect(renderer.toneMappingExposure).toBeLessThanOrEqual(1.5);
    },
  );
});
