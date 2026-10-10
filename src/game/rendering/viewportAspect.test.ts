import { describe, expect, it } from 'vitest';
import { calculateViewportDimensions, isAspectRatioPreset } from './viewportAspect';

describe('viewportAspect', () => {
  it('recognizes valid presets', () => {
    expect(isAspectRatioPreset('ultrawide')).toBe(true);
    expect(isAspectRatioPreset('auto')).toBe(true);
    expect(isAspectRatioPreset('16:9')).toBe(true);
    expect(isAspectRatioPreset('4:3')).toBe(true);
    expect(isAspectRatioPreset('32:9')).toBe(true);
    expect(isAspectRatioPreset('invalid')).toBe(false);
    expect(isAspectRatioPreset(null)).toBe(false);
    expect(isAspectRatioPreset('toString')).toBe(false);
    expect(isAspectRatioPreset('__proto__')).toBe(false);
  });

  it('defaults to the whole portrait phone viewport', () => {
    expect(calculateViewportDimensions(390, 844)).toEqual({
      width: 390,
      height: 844,
      left: 0,
      top: 0,
      aspect: 390 / 844,
    });
  });

  it('calculates ultrawide (21:9) letterbox on 16:9 screen', () => {
    // 1920x1080 (16:9) -> Ultrawide (21:9 ≈ 2.3333) is wider, so height gets letterboxed
    const bounds = calculateViewportDimensions(1920, 1080, 'ultrawide');
    expect(bounds.width).toBe(1920);
    expect(bounds.height).toBe(Math.round(1920 / (21 / 9)));
    expect(bounds.height).toBeLessThan(1080);
    expect(bounds.left).toBe(0);
    expect(bounds.top).toBe(Math.round((1080 - bounds.height) / 2));
    expect(bounds.aspect).toBeCloseTo(21 / 9, 3);
  });

  it('calculates ultrawide (21:9) on native 21:9 screen without letterbox', () => {
    const nativeW = 2520;
    const nativeH = 1080; // 2520 / 1080 = 2.3333 = 21 / 9
    const bounds = calculateViewportDimensions(nativeW, nativeH, 'ultrawide');
    expect(bounds.width).toBe(nativeW);
    expect(bounds.height).toBe(nativeH);
    expect(bounds.left).toBe(0);
    expect(bounds.top).toBe(0);
  });

  it('calculates auto (fullscreen) without any bars', () => {
    const bounds = calculateViewportDimensions(1920, 1080, 'auto');
    expect(bounds.width).toBe(1920);
    expect(bounds.height).toBe(1080);
    expect(bounds.left).toBe(0);
    expect(bounds.top).toBe(0);
    expect(bounds.aspect).toBeCloseTo(16 / 9, 3);
  });

  it('calculates 4:3 pillarbox on 16:9 screen', () => {
    // 1920x1080 -> 4:3 is narrower than 16:9, so width gets pillarboxed
    const bounds = calculateViewportDimensions(1920, 1080, '4:3');
    expect(bounds.height).toBe(1080);
    expect(bounds.width).toBe(Math.round(1080 * (4 / 3)));
    expect(bounds.width).toBe(1440);
    expect(bounds.left).toBe((1920 - 1440) / 2);
    expect(bounds.top).toBe(0);
  });

  it('calculates 32:9 on 16:9 screen with letterbox', () => {
    const bounds = calculateViewportDimensions(1920, 1080, '32:9');
    expect(bounds.width).toBe(1920);
    expect(bounds.height).toBe(Math.round(1920 / (32 / 9)));
    expect(bounds.top).toBe(Math.round((1080 - bounds.height) / 2));
  });

  it('safely handles zero or negative dimensions', () => {
    const bounds = calculateViewportDimensions(0, 0, 'ultrawide');
    expect(bounds.width).toBeGreaterThanOrEqual(1);
    expect(bounds.height).toBeGreaterThanOrEqual(1);
  });
});
