/** Closer framing preserves readable tiles on phones and gives desktop artwork room to breathe. */
export function caveTileSize(width: number, playHeight: number, columns?: number, rows?: number): number {
  const readableScale = Math.max(40, Math.min(80, width / 17, playHeight / 12));
  // Uniform cover scaling removes letterboxing; the existing camera follows the cropped map.
  return Math.max(readableScale, columns ? width / columns : 0, rows ? playHeight / rows : 0);
}

/** The four pressed-tablet designs occupy a transparent two-by-two sheet. */
export function raveTabletRect(width: number, height: number, variant: number) {
  const cell = Math.abs(Math.trunc(variant)) % 4;
  return {
    x: (cell % 2) * (width / 2),
    y: Math.floor(cell / 2) * (height / 2),
    width: width / 2,
    height: height / 2,
  };
}

/** Stable sprite cells shared by all flavour variants; no randomness enters the simulation. */
export function collectibleCell(biome: number, variant: number): number {
  const v = Math.abs(Math.trunc(variant));
  return biome === 0
    ? v % 3
    : biome === 1
      ? 8 + (v % 2)
      : biome === 2
        ? [12, 11, 13, 14][v % 4]
        : 4 + (v % 4);
}
