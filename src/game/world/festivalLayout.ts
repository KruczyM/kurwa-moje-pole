/** Compact playable interpretation of the supplied 2025 map, not a 1:1 survey. */
export const WORLD_SIZE = 320;
export const WORLD_LIMIT = WORLD_SIZE / 2;
export const MAIN_ASPHALT_ROAD = { minX: -140, maxX: 140, minZ: -40, maxZ: -30 } as const;
export const CAMP_PLOT_SIZE = 36;
export const PRIMARY_CAMP_PLOT = { id: 'Camp', minX: -18, maxX: 18, minZ: -18, maxZ: 18 };
export const CAMPING_PLOTS = [
  ...[-118, -78, -38, 2, 42, 82].map((x) => [x, -140]),
  [-58, -18],
  [22, -18],
  [-58, 22],
  [-18, 22],
  [22, 22],
  [-18, 62],
].map(([x, z], index) => ({
  id: index < 6 ? `N1-${index + 1}` : `Neighbour-${index - 5}`,
  minX: x,
  maxX: x + CAMP_PLOT_SIZE,
  minZ: z,
  maxZ: z + CAMP_PLOT_SIZE,
}));
export const ALL_CAMPING_PLOTS = [PRIMARY_CAMP_PLOT, ...CAMPING_PLOTS];
