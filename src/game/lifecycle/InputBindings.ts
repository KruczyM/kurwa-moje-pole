import type { AppState } from './AppStateMachine';

export const inputBindings = {
  move: 'WASD / strzałki',
  look: 'mysz',
  run: 'Shift',
  interact: 'E',
  inventory: 'Tab',
  escape: 'Esc',
} as const;

export type GameInputAction = 'escape' | 'toggle-inventory' | 'primary-action';

/** Zamienia pojedynczy klawisz na akcję dozwoloną w aktualnym stanie aplikacji. */
export function resolveGameInput(state: AppState, key: string, repeat = false): GameInputAction | null {
  if (repeat) return null;
  if (key === 'Escape' && ['playing', 'inspecting', 'dialog', 'inventory', 'paused'].includes(state)) {
    return 'escape';
  }
  if (key === 'Tab' && (state === 'playing' || state === 'inventory')) {
    return 'toggle-inventory';
  }
  if (key.toLowerCase() === 'e' && (state === 'playing' || state === 'inspecting')) {
    return 'primary-action';
  }
  return null;
}

/** Zwraca skróconą podpowiedź właściwą dla konkretnego ekranu lub modala. */
export function controlHintForState(state: AppState) {
  switch (state) {
    case 'playing':
      return `${inputBindings.escape} — pauza · ${inputBindings.interact} — interakcja · ${inputBindings.inventory} — ekwipunek`;
    case 'inspecting':
      return `${inputBindings.interact} — uruchom efekt · ${inputBindings.escape} — wróć do obozu`;
    case 'dialog':
      return `${inputBindings.escape} — wróć do obozu`;
    case 'inventory':
      return `${inputBindings.inventory} / ${inputBindings.escape} — zamknij`;
    case 'paused':
      return `${inputBindings.escape} — wróć do gry`;
    default:
      return '';
  }
}

/** Buduje pełną instrukcję sterowania wyświetlaną na ekranie startowym. */
export function startControlHint() {
  return `${inputBindings.move} — ruch · ${inputBindings.look} — rozglądanie · ${inputBindings.run} — szybciej · ${inputBindings.interact} — interakcja · ${inputBindings.inventory} — ekwipunek · ${inputBindings.escape} — pauza`;
}

/** Buduje kontekstową podpowiedź E bez duplikowania nazwy klawisza w logice świata. */
export function interactionControlHint(action: string) {
  return `${inputBindings.interact} — ${action}`;
}
