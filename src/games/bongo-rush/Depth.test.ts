import { describe, expect, it } from 'vitest';
import { DEPTH_LAYERS, depthFrame, foregroundBands } from './Depth';
import { CameraRig } from '../after/presentation/CameraRig';

describe('cave parallax geometry', () => {
  const viewport = { x: 1000, y: 600 },
    image = { x: 1000, y: 600 };
  it('moves layers at their configured rates before the image reaches its edge', () => {
    const center = depthFrame(viewport, image, { x: 0, y: 0 }, 0.15);
    for (const layer of DEPTH_LAYERS) {
      const frame = depthFrame(viewport, image, { x: 10, y: -10 }, layer.factor);
      expect(frame.x - center.x).toBeCloseTo(-10 * layer.factor);
      expect(frame.y - center.y).toBeCloseTo(10 * layer.factor);
    }
  });
  it('never exposes empty edges across portrait, landscape, resize and map corners', () => {
    for (const view of [viewport, { x: 390, y: 520 }, { x: 800, y: 220 }])
      for (const point of [
        { x: 1e6, y: -1e6 },
        { x: -1e6, y: 1e6 },
        { x: 0, y: 0 },
      ]) {
        const frame = depthFrame(view, image, point, 1.1);
        expect(frame.x).toBeLessThanOrEqual(0);
        expect(frame.y).toBeLessThanOrEqual(0);
        expect(frame.x + frame.width).toBeGreaterThanOrEqual(view.x);
        expect(frame.y + frame.height).toBeGreaterThanOrEqual(view.y);
      }
  });
  it('is static for reduced motion and identical when a paused camera does not move', () => {
    expect(depthFrame(viewport, image, { x: 80, y: 90 }, 0.4, true)).toEqual(
      depthFrame(viewport, image, { x: -80, y: -90 }, 0.4, true),
    );
    const camera = new CameraRig({ width: 100, height: 100 });
    camera.resize({ width: 1000, height: 600, pixelsPerMeter: 64 });
    camera.snap({ x: 30, y: 30 });
    const before = camera.project({ x: 0, y: 0 });
    camera.follow({ x: 50, y: 50 }, 1, true);
    expect(depthFrame(viewport, image, camera.project({ x: 0, y: 0 }), 0.4)).toEqual(
      depthFrame(viewport, image, before, 0.4),
    );
    camera.snap({ x: 10, y: 10 });
    expect(camera.project({ x: 10, y: 10 })).toEqual({ x: 500, y: 300 });
  });
  it('restricts foreground bands to the outer twelve percent without overlapping corners', () => {
    expect(foregroundBands(1000, 600)).toEqual([
      { x: 0, y: 0, width: 1000, height: 72 },
      { x: 0, y: 528, width: 1000, height: 72 },
      { x: 0, y: 72, width: 120, height: 456 },
      { x: 880, y: 72, width: 120, height: 456 },
    ]);
    expect(DEPTH_LAYERS[2].opacity).toBeLessThanOrEqual(0.2);
  });
});
