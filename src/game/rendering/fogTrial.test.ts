import { describe, expect, it } from 'vitest';
import { DESKTOP_GRAPHICS } from './graphicsProfile';
import { fogTrialEnabled, fogTrialProfile } from './fogTrial';

describe('mobile fog trial', () => {
  it('defaults only on touch/mobile, with explicit opt in/out', () => {
    expect(fogTrialEnabled(true, '')).toBe(true);
    expect(fogTrialEnabled(false, '')).toBe(false);
    expect(fogTrialEnabled(true, '?fogTrial=0')).toBe(false);
    expect(fogTrialEnabled(false, '?fogTrial=1')).toBe(true);
  });
  it('limits range without changing resolution or shadow quality or mutating the original', () => {
    const profile = fogTrialProfile(DESKTOP_GRAPHICS, true);
    expect(profile.characters).toBe(15);
    expect(profile.animation).toBe(15);
    expect(profile.landmarks).toBe(15);
    expect(profile.dprCap).toBe(DESKTOP_GRAPHICS.dprCap);
    expect(profile.shadowMapSize).toBe(DESKTOP_GRAPHICS.shadowMapSize);
    expect(DESKTOP_GRAPHICS.characters).toBe(Infinity);
    expect(fogTrialProfile(DESKTOP_GRAPHICS, false)).toBe(DESKTOP_GRAPHICS);
  });
});
