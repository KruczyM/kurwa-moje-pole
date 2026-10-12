export const INPUT = {
  UP: 1 << 0,
  DOWN: 1 << 1,
  LEFT: 1 << 2,
  RIGHT: 1 << 3,
  LP: 1 << 4, // Left Punch (Lekka Pięść)
  RP: 1 << 5, // Right Punch (Mocna Pięść / HP)
  HP: 1 << 5, // Alias for Right Punch
  LK: 1 << 6, // Left Kick (Lekkie Kopnięcie)
  RK: 1 << 7, // Right Kick (Mocne Kopnięcie / HK)
  HK: 1 << 7, // Alias for Right Kick
  SPECIAL: 1 << 8, // Special Move
  BLOCK: 1 << 9, // Block / Throw Escape
} as const;

export type ButtonName = keyof typeof INPUT;

export type ActionState =
  | 'idle'
  | 'walk_fwd'
  | 'walk_back'
  | 'crouch'
  | 'jump_start'
  | 'jump_air'
  | 'landing'
  | 'attack'
  | 'block_high'
  | 'block_low'
  | 'hit_stun'
  | 'knockdown'
  | 'get_up'
  | 'victory'
  | 'defeat';

export type AttackHeight = 'high' | 'mid' | 'low';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveDefinition {
  id: string;
  name: string;
  command?: 'qcf' | 'qcb' | 'normal';
  startup: number; // Ticks before hitbox becomes active
  active: number; // Ticks hitbox stays active
  recovery: number; // Ticks of vulnerability after active
  damage: number; // Base damage
  hitstun: number; // Ticks defender is immobilized on hit
  blockstun: number; // Ticks defender is immobilized on block
  hitstop: number; // Ticks both players freeze on hit
  attackHeight: AttackHeight;
  hitboxes: Box[]; // Coordinates relative to fighter root (x: 0, y: 0 is feet)
  pushback: number; // Impulse applied to opponent on hit/block
  meterGain: number; // Meter gained on hit
  meterCost: number; // Meter consumed to execute move
  cancelWindow?: number; // Ticks during recovery where can cancel into special/super
  launcher?: boolean; // If true, launches defender upward into the air for juggle combos
  launchVelocityY?: number; // Initial vertical upward velocity applied to defender
  launchVelocityX?: number; // Initial horizontal velocity applied to defender
  causesKnockdown?: boolean; // If true, causes immediate sweep/knockdown
}

export interface FighterDefinition {
  id: string;
  name: string;
  title: string;
  maxHp: number;
  walkSpeedFwd: number;
  walkSpeedBack: number;
  dashSpeedFwd: number;
  dashSpeedBack: number;
  jumpVelocity: number;
  hurtboxStand: Box;
  hurtboxCrouch: Box;
  hurtboxAir: Box;
  pushbox: Box;
  moves: Record<string, MoveDefinition>;
  specialMoveId: string;
  ultimateMoveId: string;
}

export interface FighterState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1; // 1 = facing right, -1 = facing left
  state: ActionState;
  stateTicks: number;
  hp: number;
  maxHp: number;
  meter: number; // 0 to 100
  currentMove: MoveDefinition | null;
  moveTick: number;
  hitstop: number;
  isGrounded: boolean;
  comboHits: number;
  lastHitBy: string | null;
  isAirJuggle?: boolean; // True while defender is airborne after launcher
  hasHit?: boolean; // True if current attack already connected with defender
  cinematicPlayed?: boolean; // True if super/special cinematic has been triggered
  stunTicks?: number;
  lastHitHeight?: AttackHeight;
  juggleHits?: number;
}

export type RoundState = 'intro' | 'fight' | 'roundOver' | 'matchOver';

export interface MatchState {
  tick: number;
  roundTimer: number; // In seconds (e.g. 90.0)
  roundNumber: number;
  roundState: RoundState;
  winner: 1 | 2 | 'draw' | null;
  p1Wins: number;
  p2Wins: number;
  stateTicks: number; // Ticks spent in current roundState
  p1: FighterState;
  p2: FighterState;
}

export interface MatchSnapshot {
  inputHistory?: [number[], number[]];
  tick: number;
  roundTimer: number;
  roundNumber: number;
  roundState: RoundState;
  winner: 1 | 2 | 'draw' | null;
  p1Wins: number;
  p2Wins: number;
  stateTicks: number;
  p1: FighterState;
  p2: FighterState;
}
