export const MUSIC_BPM = [78, 72, 108, 60] as const;
export const MAIN_MOTIF = [0, 7, 10, 14, 15, 7] as const; // A–E–G–B–C–E
export interface MusicNote {
  frequency: number;
  gain: number;
  duration: number;
  wave: OscillatorType;
  cutoff: number;
}

/** A complete arrangement lasts approximately two minutes at each biome's own tempo. */
export function musicCycleBeats(biome: number): number {
  return MUSIC_BPM[biome] * 2;
}

/** Returns composed melody, silence and bass variations; no randomness or wall-clock dependency. */
export function musicPhrase(biome: number, beat: number, menu = false): readonly MusicNote[] {
  const b = Math.max(0, Math.min(3, Math.floor(biome)));
  const step = ((Math.floor(beat) % musicCycleBeats(b)) + musicCycleBeats(b)) % musicCycleBeats(b);
  const section = Math.floor(step / (musicCycleBeats(b) / 4));
  const phrase = step % 16;
  const notes: MusicNote[] = [];
  const melody = section !== 2 && phrase < MAIN_MOTIF.length && (!menu || phrase % 2 === 0);
  if (melody) {
    const octave = section === 1 && phrase >= 3 ? 12 : 0;
    notes.push({
      frequency: 220 * 2 ** ((MAIN_MOTIF[phrase] + octave) / 12),
      gain: menu ? 0.014 : 0.024,
      duration: [1.4, 1.1, 0.7, 2.6][b],
      wave: (['triangle', 'sine', 'sawtooth', 'sine'] as const)[b],
      cutoff: [950, 1700, 700, 2600][b],
    });
  }
  if (step % (menu ? 16 : 8) === 0) {
    notes.push({
      frequency: [55, 55 * 2 ** (3 / 12), 55 * 2 ** (7 / 12), 55][section],
      gain: menu ? 0.01 : 0.016,
      duration: 2.4,
      wave: 'sine',
      cutoff: 350,
    });
  }
  if (b === 2 && !menu && phrase >= 8 && step % 2 === 0 && section !== 2)
    notes.push({ frequency: 110, gain: 0.009, duration: 0.16, wave: 'triangle', cutoff: 400 });
  return notes;
}

/** Retains the read-only frequency helper for callers that only inspect the composition. */
export function ambientPhrase(biome: number, beat: number): readonly number[] {
  return musicPhrase(biome, beat).map((note) => note.frequency);
}
