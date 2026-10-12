/** Original restrained ambient motifs, one pentatonic colour per biome (no external recordings). */
const MOTIFS = [
  [0, 7, 12, 10, 3, 7, 15, 10],
  [0, 3, 7, 12, 10, 7, 3, -2],
  [0, 5, 12, 7, 15, 12, 5, 7],
  [0, 7, 10, 15, 12, 7, 3, 0],
] as const;

/** Returns a deterministic low-volume bass plus bell phrase; generation needs no wall-clock timer. */
export function ambientPhrase(biome: number, beat: number): readonly number[] {
  const motif = MOTIFS[Math.max(0, Math.min(3, Math.floor(biome)))];
  const index = ((Math.floor(beat) % motif.length) + motif.length) % motif.length;
  const base = [146.83, 130.81, 164.81, 110][Math.max(0, Math.min(3, Math.floor(biome)))];
  const bell = base * 2 ** (motif[index] / 12);
  return index % 4 === 0 ? [bell, base / 2] : [bell];
}
