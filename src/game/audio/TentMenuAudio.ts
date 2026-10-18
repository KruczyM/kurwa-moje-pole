/**
 * TentMenuAudio — Efekt „Muzyki słyszanej z namiotu” w menu głównym.
 *
 * Zgodnie ze specyfikacją z transkryptu:
 * W menu głównym muzyka festiwalowa (camp-track) gra przez filtr dolnoprzepustowy (BiquadFilterNode
 * ustawiony na 350 Hz) — brzmi dokładnie tak, jakby gracz siedział zamknięty w namiocie obozowym
 * i słyszał tylko dudniący, pulsujący bas festiwalowy z zewnątrz.
 *
 * W momencie kliknięcia Start filtr płynnie otwiera się od 350 Hz do 20 000 Hz w ciągu 1 sekundy,
 * a dźwięk nabiera pełnej przestrzeni, blasku i ostrości w trakcie wchodzenia do gry.
 */

export interface TentMenuAudioOptions {
  audioUrl?: string;
  defaultVolume?: number;
  tentCutoff?: number; // domyślnie 350 Hz
  openCutoff?: number; // domyślnie 20 000 Hz
  audioContext?: AudioContext;
  audioFactory?: (url: string) => HTMLAudioElement;
}

export const DEFAULT_TENT_CUTOFF = 380;
export const DEFAULT_OPEN_CUTOFF = 20000;
export const DEFAULT_TENT_VOLUME = 0.65;

export class TentMenuAudio {
  private ctx: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filterNode1: BiquadFilterNode | null = null;
  private filterNode2: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private audioUrl: string;
  private userVolume: number;
  private tentCutoff: number;
  private openCutoff: number;
  private isMuffled = true;
  private isPlaying = false;
  private pendingGestureResume: (() => void) | null = null;
  private disposed = false;
  private audioFactory?: (url: string) => HTMLAudioElement;

  constructor(options: TentMenuAudioOptions = {}) {
    this.audioUrl = options.audioUrl ?? 'game-assets/audio/camp-track.mp4';
    this.userVolume = Math.max(0, Math.min(1, options.defaultVolume ?? DEFAULT_TENT_VOLUME));
    this.tentCutoff = options.tentCutoff ?? DEFAULT_TENT_CUTOFF;
    this.openCutoff = options.openCutoff ?? DEFAULT_OPEN_CUTOFF;
    this.audioFactory = options.audioFactory;

    if (options.audioContext) {
      this.ctx = options.audioContext;
    }
  }

  public get muffled(): boolean {
    return this.isMuffled;
  }

  public get active(): boolean {
    return this.isPlaying;
  }

  public get volume(): number {
    return this.userVolume;
  }

  public get filterNode(): BiquadFilterNode | null {
    return this.filterNode1;
  }

  public get currentCutoff(): number {
    return this.filterNode1
      ? this.filterNode1.frequency.value
      : this.isMuffled
        ? this.tentCutoff
        : this.openCutoff;
  }

