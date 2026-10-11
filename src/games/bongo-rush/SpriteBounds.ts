export interface SpriteCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Finds a common alpha crop across every atlas frame, so size and feet never jitter between directions. */
export function measureSpriteCrop(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  frameWidth: number,
  frameHeight: number,
): SpriteCrop {
  let left = frameWidth,
    top = frameHeight,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 32) continue;
      const localX = x % frameWidth,
        localY = y % frameHeight;
      left = Math.min(left, localX);
      top = Math.min(top, localY);
      right = Math.max(right, localX);
      bottom = Math.max(bottom, localY);
    }
  return right < left
    ? { x: 0, y: 0, width: frameWidth, height: frameHeight }
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
