import { describe, expect, it } from 'vitest';
import { measureSpriteCrop } from './SpriteBounds';

describe('consistent cosmetic sprite framing', () => {
  it('unions alpha bounds across frames without changing the source image', () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    pixels[(1 * 8 + 1) * 4 + 3] = 255;
    pixels[(6 * 8 + 6) * 4 + 3] = 255;
    const original = new Uint8ClampedArray(pixels);
    expect(measureSpriteCrop(pixels, 8, 8, 4, 4)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    expect(pixels).toEqual(original);
  });
  it('ignores near-invisible shadows and handles empty atlases safely', () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    pixels[3] = 8;
    expect(measureSpriteCrop(pixels, 4, 4, 4, 4)).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });
});
