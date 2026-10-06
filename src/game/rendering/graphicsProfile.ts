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
    characters: 72,
    animation: 48,
    interactive: 84,
    tents: 110,
    decorations: 48,
    vegetation: 60,
    particles: 40,
    landmarks: 380,
    shadows: 28,
    shadowMapSize: 512,
    staticCheckSeconds: 0.25,
    hysteresis: 8,
    tvFeedFps: 4,
    tvFeedWidth: 256,
    bloomScale: 0.5,
  },
  normal: {
    mobile: true,
    dprCap: 1.25,
    characters: 96,
    animation: 64,
    interactive: 100,
    tents: 140,
    decorations: 64,
    vegetation: 80,
    particles: 55,
    landmarks: 380,
    shadows: 36,
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
    characters: 128,
    animation: 84,
    interactive: 128,
    tents: 180,
    decorations: 84,
    vegetation: 110,
    particles: 70,
    landmarks: 380,
    shadows: 44,
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
  return capabilities.deviceMemory !== undefined && capabilities.deviceMemory <= 4
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
