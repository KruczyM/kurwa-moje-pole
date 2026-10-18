import { FighterDefinition, FighterState } from './CombatTypes';

export const STAGE_WIDTH = 1200;
export const STAGE_HALF_WIDTH = STAGE_WIDTH / 2;
/** Minimum world width visible on any screen; zoom never depends on fighter distance. */
export const CAMERA_VIEW_WIDTH = 820;
/** Fighting-game "camera wall": leaves 150 units per side for the sprite and its reach. */
export const MAX_FIGHTER_SEPARATION = 520;
export const GRAVITY = 0.85;

function clampToStage(fighter: FighterState, def: FighterDefinition): void {
  const half = def.pushbox.w / 2;
  fighter.x = Math.max(-STAGE_HALF_WIDTH + half, Math.min(STAGE_HALF_WIDTH - half, fighter.x));
}

/**
 * Hold the fighter who is moving away once the pair reaches the camera wall.
 * The other fighter is never dragged; if both (or neither) retreat the excess is shared.
 */
export function enforceMaxSeparation(
  p1: FighterState,
  def1: FighterDefinition,
  p2: FighterState,
  def2: FighterDefinition,
): void {
  const dx = p2.x - p1.x;
  const excess = Math.abs(dx) - MAX_FIGHTER_SEPARATION;
  if (excess <= 0) return;
  const away = dx >= 0 ? 1 : -1;
  const p1Leaving = p1.vx * -away > 0;
  const p2Leaving = p2.vx * away > 0;
  const share1 = p1Leaving && !p2Leaving ? 1 : !p1Leaving && p2Leaving ? 0 : 0.5;
  p1.x += away * excess * share1;
  p2.x -= away * excess * (1 - share1);
  if (p1Leaving) p1.vx = 0;
  if (p2Leaving) p2.vx = 0;
  clampToStage(p1, def1);
  clampToStage(p2, def2);
}

export function resolveFacing(p1: FighterState, p2: FighterState): void {
  // If either player is airborne or in active attack/hitstun, preserve facing to prevent abrupt flips
  if (p1.isGrounded && p2.isGrounded) {
    if (p1.state !== 'attack' && p2.state !== 'attack') {
      if (p1.x < p2.x) {
        p1.facing = 1;
        p2.facing = -1;
      } else {
        p1.facing = -1;
        p2.facing = 1;
      }
    }
  }
}

export function updatePhysics(fighter: FighterState, def: FighterDefinition): void {
  // Apply horizontal velocity
  fighter.x += fighter.vx;

  // Apply vertical velocity & gravity
  if (!fighter.isGrounded) {
    fighter.vy -= GRAVITY;
    fighter.y += fighter.vy;

    if (fighter.y <= 0) {
      fighter.y = 0;
      fighter.vy = 0;
      fighter.isGrounded = true;
      if (fighter.state === 'jump_air') {
        fighter.state = 'landing';
        fighter.stateTicks = 0;
      } else if (fighter.state === 'hit_stun' && fighter.isAirJuggle) {
        // Landed from air juggle: hard knockdown upon hitting the ground!
        fighter.state = 'knockdown';
        fighter.stateTicks = 0;
        fighter.vx = 0;
        fighter.isAirJuggle = false;
      } else if (fighter.state === 'knockdown') {
        fighter.stateTicks = 0;
        fighter.vx = 0;
      }
    }
  }

  // Stage boundaries (left and right walls)
  const halfPush = def.pushbox.w / 2;
  if (fighter.x - halfPush < -STAGE_HALF_WIDTH) {
    fighter.x = -STAGE_HALF_WIDTH + halfPush;
    fighter.vx = 0;
  } else if (fighter.x + halfPush > STAGE_HALF_WIDTH) {
    fighter.x = STAGE_HALF_WIDTH - halfPush;
    fighter.vx = 0;
  }
}

export function resolvePushboxes(
  p1: FighterState,
  def1: FighterDefinition,
  p2: FighterState,
  def2: FighterDefinition,
): void {
  // Pushbox prevents grounded players from walking through each other
  if (p1.y < 80 && p2.y < 80) {
    const minDistance = (def1.pushbox.w + def2.pushbox.w) / 2;
    const currentDist = p2.x - p1.x;
    const absDist = Math.abs(currentDist);

    if (absDist < minDistance) {
      const overlap = (minDistance - absDist) / 2;
      if (currentDist >= 0) {
        p1.x -= overlap;
        p2.x += overlap;
      } else {
        p1.x += overlap;
        p2.x -= overlap;
      }
    }
  }
  // Clamp before resolving again; transfer any wall-constrained separation.
  const half1 = def1.pushbox.w / 2;
  const half2 = def2.pushbox.w / 2;
  p1.x = Math.max(-STAGE_HALF_WIDTH + half1, Math.min(STAGE_HALF_WIDTH - half1, p1.x));
  p2.x = Math.max(-STAGE_HALF_WIDTH + half2, Math.min(STAGE_HALF_WIDTH - half2, p2.x));
  if (p1.y < 80 && p2.y < 80) {
    const overlap = half1 + half2 - Math.abs(p2.x - p1.x);
    if (overlap > 0) {
      const sign = p2.x >= p1.x ? 1 : -1;
      const before1 = p1.x;
      p1.x = Math.max(-STAGE_HALF_WIDTH + half1, Math.min(STAGE_HALF_WIDTH - half1, p1.x - sign * overlap));
      const remaining = overlap - Math.abs(p1.x - before1);
      p2.x = Math.max(-STAGE_HALF_WIDTH + half2, Math.min(STAGE_HALF_WIDTH - half2, p2.x + sign * remaining));
    }
  }
}
