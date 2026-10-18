import type { VisualTheme } from './Presentation';
import { MUSIC_BPM, type MusicNote } from './Music';
export interface LevelMusicProfile {
  level: number;
  biome: number;
  theme: VisualTheme;
}
/** Authored independent phrases: pitch and rhythm are not random or transpositions. */
export const LEVEL_MOTIFS = [
  [0, 4, 7, 9, 7, 4, 2, 0],
  [7, 4, 2, 4, 9, 7, 11, 7],
  [0, 7, 4, 11, 9, 4, 2, 7],
  [4, 2, 0, 7, 9, 11, 7, 4],
  [9, 7, 4, 2, 0, 4, 7, 11],
  [0, 3, 7, 5, 10, 7, 3, 0],
  [7, 10, 5, 3, 0, 5, 3, -2],
  [3, 0, 5, 7, 10, 12, 7, 5],
  [0, 5, 3, 10, 7, 3, 5, -2],
  [10, 7, 5, 0, 3, 7, 12, 10],
  [0, 7, 3, 10, 12, 10, 7, 3],
  [7, 7, 10, 3, 0, 12, 10, 7],
  [3, 10, 7, 0, 12, 15, 10, 7],
  [12, 7, 10, 3, 7, 0, 3, 10],
  [0, 3, 12, 10, 7, 15, 12, 7],
  [0, 7, 14, 10, 5, 2, 7, 0],
  [7, 2, 5, 10, 14, 12, 7, 5],
  [2, 0, 7, 5, 12, 14, 10, 7],
  [10, 5, 2, 7, 0, 14, 12, 5],
  [0, 12, 7, 14, 10, 5, 2, 0],
  [4, 7, 11, 9, 2, 4, 0, 7],
  [5, 3, 10, 7, 12, 5, 0, 3],
  [7, 12, 15, 10, 3, 7, 0, 12],
  [5, 10, 14, 7, 2, 12, 7, 0],
] as const;
export const LEVEL_RHYTHMS = [
  [0, 2, 4, 6, 8, 10, 12, 15],
  [0, 1, 4, 7, 8, 11, 13, 14],
  [0, 3, 4, 6, 9, 10, 12, 14],
  [0, 2, 5, 7, 8, 10, 13, 15],
  [0, 3, 5, 6, 8, 11, 12, 15],
  [0, 2, 4, 7, 9, 10, 12, 14],
  [0, 3, 5, 7, 8, 10, 13, 14],
  [0, 2, 5, 6, 8, 11, 13, 15],
  [0, 3, 4, 7, 9, 11, 12, 14],
  [0, 2, 4, 6, 9, 11, 13, 15],
  [0, 1, 4, 6, 8, 9, 12, 14],
  [0, 2, 3, 6, 8, 10, 11, 14],
  [0, 1, 3, 4, 8, 10, 12, 15],
  [0, 2, 4, 5, 8, 10, 12, 13],
  [0, 1, 4, 7, 8, 9, 12, 15],
  [0, 3, 5, 7, 9, 11, 13, 15],
  [0, 2, 5, 7, 8, 11, 12, 15],
  [0, 3, 4, 6, 9, 11, 13, 14],
  [0, 2, 4, 7, 9, 10, 13, 15],
  [0, 3, 5, 6, 8, 11, 12, 14],
  [0, 1, 3, 6, 8, 10, 13, 15],
  [0, 2, 5, 7, 9, 10, 12, 15],
  [0, 1, 3, 6, 8, 9, 11, 14],
  [0, 3, 4, 7, 8, 10, 12, 15],
] as const;
export const LEVEL_MUSIC_BEATS = 128;
export function levelMusicRoot(biome: number) {
  return [196, 164.8138, 220, 146.8324][biome];
}
export function levelMusicPhrase(
  profile: LevelMusicProfile,
  beat: number,
  menu = false,
): readonly MusicNote[] {
  const level = Math.max(0, Math.min(23, profile.level - 1));
  const step = ((Math.floor(beat) % LEVEL_MUSIC_BEATS) + LEVEL_MUSIC_BEATS) % LEVEL_MUSIC_BEATS;
  const section = Math.floor(step / 32),
    phrase = step % 16;
  const root = levelMusicRoot(profile.biome),
    notes: MusicNote[] = [];
  const luminous = profile.theme === 'luminous',
    dark = profile.theme === 'mysterious';
  const index = (LEVEL_RHYTHMS[level] as readonly number[]).indexOf(phrase);
  if (index >= 0 && (section !== 2 || index % 3 === 0) && (!menu || index % 2 === 0)) {
    const pitch = LEVEL_MOTIFS[level][index] + (section === 1 && index >= 4 ? 12 : 0);
    notes.push({
      frequency: root * 2 ** (pitch / 12),
      gain: menu ? 0.009 : dark ? 0.016 : 0.02,
      duration: dark ? 1.6 : luminous ? 0.95 : 0.55,
      wave: dark || luminous ? 'sine' : 'triangle',
      cutoff: dark ? 800 : luminous ? 2600 : 1450,
    });
    if (luminous && index % 3 === 0 && !menu)
      notes.push({
        frequency: root * 2 ** ((pitch + 19) / 12),
        gain: 0.003,
        duration: 1.4,
        wave: 'sine',
        cutoff: 3800,
      });
  }
  const harmony = [0, profile.biome === 0 ? 5 : 3, 7, 0][section];
  if (step % (menu ? 16 : 8) === 0)
    notes.push({
      frequency: (root / 4) * 2 ** (harmony / 12),
      gain: menu ? 0.006 : 0.011,
      duration: 2.2,
      wave: 'sine',
      cutoff: 320,
    });
  if (!menu && section !== 2 && phrase % (dark ? 8 : 4) === 2)
    notes.push({ frequency: root / 2, gain: 0.006, duration: 0.12, wave: 'triangle', cutoff: 460 });
  return notes;
}
export function levelMusicBpm(profile: LevelMusicProfile) {
  return MUSIC_BPM[profile.biome];
}
