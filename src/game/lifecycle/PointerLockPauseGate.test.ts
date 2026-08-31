import { describe, expect, it } from 'vitest';
import { PointerLockPauseGate } from './PointerLockPauseGate';

describe('PointerLockPauseGate', () => {
  it('does not pause when pointer lock cannot be reacquired after inspection', () => {
    const gate = new PointerLockPauseGate();
    gate.reset();
    expect(gate.update(false)).toBe(false);
  });

  it('pauses only after a previously acquired pointer lock is lost', () => {
    const gate = new PointerLockPauseGate();
    expect(gate.update(true)).toBe(false);
    expect(gate.update(false)).toBe(true);
    expect(gate.update(false)).toBe(false);
  });
});
