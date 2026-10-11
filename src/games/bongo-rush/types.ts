/** Grid directions are shared by keyboard, joystick, physics and recorded solutions. */
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Cell = 'wall' | 'soil' | 'air' | 'exit' | 'buried-bush' | 'bush';
export type EnemyKind = 'red' | 'blue' | 'undercover' | 'boss';
export interface Point {
  x: number;
  y: number;
}
export interface Body extends Point {
  id: number;
  previous: Point;
}
export interface LooseObject extends Body {
  required?: boolean;
  kind: 'rock' | 'pickup';
  falling: boolean;
  variant: number;
}
export interface Enemy extends Body {
  kind: EnemyKind;
  direction: Direction;
  chasing: boolean;
}
export interface LevelDefinition {
  id: number;
  title: string;
  hint: string;
  biome: number;
  rows: readonly string[];
  quota: number;
  /** Original positions identify mandatory vault loot; the flag follows falling objects by ID. */
  requiredPickups?: readonly Point[];
  solution: readonly Direction[];
  timeLimitSeconds?: number;
  gate?: Point;
  pen?: readonly Point[];
  vault?: {
    entry: Point;
    name: string;
    hint: string;
    stages?: readonly { entry: Point; name: string; hint: string }[];
  };
}
export interface World {
  width: number;
  height: number;
  cells: Cell[];
  player: Body & { direction: Direction };
  objects: LooseObject[];
  enemies: Enemy[];
  collected: number;
  tick: number;
  status: 'playing' | 'lost' | 'won';
  reason: string;
  trapped: boolean;
  bushRoots: Point[];
  nextBushGrowth?: number;
}
export type SoundEvent = 'pickup' | 'dig' | 'push' | 'impact' | 'lost' | 'exit' | 'won' | 'trap';
export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];
export const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
export const STEP_SECONDS = 0.14;
/** Seconds of active gameplay between bush waves; pause does not advance simulation ticks. */
export const BUSH_GROWTH_SECONDS = 5;
export const BUSH_GROWTH_TICKS = Math.ceil(BUSH_GROWTH_SECONDS / STEP_SECONDS);

/** Compares exact tile coordinates rather than interpolated presentation coordinates. */
export function same(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Returns a neighbour without mutating either argument. */
export function neighbour(point: Point, direction: Direction): Point {
  const vector = VECTORS[direction];
  return { x: point.x + vector.x, y: point.y + vector.y };
}
