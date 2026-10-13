export const MUSIC_BPM = [84, 72, 116, 64] as const;
/** Four original themes, rather than one tune with different oscillator colours. */
export const BIOME_MELODIES = [
  [0, 4, 7, 11, 9, 7, 4, 2],
  [0, 3, 5, 10, 7, 5, 3, -2],
  [0, 0, 7, 10, 12, 7, 3, 10],
  [0, 7, 14, 10, 5, 12, 9, 2],
] as const;
export const MAIN_MOTIF = BIOME_MELODIES[0];
export interface MusicNote {
  frequency: number;
  gain: number;
  duration: number;
  wave: OscillatorType;
  cutoff: number;
}
const ROOTS = [196, 164.8138, 220, 146.8324] as const;
const RHYTHMS = [
  [0, 1, 3, 4, 6, 8, 9, 12],
  [0, 2, 5, 6, 8, 10, 13, 14],
  [0, 1, 2, 4, 6, 8, 10, 12],
  [0, 3, 5, 7, 9, 11, 13, 15],
] as const;
const HARMONIES = [
  [0, 5, 7, 0],
  [0, 3, -2, 5],
  [0, -2, 3, 7],
  [0, 7, 5, 2],
] as const;

/** Approximately two minutes, with a sparse middle section and deterministic return. */
export function musicCycleBeats(biome: number): number {
  return MUSIC_BPM[biome] * 2;
}
export function musicPhrase(biome: number, beat: number, menu = false): readonly MusicNote[] {
  const b = Math.max(0, Math.min(3, Math.floor(biome)));
  const cycle = musicCycleBeats(b);
  const step = ((Math.floor(beat) % cycle) + cycle) % cycle;
  const section = Math.floor(step / (cycle / 4));
  const phrase = step % 16;
  const notes: MusicNote[] = [];
  const index = RHYTHMS[b].indexOf(phrase as never);
  if (index >= 0 && section !== 2 && (!menu || index % 2 === 0)) {
    const pitch = BIOME_MELODIES[b][index] + (section === 1 && index >= 4 ? 12 : 0);
    notes.push({
      frequency: ROOTS[b] * 2 ** (pitch / 12),
      gain: menu ? 0.012 : 0.022,
      duration: [0.55, 1.15, 0.32, 2.6][b],
      wave: (['triangle', 'sine', 'sawtooth', 'sine'] as const)[b],
      cutoff: [1350, 1500, 850, 2800][b],
    });
  }
  if (step % (menu ? 16 : 8) === 0)
    notes.push({
      frequency: (ROOTS[b] / (b === 1 || b === 3 ? 2 : 4)) * 2 ** (HARMONIES[b][section] / 12),
      gain: menu ? 0.008 : 0.014,
      duration: [1.2, 2.2, 0.38, 2.8][b],
      wave: 'sine',
      cutoff: 350,
    });
  // Short tonal percussion stays inside the existing bounded voice scheduler.
  if (
    !menu &&
    section !== 2 &&
    ((b === 2 && phrase % 2 === 0 && phrase !== 0) || (b === 0 && phrase % 4 === 2))
  )
    notes.push({ frequency: b === 2 ? 55 : 98, gain: 0.009, duration: 0.12, wave: 'triangle', cutoff: 480 });
  return notes;
}
export function ambientPhrase(biome: number, beat: number): readonly number[] {
  return musicPhrase(biome, beat).map((note) => note.frequency);
}
