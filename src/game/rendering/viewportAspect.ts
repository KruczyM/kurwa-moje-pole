export type AspectRatioPreset = 'ultrawide' | 'auto' | '16:9' | '4:3' | '32:9';

export interface ViewportBounds {
  width: number;
  height: number;
  left: number;
  top: number;
  aspect: number;
}

export const ASPECT_RATIO_PRESETS: Record<AspectRatioPreset, { label: string; ratio: number | null }> = {
  ultrawide: { label: 'Kinowy Ultrawide (21:9)', ratio: 21 / 9 },
  auto: { label: 'Pełny ekran (Automatyczny)', ratio: null },
  '16:9': { label: 'Standardowy (16:9)', ratio: 16 / 9 },
  '4:3': { label: 'Klasyczny / Retro (4:3)', ratio: 4 / 3 },
  '32:9': { label: 'Super Ultrawide (32:9)', ratio: 32 / 9 },
};

export function isAspectRatioPreset(value: unknown): value is AspectRatioPreset {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ASPECT_RATIO_PRESETS, value);
}

/**
 * Wylicza wymiary i wycentrowane przesunięcie widoku renderowania WebGL
 * z eleganckim obramowaniem (letterbox/pillarbox) zgodnie z wybranym formatem.
 */
export function calculateViewportDimensions(
  windowWidth: number,
  windowHeight: number,
  preset: AspectRatioPreset = 'auto',
): ViewportBounds {
  const safeW = Math.max(1, Math.round(windowWidth));
  const safeH = Math.max(1, Math.round(windowHeight));
  const targetRatio = ASPECT_RATIO_PRESETS[preset]?.ratio ?? null;

  if (!targetRatio || targetRatio <= 0) {
    return {
      width: safeW,
      height: safeH,
      left: 0,
      top: 0,
      aspect: safeW / safeH,
    };
  }

  const windowRatio = safeW / safeH;
  let renderWidth: number;
  let renderHeight: number;

  if (windowRatio < targetRatio) {
    // Okno jest węższe niż docelowy kadr -> pasy u góry i u dołu (letterbox)
    renderWidth = safeW;
    renderHeight = Math.max(1, Math.round(safeW / targetRatio));
  } else {
    // Okno jest szersze niż docelowy kadr -> pasy po bokach (pillarbox)
    renderHeight = safeH;
    renderWidth = Math.max(1, Math.round(safeH * targetRatio));
  }

  const left = Math.round((safeW - renderWidth) / 2);
  const top = Math.round((safeH - renderHeight) / 2);

  return {
    width: renderWidth,
    height: renderHeight,
    left,
    top,
    aspect: targetRatio,
  };
}
