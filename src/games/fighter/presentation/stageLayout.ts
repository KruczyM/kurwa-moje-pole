export const CAMERA_SHAKE_MARGIN = 32;

/** Fit both bodies and their forward/back props, including portrait displays. */
export function fightFraming(width: number, zoom: number, cameraX: number, p1x: number, p2x: number) {
  const minX = Math.min(p1x, p2x) - 230;
  const maxX = Math.max(p1x, p2x) + 230;
  const available = Math.max(1, width - CAMERA_SHAKE_MARGIN * 2);
  const fittedZoom = Math.min(zoom, available / (maxX - minX));
  const half = available / (2 * fittedZoom);
  return { zoom: fittedZoom, x: Math.max(maxX - half, Math.min(minX + half, cameraX)) };
}

/** Cover the viewport above and below the shared world ground (y=0). */
export function stageLayout(
  width: number,
  height: number,
  zoom: number,
  cameraX: number,
  aspect: number,
  groundRatio: number,
) {
  const groundY = height * 0.74;
  const imageWidth = Math.max(1420, (width + CAMERA_SHAKE_MARGIN * 2) / zoom + Math.abs(cameraX) * 0.32);
  const aboveGround = Math.max(imageWidth * aspect * groundRatio, (groundY + CAMERA_SHAKE_MARGIN) / zoom);
  const belowGround = Math.max(
    imageWidth * aspect * (1 - groundRatio),
    (height - groundY + CAMERA_SHAKE_MARGIN) / zoom,
  );
  return {
    x: cameraX * 0.84 - imageWidth / 2,
    y: -aboveGround,
    width: imageWidth,
    height: aboveGround + belowGround,
    aboveGround,
    belowGround,
    groundY,
  };
}
