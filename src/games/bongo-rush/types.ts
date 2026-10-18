/** Grid directions are shared by keyboard, joystick, physics and recorded solutions. */
export type Direction = 'up' | 'right' | 'down' | 'left';
/** Recorded waits advance the same fixed simulation clock as movement. */
export type ReplayInput = Direction | undefined;
export interface TerrainMotif {
  at: Point;
  kind: 'horizontal' | 'vertical' | 'accent';
  variant: number;
}
export interface LootSource {
  tile: Point;
  outlet: Point;
  count: number;
  required?: boolean;
  roots: readonly Point[];
}
/** Authored presentation only. View masks never change the underlying wall collision. */
export interface Scenery {
  materials: readonly { bounds: Point & { width: number; height: number }; material: number }[];
  views: readonly {
    id: string;
    bounds: Point & { width: number; height: number };
    mask: readonly Point[];
  }[];
  props: readonly {
    at: Point;
    width: number;
    height: number;
    asset: string;
    layer: 'depth' | 'frame';
  }[];
  rays: readonly { at: Point; direction: Point; length: number; width: number }[];
  floorDetails: readonly { at: Point; asset: string }[];
}
export interface ChamberDefinition {
  id: string;
  name: string;
  hint: string;
  rows: readonly string[];
  requiredPickups?: readonly Point[];
  lootSources?: readonly LootSource[];
  decorations?: readonly TerrainMotif[];
  colonies?: readonly Point[];
  scenery?: Scenery;
}
export interface PortalEndpoint extends Point {
  chamber: string;
}
export interface PortalPair {
  name: string;
  a: PortalEndpoint;
  b: PortalEndpoint;
}
export type Cell = 'wall' | 'soil' | 'air' | 'exit' | 'buried-bush' | 'bush' | 'portal';
export type EnemyKind = 'red' | 'blue' | 'undercover' | 'boss' | 'sweeper';
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
  wallAttached?: boolean;
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
  bonus?: boolean;
  style?: 'exploration' | 'puzzle';
  alternatives?: readonly { name: string; inputs: readonly Direction[] }[];
  encounters?: readonly { spawn: Point; role: string; minimumCircuit: number }[];
  requiredKills?: number;
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
  chambers?: readonly ChamberDefinition[];
  portals?: readonly PortalPair[];
  lootSources?: readonly LootSource[];
  /** Expanded authored campaigns may include waits and portal transitions. */
  replay?: readonly ReplayInput[];
  alternateReplays?: readonly { name: string; inputs: readonly ReplayInput[] }[];
  terrainTheme?: number;
  decorations?: readonly TerrainMotif[];
  /** Visible, solid colonies, independent of collecting/digging their own tile. */
  colonies?: readonly Point[];
  bushGrowthSeconds?: number;
  failureReplays?: readonly { name: string; inputs: readonly ReplayInput[] }[];
  scenery?: Scenery;
}
export interface World {
  width: number;
  height: number;
  cells: Cell[];
  player: Body & { direction: Direction };
  objects: LooseObject[];
  enemies: Enemy[];
  collected: number;
  kills: number;
  tick: number;
  status: 'playing' | 'lost' | 'won';
  reason: string;
  trapped: boolean;
  bushRoots: Point[];
  nextBushGrowth?: number;
  /** Actual births drive presentation even when growth happens outside the camera or in another room. */
  bushBirths?: { at: Point; from: Point; tick: number }[];
  lootSources?: { definition: LootSource; activated: boolean; remaining: number }[];
}
export type SoundEvent = 'pickup' | 'dig' | 'push' | 'impact' | 'lost' | 'exit' | 'won' | 'trap';
export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];
export const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
/** Deliberate touch-friendly pace: five tile moves per second, shared with falling objects. */
export const STEP_SECONDS = 0.2;
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
