import type { SectorRect, TentConfig } from './campLayout';

export const CAMP_PALETTES = {
  sage: { fly: '#9ba995', accent: '#465e48' },
  ocean: { fly: '#b5bec6', accent: '#287e91' },
  ochre: { fly: '#ccba98', accent: '#a16b39' },
  coral: { fly: '#c4a49c', accent: '#964d43' },
  plum: { fly: '#b4a7bb', accent: '#66516d' },
  slate: { fly: '#aaaeb0', accent: '#454f5a' },
} as const;
export type CampPalette = keyof typeof CAMP_PALETTES;

/** Small playable staging sectors, NOT a geographical reconstruction of the 2026 festival. */
export const FESTIVAL_CAMP_SECTORS = [
  { id: 'NW', minX: -50, maxX: -20, minZ: -50, maxZ: -20 },
  { id: 'NE', minX: 20, maxX: 50, minZ: -50, maxZ: -20 },
  { id: 'SW', minX: -50, maxX: -20, minZ: 20, maxZ: 50 },
  { id: 'SE', minX: 20, maxX: 50, minZ: 20, maxZ: 50 },
] as const;

export const FESTIVAL_CAMP_ROADS: readonly SectorRect[] = FESTIVAL_CAMP_SECTORS.flatMap((s) => [
  { minX: s.minX + 14, maxX: s.minX + 17, minZ: s.minZ, maxZ: s.maxZ },
  { minX: s.minX, maxX: s.maxX, minZ: s.minZ + 8.5, maxZ: s.minZ + 11.5 },
  { minX: s.minX, maxX: s.maxX, minZ: s.minZ + 19.5, maxZ: s.minZ + 22.5 },
]);

function randomSequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Fixed slots preserve lanes; seeded jitter changes only small offsets and appearance. */
export function createFestivalCamp(
  templates: readonly TentConfig[],
  reserved: readonly SectorRect[],
  seed = 2026,
): readonly TentConfig[] {
  if (templates.length === 0) return [];
  const random = randomSequence(seed);
  const palettes = Object.keys(CAMP_PALETTES) as CampPalette[];
  const result: TentConfig[] = [];
  let slot = 0;
  for (const sector of FESTIVAL_CAMP_SECTORS) {
    for (let row = 0; row < 3; row++) {
      for (const column of [4, 10.5, 20.5, 27]) {
        const index = slot++;
        const x = sector.minX + column + (random() - 0.5) * 0.16;
        const z = sector.minZ + 4 + row * 11 + (random() - 0.5) * 0.16;
        const modelIndex = Math.floor(random() * templates.length);
        const palette = palettes[Math.floor(random() * palettes.length)];
        const rotationY = (row === 0 ? 0 : Math.PI) + (random() - 0.5) * 0.08;
        // 3.15 m radius includes ropes, not only the solid collider; stable holes keep IDs stable.
        if (
          reserved.some(
            (r) => x + 3.15 > r.minX && x - 3.15 < r.maxX && z + 3.15 > r.minZ && z - 3.15 < r.maxZ,
          )
        )
          continue;
        const source = templates[modelIndex];
        result.push({
          ...source,
          id: `T${20 + index}`,
          label: `Namiot ${sector.id}-${index + 1}`,
          position: [x, 0, z],
          rotationY,
          palette,
          terrainFit: true,
          physicalSize: [...source.physicalSize],
          collider: { type: 'box', size: [...source.collider.size] },
        });
      }
    }
  }
  return result;
}

export function sampleFestivalRoadMask(x: number, z: number): number {
  let mask = 1;
  for (const r of FESTIVAL_CAMP_ROADS) {
    const distance = Math.max(r.minX - x, x - r.maxX, r.minZ - z, z - r.maxZ);
    if (distance <= 0) return 0;
    if (distance < 0.25) mask = Math.min(mask, distance / 0.25);
  }
  return mask;
}

/** Clearance above a gently sloping footprint; does not alter terrain or old tent offsets. */
export function tentTerrainOffset(
  config: TentConfig,
  floorHeight: number,
  heightAt: (x: number, z: number) => number,
): number {
  const authored = config.groundOffset ?? 0;
  if (!config.terrainFit) return authored;
  const [x, , z] = config.position;
  const [width, depth] = config.collider.size;
  const cosine = Math.cos(config.rotationY),
    sine = Math.sin(config.rotationY);
  let high = heightAt(x, z);
  const nx = Math.ceil(width / 0.25),
    nz = Math.ceil(depth / 0.25);
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      const px = width * (i / nx - 0.5),
        pz = depth * (j / nz - 0.5);
      high = Math.max(high, heightAt(x + px * cosine + pz * sine, z - px * sine + pz * cosine));
    }
  }
  return Math.max(authored, high - heightAt(x, z) + 0.025 - floorHeight);
}
