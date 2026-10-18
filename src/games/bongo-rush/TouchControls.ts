export interface TouchControlPreferences {
  position: 'left' | 'center' | 'right';
  size: 'compact' | 'normal' | 'large';
  opacity: number;
}

/** Untrusted saves cannot shrink targets below 48 px or make controls invisible. */
export function touchControlPreferences(
  value?: Partial<TouchControlPreferences> | null,
): TouchControlPreferences {
  return {
    position: value?.position === 'left' || value?.position === 'right' ? value.position : 'center',
    size: value?.size === 'compact' || value?.size === 'large' ? value.size : 'normal',
    opacity:
      typeof value?.opacity === 'number' && Number.isFinite(value.opacity)
        ? Math.max(60, Math.min(100, value.opacity))
        : 90,
  };
}

/** CSS sizes include two 2 px gaps, leaving at least 48 px per digital arrow. */
export const TOUCH_PAD_SIZES = { compact: 148, normal: 168, large: 192 } as const;

/** In short landscape view, keep the hero beside the pad instead of compressing it above the pad. */
export function cameraSafeInsets(
  width: number,
  height: number,
  hudBottom: number,
  padSize: number,
  padBottom: number,
  position: TouchControlPreferences['position'],
  touch: boolean,
) {
  const top = Math.min(Math.max(8, hudBottom + 8), height * 0.25);
  if (touch && width > height && height < 500) {
    const side = Math.min(padSize + 24, width * 0.7);
    return {
      top,
      bottom: 8,
      left: position === 'left' ? side : 8,
      right:
        position === 'right'
          ? side
          : position === 'center'
            ? Math.min((width + padSize) / 2 + 12, width - 64)
            : 8,
    };
  }
  return { top, bottom: touch ? Math.min(padSize + padBottom + 12, height * 0.55) : 8, left: 8, right: 8 };
}