  public setVolume(vol: number): void {
    this.userVolume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.userVolume, this.ctx.currentTime, 0.05);
    }
  }

  public diagnostics() {
    return {
      isPlaying: this.isPlaying,
      isMuffled: this.isMuffled,
      userVolume: this.userVolume,
      tentCutoff: this.tentCutoff,
      currentCutoff: this.currentCutoff,
      audioUrl: this.audioUrl,
      audioSrc: this.audio?.src,
      audioPaused: this.audio?.paused,
      audioCurrentTime: this.audio?.currentTime,
      audioReadyState: this.audio?.readyState,
      audioError: this.audio?.error
        ? { code: this.audio.error.code, message: this.audio.error.message }
        : null,
      contextState: this.ctx?.state,
      gainValue: this.gainNode?.gain.value,
      filter1Freq: this.filterNode1?.frequency.value,
      filter2Freq: this.filterNode2?.frequency.value,
    };
  }

  /**
   * Uruchamia muzykę z namiotu w menu głównym (podwójny kaskadowy filtr 185 Hz).
   * Jeśli przeglądarka blokuje autoplay, rejestruje jednorazowy nasłuch gestu (klik/klawisz).
   */
  public startTentAudio(): void {
    if (this.disposed || this.isPlaying) return;

    if (!this.initAudioNodes()) {
      return;
    }

    this.isMuffled = true;
    this.isPlaying = true;

    const now = this.ctx?.currentTime ?? 0;
    if (this.filterNode1 && this.ctx) {
      this.filterNode1.frequency.cancelScheduledValues(now);
      this.filterNode1.frequency.setValueAtTime(this.tentCutoff, now);
    }
    if (this.filterNode2 && this.ctx) {
      this.filterNode2.frequency.cancelScheduledValues(now);
      this.filterNode2.frequency.setValueAtTime(this.tentCutoff, now);
    }

    if (this.gainNode && this.ctx) {
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.userVolume, now);
    }

    if (this.audio) {
      const playPromise = this.audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Polityka autoplay — podepnij wznowienie po pierwszym geście gracza
          this.setupGestureResume();
        });
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.setupGestureResume();
    }
  }

  /**
   * Płynnie otwiera kaskadę filtrów od 185 Hz do 20 000 Hz w ciągu duration sekund (np. 1.0 s)
   * w momencie naciśnięcia przycisku „Graj” / Start.
   */
  public unmuffleAndOpen(duration = 1.0): void {
    if (this.disposed) return;
    this.isMuffled = false;

    if (!this.isPlaying) {
      this.startTentAudio();
    }

    if (!this.ctx || !this.filterNode1) return;

    try {
      const now = this.ctx.currentTime;
      const rampDuration = Math.max(0.1, duration);
      const targetCutoff = this.openCutoff;

      const ramp = (filter: BiquadFilterNode) => {
        filter.frequency.cancelScheduledValues(now);
        filter.frequency.setValueAtTime(Math.max(20, filter.frequency.value), now);
        filter.frequency.exponentialRampToValueAtTime(targetCutoff, now + rampDuration);
      };

      ramp(this.filterNode1);
      if (this.filterNode2) ramp(this.filterNode2);

      if (this.gainNode) {
        // Nieznaczne podbicie głośności przy pełnym otwarciu namiotu
        const fullVolume = Math.min(1.0, this.userVolume * 1.35);
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(fullVolume, now + rampDuration);
      }
    } catch {
      if (this.filterNode1) {
        this.filterNode1.frequency.value = this.openCutoff;
      }
      if (this.filterNode2) {
        this.filterNode2.frequency.value = this.openCutoff;
      }
    }
  }

  /**
   * Płynnie przywraca filtr namiotu (zjazd do 185 Hz) w przypadku powrotu do menu głównego.
   */
  public muffleToTent(duration = 0.8): void {
    if (this.disposed) return;
    this.isMuffled = true;

    if (!this.ctx || !this.filterNode1) return;

    try {
      const now = this.ctx.currentTime;
      const rampDuration = Math.max(0.1, duration);
      const targetCutoff = this.tentCutoff;

      const ramp = (filter: BiquadFilterNode) => {
        filter.frequency.cancelScheduledValues(now);
        filter.frequency.setValueAtTime(Math.max(20, filter.frequency.value), now);
        filter.frequency.exponentialRampToValueAtTime(targetCutoff, now + rampDuration);
      };

      ramp(this.filterNode1);
      if (this.filterNode2) ramp(this.filterNode2);

      if (this.gainNode) {
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(this.userVolume, now + rampDuration);
      }
    } catch {
      if (this.filterNode1) {
        this.filterNode1.frequency.value = this.tentCutoff;
      }
      if (this.filterNode2) {
        this.filterNode2.frequency.value = this.tentCutoff;
      }
    }
  }

  /**
   * Natychmiastowe zatrzymanie dźwięku bez opóźnienia i bez fade-outu (np. przy przejściu do innej gry).
   */
  public stopImmediate(): void {
    this.clearGestureResume();
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.gainNode && this.ctx) {
      const now = this.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(0, now);
    }
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }

  /**
   * Płynne wyciszenie i zatrzymanie (np. przy przejściu na inny system dźwiękowy).
   */
  public stop(fadeDuration = 0.4): void {
    this.clearGestureResume();
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.gainNode && this.ctx) {
      const now = this.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);
      setTimeout(
        () => {
          if (!this.isPlaying && this.audio) {
            try {
              this.audio.pause();
              this.audio.currentTime = 0;
            } catch {
              // ignore
            }
          }
        },
        fadeDuration * 1000 + 50,
      );
    } else if (this.audio) {
      try {
        this.audio.pause();
      } catch {
        // ignore
      }
    }
  }

  private initAudioNodes(): boolean {
    if (this.sourceNode && this.filterNode1 && this.gainNode) return true;

    try {
      if (!this.ctx) {
        if (typeof window === 'undefined') return false;
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtxClass) return false;
        this.ctx = new AudioCtxClass();
      }

      if (!this.audio) {
        if (this.audioFactory) {
          this.audio = this.audioFactory(this.audioUrl);
        } else if (typeof Audio !== 'undefined') {
          this.audio = new Audio(this.audioUrl);
        } else {
          return false;
        }
        this.audio.loop = true;
        this.audio.preload = 'auto';
      }

      // Kaskadowy podwójny filtr dolnoprzepustowy (4-pole -24 dB/oct),
      // dający głębokie, autentyczne wrażenie muzyki dobiegającej z bardzo daleka
      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.value = this.tentCutoff;
      filter1.Q.value = 1.3;
      this.filterNode1 = filter1;

      const filter2 = this.ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.frequency.value = this.tentCutoff;
      filter2.Q.value = 0.707;
      this.filterNode2 = filter2;

      const gain = this.ctx.createGain();
      gain.gain.value = this.userVolume;
      this.gainNode = gain;

      // Połączenie z mediami HTML:
      // source -> filter1 -> filter2 -> gain -> destination
      this.sourceNode = this.ctx.createMediaElementSource(this.audio);
      this.sourceNode.connect(filter1);
      filter1.connect(filter2);
      filter2.connect(gain);
      gain.connect(this.ctx.destination);

      return true;
    } catch {
      return false;
    }
  }

  private setupGestureResume(): void {
    if (typeof window === 'undefined') return;
    this.clearGestureResume();

    const resume = () => {
      if (this.disposed) return;
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      if (this.gainNode && this.ctx) {
        const now = this.ctx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.userVolume, now);
      }
      if (this.audio && this.audio.paused) {
        void this.audio.play().catch(() => {});
      }
      if (this.audio && !this.audio.paused && (!this.ctx || this.ctx.state === 'running')) {
        this.clearGestureResume();
      }
    };

    this.pendingGestureResume = resume;
    for (const evt of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown']) {
      window.addEventListener(evt, resume, { capture: true, passive: true });
    }
  }

  private clearGestureResume(): void {
    if (typeof window !== 'undefined' && this.pendingGestureResume) {
      for (const evt of [
        'pointerdown',
        'touchstart',
        'touchend',
        'mousedown',
        'mouseup',
        'click',
        'keydown',
      ]) {
        window.removeEventListener(evt, this.pendingGestureResume, { capture: true });
      }
    }
    this.pendingGestureResume = null;
  }

  public dispose(): void {
    this.disposed = true;
    this.clearGestureResume();
    this.stop(0.05);

    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
      } catch {
        // ignore
      }
      this.audio = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.filterNode1) {
      try {
        this.filterNode1.disconnect();
      } catch {
        // ignore
      }
      this.filterNode1 = null;
    }

    if (this.filterNode2) {
      try {
        this.filterNode2.disconnect();
      } catch {
        // ignore
      }
      this.filterNode2 = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // ignore
      }
      this.gainNode = null;
    }

    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
