import type { GraphicsProfile } from './graphicsProfile';

export const FOG_TRIAL_NEAR = 9;
export const FOG_TRIAL_FAR = 15;
export const FOG_TRIAL_PREFETCH = 18;
export const FOG_TRIAL_RETAIN = 26;
export function fogTrialEnabled(
  mobile: boolean,
  search = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  const value = new URLSearchParams(search).get('fogTrial');
  return value === '1' || (mobile && value !== '0');
}
export function fogTrialProfile(profile: GraphicsProfile, enabled: boolean): GraphicsProfile {
  if (!enabled) return profile;
  return {
    ...profile,
    mobile: true,
    characters: 15,
    animation: 15,
    interactive: 15,
    tents: 15,
    decorations: 15,
    vegetation: 15,
    particles: 15,
    landmarks: 15,
    hysteresis: 0,
    staticCheckSeconds: 0.2,
  };
}
