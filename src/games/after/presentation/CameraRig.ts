import type { Point } from '../simulation/WorldState';

export interface CameraBounds {
  width: number;
  height: number;
}
export interface Viewport {
  width: number;
  height: number;
  pixelsPerMeter: number;
}

/** Calculates a responsive camera in world metres, including small-map letterboxing. */
export class CameraRig {
  private center: Point = { x: 0, y: 0 };
  private viewport: Viewport = { width: 1, height: 1, pixelsPerMeter: 64 };
  private initialized = false;

  /** Requires finite positive map dimensions; does not create a Three.js camera. */
  constructor(private readonly bounds: CameraBounds) {
    if (![bounds.width, bounds.height].every((n) => Number.isFinite(n) && n > 0))
      throw new Error('Invalid camera bounds');
    this.bounds = { ...bounds };
  }

  /** Updates layout from host resize measurements and immediately clamps the existing center. */
  resize(viewport: Viewport): void {
    if (!Object.values(viewport).every((n) => Number.isFinite(n) && n > 0))
      throw new Error('Invalid viewport');
    this.viewport = { ...viewport };
    this.center = this.clamp(this.center);
  }

  /** Smooths toward the player independently of frame rate; paused views remain stationary. */
  follow(target: Point, dt: number, paused = false): void {
    if (paused || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    const goal = this.clamp(target);
    if (!this.initialized) {
      this.center = goal;
      this.initialized = true;
      return;
    }
    if (!Number.isFinite(dt) || dt <= 0) return;
    const alpha = 1 - Math.exp(-10 * Math.min(dt, 0.25));
    this.center = this.clamp({
      x: this.center.x + (goal.x - this.center.x) * alpha,
      y: this.center.y + (goal.y - this.center.y) * alpha,
    });
  }

  /** Immediately frames a new spawn without panning through the previous level. */
  snap(target: Point): void {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    this.center = this.clamp(target);
    this.initialized = true;
  }

  /** Projects world foot positions into CSS pixels, not device-pixel backing-store units. */
  project(point: Point): Point {
    const { width, height, pixelsPerMeter } = this.viewport;
    return {
      x: (point.x - this.center.x) * pixelsPerMeter + width / 2,
      y: (point.y - this.center.y) * pixelsPerMeter + height / 2,
    };
  }

  /** Keeps camera inside the map; centers axes smaller than the visible area. */
  private clamp(point: Point): Point {
    const halfX = this.viewport.width / this.viewport.pixelsPerMeter / 2;
    const halfY = this.viewport.height / this.viewport.pixelsPerMeter / 2;
    const axis = (value: number, size: number, half: number) =>
      size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, value));
    return { x: axis(point.x, this.bounds.width, halfX), y: axis(point.y, this.bounds.height, halfY) };
  }
}
