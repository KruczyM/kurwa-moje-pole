import tracks from './data/soundtrack-v1.json';

export type SoundtrackId = keyof typeof tracks;
/** Deliberately placed reprises link related rooms; adjacent maps change their motif. */
export const LEVEL_SOUNDTRACKS: readonly SoundtrackId[] = [
  'indie-guitar',
  'warm-technology',
  'intrigued',
  'lofi-bells',
  'mysterious-piano',
  'android-forest',
  'clarity-1',
  'clarity-2',
  'herbarium',
  'android-forest',
  'science-1',
  'ambient-loop',
  'lofi-bells',
  'science-2',
  'glitch-ambient',
  'dark-melancholy',
  'intrigued',
  'ambient-loop',
  'glitch-ambient',
  'sunshine-rain',
  'indie-guitar',
  'herbarium',
  'science-2',
  'tower-clock',
];

export function levelSoundtrack(level: number) {
  const id = LEVEL_SOUNDTRACKS[Math.max(0, Math.min(LEVEL_SOUNDTRACKS.length - 1, Math.trunc(level) - 1))];
  return { id, ...tracks[id] };
}

export function soundtrackUrl(base: string, level: number): string {
  return `${base}game-assets/audio/bongo-rush/soundtrack-v1/${levelSoundtrack(level).file}`;
}
