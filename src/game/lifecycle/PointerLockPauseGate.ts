export class PointerLockPauseGate {
  private armed = false;
  /** Rozbraja automatyczną pauzę przed próbą odzyskania pointer lock. */
  reset() {
    this.armed = false;
  }
  /** Zwraca `true` tylko przy utracie wcześniej rzeczywiście uzyskanej blokady kursora. */
  update(locked: boolean) {
    if (locked) {
      this.armed = true;
      return false;
    }
    if (!this.armed) return false;
    this.armed = false;
    return true;
  }
}
