export type CampAmbientOptions = {
  defaultVolume?: number;
  audioContext?: AudioContext;
};

export const DEFAULT_AMBIENT_VOLUME = 0.35;

/**
 * Proceduralny generator ambientu wiatru i otwartego pola obozowego oparty na Web Audio API.
 * Nie wymaga pobierania zewnętrznych plików dźwiękowych, zapętla się bezszwowo i reaguje na suwak głośności.
 */
export class CampAmbientAudio {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private lfoNode: OscillatorNode | null = null;
  private masterGain: GainNode | null = null;
  private userVolume: number;
  private isRunning = false;
  private isPaused = false;
  private pendingGestureResume: (() => void) | null = null;
  private disposed = false;

  constructor(options: CampAmbientOptions = {}) {
    this.userVolume = Math.min(1, Math.max(0, options.defaultVolume ?? DEFAULT_AMBIENT_VOLUME));
    if (options.audioContext) {
      this.ctx = options.audioContext;
    }
  }

  /** Zwraca czy ambient jest aktywny logicznie. */
  get active(): boolean {
    return this.isRunning && !this.isPaused;
  }

  /** Pobiera bieżącą głośność ambientu (0..1). */
  get volume(): number {
    return this.userVolume;
  }

  /** Ustawia głośność ambientu (0..1). */
  setVolume(volume: number) {
    this.userVolume = Math.min(1, Math.max(0, volume));
    if (this.masterGain && this.ctx) {
      const targetGain = this.isPaused ? 0 : this.userVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
  }

  /** Uruchamia proceduralny ambient wiatru. */
  start() {
    if (this.disposed || this.isRunning) return;

    if (!this.initAudioNodes()) {
      return;
    }

    this.isRunning = true;
    this.isPaused = false;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.setupGestureResume();
    }
  }

  /** Wstrzymuje ambient (np. podczas pauzy w menu lub wyjścia). */
  pause() {
    if (!this.isRunning || this.isPaused || !this.ctx || !this.masterGain) return;
    this.isPaused = true;
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  /** Wznawia ambient po pauzie. */
  resume() {
    if (!this.isRunning || !this.isPaused || !this.ctx || !this.masterGain) return;
    this.isPaused = false;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.masterGain.gain.setTargetAtTime(this.userVolume, this.ctx.currentTime, 0.2);
  }

  private initAudioNodes(): boolean {
    try {
      if (!this.ctx) {
        if (typeof window === 'undefined') return false;
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtxClass) return false;
        this.ctx = new AudioCtxClass();
      }

      const sampleRate = this.ctx.sampleRate || 44100;
      const bufferLength = sampleRate * 4; // 4-sekundowy bufor szumu
      const noiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
      const data = noiseBuffer.getChannelData(0);

      // Generowanie szumu różowego (pink noise filter) dającego naturalny, miękki szum powietrza
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      this.noiseNode = source;

      // Filtr górnoprzepustowy usuwający dudnienie basowe poniżej 70 Hz
      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 70;

      // Główny filtr dolnoprzepustowy kształtujący powiew wiatru (~380 Hz do ~750 Hz)
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 450;
      lowpass.Q.value = 1.2;

      // Wolny oscylator LFO modulujący częstotliwość odcięcia wiatru (powiewy w cyklu ~8-9 sekund)
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11; // ~0.11 Hz

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 240; // modulacja w zakresie ±240 Hz

      lfo.connect(lfoGain);
      lfoGain.connect(lowpass.frequency);
      this.lfoNode = lfo;

      // Główny węzeł wzmocnienia
      const master = this.ctx.createGain();
      master.gain.value = this.userVolume;
      this.masterGain = master;

      // Łączenie toru audio: noise -> highpass -> lowpass -> masterGain -> destination
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(master);
      master.connect(this.ctx.destination);

      source.start();
      lfo.start();

      return true;
    } catch {
      return false;
    }
  }

  private setupGestureResume() {
    if (typeof window === 'undefined') return;
    this.clearGestureListener();

    const onGesture = () => {
      this.clearGestureListener();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    };

    this.pendingGestureResume = onGesture;
    window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
    window.addEventListener('keydown', onGesture, { once: true, capture: true });
  }

  private clearGestureListener() {
    if (typeof window !== 'undefined' && this.pendingGestureResume) {
      window.removeEventListener('pointerdown', this.pendingGestureResume, { capture: true });
      window.removeEventListener('keydown', this.pendingGestureResume, { capture: true });
    }
    this.pendingGestureResume = null;
  }

  /** Zwalnia kontekst Web Audio, wyłącza generatory szumu i odłącza węzły. */
  dispose() {
    this.disposed = true;
    this.isRunning = false;
    this.isPaused = false;
    this.clearGestureListener();

    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }

    if (this.lfoNode) {
      try {
        this.lfoNode.stop();
        this.lfoNode.disconnect();
      } catch {}
      this.lfoNode = null;
    }

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {}
      this.masterGain = null;
    }

    if (this.ctx && typeof this.ctx.close === 'function') {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
