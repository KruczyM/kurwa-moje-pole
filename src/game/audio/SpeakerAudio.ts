import type { AudioEffectState, EffectAudioTarget } from '../effects/EffectManager';

export type Vector3Like = {
  x: number;
  y: number;
  z: number;
};

export type AudioLike = {
  loop: boolean;
  preload: string;
  volume: number;
  playbackRate: number;
  src: string;
  play(): Promise<void> | void;
  pause(): void;
};

export type AudioFactory = (url: string) => AudioLike;

export type SpeakerAudioOptions = {
  innerRadius?: number;
  outerRadius?: number;
  fadeDuration?: number;
  defaultUserVolume?: number;
  factory?: AudioFactory;
};

export const DEFAULT_SPEAKER_INNER_RADIUS = 3.5;
export const DEFAULT_SPEAKER_OUTER_RADIUS = 35.0;
export const DEFAULT_SPEAKER_FADE_DURATION = 0.45;
export const DEFAULT_SPEAKER_USER_VOLUME = 0.7;

export type SpeakerPlaybackState = 'off' | 'fading-in' | 'on' | 'fading-out';

/**
 * Przestrzenny kontroler odtwarzacza muzyki z głośnika obozowego.
 * Zapewnia kwadratowe tłumienie głośności w zależności od odległości gracza,
 * płynne przejścia włączania/wyłączania (crossfade) oraz odporność na blokady autoplay.
 */
export class SpeakerAudio implements EffectAudioTarget {
  private audio: AudioLike;
  private state: SpeakerPlaybackState = 'off';
  private fadeFactor = 0;
  private innerRadius: number;
  private outerRadius: number;
  private fadeDuration: number;
  private userVolume: number;
  private effectVolumeModifier = 1.0;
  private effectPlaybackRate = 1.0;
  private speakerPosition: Vector3Like | null = null;
  private lastListenerPosition: Vector3Like | null = null;
  private pendingAutoplayResume: (() => void) | null = null;
  private disposed = false;

  constructor(url: string, options: SpeakerAudioOptions = {}) {
    this.innerRadius = options.innerRadius ?? DEFAULT_SPEAKER_INNER_RADIUS;
    this.outerRadius = options.outerRadius ?? DEFAULT_SPEAKER_OUTER_RADIUS;
    this.fadeDuration = Math.max(0.01, options.fadeDuration ?? DEFAULT_SPEAKER_FADE_DURATION);
    this.userVolume = Math.min(1, Math.max(0, options.defaultUserVolume ?? DEFAULT_SPEAKER_USER_VOLUME));

    const factory: AudioFactory =
      options.factory ??
      ((targetUrl: string) => {
        if (typeof Audio !== 'undefined') {
          return new Audio(targetUrl);
        }
        return {
          loop: true,
          preload: 'metadata',
          volume: 1,
          playbackRate: 1,
          src: targetUrl,
          play: () => Promise.resolve(),
          pause: () => {},
        };
      });

    this.audio = factory(url);
    this.audio.loop = true;
    this.audio.preload = 'metadata';
    this.audio.volume = 0;
  }

  /** Zwraca bieżący stan odtwarzania. */
  get playbackState(): SpeakerPlaybackState {
    return this.state;
  }

  /** Czy głośnik jest aktualnie włączony lub w trakcie włączania. */
  get isPlaying(): boolean {
    return this.state === 'on' || this.state === 'fading-in';
  }

  /** Zwraca aktualną pozycję głośnika w świecie. */
  get position(): Vector3Like | null {
    return this.speakerPosition;
  }

  /** Ustawia pozycję głośnika w świecie dla kalkulacji przestrzennych. */
  setSpeakerPosition(position: Vector3Like | null) {
    this.speakerPosition = position ? { x: position.x, y: position.y, z: position.z } : null;
    this.recalculateVolume();
  }

  /** Ustawia bazową głośność preferowaną przez gracza (0..1). */
  setUserVolume(volume: number) {
    this.userVolume = Math.min(1, Math.max(0, volume));
    this.recalculateVolume();
  }

  /** Pobiera bazową głośność preferowaną przez gracza. */
  getUserVolume(): number {
    return this.userVolume;
  }

  /** Zapisuje parametry dźwięku sprzed uruchomienia efektu (zgodność z EffectAudioTarget). */
  captureEffectState(): AudioEffectState {
    return {
      volume: this.effectVolumeModifier,
      playbackRate: this.effectPlaybackRate,
    };
  }

  /** Nakłada płynną modulację głośności i tempa aktywnej używki. */
  applyEffectState(state: AudioEffectState) {
    this.effectVolumeModifier = Math.min(2, Math.max(0, state.volume));
    this.effectPlaybackRate = Math.min(2, Math.max(0.5, state.playbackRate));
    this.audio.playbackRate = this.effectPlaybackRate;
    this.recalculateVolume();
  }

