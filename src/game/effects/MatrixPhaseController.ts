export type MatrixPhaseMode = 'auto' | 'always' | 'off';

export interface MatrixPhaseTiming {
  fadeIn: number;
  active: number;
  fadeOut: number;
  interval: number;
}

export const DEFAULT_MATRIX_TIMING: MatrixPhaseTiming = {
  fadeIn: 1.0,
  active: 3.2,
  fadeOut: 1.2,
  interval: 14.0,
};

export type MatrixState = 'inactive' | 'fadeIn' | 'active' | 'fadeOut';

/**
 * Steruje cyklami i czasem trwania fazy Matrix (krótkie fazy, płynne pojawianie się i znikanie).
 */
export class MatrixPhaseController {
  private mode: MatrixPhaseMode = 'auto';
  private state: MatrixState = 'inactive';
  private timer = 0;
  private intervalTimer = 0;
  private currentTiming: MatrixPhaseTiming = { ...DEFAULT_MATRIX_TIMING };
  private alpha = 0;

  constructor(mode: MatrixPhaseMode = 'auto', timing?: Partial<MatrixPhaseTiming>) {
    this.mode = mode;
    if (timing) {
      Object.assign(this.currentTiming, timing);
    }
  }

  get currentMode(): MatrixPhaseMode {
    return this.mode;
  }

  get currentState(): MatrixState {
    return this.state;
  }

  get currentAlpha(): number {
    return this.alpha;
  }

  get isWireframeEligible(): boolean {
    return this.alpha >= 0.35;
  }

  setMode(mode: MatrixPhaseMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'off') {
      this.reset();
    }
  }

  /** Ręczne wyzwolenie fazy (np. na żądanie testu lub po interakcji). */
  triggerPhase() {
    if (this.mode === 'off') return;
    this.state = 'fadeIn';
    this.timer = 0;
  }

  /**
   * Aktualizuje stan fazy Matrix.
   * @param dt Czas ramki w sekundach.
   * @param isDrugEffectActive Czy jakikolwiek efekt używki jest aktualnie aktywny.
   * @param visualIntensity Mnożnik intensywności efektów (0..1).
   * @param reduceMotion Czy ruch jest wyłączony.
   */
  update(dt: number, isDrugEffectActive: boolean, visualIntensity = 1, reduceMotion = false): number {
    if (this.mode === 'off' || visualIntensity <= 0.01) {
      this.reset();
      return 0;
    }

    if (this.mode === 'always') {
      this.state = 'active';
      // W trybie ciągłym stosujemy stałą, subtelną wartość
      const baseAlpha = reduceMotion ? 0.25 : 0.55;
      this.alpha = baseAlpha * visualIntensity;
      return this.alpha;
    }

    // Tryb 'auto': faza pojawia się okresowo tylko w trakcie trwania efektów używek
    if (!isDrugEffectActive) {
      if (this.state !== 'inactive' && this.state !== 'fadeOut') {
        this.state = 'fadeOut';
        this.timer = 0;
      }
    } else if (this.state === 'inactive') {
      this.intervalTimer += dt;
      if (this.intervalTimer >= this.currentTiming.interval) {
        this.intervalTimer = 0;
        this.state = 'fadeIn';
        this.timer = 0;
        return 0;
      }
    }

    const { fadeIn, active, fadeOut } = this.currentTiming;

    if (this.state === 'fadeIn') {
      this.timer += dt;
      const progress = fadeIn > 0 ? Math.min(1, this.timer / fadeIn) : 1;
      this.alpha = progress;
      if (progress >= 1) {
        this.state = 'active';
        this.timer = 0;
      }
    } else if (this.state === 'active') {
      this.timer += dt;
      this.alpha = 1;
      if (this.timer >= active) {
        this.state = 'fadeOut';
        this.timer = 0;
      }
    } else if (this.state === 'fadeOut') {
      this.timer += dt;
      const progress = fadeOut > 0 ? Math.min(1, this.timer / fadeOut) : 1;
      this.alpha = 1 - progress;
      if (progress >= 1) {
        this.reset();
      }
    } else {
      this.alpha = 0;
    }

    // Skalowanie przez intensywność wizualną i ograniczenie w trybie reduced motion
    const motionFactor = reduceMotion ? 0.35 : 1.0;
    this.alpha = this.alpha * visualIntensity * motionFactor;
    return this.alpha;
  }

  reset() {
    this.state = 'inactive';
    this.timer = 0;
    this.intervalTimer = 0;
    this.alpha = 0;
  }
}
