export type MobileQuality = 'auto' | 'low' | 'normal' | 'high';
export type GraphicsProfile = {
  mobile: boolean;
  dprCap: number;
  characters: number;
  animation: number;
  interactive: number;
  tents: number;
  decorations: number;
  vegetation: number;
  particles: number;
  landmarks: number;
  shadows: number;
  shadowMapSize: number;
  staticCheckSeconds: number;
  hysteresis: number;
  tvFeedFps: number;
  tvFeedWidth: number;
  bloomScale: number;
};
/** 1 unit ~= 1 metre; camp plots 36m, roads 280m, stage ~200m from camp. */
export const MOBILE_GRAPHICS: Record<Exclude<MobileQuality, 'auto'>, GraphicsProfile> = {
  low: {
    mobile: true,
    dprCap: 1,
    characters: 20,
    animation: 15,
    interactive: 30,
    tents: 30,
    decorations: 20,
    vegetation: 25,
    particles: 15,
    landmarks: 90,
    shadows: 0,
    shadowMapSize: 512,
    staticCheckSeconds: 0.25,
    hysteresis: 4,
    tvFeedFps: 4,
    tvFeedWidth: 256,
    bloomScale: 0.5,
  },
  normal: {
    mobile: true,
    dprCap: 1,
    characters: 35,
    animation: 25,
    interactive: 45,
    tents: 45,
    decorations: 30,
    vegetation: 35,
    particles: 25,
    landmarks: 150,
    shadows: 0,
    shadowMapSize: 512,
    staticCheckSeconds: 0.2,
    hysteresis: 8,
    tvFeedFps: 5,
    tvFeedWidth: 384,
    bloomScale: 0.65,
  },
  high: {
    mobile: true,
    dprCap: 1.5,
    characters: 60,
    animation: 40,
    interactive: 128,
    tents: 75,
    decorations: 45,
    vegetation: 60,
    particles: 70,
    landmarks: 240,
    shadows: 20,
    shadowMapSize: 1024,
    staticCheckSeconds: 0.2,
    hysteresis: 8,
    tvFeedFps: 8,
    tvFeedWidth: 512,
    bloomScale: 0.8,
  },
};
export const DESKTOP_GRAPHICS: GraphicsProfile = {
  ...MOBILE_GRAPHICS.high,
  mobile: false,
  dprCap: 2,
  characters: Infinity,
  animation: Infinity,
  interactive: Infinity,
  tents: Infinity,
  decorations: Infinity,
  vegetation: Infinity,
  particles: Infinity,
  landmarks: Infinity,
  shadows: Infinity,
  shadowMapSize: 1024,
  tvFeedFps: 10,
  tvFeedWidth: 512,
  bloomScale: 1,
};

export function isMobileQuality(value: unknown): value is MobileQuality {
  return ['auto', 'low', 'normal', 'high'].includes(String(value));
}
export function selectGraphicsProfile(
  capabilities: {
    coarse: boolean;
    touchPoints: number;
    width: number;
    height: number;
    deviceMemory?: number;
  },
  quality: MobileQuality = 'auto',
): GraphicsProfile {
  // Touchscreen laptops with a fine primary pointer keep desktop quality.
  const mobile =
    capabilities.coarse ||
    (capabilities.touchPoints > 0 && Math.max(capabilities.width, capabilities.height) <= 1024);
  if (!mobile) return DESKTOP_GRAPHICS;
  if (quality !== 'auto') return MOBILE_GRAPHICS[quality];
  return capabilities.deviceMemory === undefined || capabilities.deviceMemory <= 4
    ? MOBILE_GRAPHICS.low
    : MOBILE_GRAPHICS.normal;
}
export function browserGraphicsProfile(quality: MobileQuality = 'auto'): GraphicsProfile {
  return selectGraphicsProfile(
    {
      coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
      touchPoints: navigator.maxTouchPoints ?? 0,
      width: innerWidth,
      height: innerHeight,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    },
    quality,
  );
}
export function savedMobileQuality(): MobileQuality {
  try {
    const value = localStorage.getItem('festival-mobile-quality');
    return isMobileQuality(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}
export function withinVisualRange(
  distanceSquared: number,
  distance: number,
  visible: boolean,
  hysteresis = 8,
): boolean {
  const threshold = distance + (visible ? hysteresis : 0);
  return distanceSquared <= threshold * threshold;
}
