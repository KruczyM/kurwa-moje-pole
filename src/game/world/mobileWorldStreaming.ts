import type { FogSector } from './FogSectorStreamer';
import { CAMPING_PLOTS, NORTH_CONCRETE_LANE } from './festivalLayout';

export type SectorRanges = { far: number; prefetch: number; retain: number; prime: number };
export const CAMP_LOAD_DISTANCE = 48;
export const CAMP_RETAIN_DISTANCE = 80;
const CAMP_SECTOR_MARGIN = 16;
const northernPlots = CAMPING_PLOTS.filter((plot) => plot.id.startsWith('N1-'));

/** Defers sectors overlapping the northern camping row, never roads or world-spanning geometry. */
export function isDeferredCampSector(sector: FogSector): boolean {
  const [min, max] = sector.bounds;
  return (
    max[2] < NORTH_CONCRETE_LANE.minZ &&
    northernPlots.some(
      (plot) =>
        max[0] >= plot.minX - CAMP_SECTOR_MARGIN &&
        min[0] <= plot.maxX + CAMP_SECTOR_MARGIN &&
        max[2] >= plot.minZ - CAMP_SECTOR_MARGIN &&
        min[2] <= plot.maxZ + CAMP_SECTOR_MARGIN,
    )
  );
}

/** All other world sectors stay resident; remote camps load near the player with eviction hysteresis. */
export function mobileWorldRanges(sector: FogSector): SectorRanges {
  return isDeferredCampSector(sector)
    ? { far: Infinity, prefetch: CAMP_LOAD_DISTANCE, prime: CAMP_LOAD_DISTANCE, retain: CAMP_RETAIN_DISTANCE }
    : { far: Infinity, prefetch: Infinity, prime: Infinity, retain: Infinity };
}

/** Mobile always uses the open streamed world; desktop opt-in is available for diagnostic testing. */
export function mobileOpenWorldEnabled(
  mobile: boolean,
  search = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  return mobile || new URLSearchParams(search).get('mobileWorld') === '1';
}
