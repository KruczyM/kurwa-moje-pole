export class SpeakerAudio {
  private audio: HTMLAudioElement;
  private playing = false;
  constructor(url: string) {
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.preload = 'metadata';
    this.audio.volume = 0.48;
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
