import { AfterJoystick } from '../after/demo/AfterJoystick';
import type { Direction } from './types';

/** Reuses After's pointer ownership, clamping and deadzone, adding cardinal hysteresis for grid motion. */
export class GridInput {
  readonly joystick = new AfterJoystick();
  readonly keys = new Set<string>();
  private axis?: 'x' | 'y';

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
  }
}
