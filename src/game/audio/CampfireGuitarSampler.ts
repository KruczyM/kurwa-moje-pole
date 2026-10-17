/**
 * CampfireGuitarSampler — Odtwarzacz autentycznych próbek dźwiękowych gitary akustycznej.
 * Wykorzystuje studyjne próbki szarpanych strun stalowej gitary akustycznej (steel-string acoustic guitar)
 * dla dźwięków z pełnego zakresu gryfu (E2 - A5).
 * W przypadku braku pobranej próbki (np. tryb offline/testy) zapewnia fizyczny model Karplus-Strong
 * z tłumieniem rezonansowym pudła drewnianego, dzięki czemu nigdy nie brzmi jak sztuczny keyboard.
 */

export interface GuitarSamplerOptions {
  baseUrl?: string;
  context?: AudioContext;
  destinationNode?: AudioNode;
}

export const SAMPLE_NOTE_NAMES: readonly string[] = [
  'E2', 'F2', 'Gb2', 'G2', 'Ab2', 'A2', 'Bb2', 'B2',
  'C3', 'Db3', 'D3', 'Eb3', 'E3', 'F3', 'Gb3', 'G3', 'Ab3', 'A3', 'Bb3', 'B3',
  'C4', 'Db4', 'D4', 'Eb4', 'E4', 'F4', 'Gb4', 'G4', 'Ab4', 'A4', 'Bb4', 'B4',
  'C5', 'Db5', 'D5', 'Eb5', 'E5', 'F5', 'Gb5', 'G5', 'Ab5', 'A5',
];

export const CHORD_NOTE_MAP: Record<string, readonly string[]> = {
  // C-dur: C3, E3, G3, C4, E4
  C: ['C3', 'E3', 'G3', 'C4', 'E4'],
  // G-dur: G2, B2, D3, G3, B3, G4
  G: ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'],
  // A-moll: A2, E3, A3, C4, E4
  Am: ['A2', 'E3', 'A3', 'C4', 'E4'],
  // E-moll: E2, B2, E3, G3, B3, E4
  Em: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'],
  // D-dur: D3, A3, D4, Gb4
  D: ['D3', 'A3', 'D4', 'Gb4'],
  // D-moll: D3, A3, D4, F4
  Dm: ['D3', 'A3', 'D4', 'F4'],
  // F-dur: F2, C3, F3, A3, C4
  F: ['F2', 'C3', 'F3', 'A3', 'C4'],
  // A-dur: A2, E3, A3, Db4, E4
  A: ['A2', 'E3', 'A3', 'Db4', 'E4'],
  // C#m: Db3, Ab3, Db4, E4, Ab4
  'C#m': ['Db3', 'Ab3', 'Db4', 'E4', 'Ab4'],
  // E-dur: E2, B2, E3, Ab3, B3, E4
  E: ['E2', 'B2', 'E3', 'Ab3', 'B3', 'E4'],
};

const SEMITONE_MAP: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Konwertuje nazwę nuty (np. "A4", "C#4", "Db3", "C-1") na numer nuty MIDI */
export function pitchNameToMidi(pitch: string): number {
  const match = /^([A-G])(#?|b?)(-?\d+)$/.exec(pitch);
  if (!match) return 69; // A4 default
  const noteLetter = match[1];
  const accidental = match[2];
  const octave = parseInt(match[3], 10);

  let semitone = SEMITONE_MAP[noteLetter] ?? 0;
  if (accidental === '#') semitone += 1;
  else if (accidental === 'b') semitone -= 1;

  return (octave + 1) * 12 + semitone;
}

/** Konwertuje numer MIDI na częstotliwość w Hz */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Konwertuje częstotliwość w Hz na numer MIDI */
export function frequencyToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

/**
 * Normalizuje zapis nuty (np. C#4 -> Db4) i dopasowuje najbliższą próbkę z obliczonym pitchRatio.
 */
export function normalizePitchToSample(pitch: string): { sampleName: string; pitchRatio: number; targetMidi: number } {
  const targetMidi = pitchNameToMidi(pitch);

  let bestSample = 'A4';
  let bestDiff = Infinity;
  let bestSampleMidi = 69;

  for (const name of SAMPLE_NOTE_NAMES) {
    const sMidi = pitchNameToMidi(name);
    const diff = Math.abs(targetMidi - sMidi);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSample = name;
      bestSampleMidi = sMidi;
      if (diff === 0) break;
    }
  }

  const pitchRatio = Math.pow(2, (targetMidi - bestSampleMidi) / 12);
  return { sampleName: bestSample, pitchRatio, targetMidi };
}

