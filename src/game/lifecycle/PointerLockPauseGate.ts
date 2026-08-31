export class PointerLockPauseGate {
  private armed = false;
  private suppressedUntil = 0;

  /** Ignoruje utratę blokady po zamknięciu modala tym samym klawiszem Escape. */
  suppressLossesUntil(timestamp: number) {
    this.suppressedUntil = Math.max(this.suppressedUntil, timestamp);
    this.armed = false;
  }

  /** Rozbraja automatyczną pauzę przed próbą odzyskania pointer lock. */
  reset() {
    this.armed = false;
  }
  /** Zwraca `true` tylko przy utracie wcześniej rzeczywiście uzyskanej blokady kursora. */
  update(locked: boolean, timestamp = performance.now()) {
    if (locked) {
      this.armed = true;
      return false;
    }
    if (timestamp <= this.suppressedUntil) {
      this.armed = false;
      return false;
    }
    if (!this.armed) return false;
    this.armed = false;
    return true;
  }
}
