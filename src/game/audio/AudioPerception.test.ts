import { describe, expect, it } from 'vitest';
import { audioPerceptionAt } from './AudioPerception';
import type { EffectId } from '../effects/EffectManager';

describe('audio perception profiles', () => {
  const effects: EffectId[] = [
    'Piwo',
    'Papieros',
    'Joint',
    'Kreska',
    'Grzyb',
    'MDMA',
    'LSD',
    'Woda',
    'Okulary',
  ];
  it('returns to neutral without an effect or at zero intensity', () => {
    expect(audioPerceptionAt(null, 1, 0)).toEqual({ cutoff: 20000, echo: 0, delay: 0.12, gain: 1 });
    for (const effect of effects) {
      const p = audioPerceptionAt(effect, 0, 0);
      expect(p.cutoff).toBe(20000);
      expect(p.echo).toBe(0);
      expect(p.gain).toBe(1);
    }
  });
  it('never amplifies or creates unbounded feedback', () => {
    for (const effect of effects)
      for (const intensity of [-1, 0, 0.5, 1, 5, NaN]) {
        for (const time of [0, 2, 15, 100, NaN]) {
          const p = audioPerceptionAt(effect, intensity, time);
          expect(p.gain).toBeLessThanOrEqual(1);
          expect(p.gain).toBeGreaterThan(0);
          expect(p.echo).toBeGreaterThanOrEqual(0);
          expect(p.echo).toBeLessThan(0.3);
          expect(p.cutoff).toBeGreaterThan(4000);
          expect(p.cutoff).toBeLessThanOrEqual(20000);
          expect(p.delay).toBeGreaterThan(0);
          expect(p.delay).toBeLessThan(0.5);
        }
      }
  });
  it('respects reduced motion and separates psychedelic cues from neutral items', () => {
    expect(audioPerceptionAt('LSD', 1, 0, true)).toEqual(audioPerceptionAt('LSD', 1, 8, true));
    expect(audioPerceptionAt('Grzyb', 1, 0).echo).toBeGreaterThan(audioPerceptionAt('Piwo', 1, 0).echo);
    for (const effect of ['Woda', 'Okulary'] as const) expect(audioPerceptionAt(effect, 1, 0).echo).toBe(0);
  });
});
