import tracks from './data/soundtrack-v1.json';
import extraTracks from './data/soundtrack-v2.json';

export type MusicPack = 'pack-1' | 'pack-2';
export function musicPack(value: unknown): MusicPack {
  return value === 'pack-2' ? 'pack-2' : 'pack-1';
}

/** Every supplied loop is used; reprises connect bonus maps with their campaign motifs. */
export const EXTRA_LEVEL_SOUNDTRACKS: readonly (keyof typeof extraTracks)[] = [
  'adventure-boy',
  'sneaky-mallet',
  'kitchen-swing',
  'cartoon-suspense',
  'mischievous-piano',
  'cabin',
  'relaxing-guitar',
  'whimsical-intrigue',
  'landscape-piano',
  'soft-background',
  'interstellar',
  'space-ambient',
  'game-14',
  'game-18',
  'ghost-zoo',
  'amber',
  'loop-three',
  'galactic-journey',
  'ambient-space',
  'cinematic-trailer',
  'kitchen-swing',
  'cabin',
  'orion-nebula',
  'adventure-boy',
];

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

export function levelSoundtrack(level: number, pack: MusicPack = 'pack-1') {
  const index = Number.isFinite(level) ? Math.max(0, Math.min(23, Math.trunc(level) - 1)) : 0;
  if (pack === 'pack-2') {
    const id = EXTRA_LEVEL_SOUNDTRACKS[index];
    return { id: `pack-2/${id}`, ...extraTracks[id] };
  }
  const id = LEVEL_SOUNDTRACKS[index];
  return { id, ...tracks[id] };
}

/** The supplied full-length jazz theme stays continuous across all menu pages. */
export const MENU_SOUNDTRACK = {
  id: 'menu-jazz',
  title: 'Fun Indie Game Type Jazz Music',
  artist: 'idoberg',
  file: 'menu-jazz.mp3',
  seconds: 67.056313,
} as const;

export function musicSoundtrack(level: number, menu = false, pack: MusicPack = 'pack-1') {
  return menu ? MENU_SOUNDTRACK : levelSoundtrack(level, pack);
}

export function soundtrackUrl(base: string, level: number, menu = false, pack: MusicPack = 'pack-1'): string {
  const folder = !menu && pack === 'pack-2' ? 'soundtrack-v2' : 'soundtrack-v1';
  return `${base}game-assets/audio/bongo-rush/${folder}/${musicSoundtrack(level, menu, pack).file}`;
}
