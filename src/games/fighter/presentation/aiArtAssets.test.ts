import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import data from '../../../../public/game-assets/2d/fighter/art-v3/locomotion.json';
import { ROSTER_KEYS } from '../data/fighters/roster';

describe('published AI art contracts', () => {
  it('ships every active fighter locomotion clip with the same foot anchor', () => {
    expect(Object.keys(data.fighters).sort()).toEqual([...ROSTER_KEYS].sort());
    for (const [id, clips] of Object.entries(data.fighters)) {
      for (const [name, clip] of Object.entries(clips)) {
        const bytes = readFileSync(`public/game-assets/2d/fighter/art-v3/locomotion/${id}/${clip.file}`);
        expect(bytes.readUInt32BE(16)).toBe(clip.frames * clip.size);
        expect(bytes.readUInt32BE(20)).toBe(clip.size);
        expect(clip.pivot).toEqual([0.5, 230 / 256]);
        expect(clip.frames).toBe(name === 'walk' ? 12 : name === 'ultimate' ? 6 : 4);
      }
    }
  });

  it('ships all unique props and responsive backgrounds without serving source images', () => {
    for (const name of [...ROSTER_KEYS, 'paper', 'soundwave']) {
      const bytes = readFileSync(`public/game-assets/2d/fighter/art-v3/props/${name}.webp`);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
    }
    for (const name of ['wristbands-wide', 'wristbands-portrait'])
      expect(existsSync(`public/game-assets/2d/fighter/art-v3/${name}.webp`)).toBe(true);
    expect(existsSync('public/game-assets/2d/fighter/art-v3/source')).toBe(false);
  });
});
