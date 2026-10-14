import { CAMERA_VIEW_WIDTH, MAX_FIGHTER_SEPARATION, STAGE_HALF_WIDTH } from '../simulation/Movement';

export const CAMERA_SHAKE_MARGIN = 32;
/** Screen ground line as a fraction of viewport height (shared by camera and background). */
export const GROUND_SCREEN_RATIO = 0.74;
/** World height kept visible above the floor: body plus jump apex. */
const FIGHT_WORLD_HEIGHT = 320;
/** Upper bound so large monitors keep the authored sprite scale instead of magnifying it. */
export const MAX_ARENA_ZOOM = 1.1;
/** World units reserved beyond each fighter centre for the sprite and its attack reach. */
export const FIGHTER_SCREEN_MARGIN = (CAMERA_VIEW_WIDTH - MAX_FIGHTER_SEPARATION) / 2;

/** Constant zoom: depends only on the viewport, never on the distance between fighters. */
export function arenaZoom(width: number, height: number): number {
  const byWidth = Math.max(1, width - CAMERA_SHAKE_MARGIN * 2) / CAMERA_VIEW_WIDTH;
  const byHeight = Math.max(1, height * GROUND_SCREEN_RATIO) / FIGHT_WORLD_HEIGHT;
  return Math.min(MAX_ARENA_ZOOM, byWidth, byHeight);
}

/** Short cinematic punch-in that still keeps both fighters (and their margins) in frame. */
export function cinematicZoom(width: number, baseZoom: number, p1x: number, p2x: number): number {
  const span = Math.abs(p2x - p1x) + FIGHTER_SCREEN_MARGIN * 2;
  const fit = Math.max(1, width - CAMERA_SHAKE_MARGIN * 2) / span;
  return Math.max(baseZoom, Math.min(baseZoom * 1.15, fit));
}

/** Follow the midpoint and stop at the arena edges, so the image no longer scrolls there. */
export function arenaCameraX(midX: number, width: number, zoom: number): number {
  const halfView = width / (2 * zoom);
  const limit = Math.max(0, STAGE_HALF_WIDTH - halfView);
  return Math.max(-limit, Math.min(limit, midX));
}

/**
 * Legacy dynamic framing helper retained for backward compatibility with existing tests.
 */
export function fightFraming(width: number, zoom: number, cameraX: number, p1x: number, p2x: number) {
  const minX = Math.min(p1x, p2x) - 230;
  const maxX = Math.max(p1x, p2x) + 230;
  const available = Math.max(1, width - CAMERA_SHAKE_MARGIN * 2);
  const fittedZoom = Math.min(zoom, available / (maxX - minX));
  const half = available / (2 * fittedZoom);
  return { zoom: fittedZoom, x: Math.max(maxX - half, Math.min(minX + half, cameraX)) };
}

/**
 * Fixed world rectangle covering the whole arena: no parallax and no rescaling while moving.
 * Supports both modern 5-arg signature and legacy 6-arg signature (with cameraX).
 */
export function stageLayout(
  width: number,
  height: number,
  zoom: number,
  aspectOrCameraX: number,
  groundRatioOrAspect: number,
  maybeGroundRatio?: number,
) {
  const hasCamX = maybeGroundRatio !== undefined;
  const cameraX = hasCamX ? aspectOrCameraX : 0;
  const aspect = hasCamX ? groundRatioOrAspect : aspectOrCameraX;
  const groundRatio = hasCamX ? maybeGroundRatio : groundRatioOrAspect;

  const groundY = height * GROUND_SCREEN_RATIO;
  const halfView = width / (2 * zoom);
  const shake = (CAMERA_SHAKE_MARGIN * 2) / zoom;
  const imageWidth = 2 * Math.max(STAGE_HALF_WIDTH, halfView + Math.abs(cameraX)) + shake;
  const aboveGround = Math.max(imageWidth * aspect * groundRatio, (groundY + CAMERA_SHAKE_MARGIN) / zoom);
  const belowGround = Math.max(
    imageWidth * aspect * (1 - groundRatio),
    (height - groundY + CAMERA_SHAKE_MARGIN) / zoom,
  );
  return {
    x: -imageWidth / 2,
    y: -aboveGround,
    width: imageWidth,
    height: aboveGround + belowGround,
    aboveGround,
    belowGround,
    groundY,
  };
}
