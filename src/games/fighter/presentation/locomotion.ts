import type { FighterState } from '../simulation/CombatTypes';

// The authored foot span is about 60 world units per step, two steps per cycle.
export const WALK_CYCLE_DISTANCE = 120;

export interface LocomotionPose {
  tick: number;
  x: number;
  moving: boolean;
  elapsed: number;
  phase: number;
  clip: 'idle' | 'walk_start' | 'walk' | 'walk_stop';
}

/** Presentation state only; no delayed inputs or modifications to simulation. */
export function locomotionPose(
  previous: LocomotionPose | undefined,
  fighter: FighterState,
  tick: number,
  frozen = false,
): LocomotionPose {
  const moving = fighter.state === 'walk_fwd' || fighter.state === 'walk_back';
  const delta = previous && !frozen ? Math.max(0, Math.min(6, tick - previous.tick)) : 0;
  let elapsed = previous?.elapsed ?? 0;
  let phase = previous?.phase ?? 0;
  let clip = previous?.clip ?? 'idle';
  if (!moving && fighter.state !== 'idle') {
    clip = 'idle';
    elapsed = 0;
    phase = 0;
  } else if (moving && !previous?.moving) {
    clip = 'walk_start';
    elapsed = 0;
  } else if (!moving && previous?.moving) {
    clip = 'walk_stop';
    elapsed = 0;
  } else {
    elapsed += delta;
    if (clip === 'walk_start' && elapsed >= 8) clip = 'walk';
    if (clip === 'walk_stop' && elapsed >= 8) clip = 'idle';
  }
  if (moving && previous && !frozen) {
    const rawDist = Math.abs(fighter.x - previous.x);
    // If the fighter is moving into a wall or against opponent pushbox / camera-wall,
    // rawDist may be near 0. We advance using nominal walking stride so footwork stays alive.
    const distance = rawDist > 0.1 ? Math.min(30, rawDist) : Math.min(30, 4.2 * Math.max(1, delta));
    phase =
      (phase + (distance / WALK_CYCLE_DISTANCE) * 12 * (fighter.state === 'walk_back' ? -1 : 1) + 12) % 12;
  }
  return { tick, x: fighter.x, moving, elapsed, phase, clip };
}