export class CampfireGuitarSampler {
  private ctx: AudioContext | null = null;
  private outputNode: AudioNode | null = null;
  private bodyFilter: BiquadFilterNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadPromises = new Map<string, Promise<AudioBuffer | null>>();
  private baseUrl: string;
  private ksBuffers = new Map<number, AudioBuffer>();
  private activeVoices = new Set<AudioScheduledSourceNode>();
  private disposed = false;

  constructor(options: GuitarSamplerOptions = {}) {
    const rawBase = options.baseUrl ?? ((typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/');
    this.baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    if (options.context) {
      this.init(options.context, options.destinationNode);
    }
  }

  public init(context: AudioContext, destination?: AudioNode): void {
    if (this.ctx === context && this.outputNode) return;
    this.ctx = context;

    try {
      // Filtr rezonansu pudła akustycznego gitary (drewniana komora rezonansowa)
      const filter = context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = 520;
      filter.Q.value = 1.2;
      filter.gain.value = 3.0;
      this.bodyFilter = filter;

      const targetDest = destination ?? context.destination;
      filter.connect(targetDest);
      this.outputNode = filter;

      // Rozpocznij wstępne ładowanie najczęstszych próbek
      void this.preloadCommonSamples();
    } catch {
      // Bezpieczeństwo AudioContext w środowiskach bez audio
    }
  }

  /**
   * Ładuje próbkę dźwiękową gitary akustycznej z serwera.
   */
  public async loadSample(name: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return this.buffers.get(name)!;
    if (this.loadPromises.has(name)) return this.loadPromises.get(name)!;
    if (!this.ctx || this.disposed) return null;
    if (typeof fetch === 'undefined') return null;

    const promise = (async () => {
      try {
        const url = `${this.baseUrl}game-assets/audio/guitar/samples/${name}.mp3`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const arrayBuf = await resp.arrayBuffer();
        if (!this.ctx || this.disposed) return null;
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
        this.buffers.set(name, audioBuf);
        return audioBuf;
      } catch {
        return null;
      } finally {
        this.loadPromises.delete(name);
      }
    })();

    this.loadPromises.set(name, promise);
    return promise;
  }

  /**
   * Preloaduje podstawowy zestaw nut najczęściej używanych w piosenkach.
   */
  public async preloadCommonSamples(): Promise<void> {
    const common = ['A2', 'E3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'];
    await Promise.all(common.map((name) => this.loadSample(name)));
  }

  /**
   * Realistyczny algorytm Karplus-Strong jako natychmiastowy fallback,
   * gdy próbka audio nie została jeszcze pobrana (np. testy jednostkowe lub offline).
   */
  private getOrCreateKsBuffer(freq: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const roundedFreq = Math.round(freq * 10) / 10;
    const cached = this.ksBuffers.get(roundedFreq);
    if (cached) return cached;

    const sampleRate = this.ctx.sampleRate || 44100;
    const duration = 1.8;
    const totalSamples = Math.floor(sampleRate * duration);
    const period = Math.max(2, Math.round(sampleRate / freq));

    const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < period; i++) {
      channel[i] = (Math.random() * 2 - 1) * 0.9;
    }

    const damping = 0.992;
    for (let i = period; i < totalSamples; i++) {
      channel[i] = (channel[i - period] + channel[i - period - 1]) * 0.5 * damping;
    }

    this.ksBuffers.set(roundedFreq, buffer);
    return buffer;
  }

  /**
   * Gra partię solową / akord przy naciśnięciu struny.
   */
  public playPlucked(noteOrChord: string, startTime?: number, lane?: number): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const now = startTime ?? this.ctx.currentTime;

    // 1. Sprawdź czy to akord (np. C, G, Am)
    const chordNotes = CHORD_NOTE_MAP[noteOrChord];
    if (chordNotes && chordNotes.length > 0) {
      if (lane !== undefined) {
        // Pojedyncza struna akordu przypisana do tego toru
        const note = chordNotes[lane % chordNotes.length];
        this.playSingleNote(note, now);
      } else {
        // Pełne bicie akordu (strum) z naturalnym mikro-opóźnieniem strun (14ms)
        chordNotes.forEach((note, idx) => {
          this.playSingleNote(note, now + idx * 0.014);
        });
      }
      return;
    }

    // 2. Pojedyncza nuta melodyczna (np. A4, B4, C5, F#4)
    this.playSingleNote(noteOrChord, now);
  }

