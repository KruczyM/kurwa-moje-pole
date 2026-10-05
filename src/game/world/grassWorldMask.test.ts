import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  bindGrassWorldMask,
  createGrassWorldMask,
  WORLD_GRASS_MASK_EXTENT,
  WORLD_GRASS_MASK_SIZE,
} from './grassWorldMask';
import { sampleRockShopGrassMask, ROCK_SHOP_SITE } from './festivalLandmarks';
import {
  createMarketGrassMask,
  MARKET_VARIANTS,
  MARKET_LANE,
  MARKET_STALL_LAYOUT,
  marketColliderBounds,
} from './festivalMarket';
import { TutorialTriangleGrass } from './vendor/three-stylized/TutorialTriangleGrass';
import { DistantTriangleGrass } from './vendor/three-stylized/DistantTriangleGrass';
import { ALL_CAMPING_PLOTS } from './festivalLayout';

describe('world grass exclusion mask', () => {
  it('keeps permanent grass distributed across every camp when the near tile moves', () => {
    const layer = new DistantTriangleGrass('low');
    try {
      const positions = layer.geometry.getAttribute('position');
      const initial = positions.array.slice();
      const counts = ALL_CAMPING_PLOTS.map(() => 0);
      for (let i = 0; i < positions.count; i += 3) {
        const index = ALL_CAMPING_PLOTS.findIndex(
          (p) =>
            positions.getX(i) >= p.minX &&
            positions.getX(i) <= p.maxX &&
            positions.getZ(i) >= p.minZ &&
            positions.getZ(i) <= p.maxZ,
        );
        if (index >= 0) counts[index]++;
      }
      expect(counts.every((count) => count > 2500)).toBe(true);
      expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(40000);
      layer.setPreset('medium');
      layer.setPreset('low');
      expect(layer.geometry.getAttribute('position').array).toEqual(initial);
      expect((layer.material as THREE.ShaderMaterial).uniforms.uPlayerPosition).toBeUndefined();
    } finally {
      layer.dispose();
    }
  }, 30000);
  it('excludes Lidl, every passage floor and concrete lane for both supplemental grass layers', () => {
    const market = createMarketGrassMask(new Set(MARKET_VARIANTS));
    const texture = createGrassWorldMask((x, z) => market(x, z) * sampleRockShopGrassMask(x, z));
    const sample = (x: number, z: number) => {
      const c = Math.floor(
        ((x + WORLD_GRASS_MASK_EXTENT) / (WORLD_GRASS_MASK_EXTENT * 2)) * WORLD_GRASS_MASK_SIZE,
      );
      const r = Math.floor(
        ((z + WORLD_GRASS_MASK_EXTENT) / (WORLD_GRASS_MASK_EXTENT * 2)) * WORLD_GRASS_MASK_SIZE,
      );
      return texture.image.data![r * WORLD_GRASS_MASK_SIZE + c];
    };
    const site = ROCK_SHOP_SITE;
    const rectangles = [
      MARKET_LANE,
      ...MARKET_STALL_LAYOUT.map(marketColliderBounds),
      {
        minX: site.x - site.halfWidth,
        maxX: site.x + site.halfWidth,
        minZ: site.z - site.halfDepth,
        maxZ: site.z + site.halfDepth,
      },
    ];
    for (const rect of rectangles)
      for (let x = rect.minX; x <= rect.maxX; x += 0.2)
        for (let z = rect.minZ; z <= rect.maxZ; z += 0.2) expect(sample(x, z)).toBe(0);
    expect(sample(15, 15)).toBe(255);
    expect(texture.minFilter).toBe(THREE.NearestFilter);
    const dispose = vi.spyOn(texture, 'dispose');
    for (const layer of [new TutorialTriangleGrass('low'), new DistantTriangleGrass('low')]) {
      bindGrassWorldMask(layer, texture);
      const material = layer.material as THREE.ShaderMaterial;
      expect(material.uniforms.uWorldGrassMask.value).toBe(texture);
      expect(material.uniforms.uWorldGrassMaskEnabled.value).toBe(1);
      expect(material.vertexShader).toContain('worldGrassCoverage(');
      expect(material.fog).toBe(true);
      expect(material.uniforms.fogColor).toBeDefined();
      expect(material.vertexShader).toContain('#include <fog_vertex>');
      expect(material.fragmentShader).toContain('#include <tonemapping_fragment>');
      expect(material.fragmentShader).toContain('#include <colorspace_fragment>');
      expect(material.fragmentShader).toContain('#include <fog_fragment>');
      expect(material.vertexShader).not.toContain('campCoverage');
      // The moving tile must sample AFTER wrapping to the player's world position.
      if (layer instanceof TutorialTriangleGrass)
        expect(material.vertexShader.indexOf('p.xz = uPlayerPosition')).toBeLessThan(
          material.vertexShader.indexOf('worldGrassCoverage(p.xz)'),
        );
      layer.setPreset('medium');
      expect(material.uniforms.uWorldGrassMask.value).toBe(texture);
      layer.dispose();
    }
    expect(dispose).not.toHaveBeenCalled();
    texture.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  }, 30000);
});
