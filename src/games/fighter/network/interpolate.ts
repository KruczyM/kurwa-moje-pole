import type { MatchState } from '../simulation/CombatTypes';

/** Interpolate positions only; combat state and damage always belong to the server. */
export function interpolateMatch(
  previous: MatchState | null,
  current: MatchState,
  alpha: number,
): MatchState {
  if (
    !previous ||
    previous.roundNumber !== current.roundNumber ||
    previous.p1.id !== current.p1.id ||
    previous.p2.id !== current.p2.id
  )
    return current;
  const t = Math.max(0, Math.min(1, alpha));
  return {
    ...current,
    p1: {
      ...current.p1,
      x: previous.p1.x + (current.p1.x - previous.p1.x) * t,
      y: previous.p1.y + (current.p1.y - previous.p1.y) * t,
    },
    p2: {
      ...current.p2,
      x: previous.p2.x + (current.p2.x - previous.p2.x) * t,
      y: previous.p2.y + (current.p2.y - previous.p2.y) * t,
    },
  };
}
