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
  'E2',
  'F2',
  'Gb2',
  'G2',
  'Ab2',
  'A2',
  'Bb2',
  'B2',
  'C3',
  'Db3',
  'D3',
  'Eb3',
  'E3',
  'F3',
  'Gb3',
  'G3',
  'Ab3',
  'A3',
  'Bb3',
  'B3',
  'C4',
  'Db4',
  'D4',
  'Eb4',
  'E4',
  'F4',
  'Gb4',
  'G4',
  'Ab4',
  'A4',
  'Bb4',
  'B4',
  'C5',
  'Db5',
  'D5',
  'Eb5',
  'E5',
  'F5',
  'Gb5',
  'G5',
  'Ab5',
  'A5',
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
  // F-dur: F2, C3, F3, A3, C4, F4
  F: ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'],
  // A-dur: A2, E3, A3, Db4, E4
  A: ['A2', 'E3', 'A3', 'Db4', 'E4'],
  // C#m / cis: Db3, Ab3, Db4, E4, Ab4
  'C#m': ['Db3', 'Ab3', 'Db4', 'E4', 'Ab4'],
  cis: ['Db3', 'Ab3', 'Db4', 'E4', 'Ab4'],
  // F#m / fis: Gb2, Db3, Gb3, A3, Db4, Gb4
  'F#m': ['Gb2', 'Db3', 'Gb3', 'A3', 'Db4', 'Gb4'],
  fis: ['Gb2', 'Db3', 'Gb3', 'A3', 'Db4', 'Gb4'],
  // E-dur: E2, B2, E3, Ab3, B3, E4
  E: ['E2', 'B2', 'E3', 'Ab3', 'B3', 'E4'],
  // E7 (Dżem blues shuffle): E2, B2, D3, Ab3, B3, E4
  E7: ['E2', 'B2', 'D3', 'Ab3', 'B3', 'E4'],
  // A7: A2, E3, G3, Db4, E4
  A7: ['A2', 'E3', 'G3', 'Db4', 'E4'],
  // H7 / B7: B2, Eb3, A3, B3, Gb4
  H7: ['B2', 'Eb3', 'A3', 'B3', 'Gb4'],
  B7: ['B2', 'Eb3', 'A3', 'B3', 'Gb4'],
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
export function normalizePitchToSample(pitch: string): {
  sampleName: string;
  pitchRatio: number;
  targetMidi: number;
} {
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
  private bodyLowFilter: BiquadFilterNode | null = null;
  private bodyMidFilter: BiquadFilterNode | null = null;
  private stringPresenceFilter: BiquadFilterNode | null = null;
  private outputGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadPromises = new Map<string, Promise<AudioBuffer | null>>();
  private baseUrl: string;
  private ksBuffers = new Map<number, AudioBuffer>();
  private activeVoices = new Set<{ source: AudioScheduledSourceNode; gain: GainNode }>();
  private readonly maxPolyphony = 24;
  private disposed = false;

  public get bodyFilter(): BiquadFilterNode | null {
    return this.bodyMidFilter;
  }

  constructor(options: GuitarSamplerOptions = {}) {
    const rawBase =
      options.baseUrl ?? ((typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/');
    this.baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    if (options.context) {
      this.init(options.context, options.destinationNode);
    }
  }

  public init(context: AudioContext, destination?: AudioNode): void {
    if (this.ctx === context && this.outputNode) return;
    this.ctx = context;

    try {
      // Trzypasmowy model rezonansu pudła gitary akustycznej (Dreadnought acoustic body):
      // 1. Rezonans komory powietrznej Helmholtz (115 Hz) — ciepłe oparcie basu bez dudnienia
      const lowFilter = context.createBiquadFilter();
      lowFilter.type = 'peaking';
      lowFilter.frequency.value = 115;
      lowFilter.Q.value = 1.0;
      lowFilter.gain.value = 0.8;
      this.bodyLowFilter = lowFilter;

      // 2. Rezonans płyty ze świerku/cedru (480 Hz) — drewniane ciało akordu
      const midFilter = context.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 480;
      midFilter.Q.value = 1.0;
      midFilter.gain.value = 0.9;
      this.bodyMidFilter = midFilter;

      // 3. Blask i atak kostki na strunach stalowo-brązowych (3400 Hz) — czysty, autentyczny dźwięk
      const highFilter = context.createBiquadFilter();
      highFilter.type = 'peaking';
      highFilter.frequency.value = 3400;
      highFilter.Q.value = 1.0;
      highFilter.gain.value = 1.1;
      this.stringPresenceFilter = highFilter;

      const outGain = context.createGain();
      outGain.gain.value = 0.48; // Zbalansowane wyjście dla wielogłosu i miksu z podkładem
      this.outputGain = outGain;

      const targetDest = destination ?? context.destination;
      highFilter.connect(midFilter);
      midFilter.connect(lowFilter);
      lowFilter.connect(outGain);
      outGain.connect(targetDest);

      this.outputNode = highFilter;

      // Rozpocznij wstępne ładowanie pełnego zestawu próbek studyjnych
      void this.preloadAllSamples();
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
        // Bezpieczne dekodowanie niezależną kopią bufora (zabezpieczenie starszych silników WebKit/Safari)
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf.slice(0));
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
   * Preloaduje pełny zestaw próbek dźwiękowych gitary (wszystkie 42 nuty E2-A5, łącznie ~750KB).
   */
  public async preloadAllSamples(): Promise<void> {
    await Promise.all(SAMPLE_NOTE_NAMES.map((name) => this.loadSample(name)));
  }

  /**
   * Preloaduje podstawowy zestaw nut najczęściej używanych w piosenkach.
   */
  public async preloadCommonSamples(): Promise<void> {
    await this.preloadAllSamples();
  }

  /**
   * Realistyczny algorytm Karplus-Strong jako natychmiastowy fallback,
   * gdy próbka audio nie została jeszcze pobrana (np. testy jednostkowe lub offline).
   * Zabezpieczony przed indeksem -1 (brak wartości NaN).
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
      const prev1 = channel[i - period];
      const prev2 = i - period === 0 ? channel[period - 1] : channel[i - period - 1];
      channel[i] = (prev1 + prev2) * 0.5 * damping;
    }

    this.ksBuffers.set(roundedFreq, buffer);
    return buffer;
  }

  /**
   * Gra partię solową lub pełny chwyt gitarowy (strum) przy naciśnięciu struny.
   * Gdy podano akord (np. Am, C, G, Dm, E, H7, F), wykonuje naturalne bicie chwytu
   * wszystkimi strunami z mikro-opóźnieniem w tonacji i dynamice danego toru i utworu.
   */
  public playPlucked(noteOrChord: string, startTime?: number, lane?: number, songId?: string): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const now = Math.max(this.ctx.currentTime, startTime ?? this.ctx.currentTime);

    // 1. Sprawdź czy to akord (np. C, G, Am, Dm, E, H7, F, F#m...)
    const chordNotes = CHORD_NOTE_MAP[noteOrChord];
    if (chordNotes && chordNotes.length > 0) {
      this.playChordStrum(chordNotes, now, lane, songId);
      return;
    }

    // 2. Pojedyncza nuta melodyczna (np. A4, B4, C5, F#4)
    this.playSingleNote(noteOrChord, now);
  }

  /**
   * Odtwarza autentyczne bicie chwytu gitarowego (chord strum) dopasowane do brzmienia oryginału.
   * Wszystkie struny akordu brzmią harmonijnie z mikro-opóźnieniem i dynamiką
   * odpowiednią dla danego utworu (blues shuffle dla Cegły, ballada dla Victorii, folk-punk dla Piły).
   */
  public playChordStrum(
    chordNotes: readonly string[],
    startTime: number,
    lane?: number,
    songId?: string,
  ): void {
    if (!this.ctx || !this.outputNode || this.disposed || chordNotes.length === 0) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const baseTime = Math.max(this.ctx.currentTime, startTime);
    const len = chordNotes.length;

    // Wytłum poprzednio wybrzmiewające struny, imitując zmianę układu dłoni na gryfie (fret muting)
    this.dampPreviousVoices(0.045);

    // Styl bicia i wybrzmienia pudła dopasowany do charakteru oryginalnego utworu:
    let baseDelay = 0.014;
    let baseDuration = 2.3;
    if (songId === 'czerwony-cegla-midi') {
      // Dżem — Czerwony jak cegła: blues shuffle, sprężysty perkusyjny atak kostki, mocny bas
      baseDelay = 0.011;
      baseDuration = 2.1;
    } else if (songId === 'sen-victoria-midi') {
      // Dżem — Sen o Victorii: miękka, balladowa głębia akustyczna, dłuższe bicie i wybrzmienie
      baseDelay = 0.018;
      baseDuration = 2.8;
    } else if (songId === 'pila-tango-midi') {
      // Strachy na Lachy — Piła tango: szybkie, cięte, dynamiczne bicie folk-punkowe
      baseDelay = 0.01;
      baseDuration = 1.9;
    } else if (songId === 'czarny-chleb-midi') {
      // Strachy na Lachy — Czarny chleb i czarna kawa: klasyczny akustyczny rytm ogniskowy
      baseDelay = 0.014;
      baseDuration = 2.4;
    }

    const isUpstroke = lane === 4;
    const strumDelay = isUpstroke ? baseDelay * 0.85 : baseDelay;

    chordNotes.forEach((note, idx) => {
      const stringIdx = isUpstroke ? len - 1 - idx : idx;
      const noteName = chordNotes[stringIdx];
      const noteTime = baseTime + idx * strumDelay;

      // Naturalna dynamika strun w akordzie akustycznym: energia uderzenia rozkłada się proporcjonalnie
      const chordEnergyFactor = 0.65 / Math.sqrt(len);
      let volume: number;
      if (lane === 0 && stringIdx === 0) {
        // Mocny akcent basowy na strunie prymy (root note)
        volume = chordEnergyFactor * 1.22;
      } else if (lane === 4 && stringIdx === len - 1) {
        // Jasny akcent wiolinowy
        volume = chordEnergyFactor * 1.18;
      } else if (stringIdx === 0) {
        volume = chordEnergyFactor * 1.1;
      } else {
        volume = chordEnergyFactor * 0.94;
      }

      // Struny basowe mają większą masę i wybrzmiewają dłużej niż wioliny
      const stringDuration = baseDuration + (len - 1 - stringIdx) * 0.16;
      this.playSingleNote(noteName, noteTime, volume, stringDuration);
    });
  }

  /**
   * Gra szarpniętą strunę o określonej częstotliwości w Hz (dla zachowania zgodności).
   */
  public playPluckedFrequency(freq: number, startTime?: number): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;
    const midi = frequencyToMidi(freq);
    const targetFreq = midiToFrequency(midi);
    const now = Math.max(this.ctx.currentTime, startTime ?? this.ctx.currentTime);

    const { sampleName, pitchRatio, targetMidi } = normalizePitchToSample(sampleNameFromMidi(midi));
    const sampleBuffer = this.buffers.get(sampleName);

    if (sampleBuffer) {
      this.playBufferSource(sampleBuffer, pitchRatio, now);
      return;
    }

    const nearest = this.findNearestLoadedBuffer(targetMidi);
    if (nearest) {
      this.playBufferSource(nearest.buffer, nearest.pitchRatio, now);
      return;
    }

    // Karplus-Strong fallback
    this.playKsPluck(targetFreq, now);
  }

  private playSingleNote(pitch: string, time: number, volume = 0.5, duration = 2.2): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;

    const { sampleName, pitchRatio, targetMidi } = normalizePitchToSample(pitch);
    const sampleBuffer = this.buffers.get(sampleName);

    if (sampleBuffer) {
      // 1. Prawdziwa studyjna próbka gitary akustycznej
      this.playBufferSource(sampleBuffer, pitchRatio, time, volume, duration);
      return;
    }

    // Jeśli próbka nie jest jeszcze w pamięci, zaplanuj jej załadowanie
    void this.loadSample(sampleName);

    // 2. Jeśli mamy jakąkolwiek załadowaną próbkę gitary akustycznej, użyj najbliższej wysokością
    // i przestrój ją (pitch-shift) - dzięki temu ZAWSZE brzmi prawdziwa gitara akustyczna!
    const nearest = this.findNearestLoadedBuffer(targetMidi);
    if (nearest) {
      this.playBufferSource(nearest.buffer, nearest.pitchRatio, time, volume, duration);
      return;
    }

    // 3. Realistyczny fizyczny model struny Karplus-Strong
    const freq = midiToFrequency(targetMidi);
    this.playKsPluck(freq, time, volume, duration);
  }

  /**
   * Płynnie wygasza wcześniej wybrzmiewające struny przy zmianie chwytu (fret-hand muting),
   * zapobiegając nakładaniu się dysonansowych tonów z poprzednich akordów.
   */
  public dampPreviousVoices(dampingTime = 0.045): void {
    if (!this.ctx || this.activeVoices.size === 0) return;
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        if (typeof voice.gain.gain.setTargetAtTime === 'function') {
          voice.gain.gain.setTargetAtTime(0.0001, now, dampingTime * 0.45);
        } else {
          voice.gain.gain.linearRampToValueAtTime(0.0001, now + dampingTime);
        }
        voice.source.stop(now + dampingTime + 0.02);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Znajduje najbliższą wysokością załadowaną w pamięci próbkę gitary akustycznej
   * i oblicza współczynnik przestrajania pitchRatio.
   */
  public findNearestLoadedBuffer(targetMidi: number): { buffer: AudioBuffer; pitchRatio: number } | null {
    if (this.buffers.size === 0) return null;

    let bestDiff = Infinity;
    let bestBuffer: AudioBuffer | null = null;
    let bestMidi = 69;

    for (const [name, buf] of this.buffers.entries()) {
      const sMidi = pitchNameToMidi(name);
      const diff = Math.abs(targetMidi - sMidi);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestBuffer = buf;
        bestMidi = sMidi;
        if (diff === 0) break;
      }
    }

    if (!bestBuffer) return null;
    const pitchRatio = Math.pow(2, (targetMidi - bestMidi) / 12);
    return { buffer: bestBuffer, pitchRatio };
  }

  private enforcePolyphonyLimit(): void {
    while (this.activeVoices.size >= this.maxPolyphony && this.ctx) {
      const oldest = this.activeVoices.values().next().value;
      if (!oldest) break;
      this.activeVoices.delete(oldest);
      try {
        const now = this.ctx.currentTime;
        oldest.gain.gain.cancelScheduledValues(now);
        oldest.gain.gain.linearRampToValueAtTime(0.0001, now + 0.01);
        oldest.source.stop(now + 0.015);
        setTimeout(() => {
          try {
            oldest.source.disconnect();
            oldest.gain.disconnect();
          } catch {
            // ignore
          }
        }, 20);
      } catch {
        // ignore
      }
    }
  }

  private playBufferSource(
    buffer: AudioBuffer,
    pitchRatio: number,
    time: number,
    volume = 0.5,
    duration = 2.2,
  ): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;

    try {
      this.enforcePolyphonyLimit();

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const safePitch = Math.max(0.35, Math.min(3.0, pitchRatio));
      if (source.playbackRate) {
        source.playbackRate.setValueAtTime(safePitch, time);
      }

      const startTime = Math.max(this.ctx.currentTime, time);
      const gain = this.ctx.createGain();
      const safeVol = Math.max(0.01, volume);

      // Naturalny, sprężysty profil wybrzmiewania stalowej struny akustycznej:
      // 1. Transient ataku kostki (0 .. 4ms)
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(safeVol, startTime + 0.004);
      // 2. Szybki spadek początkowy (tłumienie początkowego uderzenia kostki, przejście w drganie swobodne)
      if (typeof gain.gain.setTargetAtTime === 'function') {
        gain.gain.setTargetAtTime(safeVol * 0.45, startTime + 0.015, 0.14);
        gain.gain.setTargetAtTime(0.0001, startTime + 0.35, Math.max(0.35, duration * 0.4));
      } else {
        gain.gain.linearRampToValueAtTime(safeVol * 0.45, startTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      }

      source.connect(gain);
      gain.connect(this.outputNode);

      const voice = { source, gain };
      this.activeVoices.add(voice);
      source.start(startTime);
      source.stop(startTime + duration + 0.05);

      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
        this.activeVoices.delete(voice);
      };
    } catch {
      // ignore
    }
  }

  private playKsPluck(freq: number, time: number, volume = 0.48, duration = 1.8): void {
    if (!this.ctx || !this.outputNode || this.disposed) return;

    try {
      this.enforcePolyphonyLimit();

      const ksBuffer = this.getOrCreateKsBuffer(freq);
      if (!ksBuffer) return;

      const source = this.ctx.createBufferSource();
      source.buffer = ksBuffer;

      const startTime = Math.max(this.ctx.currentTime, time);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(Math.max(0.01, volume), startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      source.connect(gain);
      gain.connect(this.outputNode);

      const voice = { source, gain };
      this.activeVoices.add(voice);
      source.start(startTime);
      source.stop(startTime + duration + 0.05);

      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
        this.activeVoices.delete(voice);
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
        voice.source.stop();
        voice.source.disconnect();
        voice.gain.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeVoices.clear();

    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch {
        // ignore
      }
      this.outputGain = null;
    }

    if (this.stringPresenceFilter) {
      try {
        this.stringPresenceFilter.disconnect();
      } catch {
        // ignore
      }
      this.stringPresenceFilter = null;
    }
    if (this.bodyMidFilter) {
      try {
        this.bodyMidFilter.disconnect();
      } catch {
        // ignore
      }
      this.bodyMidFilter = null;
    }
    if (this.bodyLowFilter) {
      try {
        this.bodyLowFilter.disconnect();
      } catch {
        // ignore
      }
      this.bodyLowFilter = null;
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
