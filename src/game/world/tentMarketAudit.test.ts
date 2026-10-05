import { describe, expect, it } from 'vitest';
import { allTentLayout, tentColliderBounds } from './campLayout';
import { MARKET_STALL_LAYOUT, marketColliderBounds } from './festivalMarket';
import { ROCK_SHOP_SITE } from './festivalLandmarks';
import { FESTIVAL_ZONE_SITES, zoneBounds } from './festivalZones';

describe('world collision and model placement audit (G5)', () => {
  it('ensures zero overlap between camping tents and market stalls / gastronomic zones', () => {
    const overlaps: string[] = [];

    for (const tent of allTentLayout) {
      const tb = tentColliderBounds(tent);
      for (const stall of MARKET_STALL_LAYOUT) {
        const mb = marketColliderBounds(stall);
        const collides = tb.maxX > mb.minX && tb.minX < mb.maxX && tb.maxZ > mb.minZ && tb.minZ < mb.maxZ;
        if (collides) {
          overlaps.push(`Tent ${tent.id} at [${tent.position.join(', ')}] overlaps with stall ${stall.id}`);
        }
      }
    }

    expect(overlaps).toEqual([]);
  });

  it('ensures zero overlap between camping tents and Lidl Rock Shop', () => {
    const overlaps: string[] = [];
    const rockShopBox = {
      minX: ROCK_SHOP_SITE.x - ROCK_SHOP_SITE.halfWidth,
      maxX: ROCK_SHOP_SITE.x + ROCK_SHOP_SITE.halfWidth,
      minZ: ROCK_SHOP_SITE.z - ROCK_SHOP_SITE.halfDepth,
      maxZ: ROCK_SHOP_SITE.z + ROCK_SHOP_SITE.halfDepth,
    };

    for (const tent of allTentLayout) {
      const tb = tentColliderBounds(tent);
      const collides =
        tb.maxX > rockShopBox.minX &&
        tb.minX < rockShopBox.maxX &&
        tb.maxZ > rockShopBox.minZ &&
        tb.minZ < rockShopBox.maxZ;
      if (collides) {
        overlaps.push(`Tent ${tent.id} at [${tent.position.join(', ')}] overlaps with Lidl Rock Shop`);
      }
    }

    expect(overlaps).toEqual([]);
  });

  it('ensures zero overlap between camping tents and special festival zone sites', () => {
    const overlaps: string[] = [];

    for (const tent of allTentLayout) {
      const tb = tentColliderBounds(tent);
      for (const zone of FESTIVAL_ZONE_SITES) {
        const zb = zoneBounds(zone);
        const collides = tb.maxX > zb.minX && tb.minX < zb.maxX && tb.maxZ > zb.minZ && tb.minZ < zb.maxZ;
        if (collides) {
          overlaps.push(`Tent ${tent.id} overlaps with zone ${zone.id}`);
        }
      }
    }

    expect(overlaps).toEqual([]);
  });
});
