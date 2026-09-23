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

describe('world grass exclusion mask', () => {
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
  });
});
