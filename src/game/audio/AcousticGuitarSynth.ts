/**
 * AcousticGuitarSynth — Syntetyzator gitary akustycznej na ognisko festiwalowe.
 * Wykorzystuje algorytm Karplus-Strong do realistycznej syntezy szarpanych strun
 * oraz symuluje bicie akordów (down-strum / up-strum) w klasycznym rytmie ogniskowym.
 * Zapewnia tłumienie przestrzenne (spatial audio) i bezpieczną pracę bez AudioContext w testach.
 */

export type ChordName = 'C' | 'G' | 'Am' | 'F' | 'Em' | 'D';

export interface GuitarChord {
  name: ChordName;
  frequencies: readonly number[]; // Częstotliwości strun od najniższej do najwyższej
}

export const CAMPFIRE_CHORDS: Record<ChordName, readonly number[]> = {
  // C-dur: C3, E3, G3, C4, E4
  C: [130.81, 164.81, 196.0, 261.63, 329.63],
  // G-dur: G2, B2, D3, G3, D4, G4
  G: [98.0, 123.47, 146.83, 196.0, 293.66, 392.0],
  // A-moll: A2, E3, A3, C4, E4
  Am: [110.0, 164.81, 220.0, 261.63, 329.63],
  // F-dur (Fmaj7/C): C3, F3, A3, C4, E4
  F: [130.81, 174.61, 220.0, 261.63, 329.63],
  // E-moll: E2, B2, E3, G3, B3, E4
  Em: [82.41, 123.47, 164.81, 196.0, 246.94, 329.63],
  // D-dur: D3, A3, D4, F#4
  D: [146.83, 220.0, 293.66, 369.99],
};

// Klasyczna progresja ogniskowa Pol'and'Rock: G -> D -> Em -> C
export const DEFAULT_CAMPFIRE_PROGRESSION: readonly ChordName[] = ['G', 'D', 'Em', 'C'];

export interface AcousticGuitarSynthOptions {
  audioContext?: AudioContext;
  campfirePosition?: { x: number; y: number; z: number };
  innerRadius?: number;
  outerRadius?: number;
  baseVolume?: number;
  progression?: readonly ChordName[];
}

