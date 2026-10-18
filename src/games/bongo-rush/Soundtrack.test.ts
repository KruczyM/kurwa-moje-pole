import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tracks from './data/soundtrack-v1.json';
import { LEVEL_SOUNDTRACKS, levelSoundtrack, soundtrackUrl } from './Soundtrack';
import { LEVELS } from './Levels';

describe('curated soundtrack delivery', () => {
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
