export type FrameScheduler = (callback: FrameRequestCallback) => number;
export type FrameCanceller = (handle: number) => void;

export class AnimationLoop {
  private handle = 0;
  private running = false;
  constructor(
    private readonly update: FrameRequestCallback,
    private readonly schedule: FrameScheduler = (callback) => requestAnimationFrame(callback),
    private readonly cancel: FrameCanceller = (handle) => cancelAnimationFrame(handle),
  ) {}
  /** Uruchamia pojedynczą, chronioną przed duplikacją pętlę requestAnimationFrame. */
  start() {
    if (this.running) return false;
    this.running = true;
    this.handle = this.schedule(this.tick);
    return true;
  }
  /** Zatrzymuje aktywną pętlę i anuluje oczekującą klatkę. */
  stop() {
    if (!this.running) return false;
    this.running = false;
    this.cancel(this.handle);
    this.handle = 0;
    return true;
  }
  /** Planuje kolejną klatkę i deleguje aktualizację do gry. */
  private tick: FrameRequestCallback = (time) => {
    if (!this.running) return;
    this.handle = this.schedule(this.tick);
    this.update(time);
  };
  /** Informuje, czy pętla jest aktualnie aktywna. */
  get active() {
    return this.running;
  }
}
