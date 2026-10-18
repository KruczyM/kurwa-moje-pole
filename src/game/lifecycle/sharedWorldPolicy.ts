import type { AppState } from './AppStateMachine';

/** Normal gameplay already advances the world; only online local pause needs a fallback step. */
export function shouldAdvancePausedSharedWorld(state: AppState, online: boolean) {
  return state === 'paused' && online;
}
