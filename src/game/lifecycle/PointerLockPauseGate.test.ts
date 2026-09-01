import { describe, expect, it } from 'vitest';
import { POINTER_LOCK_ESCAPE_SUPPRESSION_MS, PointerLockPauseGate } from './PointerLockPauseGate';

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
    const startedAt = 1_000;
    gate.suppressLossesUntil(startedAt + POINTER_LOCK_ESCAPE_SUPPRESSION_MS);
    expect(gate.update(true, startedAt)).toBe(false);
    expect(gate.update(false, startedAt + POINTER_LOCK_ESCAPE_SUPPRESSION_MS - 1)).toBe(false);
    expect(gate.update(true, startedAt + POINTER_LOCK_ESCAPE_SUPPRESSION_MS + 1)).toBe(false);
    expect(gate.update(false, startedAt + POINTER_LOCK_ESCAPE_SUPPRESSION_MS + 2)).toBe(true);
  });
});
