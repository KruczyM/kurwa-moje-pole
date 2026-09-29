import { describe, expect, it } from 'vitest';
import {
  ALL_CAMPING_PLOTS,
  CAMP_PLOT_SIZE,
  CAMPING_PLOTS,
  MAIN_ASPHALT_ROAD,
  SOUTH_CONCRETE_LANE,
  WORLD_LIMIT,
  WORLD_SIZE,
} from './festivalLayout';
import { allTentLayout, prototypeTentLayout, festivalTentLayout, tentColliderBounds } from './campLayout';
import { MARKET_STALL_LAYOUT, marketColliderBounds } from './festivalMarket';
import { FESTIVAL_ZONE_SITES, zoneBounds } from './festivalZones';
import { ROCK_SHOP_SITE } from './festivalLandmarks';
import { terrainHeight } from './terrainHeight';
import { grassDensityForSurface, GRASS_PRESETS } from './grassQuality';
import { WORLD_GRASS_MASK_EXTENT } from './grassWorldMask';
import { CAMP_TENT_SLOTS } from './festivalCamping';

describe('map-led airfield layout', () => {
  it('expands the physical map, mask and static grass budget consistently', () => {
    expect(WORLD_SIZE).toBe(520);
    expect(WORLD_GRASS_MASK_EXTENT).toBe(WORLD_LIMIT);
    for (const preset of Object.values(GRASS_PRESETS)) {
      expect(
        grassDensityForSurface(preset.grassLayerDensity, WORLD_SIZE, WORLD_SIZE) * WORLD_SIZE ** 2,
      ).toBeCloseTo(preset.grassLayerDensity * 117.6 ** 2, 4);
    }
  });

  it('faces every existing shop and both Red Bulls towards one straight asphalt road', () => {
    const roadside = [
      ...MARKET_STALL_LAYOUT.map((s) => ({ ...marketColliderBounds(s), rotationY: s.rotationY })),
      ...FESTIVAL_ZONE_SITES.filter((s) => s.id === 'redBull').map((s) => ({
        ...zoneBounds(s),
        rotationY: s.rotationY,
      })),
    ];
    expect(roadside).toHaveLength(20);
    for (const site of roadside) {
      expect(site.rotationY).toBe(0);
      expect(site.minX).toBeGreaterThan(MAIN_ASPHALT_ROAD.minX);
      expect(site.maxX).toBeLessThan(MAIN_ASPHALT_ROAD.maxX);
      expect(site.maxZ).toBeLessThan(MAIN_ASPHALT_ROAD.minZ);
      expect(MAIN_ASPHALT_ROAD.minZ - site.maxZ).toBeLessThan(2);
    }
  });

  it('keeps every ordinary tent inside a populated level plot, with no isolated prototypes', () => {
    expect(allTentLayout).toHaveLength(207);
    for (const tent of allTentLayout) {
      const b = tentColliderBounds(tent);
      expect(
        ALL_CAMPING_PLOTS.filter(
          (p) => b.minX > p.minX && b.maxX < p.maxX && b.minZ > p.minZ && b.maxZ < p.maxZ,
        ),
      ).toHaveLength(1);
    }
    for (const plot of ALL_CAMPING_PLOTS) {
      expect(plot.maxX - plot.minX).toBe(CAMP_PLOT_SIZE);
      expect(plot.maxZ - plot.minZ).toBe(CAMP_PLOT_SIZE);
      expect(
        Math.max(Math.abs(plot.minX), Math.abs(plot.maxX), Math.abs(plot.minZ), Math.abs(plot.maxZ)),
      ).toBeLessThan(WORLD_LIMIT);
      const tents = allTentLayout.filter(
        (t) =>
          t.position[0] > plot.minX &&
          t.position[0] < plot.maxX &&
          t.position[2] > plot.minZ &&
          t.position[2] < plot.maxZ,
      );
      expect(tents.length).toBeGreaterThanOrEqual(15);
      for (let x = plot.minX; x <= plot.maxX; x += 3)
        for (let z = plot.minZ; z <= plot.maxZ; z += 3) expect(terrainHeight(x, z)).toBe(0);
    }
    for (const t of [...prototypeTentLayout, ...festivalTentLayout]) {
      const p = CAMPING_PLOTS.find(
        (p) =>
          t.position[0] > p.minX &&
          t.position[0] < p.maxX &&
          t.position[2] > p.minZ &&
          t.position[2] < p.maxZ,
      )!;
      expect(
        CAMP_TENT_SLOTS.some((s) => s.x === t.position[0] - p.minX && s.z === t.position[2] - p.minZ),
      ).toBe(true);
    }
  });

  it('places six populated neighbouring camps around the main camp and Lidl on the market road', () => {
    const redBulls = FESTIVAL_ZONE_SITES.filter((s) => s.id === 'redBull');
    expect(redBulls[0].x).toBeCloseTo(
      MAIN_ASPHALT_ROAD.minX + (MAIN_ASPHALT_ROAD.maxX - MAIN_ASPHALT_ROAD.minX) / 3,
    );
    expect(MAIN_ASPHALT_ROAD.maxX - redBulls[1].x).toBeLessThan(10);
    const neighbours = CAMPING_PLOTS.filter((p) => p.id.startsWith('Neighbour-'));
    expect(neighbours).toHaveLength(6);
    expect(neighbours.some((p) => p.maxX < -18)).toBe(true);
    expect(neighbours.some((p) => p.minX > 18)).toBe(true);
    expect(neighbours.some((p) => p.minZ > 18)).toBe(true);
    expect(ROCK_SHOP_SITE.z - ROCK_SHOP_SITE.halfDepth).toBeGreaterThan(SOUTH_CONCRETE_LANE.maxZ);
    expect(ROCK_SHOP_SITE.z - ROCK_SHOP_SITE.halfDepth - ROCK_SHOP_SITE.frontApron).toBe(
      SOUTH_CONCRETE_LANE.maxZ,
    );
  });
});
