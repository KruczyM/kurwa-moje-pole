import type { Facing } from '../simulation/WorldState';

export type SpriteDirection = 'down' | 'right' | 'up' | 'left';
export interface SpriteMetadata {
  frameWidth: number;
  frameHeight: number;
  framesPerDirection: number;
  rows: Record<SpriteDirection, number>;
  animationColumns: { idle: readonly number[]; walk: readonly number[] };
  pivot?: { x: number; y: number };
  margin?: number;
  walkTilesPerCycle?: number;
  idleFps?: number;
}
export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}
const DIRECTIONS: Record<Facing, SpriteDirection> = {
  south: 'down',
  east: 'right',
  north: 'up',
  west: 'left',
};

/** Reads the shared atlas contract without loading images or owning a render loop. */
export class SpriteAnimator {
  private readonly meta: SpriteMetadata;
  private phase = 0;
  private moving = false;
  private readonly clipPhases = { idle: 0, walk: 0 };

  /** Rejects invalid atlas geometry and copies metadata against later external mutation. */
  constructor(
    meta: SpriteMetadata,
    private readonly timing: { preservePhase?: boolean; idleFps?: number; walkFps?: number } = {},
  ) {
    const positive = (n: number) => Number.isSafeInteger(n) && n > 0;
    const rows = Object.values(DIRECTIONS).map((key) => meta.rows[key]);
    if (
      !positive(meta.frameWidth) ||
      !positive(meta.frameHeight) ||
      !positive(meta.framesPerDirection) ||
      (meta.walkTilesPerCycle !== undefined &&
        (!Number.isFinite(meta.walkTilesPerCycle) || meta.walkTilesPerCycle <= 0)) ||
      (meta.idleFps !== undefined && (!Number.isFinite(meta.idleFps) || meta.idleFps <= 0)) ||
      (meta.margin !== undefined &&
        (!Number.isSafeInteger(meta.margin) ||
          meta.margin < 0 ||
          meta.margin * 2 >= Math.min(meta.frameWidth, meta.frameHeight))) ||
      (meta.pivot !== undefined &&
        (!Number.isFinite(meta.pivot.x) ||
          !Number.isFinite(meta.pivot.y) ||
          meta.pivot.x < 0 ||
          meta.pivot.y <= 0 ||
          meta.pivot.x > meta.frameWidth ||
          meta.pivot.y > meta.frameHeight)) ||
      rows.some((n) => !Number.isSafeInteger(n) || n < 0) ||
      new Set(rows).size !== 4 ||
      Object.values(meta.animationColumns).some(
        (columns) =>
          columns.length === 0 ||
          columns.some((n) => !Number.isSafeInteger(n) || n < 0 || n >= meta.framesPerDirection),
      )
    ) {
      throw new Error('Invalid After sprite metadata');
    }
    this.meta = structuredClone(meta);
  }

  /** Advances phase from host delta time; direction changes preserve gait and pause freezes it. */
  update(
    dt: number,
    facing: Facing,
    moving: boolean,
    running = false,
    paused = false,
    distance?: number,
  ): SpriteFrame {
    if (!paused) {
      if (moving !== this.moving)
        this.phase = this.timing.preservePhase ? this.clipPhases[moving ? 'walk' : 'idle'] : 0;
      this.moving = moving;
      const columns = this.meta.animationColumns[moving ? 'walk' : 'idle'];
      if (moving && this.meta.walkTilesPerCycle !== undefined && distance !== undefined) {
        if (Number.isFinite(distance) && distance > 0)
          this.phase =
            (this.phase + (distance * columns.length) / this.meta.walkTilesPerCycle) % columns.length;
      } else if (Number.isFinite(dt) && dt > 0)
        this.phase =
          (this.phase +
            Math.min(dt, 0.25) *
              (running
                ? 12
                : moving
                  ? (this.timing.walkFps ?? 8)
                  : (this.timing.idleFps ?? this.meta.idleFps ?? 8))) %
          columns.length;
      this.clipPhases[moving ? 'walk' : 'idle'] = this.phase;
    }
    const columns = this.meta.animationColumns[this.moving ? 'walk' : 'idle'];
    return {
      x: columns[Math.floor(this.phase + 1e-9) % columns.length] * this.meta.frameWidth,
      y: this.meta.rows[DIRECTIONS[facing]] * this.meta.frameHeight,
      width: this.meta.frameWidth,
      height: this.meta.frameHeight,
    };
  }

  /** A new run or a room teleport snaps presentation without inventing travelled distance. */
  reset(): void {
    this.phase = 0;
    this.moving = false;
    this.clipPhases.idle = this.clipPhases.walk = 0;
  }
}
