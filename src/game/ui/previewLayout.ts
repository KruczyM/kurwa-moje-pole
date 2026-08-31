export type PreviewSize = { width: number; height: number };
export type PreviewBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type PreviewLayout = {
  scale: number;
  position: { x: number; y: number; z: number };
  camera: { left: number; right: number; top: number; bottom: number };
  safeArea: { left: number; right: number; top: number; bottom: number };
};

/** Ogranicza wartość do domkniętego przedziału. */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Fits complete model bounds into the free start-screen area. */
export function calculatePreviewLayout(
  viewport: PreviewSize,
  bounds: PreviewBounds,
  wideBreakpoint = 900,
): PreviewLayout {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const modelWidth = bounds.max.x - bounds.min.x;
  const modelHeight = bounds.max.y - bounds.min.y;
  const modelDepth = bounds.max.z - bounds.min.z;

  if (
    ![modelWidth, modelHeight, modelDepth].every(Number.isFinite) ||
    modelWidth <= 0 ||
    modelHeight <= 0 ||
    modelDepth < 0
  ) {
    throw new Error('Model podglądu ma nieprawidłowy bounding box.');
  }

  const margin = clamp(Math.min(width, height) * 0.055, 16, 56);
  const wide = width > wideBreakpoint;
  const safeArea = {
    left: wide ? Math.max(width * 0.56, width - height * 0.78) : margin,
    right: width - margin,
    top: margin,
    bottom: height - margin,
  };
  const availableWidth = Math.max(1, safeArea.right - safeArea.left);
  const availableHeight = Math.max(1, safeArea.bottom - safeArea.top);
  const scale = Math.min(availableWidth / modelWidth, availableHeight / modelHeight) * 0.94;
  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const target = {
    x: (safeArea.left + safeArea.right) / 2 - width / 2,
    y: height / 2 - (safeArea.top + safeArea.bottom) / 2,
  };

  return {
    scale,
    position: {
      x: target.x - center.x * scale,
      y: target.y - center.y * scale,
      z: -center.z * scale,
    },
    camera: {
      left: -width / 2,
      right: width / 2,
      top: height / 2,
      bottom: -height / 2,
    },
    safeArea,
  };
}

/** Sprawdza w pikselach, czy cały model mieści się w wyznaczonym bezpiecznym obszarze. */
export function previewBoundsFit(viewport: PreviewSize, bounds: PreviewBounds, layout: PreviewLayout) {
  const toPixelX = (value: number) => viewport.width / 2 + value * layout.scale + layout.position.x;
  const toPixelY = (value: number) => viewport.height / 2 - (value * layout.scale + layout.position.y);
  const left = toPixelX(bounds.min.x);
  const right = toPixelX(bounds.max.x);
  const top = toPixelY(bounds.max.y);
  const bottom = toPixelY(bounds.min.y);

  return (
    left >= layout.safeArea.left - 0.01 &&
    right <= layout.safeArea.right + 0.01 &&
    top >= layout.safeArea.top - 0.01 &&
    bottom <= layout.safeArea.bottom + 0.01
  );
}
