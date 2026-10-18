import { STEP_SECONDS } from './types';
import type { Point, World } from './types';

export const COLONY_SHAKE_SECONDS = 0.7;
export const COLONY_SPLIT_SECONDS = 0.24;
export interface ColonyPose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  crack: number;
}

/** Pure simulation-time pose: blocked colonies rest, then shake and split into a real newborn tile. */
export function colonyPose(
  point: Point,
  tick: number,
  alpha: number,
  nextWave: number | undefined,
  canSpread: boolean,
  birth: NonNullable<World['bushBirths']>[number] | undefined,
  reduced = false,
): ColonyPose {
  const resting: ColonyPose = { x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, crack: 0 };
  if (reduced) return resting;
  const now = tick + Math.max(0, Math.min(1, alpha));
  if (birth) {
    const progress = Math.max(0, Math.min(1, ((now - birth.tick) * STEP_SECONDS) / COLONY_SPLIT_SECONDS));
    if (progress < 1) {
      const ease = 1 - (1 - progress) ** 3;
      const horizontal = birth.from.x !== point.x;
      const stretch = Math.sin(progress * Math.PI) * 0.26;
      const scale = 0.5 + ease * 0.5;
      return {
        x: (birth.from.x - point.x) * 64 * (1 - ease),
        y: (birth.from.y - point.y) * 64 * (1 - ease),
        scaleX: scale + (horizontal ? stretch : -stretch * 0.35),
        scaleY: scale + (horizontal ? -stretch * 0.35 : stretch),
        angle: 0,
        crack: 0,
      };
    }
  }
  if (!canSpread || nextWave === undefined) return resting;
  const remaining = (nextWave - now) * STEP_SECONDS;
  if (remaining <= 0 || remaining > COLONY_SHAKE_SECONDS) return resting;
  const tension = 1 - remaining / COLONY_SHAKE_SECONDS;
  const phase = now * STEP_SECONDS * Math.PI * 32 + point.x * 0.7 + point.y * 1.3;
  return {
    x: Math.sin(phase) * (0.7 + tension * 2.8),
    y: Math.cos(phase * 1.3) * tension * 1.3,
    scaleX: 1 + tension * 0.09,
    scaleY: 1 - tension * 0.06,
    angle: Math.sin(phase * 0.8) * tension * 0.065,
    crack: Math.max(0, (tension - 0.55) / 0.45),
  };
}
