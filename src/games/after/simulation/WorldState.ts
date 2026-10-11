import type { CharacterName } from '../../../game/network/networkProtocol';

export const AFTER_SCHEMA_VERSION = 1;
export const AFTER_CONTENT_VERSION = 'pilot-1';
export const AFTER_TICK_RATE = 30;
export const AFTER_STEP_SECONDS = 1 / AFTER_TICK_RATE;

export interface Point {
  x: number;
  y: number;
}

export type Facing = 'north' | 'south' | 'east' | 'west';

export interface MapDefinition {
  id: string;
  width: number;
  height: number;
  tileSize: number;
  /** Row-major collision grid; true denotes a solid tile. Coordinates describe feet. */
  collision: readonly boolean[];
  spawns: readonly Point[];
  interactions: readonly InteractionDefinition[];
}

export interface InteractionDefinition {
  id: string;
  position: Point;
  radius: number;
  priority: number;
  prompt: string;
  once: boolean;
}

export interface PlayerState {
  slotId: string;
  characterId: CharacterName;
  position: Point;
  previousPosition: Point;
  facing: Facing;
  stamina: number;
  carrying: boolean;
  abilityCooldownTicks: number;
  lastSequence: number;
}

export interface AfterWorldState {
  schemaVersion: number;
  contentVersion: string;
  sessionId: string;
  seed: number;
  tick: number;
  mapId: string;
  nightPhase: 'after-concert' | 'before-dawn';
  players: PlayerState[];
  flags: string[];
}

export interface PlayerInput {
  moveX: number;
  moveY: number;
  sprint: boolean;
}

export interface InteractionCommand {
  sessionId: string;
  sequence: number;
  slotId: string;
  targetId: string;
}

export interface WorldEvent {
  id: string;
  tick: number;
  type: 'interacted';
  slotId: string;
  targetId: string;
}
