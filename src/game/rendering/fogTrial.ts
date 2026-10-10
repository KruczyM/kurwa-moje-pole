import type { GraphicsProfile } from './graphicsProfile';

export const FOG_TRIAL_NEAR = 9;
export const FOG_TRIAL_FAR = 15;
export const FOG_TRIAL_PREFETCH = 18;
export const FOG_TRIAL_RETAIN = 26;
export function fogDistance(value: unknown): number {
  const number = Number(value);
  return value === null || value === '' || !Number.isFinite(number)
    ? FOG_TRIAL_FAR
    : Math.max(8, Math.min(30, Math.round(number)));
}
export function savedFogDistance(): number {
  try {
    return fogDistance(localStorage.getItem('festival-fog-distance'));
  } catch {
    return FOG_TRIAL_FAR;
  }
}
export function fogRanges(distance: number) {
  const far = fogDistance(distance);
  return { near: far * 0.6, far, prefetch: far + 3, retain: far + 11, prime: far + 2 };
}
export function fogTrialEnabled(
  mobile: boolean,
  search = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  const value = new URLSearchParams(search).get('fogTrial');
  return value === '1' || (mobile && value !== '0');
}
export function fogTrialProfile(
  profile: GraphicsProfile,
  enabled: boolean,
  distance = FOG_TRIAL_FAR,
): GraphicsProfile {
  if (!enabled) return profile;
  const range = fogDistance(distance);
  return {
    ...profile,
    mobile: true,
    characters: range,
    animation: range,
    interactive: range,
    tents: range,
    decorations: range,
    vegetation: range,
    particles: range,
    landmarks: range,
    hysteresis: 0,
    staticCheckSeconds: 0.2,
  };
}
