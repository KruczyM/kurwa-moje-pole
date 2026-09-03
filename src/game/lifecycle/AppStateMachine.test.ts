import { describe, expect, it, vi } from 'vitest';
import { AppStateMachine, escapeTarget } from './AppStateMachine';

describe('AppStateMachine', () => {
  it('follows the application lifecycle', () => {
    const machine = new AppStateMachine();
    machine.transition('loading');
    machine.transition('playing');
    machine.transition('inspecting');
    machine.transition('using-item');
    machine.transition('playing');
    machine.transition('paused');
    expect(machine.current).toBe('paused');
  });

  it('rejects contradictory modal transitions', () => {
    const machine = new AppStateMachine('playing');
    machine.transition('inventory');
    expect(() => machine.transition('dialog')).toThrow('inventory -> dialog');
  });

  it('allows an inventory item to enter and finish its use sequence', () => {
    const machine = new AppStateMachine('playing');
    machine.transition('inventory');
    machine.transition('using-item');
    machine.transition('playing');
    expect(machine.current).toBe('playing');
  });

  it('uses one Escape priority for every state', () => {
    expect(escapeTarget('inspecting')).toBe('playing');
    expect(escapeTarget('seated')).toBe('playing');
    expect(escapeTarget('using-item')).toBe('playing');
    expect(escapeTarget('dialog')).toBe('playing');
    expect(escapeTarget('inventory')).toBe('playing');
    expect(escapeTarget('playing')).toBe('paused');
    expect(escapeTarget('paused')).toBe('playing');
    expect(escapeTarget('loading')).toBeNull();
  });

  it('enters and leaves an interactive seat without opening pause', () => {
    const machine = new AppStateMachine('playing');
    machine.transition('seated');
    expect(machine.current).toBe('seated');
    machine.transition(escapeTarget(machine.current)!);
    expect(machine.current).toBe('playing');
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