  /** Odtwarza dokładne parametry dźwięku zapisane przed efektem. */
  restoreEffectState(state: AudioEffectState) {
    this.effectVolumeModifier = state.volume;
    this.effectPlaybackRate = state.playbackRate;
    this.audio.playbackRate = this.effectPlaybackRate;
    this.recalculateVolume();
  }

  /**
   * Oblicza współczynnik tłumienia zależny od odległości (0..1).
   * Do innerRadius głośność wynosi 1.0. Powyżej outerRadius głośność wynosi 0.0.
   */
  calculateDistanceAttenuation(listenerPos: Vector3Like | null): number {
    if (!this.speakerPosition || !listenerPos) return 1.0;
    const dx = listenerPos.x - this.speakerPosition.x;
    const dy = listenerPos.y - this.speakerPosition.y;
    const dz = listenerPos.z - this.speakerPosition.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance <= this.innerRadius) return 1.0;
    if (distance >= this.outerRadius) return 0.0;

    const ratio = 1 - (distance - this.innerRadius) / (this.outerRadius - this.innerRadius);
    // Gładkie tłumienie kwadratowe odpowiadające naturalnej akustyce otwartej przestrzeni
    return ratio * ratio;
  }

  /** Aktualizuje stan głośnika i płynny fade w pętli renderowania gry. */
  update(listenerPosition: Vector3Like, dt: number) {
    if (this.disposed) return;
    this.lastListenerPosition = { x: listenerPosition.x, y: listenerPosition.y, z: listenerPosition.z };

    if (this.state === 'fading-in') {
      this.fadeFactor = Math.min(1, this.fadeFactor + dt / this.fadeDuration);
      if (this.fadeFactor >= 1) {
        this.state = 'on';
      }
    } else if (this.state === 'fading-out') {
      this.fadeFactor = Math.max(0, this.fadeFactor - dt / this.fadeDuration);
      if (this.fadeFactor <= 0) {
        this.state = 'off';
        this.audio.pause();
      }
    }

    this.recalculateVolume();
  }

  /** Przełącza odtwarzanie muzyki głośnika i zwraca nowy stan logiczny (true = włącza, false = wyłącza). */
  async toggle(): Promise<boolean> {
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    return this.play();
  }

  /** Płynnie uruchamia odtwarzanie muzyki z głośnika. */
  async play(): Promise<boolean> {
    if (this.disposed) return false;
    this.clearAutoplayListener();

    if (this.state === 'on') return true;

    this.state = 'fading-in';
    this.recalculateVolume();

    try {
      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await playPromise;
      }
      return true;
    } catch {
      // Obsługa polityki autoplay przeglądarki
      this.setupAutoplayResume();
      return false;
    }
  }

  /** Płynnie wygasza odtwarzanie muzyki z głośnika. */
  stop() {
    this.clearAutoplayListener();
    if (this.state === 'off') return;
    this.state = 'fading-out';
  }

  /** Wymusza natychmiastowe zatrzymanie (bez fade). */
  stopImmediate() {
    this.clearAutoplayListener();
    this.state = 'off';
    this.fadeFactor = 0;
    this.audio.pause();
    this.recalculateVolume();
  }

  private recalculateVolume() {
    if (this.disposed) return;
    const distanceAttenuation = this.calculateDistanceAttenuation(this.lastListenerPosition);
    const finalVolume = Math.min(
      1,
      Math.max(0, this.userVolume * distanceAttenuation * this.effectVolumeModifier * this.fadeFactor),
    );
    this.audio.volume = finalVolume;
  }

  private setupAutoplayResume() {
    if (typeof window === 'undefined') return;
    this.clearAutoplayListener();

    const resume = () => {
      this.clearAutoplayListener();
      if (this.state === 'fading-in' || this.state === 'on') {
        void this.audio.play();
      }
    };

    this.pendingAutoplayResume = resume;
    window.addEventListener('pointerdown', resume, { once: true, capture: true });
    window.addEventListener('keydown', resume, { once: true, capture: true });
  }

  private clearAutoplayListener() {
    if (typeof window !== 'undefined' && this.pendingAutoplayResume) {
      window.removeEventListener('pointerdown', this.pendingAutoplayResume, { capture: true });
      window.removeEventListener('keydown', this.pendingAutoplayResume, { capture: true });
    }
    this.pendingAutoplayResume = null;
  }

  /** Zatrzymuje muzykę, odłącza nasłuchy i zwalnia zasoby audio. */
  dispose() {
    this.disposed = true;
    this.clearAutoplayListener();
    this.stopImmediate();
    this.audio.src = '';
  }
}
