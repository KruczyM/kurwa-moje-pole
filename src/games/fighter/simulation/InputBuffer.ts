import { INPUT } from './CombatTypes';

export class InputBuffer {
  private history: number[] = [];
  private readonly maxSize = 20;

  push(inputMask: number): void {
    this.history.unshift(inputMask);
    if (this.history.length > this.maxSize) {
      this.history.pop();
    }
  }

  current(): number {
    return this.history[0] ?? 0;
  }

  previous(): number {
    return this.history[1] ?? 0;
  }

  justPressed(button: number): boolean {
    const cur = this.current();
    const prev = this.previous();
    return (cur & button) !== 0 && (prev & button) === 0;
  }

  isDown(button: number): boolean {
    return (this.current() & button) !== 0;
  }

  /**
   * Checks if a Quarter Circle Forward (Down -> Down-Forward -> Forward) motion
   * was completed in the last 15 frames, taking into account facing direction (1 = right, -1 = left).
   */
  hasQCF(facing: 1 | -1): boolean {
    const fwd = facing === 1 ? INPUT.RIGHT : INPUT.LEFT;
    const down = INPUT.DOWN;

    let step = 0; // 0 = looking for Down, 1 = looking for Down+Fwd, 2 = looking for Fwd
    // Scan backwards from newest to oldest within 15 frames
    const limit = Math.min(this.history.length, 15);
    for (let i = limit - 1; i >= 0; i--) {
      const mask = this.history[i]!;
      if (step === 0) {
        if ((mask & down) !== 0 && (mask & fwd) === 0) {
          step = 1;
        }
      } else if (step === 1) {
        if ((mask & down) !== 0 && (mask & fwd) !== 0) {
          step = 2;
        } else if ((mask & down) === 0 && (mask & fwd) !== 0) {
          // Lenient input: jumped directly from down to forward
          step = 2;
        }
      } else if (step === 2) {
        if ((mask & fwd) !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  clear(): void {
    this.history = [];
  }

  snapshot(): number[] {
    return [...this.history];
  }
  restore(history: number[]): void {
    this.history = history.slice(0, this.maxSize);
  }
}
