import { describe, expect, it } from 'vitest';
import { CameraRig } from '../after/presentation/CameraRig';
import { touchControlPreferences, TOUCH_PAD_SIZES, cameraSafeInsets } from './TouchControls';
import { loadProgress, saveProgress } from './Progress';

describe('UI-safe camera and mobile controls', () => {
  it('limits camera lag before a moving tile enters controls on a very narrow landscape screen', () => {
    const camera = new CameraRig({ width: 100, height: 100 });
    const insets = cameraSafeInsets(320, 200, 44, 168, 8, 'center', true);
    camera.resize({ width: 320, height: 200, pixelsPerMeter: 40, insets });
    camera.snap({ x: 30, y: 30 });
    for (let frame = 0; frame < 120; frame++) {
      const target = { x: 30 + frame / 6, y: 30 };
      camera.follow(target, 1 / 60);
      const point = camera.project(target);
      expect(point.x + 20).toBeLessThanOrEqual(64.001);
      expect(point.x - 20).toBeGreaterThanOrEqual(7.999);
    }
  });
  it('keeps a whole tile clear of large controls even on a short landscape screen', () => {
    for (const position of ['left', 'center', 'right'] as const) {
      const camera = new CameraRig({ width: 40, height: 22 });
      const insets = cameraSafeInsets(568, 267, 44, 168, 8, position, true);
      camera.resize({ width: 568, height: 267, pixelsPerMeter: 40, insets });
      const padLeft = position === 'left' ? 12 : position === 'right' ? 388 : 200;
      for (const target of [
        { x: 1.5, y: 1.5 },
        { x: 38.5, y: 20.5 },
        { x: 20, y: 11 },
      ]) {
        camera.snap(target);
        const p = camera.project(target);
        const overlaps = p.x - 20 < padLeft + 168 && p.x + 20 > padLeft && p.y + 20 > 91;
        expect(overlaps).toBe(false);
        expect(p.y - 20).toBeGreaterThanOrEqual(44);
      }
    }
  });
  it('keeps edge spawns inside the unoccluded area without enlarging a small map', () => {
    for (const bounds of [
      { width: 40, height: 22 },
      { width: 13, height: 8 },
    ]) {
      const camera = new CameraRig(bounds);
      camera.resize({
        width: 390,
        height: 750,
        pixelsPerMeter: 40,
        insets: { top: 80, bottom: 228, left: 8, right: 8 },
      });
      for (const target of [
        { x: 1.5, y: 1.5 },
        { x: bounds.width - 1.5, y: bounds.height - 1.5 },
      ]) {
        camera.snap(target);
        const projected = camera.project(target);
        expect(projected.y - 20).toBeGreaterThanOrEqual(80);
        expect(projected.y + 20).toBeLessThanOrEqual(522);
        expect(projected.x - 20).toBeGreaterThanOrEqual(8);
        expect(projected.x + 20).toBeLessThanOrEqual(382);
      }
      expect(camera.project({ x: 1, y: 0 }).x - camera.project({ x: 0, y: 0 }).x).toBe(40);
    }
  });
  it('preserves legacy framing without insets, copies options and rejects invalid safe areas', () => {
    const camera = new CameraRig({ width: 100, height: 100 });
    const insets = { top: 60, bottom: 100, left: 0, right: 0 };
    camera.resize({ width: 400, height: 600, pixelsPerMeter: 40, insets });
    camera.snap({ x: 30, y: 30 });
    const before = camera.project({ x: 30, y: 30 });
    insets.bottom = 590;
    expect(camera.project({ x: 30, y: 30 })).toEqual(before);
    expect(() => camera.resize({ width: 400, height: 600, pixelsPerMeter: 40, insets })).toThrow();
    camera.resize({ width: 400, height: 600, pixelsPerMeter: 40 });
    camera.snap({ x: 30, y: 30 });
    expect(camera.project({ x: 30, y: 30 })).toEqual({ x: 200, y: 300 });
  });
  it('keeps touch targets usable and migrates preferences without changing progress', () => {
    expect(touchControlPreferences()).toEqual({ position: 'center', size: 'normal', opacity: 90 });
    expect(touchControlPreferences({ opacity: 1 })).toMatchObject({ opacity: 60 });
    expect(touchControlPreferences({ opacity: Infinity })).toMatchObject({ opacity: 90 });
    for (const size of Object.values(TOUCH_PAD_SIZES)) expect((size - 4) / 3).toBeGreaterThanOrEqual(48);
    const progress = loadProgress({
      getItem: () =>
        JSON.stringify({
          version: 1,
          campaignRevision: 3,
          unlocked: 18,
          hero: 'korba',
          touchControls: { position: 'left', size: 'large', opacity: 75 },
        }),
    });
    expect(progress).toMatchObject({
      unlocked: 18,
      hero: 'korba',
      touchControls: { position: 'left', size: 'large', opacity: 75 },
    });
    let saved = '';
    saveProgress(
      {
        setItem: (_key, value) => {
          saved = value;
        },
      },
      progress,
    );
    expect(loadProgress({ getItem: () => saved })).toEqual(progress);
  });
});
