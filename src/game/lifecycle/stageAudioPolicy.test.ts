import { expect, it } from 'vitest';
import { isStageAudioEnabled, type AppState } from './AppStateMachine';

it('keeps stage silent in character selection, loading and errors', () => {
  for (const state of ['start', 'loading', 'error'] as AppState[])
    expect(isStageAudioEnabled(state)).toBe(false);
});
it('keeps spatial stage audio after entering, including gameplay menus and attractions', () => {
  for (const state of [
    'playing',
    'paused',
    'seated',
    'riding',
    'inventory',
    'dialog',
    'inspecting',
    'using-item',
    'effect-warning',
  ] as AppState[])
    expect(isStageAudioEnabled(state)).toBe(true);
});
