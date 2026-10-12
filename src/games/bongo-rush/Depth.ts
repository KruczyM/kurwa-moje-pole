import type { Point } from './types';

export const DEPTH_LAYERS = [
  { order: 'far', factor: 0.15, opacity: 1 },
  { order: 'middle', factor: 0.4, opacity: 0.32 },
  { order: 'front', factor: 1.1, opacity: 0.18 },
] as const;

/** Cover with overscan; all camera offsets stay inside the actual image edges. */
export function depthFrame(
  viewport: Point,
  image: Point,
  cameraDisplacement: Point,
  factor: number,
  reducedMotion = false,
) {
  const scale = Math.max(viewport.x / image.x, viewport.y / image.y) * 1.2;
  const width = image.x * scale;
  const height = image.y * scale;
  const offset = (value: number, margin: number) =>
    reducedMotion ? 0 : Math.max(-margin, Math.min(margin, -value * factor));
  return {
    x: (viewport.x - width) / 2 + offset(cameraDisplacement.x, (width - viewport.x) / 2),
    y: (viewport.y - height) / 2 + offset(cameraDisplacement.y, (height - viewport.y) / 2),
    width,
    height,
  };
}

/** The foreground is confined to a narrow frame, keeping the central play area clear. */
export function foregroundBands(width: number, height: number) {
  const x = width * 0.12,
    y = height * 0.12;
  return [
    { x: 0, y: 0, width, height: y },
    { x: 0, y: height - y, width, height: y },
    { x: 0, y, width: x, height: height - 2 * y },
    { x: width - x, y, width: x, height: height - 2 * y },
  ];
}
