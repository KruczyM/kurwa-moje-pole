export type AppState =
  | 'start'
  | 'loading'
  | 'playing'
  | 'seated'
  | 'inspecting'
  | 'using-item'
  | 'effect-warning'
  | 'dialog'
  | 'inventory'
  | 'paused'
  | 'riding'
  | 'error';

export type StateChange = { from: AppState; to: AppState };
/** Stage audio is only audible after entering the world, including in-world menus. */
export function isStageAudioEnabled(state: AppState): boolean {
  return state !== 'start' && state !== 'loading' && state !== 'error';
}
type Listener = (change: StateChange) => void;

const transitions: Record<AppState, readonly AppState[]> = {
  start: ['loading'],
  loading: ['playing', 'error', 'start'],
  playing: [
    'seated',
    'inspecting',
    'dialog',
    'inventory',
    'paused',
    'error',
    'start',
    'effect-warning',
    'riding',
  ],
  seated: ['playing', 'error', 'start'],
  inspecting: ['playing', 'using-item', 'effect-warning', 'error', 'start'],
  'using-item': ['playing', 'error', 'start'],
  'effect-warning': ['using-item', 'playing', 'inventory', 'inspecting', 'error', 'start'],
  dialog: ['playing', 'error', 'start'],
  inventory: ['playing', 'using-item', 'effect-warning', 'error', 'start'],
  paused: ['playing', 'seated', 'riding', 'error', 'start'],
  riding: ['playing', 'paused', 'error', 'start'],
  error: ['loading', 'start'],
};

export const modalStates: readonly AppState[] = [
  'inspecting',
  'dialog',
  'inventory',
  'paused',
  'effect-warning',
];

/** Wyznacza pojedynczy, przewidywalny stan docelowy dla klawisza Escape. */
export function escapeTarget(state: AppState, pauseSource?: AppState | null): AppState | null {
  if (
    state === 'seated' ||
    state === 'inspecting' ||
    state === 'using-item' ||
    state === 'effect-warning' ||
    state === 'dialog' ||
    state === 'inventory'
  )
    return 'playing';
  if (state === 'riding') return 'paused';
  if (state === 'playing') return 'paused';
  if (state === 'paused') return pauseSource === 'riding' ? 'riding' : 'playing';
  return null;
}

export class AppStateMachine {
  private listeners = new Set<Listener>();
  private pauseOrigin: AppState | null = null;
  constructor(private value: AppState = 'start') {}
  /** Zwraca bieżący stan aplikacji. */
  get current() {
    return this.value;
  }
  /** Zwraca stan, z którego gra weszła w pauzę (np. 'playing' lub 'riding'). */
  get pauseSource() {
    return this.pauseOrigin;
  }
  /** Sprawdza, czy przejście do wskazanego stanu jest dozwolone. */
  canTransition(to: AppState) {
    return to === this.value || transitions[this.value].includes(to);
  }
  /** Wykonuje poprawne przejście i powiadamia subskrybentów. */
  transition(to: AppState) {
    if (to === this.value) return false;
    if (!this.canTransition(to)) throw new Error(`Invalid app state transition: ${this.value} -> ${to}`);
    if (to === 'paused') {
      this.pauseOrigin = this.value;
    } else if (this.value === 'paused') {
      this.pauseOrigin = null;
    }
    const change = { from: this.value, to };
    this.value = to;
    this.listeners.forEach((listener) => listener(change));
    return true;
  }
  /** Dodaje obserwatora zmian i zwraca funkcję bezpiecznego wypisania. */
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
