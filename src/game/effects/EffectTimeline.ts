import type { EffectId, EffectPhase } from './EffectManager';

export type EffectDurations = {
  fadeIn: number;
  active: number;
  fadeOut: number;
};

/** Steruje trzema fazami efektu bez zależności od renderera i interfejsu. */
export class EffectTimeline {
  active: EffectId | null = null;
  phase: EffectPhase = 'inactive';
  remaining = 0;
  intensity = 0;
  private elapsed = 0;

  /** Rozpoczyna efekt od początku, również przy szybkiej zmianie używki. */
  use(id: EffectId, durations: EffectDurations) {
    this.active = id;
    this.phase = 'fadeIn';
    this.elapsed = 0;
    this.remaining = durations.fadeIn;
    this.intensity = 0;
  }

  /** Rozpoczyna wygaszanie od aktualnej siły, aby anulowanie nie powodowało skoku. */
  cancel(durations: EffectDurations) {
    if (!this.active || this.phase === 'fadeOut') return;
    this.phase = 'fadeOut';
    this.elapsed = durations.fadeOut * (1 - this.intensity);
    this.remaining = durations.fadeOut - this.elapsed;
  }

  /** Aktualizuje licznik i zwraca true dokładnie w klatce pełnego zakończenia efektu. */
  update(dt: number, durations: EffectDurations | null) {
    if (!this.active || !durations) return false;
    this.elapsed += Math.max(0, dt);

    if (this.phase === 'fadeIn') {
      this.intensity = durations.fadeIn <= 0 ? 1 : Math.min(1, this.elapsed / durations.fadeIn);
      this.remaining = Math.max(0, durations.fadeIn - this.elapsed);
      if (this.intensity >= 1) {
        this.phase = 'active';
        this.elapsed = 0;
        this.remaining = durations.active;
      }
      return false;
    }

    if (this.phase === 'active') {
      this.intensity = 1;
      this.remaining = Math.max(0, durations.active - this.elapsed);
      if (this.elapsed >= durations.active) {
        this.phase = 'fadeOut';
        this.elapsed = 0;
        this.remaining = durations.fadeOut;
      }
      return false;
    }

    this.intensity = durations.fadeOut <= 0 ? 0 : Math.max(0, 1 - this.elapsed / durations.fadeOut);
    this.remaining = Math.max(0, durations.fadeOut - this.elapsed);
    if (this.intensity > 0) return false;
    this.reset();
    return true;
  }

  /** Czyści licznik bez pozostawiania nieaktywnej fazy lub czasu. */
  reset() {
    this.active = null;
    this.phase = 'inactive';
    this.remaining = 0;
    this.intensity = 0;
    this.elapsed = 0;
  }
}
