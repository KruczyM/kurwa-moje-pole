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