  /**
   * Gra szarpniętą strunę o określonej częstotliwości w Hz (dla zachowania zgodności).
   */
  public playPluckedFrequency(freq: number, startTime?: number): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;
    const midi = frequencyToMidi(freq);
    const targetFreq = midiToFrequency(midi);
    const now = startTime ?? this.ctx.currentTime;

    // Sprawdź czy mamy próbkę
    const { sampleName, pitchRatio } = normalizePitchToSample(sampleNameFromMidi(midi));
    const sampleBuffer = this.buffers.get(sampleName);

    if (sampleBuffer) {
      this.playBufferSource(sampleBuffer, pitchRatio, now);
      return;
    }

    // Karplus-Strong fallback
    this.playKsPluck(targetFreq, now);
  }

  private playSingleNote(pitch: string, time: number): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;

    const { sampleName, pitchRatio, targetMidi } = normalizePitchToSample(pitch);
    const sampleBuffer = this.buffers.get(sampleName);

    if (sampleBuffer) {
      // 1. Prawdziwa studyjna próbka gitary akustycznej
      this.playBufferSource(sampleBuffer, pitchRatio, time);
      return;
    }

    // Jeśli próbka nie jest jeszcze w pamięci, zaplanuj jej załadowanie
    void this.loadSample(sampleName);

    // 2. Realistyczny fizyczny model struny Karplus-Strong
    const freq = midiToFrequency(targetMidi);
    this.playKsPluck(freq, time);
  }

  private playBufferSource(buffer: AudioBuffer, pitchRatio: number, time: number): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      if (source.playbackRate) {
        source.playbackRate.setValueAtTime(pitchRatio, time);
      }

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.85, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.2);

      source.connect(gain);
      gain.connect(this.outputNode);

      this.activeVoices.add(source);
      source.start(time);
      source.stop(time + 2.3);

      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
        this.activeVoices.delete(source);
      };
    } catch {
      // ignore
    }
  }

  private playKsPluck(freq: number, time: number): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;

    try {
      const ksBuffer = this.getOrCreateKsBuffer(freq);
      if (!ksBuffer) return;

      const source = this.ctx.createBufferSource();
      source.buffer = ksBuffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.7, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);

      source.connect(gain);
      gain.connect(this.outputNode);

      this.activeVoices.add(source);
      source.start(time);
      source.stop(time + 1.85);

      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
        this.activeVoices.delete(source);
      };
    } catch {
      // ignore
    }
  }

  public get loadedSampleCount(): number {
    return this.buffers.size;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const voice of this.activeVoices) {
      try {
        voice.stop();
        voice.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeVoices.clear();

    if (this.bodyFilter) {
      try {
        this.bodyFilter.disconnect();
      } catch {
        // ignore
      }
      this.bodyFilter = null;
    }
    this.outputNode = null;
    this.buffers.clear();
    this.ksBuffers.clear();
  }
}

function sampleNameFromMidi(midi: number): string {
  const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = noteNames[midi % 12];
  return `${name}${octave}`;
}
