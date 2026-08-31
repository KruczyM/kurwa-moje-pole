import { describe, expect, it, vi } from 'vitest';
import { AppStateMachine, escapeTarget } from './AppStateMachine';

describe('AppStateMachine', () => {
  it('follows the application lifecycle', () => {
    const machine = new AppStateMachine();
    machine.transition('loading');
    machine.transition('playing');
    machine.transition('inspecting');
    machine.transition('playing');
    machine.transition('paused');
    expect(machine.current).toBe('paused');
  });

  it('rejects contradictory modal transitions', () => {
    const machine = new AppStateMachine('playing');
    machine.transition('inventory');
    expect(() => machine.transition('dialog')).toThrow('inventory -> dialog');
  });

  it('uses one Escape priority for every state', () => {
    expect(escapeTarget('inspecting')).toBe('playing');
    expect(escapeTarget('dialog')).toBe('playing');
    expect(escapeTarget('inventory')).toBe('playing');
    expect(escapeTarget('playing')).toBe('paused');
    expect(escapeTarget('paused')).toBe('playing');
    expect(escapeTarget('loading')).toBeNull();
  });

  it('can unsubscribe transition observers', () => {
    const listener = vi.fn(),
      machine = new AppStateMachine();
    const unsubscribe = machine.subscribe(listener);
    machine.transition('loading');
    unsubscribe();
    machine.transition('error');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
