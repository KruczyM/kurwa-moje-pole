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

  it('consumes the pointer-lock loss caused by the Escape closing inspection', () => {
    const gate = new PointerLockPauseGate();
    gate.suppressLossesUntil(1_000);
    expect(gate.update(true, 100)).toBe(false);
    expect(gate.update(false, 150)).toBe(false);
    expect(gate.update(true, 1_100)).toBe(false);
    expect(gate.update(false, 1_200)).toBe(true);
  });
});
