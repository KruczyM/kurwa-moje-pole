import { describe, expect, it } from 'vitest';
import { effectConfigs } from './EffectManager';

describe('LSD visual profile', () => {
  it('uses strong saturation and a smooth three-phase lifetime', () => {
    const lsd = effectConfigs.LSD;
    expect(lsd.saturation).toBeGreaterThanOrEqual(2);
    expect(lsd.fadeIn).toBeGreaterThan(0);
    expect(lsd.active).toBeGreaterThan(0);
    expect(lsd.fadeOut).toBeGreaterThan(0);
  });
});

describe('MDMA visual profile', () => {
  it('keeps the scene bright and alternates melt with color mixing', () => {
    const mdma = effectConfigs.MDMA;
    expect(mdma.saturation).toBeGreaterThanOrEqual(2);
    expect(mdma.brightness).toBeGreaterThan(0.1);
    expect(mdma.lift).toBeGreaterThan(0);
    expect(mdma.melt).toBeGreaterThan(0);
    expect(mdma.mixing).toBeGreaterThan(0);
  });
});

describe('distinct effect profiles', () => {
  it('assigns a separate visual language to every strong effect', () => {
    const ids = ['Joint', 'Kreska', 'Grzyb', 'MDMA', 'LSD'] as const;
    const languages = ids.map((id) => effectConfigs[id].visualLanguage);
    expect(new Set(languages).size).toBe(ids.length);
  });

  it('gives each profile an audible modulation which can return to its snapshot', () => {
    expect(effectConfigs.Joint.audioRate).toBeLessThan(1);
    expect(effectConfigs.Kreska.audioRate).toBeGreaterThan(1);
    expect(effectConfigs.Grzyb.audioRate).not.toBe(effectConfigs.MDMA.audioRate);
    expect(effectConfigs.LSD.audioVolume).toBeLessThan(1);
  });
});
