import { describe, expect, it } from 'vitest';
import { calculatePreviewLayout, previewBoundsFit, type PreviewBounds } from './previewLayout';

const characterDimensions = [
  [0.5331, 0.9874, 0.3700], [0.9558, 0.9874, 0.3009],
  [0.6333, 0.9870, 0.3488], [0.9778, 0.9899, 0.3674],
  [0.5588, 0.9872, 0.3485], [0.5398, 0.9874, 0.4095],
  [0.6202, 0.9872, 0.3727], [0.5094, 0.9873, 0.3620],
] as const;
const viewports = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2535, height: 1252 },
];
const boundsFromDimensions = ([width, height, depth]: readonly number[]): PreviewBounds => ({
  min: { x: -width / 2, y: -height / 2, z: -depth / 2 },
  max: { x: width / 2, y: height / 2, z: depth / 2 },
});

describe('character preview layout', () => {
  it('keeps all eight characters inside all required desktop viewports', () => {
    for (const viewport of viewports) for (const dimensions of characterDimensions) {
      const bounds = boundsFromDimensions(dimensions);
      const layout = calculatePreviewLayout(viewport, bounds);
      expect(previewBoundsFit(viewport, bounds, layout)).toBe(true);
      expect(layout.safeArea.left).toBeGreaterThan(viewport.width / 2);
    }
  });

  it('uses the complete layer below the menu on a narrow screen', () => {
    const viewport = { width: 390, height: 300 };
    const bounds = boundsFromDimensions(characterDimensions[3]);
    const layout = calculatePreviewLayout(viewport, bounds);
    expect(previewBoundsFit(viewport, bounds, layout)).toBe(true);
    expect(layout.safeArea.left).toBeLessThan(viewport.width / 4);
  });

  it('rejects empty model bounds', () => {
    expect(() => calculatePreviewLayout(
      { width: 1280, height: 720 },
      { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 1, z: 1 } },
    )).toThrow(/bounding box/);
  });
});
