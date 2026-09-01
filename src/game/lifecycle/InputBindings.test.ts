import { describe, expect, it } from 'vitest';
import {
  controlHintForState,
  inputBindings,
  interactionControlHint,
  resolveGameInput,
  startControlHint,
} from './InputBindings';

describe('InputBindings', () => {
  it('resolves only actions allowed by the active state', () => {
    expect(resolveGameInput('playing', 'Escape')).toBe('escape');
    expect(resolveGameInput('inspecting', 'Escape')).toBe('escape');
    expect(resolveGameInput('dialog', 'Escape')).toBe('escape');
    expect(resolveGameInput('inventory', 'Escape')).toBe('escape');
    expect(resolveGameInput('paused', 'Escape')).toBe('escape');
    expect(resolveGameInput('playing', 'Tab')).toBe('toggle-inventory');
    expect(resolveGameInput('inventory', 'Tab')).toBe('toggle-inventory');
    expect(resolveGameInput('playing', 'e')).toBe('primary-action');
    expect(resolveGameInput('inspecting', 'E')).toBe('primary-action');
  });

  it('blocks repeated and contradictory modal actions', () => {
    expect(resolveGameInput('playing', 'Tab', true)).toBeNull();
    expect(resolveGameInput('dialog', 'Tab')).toBeNull();
    expect(resolveGameInput('paused', 'e')).toBeNull();
    expect(resolveGameInput('loading', 'Escape')).toBeNull();
  });

  it('uses the same labels in static and contextual hints', () => {
    expect(startControlHint()).toContain(inputBindings.inventory);
    expect(controlHintForState('paused')).toContain(inputBindings.escape);
    expect(interactionControlHint('Porozmawiaj')).toBe(`${inputBindings.interact} — Porozmawiaj`);
  });
});
