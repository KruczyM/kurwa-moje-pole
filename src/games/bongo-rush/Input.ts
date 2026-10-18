import { AfterJoystick } from '../after/demo/AfterJoystick';
import type { Direction } from './types';

/** Four-way pad sectors: neutral centre, stable corners, no diagonal output. */
export function padDirection(
  dx: number,
  dy: number,
  size: number,
  previous?: Direction,
): Direction | undefined {
  if (![dx, dy, size].every(Number.isFinite) || size <= 0) return;
  const ax = Math.abs(dx),
    ay = Math.abs(dy);
  if (Math.max(ax, ay) < size / 6) return;
  const horizontal: Direction = dx > 0 ? 'right' : 'left';
  const vertical: Direction = dy > 0 ? 'down' : 'up';
  if (Math.min(ax, ay) > Math.max(ax, ay) * 0.8)
    return previous === horizontal || previous === vertical ? previous : undefined;
  return ax > ay ? horizontal : vertical;
}

/** Reuses After's pointer ownership, clamping and deadzone, adding cardinal hysteresis for grid motion. */
export class GridInput {
  readonly joystick = new AfterJoystick();
  readonly keys = new Set<string>();
  private axis?: 'x' | 'y';
  private padPointer?: number;
  private pendingTap?: Direction;

  /** A short press survives until one simulation tick, without speeding up held motion. */
  beginPad(pointerId: number, direction: Direction): boolean {
    if (!this.joystick.begin(pointerId)) return false;
    this.padPointer = pointerId;
    this.pressPad(pointerId, direction);
    this.pendingTap = direction;
    return true;
  }

  endPad(pointerId: number, cancelled = false): void {
    this.joystick.end(pointerId);
    if (this.padPointer === pointerId) {
      this.padPointer = undefined;
      if (cancelled) this.pendingTap = undefined;
    }
  }

  consumeDirection(): Direction | undefined {
    const tap = this.pendingTap;
    this.pendingTap = undefined;
    return this.direction() ?? tap;
  }

  /** Exact digital arrows reuse the same single-pointer owner and reset lifecycle. */
  pressPad(pointerId: number, direction?: Direction): void {
    const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [x, y] = direction ? vectors[direction] : [0, 0];
    this.joystick.move(pointerId, x, y, 1);
  }

  /** Slides across arrows without requiring the finger to return to the centre. */
  movePad(pointerId: number, dx: number, dy: number, size: number): void {
    if (this.padPointer !== pointerId) return;
    const { x, y } = this.joystick.snapshot();
    const previous = x ? (x > 0 ? 'right' : 'left') : y ? (y > 0 ? 'down' : 'up') : undefined;
    const direction = padDirection(dx, dy, size, previous);
    this.pressPad(pointerId, direction);
    if (this.pendingTap) this.pendingTap = direction;
  }

  /** Reads one direction; the latest pressed keyboard key wins over analog input. */
  direction(): Direction | undefined {
    const bindings: Record<string, Direction> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
    };
    for (const key of [...this.keys].reverse()) if (bindings[key]) return bindings[key];
    const { x, y } = this.joystick.snapshot();
    if (Math.hypot(x, y) < 0.15) {
      this.axis = undefined;
      return;
    }
    if (!this.axis) this.axis = Math.abs(x) >= Math.abs(y) ? 'x' : 'y';
    if (this.axis === 'x' && (Math.abs(x) < 0.08 || Math.abs(y) > Math.abs(x) + 0.18)) this.axis = 'y';
    else if (this.axis === 'y' && (Math.abs(y) < 0.08 || Math.abs(x) > Math.abs(y) + 0.18)) this.axis = 'x';
    return this.axis === 'x' ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
  }

  /** Clears held motion whenever an overlay opens or focus/pointer ownership is lost. */
  reset(): void {
    this.keys.clear();
    this.joystick.reset();
    this.axis = undefined;
    this.padPointer = undefined;
    this.pendingTap = undefined;
  }
}