export class AcousticGuitarSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bodyFilter: BiquadFilterNode | null = null;
  private isPlaying = false;
  private campfirePos = { x: 5.5, y: 0, z: -3.0 };
  private innerRadius = 3.5;
  private outerRadius = 32.0;
  private userVolume = 0.85;
  private progression: readonly ChordName[];
  private currentChordIndex = 0;
  private beatTimer = 0;
  private beatStep = 0;
  private tempoBpm = 98; // Klasyczne, relaksujące tempo piosenek harcerskich / ogniskowych
  private noteBuffers = new Map<number, AudioBuffer>();
  private activeSources: AudioBufferSourceNode[] = [];

  constructor(options: AcousticGuitarSynthOptions = {}) {
    this.progression = options.progression ?? DEFAULT_CAMPFIRE_PROGRESSION;
    if (options.campfirePosition) this.campfirePos = { ...options.campfirePosition };
    if (options.innerRadius !== undefined) this.innerRadius = options.innerRadius;
    if (options.outerRadius !== undefined) this.outerRadius = options.outerRadius;
    if (options.baseVolume !== undefined) this.userVolume = options.baseVolume;

    if (options.audioContext) {
      this.initContext(options.audioContext);
    }
  }

  private initContext(context?: AudioContext): boolean {
    if (this.ctx) return true;
    if (!context) {
      if (typeof window === 'undefined') return false;
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return false;
      try {
        context = new AudioCtxClass();
      } catch {
        return false;
      }
    }
    this.ctx = context;

    // Filtr modelujący drewniany korpus pudła gitary akustycznej (rezonans 400-800 Hz)
    const filter = context.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 520;
    filter.Q.value = 1.2;
    filter.gain.value = 4.0;
    this.bodyFilter = filter;

    const gain = context.createGain();
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(context.destination);
    this.masterGain = gain;

    return true;
  }

  /**
   * Generuje próbkę szarpanej struny o podanej częstotliwości z użyciem algorytmu Karplus-Strong.
   */
  private getOrCreateNoteBuffer(freq: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const roundedFreq = Math.round(freq * 10) / 10;
    const cached = this.noteBuffers.get(roundedFreq);
    if (cached) return cached;

    const sampleRate = this.ctx.sampleRate || 44100;
    const duration = 1.8; // Czas wybrzmiewania struny akustycznej
    const totalSamples = Math.floor(sampleRate * duration);
    const period = Math.max(2, Math.round(sampleRate / freq));

    const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    // Krok 1: Wypełnij początkowy bufor losowym szumem (uderzenie kostki o strunę)
    for (let i = 0; i < period; i++) {
      channel[i] = (Math.random() * 2 - 1) * 0.9;
    }

    // Krok 2: Pętla sprzężenia zwrotnego z filtrem dolnoprzepustowym (damping factor 0.993)
    const damping = 0.993;
    for (let i = period; i < totalSamples; i++) {
      channel[i] = (channel[i - period] + channel[i - period - 1]) * 0.5 * damping;
    }

    this.noteBuffers.set(roundedFreq, buffer);
    return buffer;
  }

  /**
   * Wykonuje uderzenie w akord (strum) z mikro-opóźnieniem między strunami.
   */
  public strumChord(chordName: ChordName, direction: 'down' | 'up' = 'down'): void {
    if (!this.ctx || !this.bodyFilter) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const freqs = CAMPFIRE_CHORDS[chordName];
    if (!freqs || freqs.length === 0) return;

    const orderedFreqs = direction === 'down' ? [...freqs] : [...freqs].reverse();
    const stringDelay = 0.024; // 24 ms między strunami przy uderzeniu kostką

    const now = this.ctx.currentTime;
    orderedFreqs.forEach((freq, index) => {
      const buffer = this.getOrCreateNoteBuffer(freq);
      if (!buffer || !this.ctx) return;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const stringGain = this.ctx.createGain();
      // Up-strum jest zazwyczaj nieco lżejszy i akcentuje wyższe struny
      const volumeMultiplier = direction === 'up' ? 0.75 : 1.0;
      stringGain.gain.setValueAtTime(0.18 * volumeMultiplier, now + index * stringDelay);

      source.connect(stringGain);
      stringGain.connect(this.bodyFilter!);

      source.start(now + index * stringDelay);
      this.activeSources.push(source);

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx >= 0) this.activeSources.splice(idx, 1);
      };
    });
  }

  public start(): void {
    if (this.isPlaying) return;
    this.initContext();
    this.isPlaying = true;
    this.currentChordIndex = 0;
    this.beatTimer = 0;
    this.beatStep = 0;
  }

  public stop(): void {
    this.isPlaying = false;
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        // Ignoruj jeśli już zakończone
      }
    }
    this.activeSources = [];
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public get running(): boolean {
    return this.isPlaying;
  }

  public setVolume(volume: number): void {
    this.userVolume = Math.max(0, Math.min(1, volume));
  }

  public setCampfirePosition(x: number, y: number, z: number): void {
    this.campfirePos = { x, y, z };
  }

  /**
   * Oblicza przestrzenne tłumienie dźwięku gitary względem pozycji słuchacza/kamery.
   */
  public calculateSpatialGain(listenerPos?: { x: number; y: number; z: number }): number {
    if (!listenerPos) return this.userVolume;
    const dx = listenerPos.x - this.campfirePos.x;
    const dy = listenerPos.y - this.campfirePos.y;
    const dz = listenerPos.z - this.campfirePos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist <= this.innerRadius) return this.userVolume;
    if (dist >= this.outerRadius) return 0;

    const t = 1.0 - (dist - this.innerRadius) / (this.outerRadius - this.innerRadius);
    return t * t * this.userVolume;
  }

  /**
   * Aktualizuje pętlę rytmu ogniskowego oraz głośność przestrzenną.
   */
  public update(dt: number, listenerPos?: { x: number; y: number; z: number }): void {
    if (!this.isPlaying) return;

    // Aktualizuj głośność przestrzenną
    const spatialGain = this.calculateSpatialGain(listenerPos);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(spatialGain, this.ctx.currentTime);
    }

    // Pętla rytmiczna: klasyczne bicie ogniskowe
    // Wzorzec bicia na 4/4 (ósemki):
    // 1: DÓŁ (akcent)
    // 2: cisza / wybrzmienie
    // 3: DÓŁ
    // 4: GÓRA
    // 5: cisza / wybrzmienie
    // 6: GÓRA
    // 7: DÓŁ
    // 8: GÓRA
    const eighthNoteDuration = 60 / this.tempoBpm / 2;
    this.beatTimer += dt;

    if (this.beatTimer >= eighthNoteDuration) {
      this.beatTimer -= eighthNoteDuration;
      const currentChord = this.progression[this.currentChordIndex];

      // Wykonaj uderzenie w zależności od kroku bicia
      if (this.beatStep === 0) {
        this.strumChord(currentChord, 'down');
      } else if (this.beatStep === 2) {
        this.strumChord(currentChord, 'down');
      } else if (this.beatStep === 3) {
        this.strumChord(currentChord, 'up');
      } else if (this.beatStep === 5) {
        this.strumChord(currentChord, 'up');
      } else if (this.beatStep === 6) {
        this.strumChord(currentChord, 'down');
      } else if (this.beatStep === 7) {
        this.strumChord(currentChord, 'up');
      }

      this.beatStep = (this.beatStep + 1) % 8;
      // Zmiana akordu co pełny takt (8 ósemek)
      if (this.beatStep === 0) {
        this.currentChordIndex = (this.currentChordIndex + 1) % this.progression.length;
      }
    }
  }

  public dispose(): void {
    this.stop();
    this.noteBuffers.clear();
    this.masterGain = null;
    this.bodyFilter = null;
    this.ctx = null;
  }
}
