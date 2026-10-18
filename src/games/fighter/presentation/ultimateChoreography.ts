import type { FighterState, MatchState } from '../simulation/CombatTypes';
import { STAGE_HALF_WIDTH } from '../simulation/Movement';

export const REDRAWN_ULTIMATES = new Set([
  'klatwa',
  'chlebak',
  'kobra',
  'zawor',
  'jeczmien',
  'ambona',
  'antena',
  'gruczol',
  'krwiak',
  'pien',
  'pierscien',
]);

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, p: number): number => a + (b - a) * clamp01(p);

/** Freestanding waist-high deck beside the operator, with its controls facing them. */
export function djConsolePose(x: number, y: number, facing: number) {
  return { x: x + facing * 100, y: -(y + 60), width: 130, height: 120, facing };
}

export function floatingCabin(t: number, x: number, y: number, facing: number) {
  return {
    x,
    y: -(y + 270),
    frame: t < 46 ? 0 : t < 52 ? 1 : t < 58 ? 2 : 3,
    facing: 1,
    propId: facing > 0 ? 'gruczol_right' : 'gruczol',
    outletX: x + facing * 20,
    outletY: -(y + 245),
  };
}

/** Front bumper reaches the opponent on contact, then exits the opposite stage edge. */
export function vehicleStageX(t: number, facing: number, targetX: number): number {
  const outside = STAGE_HALF_WIDTH + 260;
  const contact = targetX * facing - 220;
  const position = t <= 76 ? lerp(-outside, contact, (t - 43) / 33) : lerp(contact, outside, (t - 76) / 29);
  return position * facing;
}

/** One presentation clock, driven by authoritative move ticks (including hitstop). */
export function cinematicTick(fighter: FighterState, match?: MatchState): number {
  const move = fighter.currentMove;
  if (!move) return 0;
  if ((match?.superFreezeTicks ?? 0) > 0 && move.id === 'ultimate')
    return 35 * (1 - match!.superFreezeTicks! / (match!.superFreezeTotal || 48));
  const tick = fighter.moveTick;
  if (tick <= move.startup) return 35 + (40 * tick) / Math.max(1, move.startup);
  if (tick <= move.startup + move.active)
    return 76 + (16 * (tick - move.startup - 1)) / Math.max(1, move.active - 1);
  return 93 + (12 * (tick - move.startup - move.active - 1)) / Math.max(1, move.recovery - 1);
}

/** Eight authored poses, with release and contact kept separate. No gameplay movement. */
export function ultimateFrame(id: string, t: number): number {
  if (id === 'ambona' && t >= 64 && t < 94) return 4 + (Math.floor((t - 64) / 1.6) % 2);
  const marks =
    id === 'zawor'
      ? [35, 43, 58, 68, 86, 93, 98, 102]
      : id === 'antena'
        ? [35, 43, 51, 63, 76, 84, 96, 103]
        : id === 'jeczmien'
          ? [35, 43, 52, 60, 66, 74, 96, 103]
          : id === 'klatwa' || id === 'kobra' || id === 'pien' || id === 'pierscien'
            ? [35, 43, 52, 63, 76, 85, 96, 103]
            : [35, 43, 52, 60, 66, 76, 96, 103];
  let frame = 0;
  for (let i = 0; i < marks.length; i++) if (t >= marks[i]) frame = i;
  return frame;
}

/** Authored hand anchors in world units, measured against the fixed foot pivot. */
export function ultimateHand(id: string, t: number, hand: 0 | 1 = 0): { x: number; y: number } {
  const frame = ultimateFrame(id, t);
  if (id === 'chlebak') {
    if (frame < 2) return { x: 40, y: 37 };
    if (frame < 4) return { x: -28, y: 115 };
    return { x: 63, y: 106 };
  }
  if (id === 'jeczmien') {
    const back = frame === 0 ? { x: -26, y: 139 } : { x: -24, y: 97 };
    const front = frame < 3 ? { x: 25, y: 88 } : { x: 64, y: 82 };
    return hand === 0 ? front : frame >= 5 ? { x: 52, y: 102 } : back;
  }
  if (id === 'ambona') return hand === 0 ? { x: 62, y: 93 } : { x: 25, y: 97 };
  return { x: 32, y: 80 };
}

export function ultimateBodyPose(
  id: string,
  t: number,
  x: number,
  y: number,
  targetX: number,
  facing: number,
) {
  if (id !== 'zawor' && id !== 'antena') return { x, y };
  const contact = targetX - facing * (id === 'antena' ? 30 : 65);
  const approach = clamp01((t - 35) / 41);
  const returnHome = clamp01((t - 96) / 9);
  return {
    x: lerp(lerp(x, contact, approach), x, returnHome),
    y: y + (id === 'zawor' && t >= 58 && t < 86 ? Math.sin(clamp01((t - 58) / 28) * Math.PI) * 35 : 0),
  };
}

export interface UltimateProjectile {
  index: number;
  hand: 0 | 1;
  release: number;
  arrival: number;
  progress: number;
  flying: boolean;
}

/** Counts describe visual objects; damage is still applied once by CombatResolver. */
export function ultimateProjectiles(id: string, t: number): UltimateProjectile[] {
  const count = id === 'jeczmien' ? 6 : id === 'ambona' ? 10 : 1;
  return Array.from({ length: count }, (_, index) => {
    const hand: 0 | 1 = id === 'jeczmien' ? (index < 3 ? 0 : 1) : ((index % 2) as 0 | 1);
    const release = id === 'jeczmien' ? 66 + hand * 8 : id === 'ambona' ? 64 + index * 1.6 : 66;
    const arrival = release + (id === 'ambona' ? 12 : 10);
    return {
      index,
      hand,
      release,
      arrival,
      progress: clamp01((t - release) / (arrival - release)),
      flying: t >= release && t <= arrival,
    };
  });
}

export function projectilePoint(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  progress: number,
  arc = 16,
) {
  const p = clamp01(progress);
  return { x: lerp(x, targetX, p), y: lerp(y, targetY, p) - Math.sin(p * Math.PI) * arc };
}
