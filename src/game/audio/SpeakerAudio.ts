import type { AudioEffectState, EffectAudioTarget } from '../effects/EffectManager';

export class SpeakerAudio implements EffectAudioTarget {
  private audio: HTMLAudioElement;
  private playing = false;
  constructor(url: string) {
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.preload = 'metadata';
    this.audio.volume = 0.48;
  }
  /** Zapisuje parametry dźwięku sprzed uruchomienia efektu. */
  captureEffectState(): AudioEffectState {
    return { volume: this.audio.volume, playbackRate: this.audio.playbackRate };
  }
  /** Nakłada płynną modulację głośności i tempa aktywnej używki. */
  applyEffectState(state: AudioEffectState) {
    this.audio.volume = Math.min(1, Math.max(0, state.volume));
    this.audio.playbackRate = Math.min(2, Math.max(0.5, state.playbackRate));
  }
  /** Odtwarza dokładne parametry dźwięku zapisane przed efektem. */
  restoreEffectState(state: AudioEffectState) {
    this.audio.volume = state.volume;
    this.audio.playbackRate = state.playbackRate;
  }
  /** Przełącza zapętloną muzykę głośnika i zwraca nowy stan odtwarzania. */
  async toggle() {
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
      return false;
    }
    try {
      await this.audio.play();
      this.playing = true;
      return true;
    } catch {
      this.playing = false;
      return false;
    }
  }
  /** Zatrzymuje muzykę i odłącza źródło audio. */
  dispose() {
    this.audio.pause();
    this.audio.src = '';
  }
}
