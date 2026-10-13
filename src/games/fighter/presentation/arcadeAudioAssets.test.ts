import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ROSTER_KEYS } from '../data/fighters/roster';

const root = 'public/game-assets/2d/fighter/audio-v2/';
const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8')) as { effects: string[] };
describe('published original arcade audio', () => {
  it('contains a distinct impact for every ultimate and two playable stereo loops', () => {
    const hashes = new Set<string>();
    for (const id of ROSTER_KEYS) {
      expect(manifest.effects).toContain('ultimate-' + id);
      hashes.add(
        createHash('sha256')
          .update(readFileSync(root + 'ultimate-' + id + '.wav'))
          .digest('hex'),
      );
    }
    expect(hashes.size).toBe(16);
    for (const name of [...manifest.effects, 'menu', 'fight']) {
      const file = readFileSync(root + name + '.wav');
      expect(file.toString('ascii', 0, 4)).toBe('RIFF');
      expect(file.toString('ascii', 8, 12)).toBe('WAVE');
      const channels = file.readUInt16LE(22),
        rate = file.readUInt32LE(24);
      expect(file.readUInt16LE(34)).toBe(16);
      expect(rate).toBe(22050);
      const duration = (file.length - 44) / (rate * channels * 2);
      const music = name === 'menu' || name === 'fight';
      expect(channels).toBe(music ? 2 : 1);
      expect(duration).toBeGreaterThan(name === 'menu' ? 63 : music ? 28 : 0.05);
      expect(duration).toBeLessThan(name === 'menu' ? 65 : music ? 38 : 1.5);
      let peak = 0,
        energy = 0;
      for (let offset = 44; offset < file.length; offset += 2) {
        const sample = file.readInt16LE(offset) / 32768;
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      expect(peak).toBeLessThan(0.93);
      expect(Math.sqrt(energy / ((file.length - 44) / 2))).toBeGreaterThan(0.005);
      if (music) {
        expect(
          Math.abs(file.readInt16LE(44) - file.readInt16LE(file.length - channels * 2)) / 32768,
        ).toBeLessThan(0.08);
      }
    }
  });
});
