import { describe, expect, it } from 'vitest';
import { type MatrixRainContext, MatrixRainOverlay } from './MatrixRainOverlay';

class Fake2dContext implements MatrixRainContext {
  canvas: { width: number; height: number };
  clearRectCalls: Array<{ x: number; y: number; w: number; h: number }> = [];
  fillRectCalls: Array<{ x: number; y: number; w: number; h: number }> = [];
  fillTextCalls: Array<{ text: string; x: number; y: number }> = [];
  fillStyle = '';
  font = '';

  constructor(width = 800, height = 600) {
    this.canvas = { width, height };
  }

  clearRect(x: number, y: number, w: number, h: number) {
    this.clearRectCalls.push({ x, y, w, h });
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.fillRectCalls.push({ x, y, w, h });
  }

  fillText(text: string, x: number, y: number) {
    this.fillTextCalls.push({ text, x, y });
  }

  reset() {
    this.clearRectCalls = [];
    this.fillRectCalls = [];
    this.fillTextCalls = [];
  }
}

describe('MatrixRainOverlay', () => {
  it('initializes columns based on width and quality presets', () => {
    const fakeCtx = new Fake2dContext(800, 600);
    const overlay = new MatrixRainOverlay(null, { context: fakeCtx, quality: 'medium' });

    expect(overlay.columnCount).toBeGreaterThan(0);
    const mediumCols = overlay.columnCount;

    overlay.setQuality('low');
    const lowCols = overlay.columnCount;
    expect(lowCols).toBeLessThan(mediumCols);

    overlay.setQuality('high');
    const highCols = overlay.columnCount;
    expect(highCols).toBeGreaterThan(mediumCols);

    overlay.dispose();
  });

  it('adapts column count on resize without crashing', () => {
    const fakeCtx = new Fake2dContext(800, 600);
    const overlay = new MatrixRainOverlay(null, { context: fakeCtx });

    overlay.resize(1600, 900);
    expect(overlay.columnCount).toBeGreaterThan(30);

    overlay.resize(320, 240);
    expect(overlay.columnCount).toBeLessThan(20);

    overlay.dispose();
  });

  it('renders glyphs when alpha > 0 and clears when alpha is 0', () => {
    const fakeCtx = new Fake2dContext(800, 600);
    const overlay = new MatrixRainOverlay(null, { context: fakeCtx });

    overlay.update(0.016, 0.8, false, false);
    expect(overlay.isVisible).toBe(true);
    expect(fakeCtx.clearRectCalls.length).toBeGreaterThan(0);

    // Fade to 0
    fakeCtx.reset();
    overlay.update(0.016, 0, false, false);
    expect(overlay.isVisible).toBe(false);
    expect(fakeCtx.clearRectCalls.length).toBe(1);

    overlay.dispose();
  });

  it('respects reduce motion by not advancing column y positions', () => {
    const fakeCtx = new Fake2dContext(800, 600);
    const overlay = new MatrixRainOverlay(null, { context: fakeCtx });

    // Force all columns to have known y
    const cols = (overlay as unknown as { columns: Array<{ y: number }> }).columns;
    const initialY = cols.map((c) => c.y);

    // Update with reduceMotion = true
    overlay.update(0.5, 0.7, true, false);
    const updatedY = cols.map((c) => c.y);

    expect(updatedY).toEqual(initialY);

    // Update with reduceMotion = false -> positions should change
    overlay.update(0.5, 0.7, false, false);
    const movingY = cols.map((c) => c.y);
    expect(movingY).not.toEqual(initialY);

    overlay.dispose();
  });

  it('cleans up cleanly on dispose', () => {
    const fakeCtx = new Fake2dContext(800, 600);
    const overlay = new MatrixRainOverlay(null, { context: fakeCtx });

    overlay.update(0.016, 0.8, false, false);
    expect(overlay.isVisible).toBe(true);

    overlay.dispose();
    expect(overlay.columnCount).toBe(0);
    expect(overlay.isVisible).toBe(false);
  });
});
