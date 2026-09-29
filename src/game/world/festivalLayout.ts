/** Compact playable interpretation of the supplied 2025 map, not a 1:1 survey. */
export const WORLD_SIZE = 520;
export const WORLD_LIMIT = WORLD_SIZE / 2;
export const MAIN_ASPHALT_ROAD = { minX: -140, maxX: 140, minZ: -40, maxZ: -30 } as const;
export const NORTH_CONCRETE_LANE = MAIN_ASPHALT_ROAD;
export const SECOND_CONCRETE_ROAD = { minX: -140, maxX: 140, minZ: 68, maxZ: 78 } as const;
export const SOUTH_CONCRETE_LANE = SECOND_CONCRETE_ROAD;
export const CONCRETE_LANES = [NORTH_CONCRETE_LANE, SOUTH_CONCRETE_LANE] as const;
export const CAMP_PLOT_SIZE = 36;
export const PRIMARY_CAMP_PLOT = { id: 'Camp', minX: -18, maxX: 18, minZ: -18, maxZ: 18 };
export const CAMPING_PLOTS = [
  ...[-118, -78, -38, 2, 42, 82].map((x) => [x, -140]),
  [-58, -18],
  [22, -18],
  [-98, 22],
  [-58, 22],
  [-18, 22],
  [22, 22],
].map(([x, z], index) => ({
  id: index < 6 ? `N1-${index + 1}` : `Neighbour-${index - 5}`,
  minX: x,
  maxX: x + CAMP_PLOT_SIZE,
  minZ: z,
  maxZ: z + CAMP_PLOT_SIZE,
}));
export const ALL_CAMPING_PLOTS = [PRIMARY_CAMP_PLOT, ...CAMPING_PLOTS];

export function isInsidePrimaryCamp(x: number, z: number, margin = 0): boolean {
  return (
    x >= PRIMARY_CAMP_PLOT.minX - margin &&
    x <= PRIMARY_CAMP_PLOT.maxX + margin &&
    z >= PRIMARY_CAMP_PLOT.minZ - margin &&
    z <= PRIMARY_CAMP_PLOT.maxZ + margin
  );
}
