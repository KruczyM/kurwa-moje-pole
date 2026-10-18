import { describe, expect, it } from 'vitest';
import { DESKTOP_GRAPHICS } from './graphicsProfile';
import { fogTrialEnabled, fogTrialProfile, fogDistance, fogRanges, savedFogDistance } from './fogTrial';
import { vi } from 'vitest';

describe('mobile fog trial', () => {
  it('bounds user distance, keeps streaming buffers in sync and survives unavailable storage', () => {
    expect([null, '', undefined, 'bad', Infinity].map(fogDistance)).toEqual([15, 15, 15, 15, 15]);
    expect([-5, 8, 22.4, 60].map(fogDistance)).toEqual([8, 8, 22, 30]);
    expect(fogRanges(10)).toEqual({ near: 6, far: 10, prefetch: 13, retain: 21, prime: 12 });
    expect(fogTrialProfile(DESKTOP_GRAPHICS, true, 24).animation).toBe(24);
    vi.stubGlobal('localStorage', { getItem: () => '22' });
    expect(savedFogDistance()).toBe(22);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Denied');
      },
    });
    expect(savedFogDistance()).toBe(15);
    vi.unstubAllGlobals();
  });
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
