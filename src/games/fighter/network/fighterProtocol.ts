import type { MatchSnapshot } from '../simulation/CombatTypes';
import type { SimulationEvent } from '../simulation/FighterSimulation';

export const FIGHTER_PROTOCOL = 2;
export type FighterPhase = 'lobby' | 'countdown' | 'fight' | 'finished' | 'suspended' | 'closed';
export interface FighterSeat {
  characterId: string;
  connected: boolean;
  ready: boolean;
  rematch: boolean;
}
export interface FighterRoomState {
  version: number;
  code: string;
  revision: number;
  phase: FighterPhase;
  players: [FighterSeat | null, FighterSeat | null];
  stageId: string;
  countdownEndsAt: number | null;
  reconnectUntil: number | null;
  message: string;
}
export interface FighterFrame {
  sequence: number;
  matchId: number;
  snapshot: MatchSnapshot;
  events: (SimulationEvent & { eventId: number })[];
}
export type FighterRequest =
  | { action: 'create'; version: number }
  | { action: 'join'; version: number; code: string; token?: string }
  | { action: 'select'; characterId: string }
  | { action: 'stage'; stageId: string }
  | { action: 'ready'; ready: boolean }
  | { action: 'rematch' }
  | { action: 'leave' };
export type FighterReply = { error: string } | { room: FighterRoomState; seat: 0 | 1; token: string };
export interface FighterInput {
  sequence: number;
  mask: number;
}
