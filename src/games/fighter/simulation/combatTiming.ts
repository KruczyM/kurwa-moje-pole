import type { FighterDefinition, MoveDefinition } from './CombatTypes';

/** Gameplay floor: readable anticipation and recovery even when buttons are mashed. */
const timings: Record<string, [number, number]> = {
  light_punch: [9, 15],
  heavy_punch: [15, 23],
  light_kick: [12, 18],
  heavy_kick: [19, 28],
  crouch_punch: [10, 16],
  crouch_kick: [13, 19],
  uppercut: [17, 27],
  sweep: [20, 30],
  jump_punch: [10, 15],
  jump_kick: [13, 18],
  special: [22, 30],
  ultimate: [50, 42],
};

export function combatMove(move: MoveDefinition): MoveDefinition {
  const [startup, recovery] = timings[move.id] ?? [12, 20];
  return {
    ...move,
    attackHeight: move.id === 'ultimate' ? 'mid' : move.attackHeight,
    meterCost: move.id === 'ultimate' ? 100 : 0,
    meterGain: move.id === 'ultimate' ? 0 : move.meterGain,
    startup: Math.max(startup, move.startup),
    recovery: Math.max(recovery, move.recovery),
  };
}

export function prepareFighter(def: FighterDefinition): FighterDefinition {
  return {
    ...def,
    moves: Object.fromEntries(Object.entries(def.moves).map(([id, move]) => [id, combatMove(move)])),
  };
}
