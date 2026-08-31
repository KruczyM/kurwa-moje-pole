type EventSource = {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
};

export class EventScope {
  private cleanups: (() => void)[] = [];
  /** Rejestruje event listener i zapamiętuje odpowiadającą operację sprzątania. */
  listen(
    source: EventSource,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    source.addEventListener(type, listener, options);
    const capture = typeof options === 'boolean' ? options : options?.capture;
    this.cleanups.push(() => source.removeEventListener(type, listener, capture));
  }
  /** Usuwa wszystkie listenery w odwrotnej kolejności ich rejestracji. */
  dispose() {
    for (let index = this.cleanups.length - 1; index >= 0; index--) this.cleanups[index]();
    this.cleanups.length = 0;
  }
  /** Zwraca liczbę aktywnych listenerów zarządzanych przez zakres. */
  get size() {
    return this.cleanups.length;
  }
}
