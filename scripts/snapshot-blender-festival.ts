/** Read-only snapshot of current layout constants. Never updates runtime data. */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import catalog from '../src/game/assets/assetCatalog.json';
import { allTentLayout } from '../src/game/world/campLayout';
import { MAD_DOG_CONFIG, FLAG_CONFIG, TOILET_CONFIG, seatLayout } from '../src/game/world/campLandmarks';
import { ALL_CAMPING_PLOTS, CONCRETE_LANES, WORLD_SIZE } from '../src/game/world/festivalLayout';
import { FESTIVAL_CAMP_ROADS, CAMP_PALETTES } from '../src/game/world/festivalCamping';
import { FESTIVAL_STAGE_SITES } from '../src/game/world/festivalStages';
import { MARKET_STALL_LAYOUT } from '../src/game/world/festivalMarket';
import { FESTIVAL_ZONE_SITES } from '../src/game/world/festivalZones';
import { FESTIVAL_INFRASTRUCTURE_PLACEMENTS } from '../src/game/world/festivalInfrastructure';
import { FESTIVAL_WHEEL_SITE } from '../src/game/world/festivalWheel';
import { ROCK_SHOP_SITE } from '../src/game/world/festivalLandmarks';
import { SUNFLOWER_FIELD_BOUNDS } from '../src/game/world/festivalSunflowerField';
import { FESTIVAL_PROP_PLACEMENTS, PROP_TARGET_HEIGHTS } from '../src/game/world/festivalProps';

const environment = catalog.environment as Record<string, string>;
const items: Record<string, unknown>[] = [];
const add = (id: string, path: string, category: string, x: number, z: number, rotationY = 0, extra = {}) => {
  if (!existsSync(`public/game-assets/${path}`)) throw new Error(`Missing ${id}: ${path}`);
  items.push({ id, path, category, x, z, rotationY, ...extra });
};
for (const t of allTentLayout)
  add(t.id, catalog.tents[t.model], 'Camping', t.position[0], t.position[2], t.rotationY, {
    size: t.physicalSize,
    fit: t.fit,
    offset: t.terrainFit ? 0 : (t.groundOffset ?? 0),
    palette: t.palette,
  });
add('MadDog', catalog.tents.main, 'MainCamp', MAD_DOG_CONFIG.position[0], MAD_DOG_CONFIG.position[2], 0, {
  size: MAD_DOG_CONFIG.physicalSize,
  fit: 'uniform-height',
});
add('CampFlag', environment.flag, 'MainCamp', FLAG_CONFIG.position[0], FLAG_CONFIG.position[2], 0, {
  height: FLAG_CONFIG.height,
});
add('CampToilet', environment.toilet, 'MainCamp', TOILET_CONFIG.position[0], TOILET_CONFIG.position[2], 0, {
  height: 3.6,
});
for (const s of seatLayout) {
  const [x, , z] = s.position,
    d = Math.hypot(x, z);
  add(
    s.id,
    environment.chair,
    'MainCamp',
    MAD_DOG_CONFIG.position[0] + x + x / d,
    MAD_DOG_CONFIG.position[2] + z + z / d,
    s.rotationY,
    { height: 1.05 },
  );
}
for (const s of FESTIVAL_STAGE_SITES)
  add(s.id, environment[s.id], 'Stages', s.x, s.z, s.rotationY, {
    size: [s.width, s.height, s.depth],
    fit: 'uniform-volume',
  });
for (const s of MARKET_STALL_LAYOUT)
  add(s.id, environment.marketStalls, 'Passage', s.x, s.z, s.rotationY, {
    selector: ['marketVariant', s.variant],
  });
for (const s of FESTIVAL_ZONE_SITES)
  add(s.instanceId, environment.festivalZones, 'Passage', s.x, s.z, s.rotationY, {
    selector: ['festivalZone', s.id],
  });
for (const s of FESTIVAL_INFRASTRUCTURE_PLACEMENTS)
  add(s.id, environment[s.modelKey], 'Infrastructure', s.x, s.z, s.rotationY);
add(
  'Lidl',
  environment.lidlRockShop,
  'Passage',
  ROCK_SHOP_SITE.x,
  ROCK_SHOP_SITE.z,
  ROCK_SHOP_SITE.rotationY,
);
add('AllegroWheel', environment.allegroWheel, 'Attractions', FESTIVAL_WHEEL_SITE.x, FESTIVAL_WHEEL_SITE.z);
const missingProps: string[] = [];
for (const p of FESTIVAL_PROP_PLACEMENTS) {
  const path = environment[p.type] ?? `props/${p.type.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())}.glb`;
  if (!existsSync(`public/game-assets/${path}`)) {
    missingProps.push(`${p.id}: ${path}`);
    continue;
  }
  add(p.id, path, 'Props', p.position[0], p.position[2], p.rotation?.[1] ?? 0, {
    height: PROP_TARGET_HEIGHTS[p.type] * (p.scaleMultiplier ?? 1),
    elevation: p.position[1],
  });
}
mkdirSync('reports/festival-blender', { recursive: true });
writeFileSync(
  'reports/festival-blender/layout.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      units: 'metres',
      mapping: 'Three(x,y,z) -> Blender(x,-z,y)',
      worldSize: WORLD_SIZE,
      items,
      roads: CONCRETE_LANES,
      paths: FESTIVAL_CAMP_ROADS,
      plots: ALL_CAMPING_PLOTS,
      palettes: CAMP_PALETTES,
      sunflowerField: { ...SUNFLOWER_FIELD_BOUNDS, path: environment.sunflower },
      missingProps,
      notes: [
        'Static authoring scene only; NPC simulation and shader grass are not baked.',
        'Current game layout, not a surveyed geographical reconstruction. No runtime migration.',
      ],
    },
    null,
    2,
  ),
);
console.log(`Snapshot: ${items.length} placements; ${missingProps.length} unavailable props`);
