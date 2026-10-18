import { joystickInput } from '../../../game/player/MobileControls';

/** Pointer ownership and analog state only; reuses the existing shared joystick math. */
export class AfterJoystick {
  private pointer?: number;
  private x = 0;
  private y = 0;
  private knobX = 0;
  private knobY = 0;

  /** Captures only one finger; a second finger remains available for sprint/interact. */
  begin(pointerId: number): boolean {
    if (this.pointer !== undefined) return false;
    this.pointer = pointerId;
    return true;
  }

  /** Updates the owning pointer with radial clamping and a small drift deadzone. */
  move(pointerId: number, dx: number, dy: number, radius: number): void {
    if (pointerId !== this.pointer || ![dx, dy, radius].every(Number.isFinite) || radius <= 0) return;
    const input = joystickInput(dx, dy, radius);
    const strength = Math.hypot(input.right, input.forward);
    const scale = strength > 0.12 ? (strength - 0.12) / (0.88 * strength) : 0;
    this.x = scale ? input.right * scale : 0;
    this.y = scale ? -input.forward * scale : 0;
    this.knobX = input.knobX;
    this.knobY = input.knobY;
  }

  /** Releases only the controlling finger; cancel/lost capture use the same cleanup. */
  end(pointerId: number): void {
    if (this.pointer === pointerId) this.reset();
  }

  /** Clears held motion when opening overlays, resizing, hiding the tab or disposing. */
  reset(): void {
    this.pointer = undefined;
    this.x = this.y = this.knobX = this.knobY = 0;
  }

  /** Returns detached input and knob coordinates, preventing external state mutation. */
  snapshot() {
    return { x: this.x, y: this.y, knobX: this.knobX, knobY: this.knobY };
  }
}
