import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tracks from './data/soundtrack-v1.json';
import extraTracks from './data/soundtrack-v2.json';
import {
  LEVEL_SOUNDTRACKS,
  levelSoundtrack,
  soundtrackUrl,
  MENU_SOUNDTRACK,
  musicSoundtrack,
  EXTRA_LEVEL_SOUNDTRACKS,
} from './Soundtrack';
import { LEVELS } from './Levels';

describe('curated soundtrack delivery', () => {
  it('uses all 21 supplied second-pack loops on 24 maps and preserves the menu theme', () => {
    expect(EXTRA_LEVEL_SOUNDTRACKS).toHaveLength(LEVELS.length);
    expect(new Set(EXTRA_LEVEL_SOUNDTRACKS).size).toBe(21);
    expect(Object.keys(extraTracks)).toHaveLength(21);
    for (const level of LEVELS) {
      const track = levelSoundtrack(level.id, 'pack-2');
      expect(track.id).toMatch(/^pack-2\//);
      if (level.id > 1) expect(track.id).not.toBe(levelSoundtrack(level.id - 1, 'pack-2').id);
      expect(soundtrackUrl('/', level.id, false, 'pack-2')).toContain('/soundtrack-v2/');
    }
    for (const track of Object.values(extraTracks)) {
      const data = readFileSync(`public/game-assets/audio/bongo-rush/soundtrack-v2/${track.file}`);
      expect(createHash('sha256').update(data).digest('hex')).toBe(track.sha256);
      expect(track.seconds).toBeGreaterThan(13);
      expect(track.seconds).toBeLessThan(32);
      expect(Number(track.analysis.output_tp)).toBeLessThan(0);
    }
    expect(musicSoundtrack(12, true, 'pack-2')).toEqual(MENU_SOUNDTRACK);
    expect(soundtrackUrl('/', 12, true, 'pack-2')).toContain('/soundtrack-v1/menu-jazz.mp3');
  });
  it('delivers the full supplied menu jazz independently of the 24 level assignments', () => {
    expect(MENU_SOUNDTRACK.seconds).toBeGreaterThan(66);
    expect(MENU_SOUNDTRACK.seconds).toBeLessThan(75);
    expect(MENU_SOUNDTRACK.artist).toBe('idoberg');
    const file = resolve('public', soundtrackUrl('', 24, true));
    expect(existsSync(file)).toBe(true);
    expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(
      '1b287a113a905d193e5925f41350dd33a349907b9d8d5bfa6c54bb7ca6a78b0b',
    );
    expect(musicSoundtrack(1, true)).toEqual(musicSoundtrack(24, true));
    expect(musicSoundtrack(1).id).toBe('indie-guitar');
  });
  it('assigns every real map, uses all16 prepared tracks and keeps intentional reprises apart', () => {
    expect(LEVEL_SOUNDTRACKS).toHaveLength(LEVELS.length);
    expect(new Set(LEVEL_SOUNDTRACKS).size).toBe(Object.keys(tracks).length);
    for (const level of LEVELS) {
      const track = levelSoundtrack(level.id);
      const file = resolve('public', soundtrackUrl('', level.id));
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file).subarray(0, 3).toString()).toBe('ID3');
      expect(track.seconds).toBeGreaterThan(5);
      expect(track.seconds).toBeLessThanOrEqual(50);
      expect(track.artist).toBeTruthy();
      if (level.id > 1) expect(track.id).not.toBe(levelSoundtrack(level.id - 1).id);
    }
    expect(levelSoundtrack(6).id).toBe('android-forest');
    expect(levelSoundtrack(9).id).toBe('herbarium');
    expect(levelSoundtrack(24).id).toBe('tower-clock');
    expect(soundtrackUrl('/kurwa-moje-pole/', 1)).toContain('/kurwa-moje-pole/game-assets/audio/');
  });
});
