import midiCharts from './guitarMidiCharts.json';

/**
 * CampfireGuitarGame — Rytmiczna mini-gra na gitarze akustycznej przy ognisku
 * („Guitar Hero Pol'and'Rock Edition”).
 * Gracz uderza w struny (klawisze D, F, J, K / 1, 2, 3, 4) w rytm klasycznych
 * festiwalowych utworów (Dżem, Kult, Budka Suflera, Tadeusz Woźniak).
 */

export interface GuitarNote {
  id: string;
  lane: 0 | 1 | 2 | 3 | 4; // 5 ścieżek (A, S, D, F, G)
  time: number; // czas pojawienia się w sekundach od startu
  chordName: string;
  hit?: boolean;
  rating?: 'perfect' | 'good' | 'miss';
}

export interface GuitarSong {
  license?: string;
  source?: string;
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: number; // sekundy
  difficulty: 'Łatwy' | 'Średni' | 'Trudny';
  chords: string[];
  notes: GuitarNote[];
}

export interface HitResult {
  rating: 'perfect' | 'good' | 'miss' | 'none';
  lane: number;
  scoreAwarded: number;
  combo: number;
  multiplier: number;
  chordName?: string;
}

export interface GuitarHudState {
  active: boolean;
  phase: 'idle' | 'song_select' | 'playing' | 'song_finished';
  currentSong?: {
    id: string;
    title: string;
    artist: string;
    duration: number;
  };
  currentTime: number;
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  cheerLevel: number; // 0.0 .. 1.0
  activeNotes: Array<{
    id: string;
    lane: number;
    progress: number; // 0.0 (góra gryfu) .. 1.0 (linia uderzenia)
    chordName: string;
  }>;
  lastFeedback?: {
    text: string;
    color: string;
    timestamp: number;
  };
  stats?: {
    perfectHits: number;
    goodHits: number;
    misses: number;
    accuracyPercent: number;
    finalScore: number;
  };
}

export interface CampfireGuitarCallbacks {
  onSongFinished?: (stats: NonNullable<GuitarHudState['stats']>) => void;
  onCheerChange?: (cheerLevel: number) => void;
  onToast?: (msg: string) => void;
  onPlayChord?: (chordName: string) => void;
  onMissSfx?: () => void;
  onCrowdCheerSfx?: () => void;
}

// Częstotliwości strun akordów (w Hz) dla syntezy Web Audio
export const GUITAR_CHORD_FREQUENCIES: Record<string, number[]> = {
  // A-dur: A2, E3, A3, C#4, E4
  A: [110.0, 164.81, 220.0, 277.18, 329.63],
  // C#m: C#3, G#3, C#4, E4, G#4
  'C#m': [138.59, 207.65, 277.18, 329.63, 415.3],
  // D-dur: D3, A3, D4, F#4
  D: [146.83, 220.0, 293.66, 369.99],
  // E-dur: E2, B2, E3, G#3, B3, E4
  E: [82.41, 123.47, 164.81, 207.65, 246.94, 329.63],
  // E-moll: E2, B2, E3, G3, B3, E4
  Em: [82.41, 123.47, 164.81, 196.0, 246.94, 329.63],
  // C-dur: C3, E3, G3, C4, E4
  C: [130.81, 164.81, 196.0, 261.63, 329.63],
  // G-dur: G2, B2, D3, G3, B3, G4
  G: [98.0, 123.47, 146.83, 196.0, 246.94, 392.0],
  // A-moll: A2, E3, A3, C4, E4
  Am: [110.0, 164.81, 220.0, 261.63, 329.63],
  // F-dur: F2, C3, F3, A3, C4
  F: [87.31, 130.81, 174.61, 220.0, 261.63],
  // D-moll: D3, A3, D4, F4
  Dm: [146.83, 220.0, 293.66, 349.23],
};

/**
 * Web Audio syntezator gitary akustycznej Karplus-Strong / addytywnego wybrzmiewania
 */
export class CampfireGuitarSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private backingGain: GainNode | null = null;
  private backingActive = false;
  private lastBackingStep = -1;

  constructor(audioContext?: AudioContext) {
    if (audioContext) {
      this.init(audioContext);
    }
  }

  public init(context?: AudioContext): void {
    if (this.ctx) return;
    if (!context) {
      if (typeof window === 'undefined') return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        context = new AudioCtx();
      } catch {
        return;
      }
    }
    this.ctx = context;
    try {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);

      this.backingGain = this.ctx.createGain();
      this.backingGain.gain.value = 0.22;
      this.backingGain.connect(this.masterGain);
    } catch {
      // AudioContext może być wyciszony lub zawieszony
    }
  }

  /**
   * Rozpoczyna ciągły akompaniament (podkład w stylu Guitar Hero)
   */
  public startBackingTrack(_bpm: number, _chords: string[]): void {
    if (!this.ctx || !this.masterGain) {
      this.init();
      if (!this.ctx || !this.masterGain) return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.backingActive = true;
    this.lastBackingStep = -1;
  }

  /**
   * Zatrzymuje akompaniament
   */
  public stopBackingTrack(): void {
    this.backingActive = false;
    this.lastBackingStep = -1;
  }

  /**
   * Aktualizuje podkład muzyczny zsynchronizowany z rytmem utworu
   */
  public updateBackingTrack(currentTime: number, bpm: number, chords: string[]): void {
    if (!this.backingActive || !this.ctx || !this.backingGain || chords.length === 0) return;
    if (this.ctx.state === 'suspended') return;

    const beatDuration = 60 / bpm;
    const stepDuration = beatDuration * 0.5; // Krok ósemkowy
    const currentStep = Math.floor(currentTime / stepDuration);

    if (this.lastBackingStep < 0) {
      this.lastBackingStep = currentStep - 1;
    }

    if (currentStep <= this.lastBackingStep) return;

    const stepsToPlay = Math.min(currentStep - this.lastBackingStep, 8);
    for (let i = 1; i <= stepsToPlay; i++) {
      const step = this.lastBackingStep + i;
      const barIndex = Math.floor(step / 8);
      const chord = chords[barIndex % chords.length] || 'A';
      const stepInBar = step % 8; // 0..7
      const now = this.ctx.currentTime + (step * stepDuration - currentTime);
      const scheduleTime = Math.max(this.ctx.currentTime, now);

      this.playBackingStep(chord, stepInBar, scheduleTime);
    }
    this.lastBackingStep = currentStep;
  }

  private playBackingStep(chord: string, stepInBar: number, time: number): void {
    if (!this.ctx || !this.backingGain) return;

    try {
      // 1. Bas akustyczny na mocne części taktu (kroki 0 i 4 = bity 1 i 3)
      if (stepInBar === 0 || stepInBar === 4) {
        const freqs = GUITAR_CHORD_FREQUENCIES[chord] || [110, 164, 220];
        const bassFreq = Math.max(55, freqs[0] * 0.5);

        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassFreq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(240, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(0.22, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.backingGain);

        osc.start(time);
        osc.stop(time + 0.4);
      }

      // 2. Ciepły akompaniament akordowy na bicie (kroki 2 i 6)
      if (stepInBar === 2 || stepInBar === 6) {
        const freqs = GUITAR_CHORD_FREQUENCIES[chord] || [220, 277, 330];
        const strumFreqs = freqs.slice(0, 3);

        strumFreqs.forEach((freq, idx) => {
          const strumTime = time + idx * 0.01;
          const osc = this.ctx!.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, strumTime);

          const filter = this.ctx!.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1100, strumTime);
          filter.frequency.exponentialRampToValueAtTime(350, strumTime + 0.22);

          const gain = this.ctx!.createGain();
          gain.gain.setValueAtTime(0.001, strumTime);
          gain.gain.linearRampToValueAtTime(0.065, strumTime + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.001, strumTime + 0.24);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.backingGain!);

          osc.start(strumTime);
          osc.stop(strumTime + 0.26);
        });
      }

      // 3. Delikatny shaker/tupanie rytmiczne przy ognisku na każdej ósemce
      const bufSize = Math.floor(this.ctx.sampleRate * 0.035);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufSize; j++) {
        data[j] = (Math.random() * 2 - 1) * (stepInBar % 2 === 0 ? 0.25 : 0.14);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const pFilter = this.ctx.createBiquadFilter();
      pFilter.type = 'highpass';
      pFilter.frequency.setValueAtTime(3200, time);

      const pGain = this.ctx.createGain();
      pGain.gain.setValueAtTime(0.025, time);
      pGain.gain.exponentialRampToValueAtTime(0.001, time + 0.032);

      noise.connect(pFilter);
      pFilter.connect(pGain);
      pGain.connect(this.backingGain);

      noise.start(time);
      noise.stop(time + 0.035);
    } catch {
      // AudioContext safety
    }
  }

  /**
   * Gra partię solową / akord przy celnym uderzeniu nuty na danym torze
   */
  public playChord(chordName: string, lane?: number): void {
    if (!this.ctx || !this.masterGain) {
      this.init();
      if (!this.ctx || !this.masterGain) return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const pitch = /^([A-G])(#?)(\d)$/.exec(chordName);
    const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const midi = pitch ? (Number(pitch[3]) + 1) * 12 + semitones[pitch[1]] + (pitch[2] ? 1 : 0) : undefined;
    let freqs: number[];
    if (midi !== undefined) {
      freqs = [440 * Math.pow(2, (midi - 69) / 12)];
    } else {
      const chordFreqs = GUITAR_CHORD_FREQUENCIES[chordName] || [220, 330, 440];
      if (lane !== undefined && lane >= 0 && lane < chordFreqs.length) {
        freqs = [chordFreqs[lane]];
      } else {
        freqs = chordFreqs;
      }
    }
    const now = this.ctx.currentTime;

    freqs.forEach((freq, idx) => {
      // Symulacja szarpnięcia struny: lekki offset w czasie (ok. 12ms per struna)
      const strumTime = now + idx * 0.012;
      this.playPluckedString(freq, strumTime);
    });
  }

  private playPluckedString(freq: number, startTime: number): void {
    if (!this.ctx || !this.masterGain) return;

    try {
      // Oscylator podstawowy (triangle + lekki sawtooth dla bogatych tonów pudła)
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      // Filtr dolnoprzepustowy symulujący tłumienie drewna i strun
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 5.0, startTime);
      filter.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 1.3), startTime + 1.2);

      // Obwiednia głośności (szybki atak, naturalne wybrzmienie)
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.24, startTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 1.85);

      // Sprzątanie węzłów
      setTimeout(() => {
        try {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      }, 2000);
    } catch {
      // ignore
    }
  }

  /**
   * Zły ton przy pudle (tłumiony dysonans)
   */
  public playMissBuzz(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.15);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // ignore
    }
  }

  /**
   * Okrzyki i oklaski tłumu festiwalowego przy ognisku
   */
  public playCrowdCheer(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.2);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 1.25);
    } catch {
      // ignore
    }
  }

  public dispose(): void {
    this.stopBackingTrack();
    if (this.ctx) {
      try {
        if (this.backingGain) this.backingGain.disconnect();
        if (this.masterGain) this.masterGain.disconnect();
        if (this.ctx.state !== 'closed') void this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
      this.masterGain = null;
      this.backingGain = null;
    }
  }
}

/**
 * Generator nut dla utworów
 */
function createSongNotes(
  bpm: number,
  chords: string[],
  bars: number,
  difficulty: 'Łatwy' | 'Średni' | 'Trudny' = 'Średni',
): GuitarNote[] {
  const notes: GuitarNote[] = [];
  const beatDuration = 60 / bpm;
  let noteIndex = 0;

  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length];
    // Dynamiczny podział rytmiczny w zależności od poziomu trudności
    let beatsInBar: number[];
    if (difficulty === 'Łatwy') {
      beatsInBar = [0, 1, 2, 3];
    } else if (difficulty === 'Średni') {
      beatsInBar = [0, 1, 1.5, 2, 2.5, 3, 3.5];
    } else {
      // Trudny: rockowy groove, synkopy i gęstsze przejścia
      beatsInBar = [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 3, 3.5];
    }

    for (let b = 0; b < beatsInBar.length; b++) {
      const time = (bar * 4 + beatsInBar[b]) * beatDuration + 1.2;
      // Rozprowadzenie po 5 torach (0..4: A, S, D, F, G)
      let lane: 0 | 1 | 2 | 3 | 4;
      if (difficulty === 'Łatwy') {
        lane = ((bar + b) % 5) as 0 | 1 | 2 | 3 | 4;
      } else if (difficulty === 'Średni') {
        const pattern = [0, 1, 2, 3, 4, 3, 2, 1];
        lane = pattern[(bar * 2 + b) % pattern.length] as 0 | 1 | 2 | 3 | 4;
      } else {
        const hardPattern = [0, 2, 4, 1, 3, 4, 2, 0, 3];
        lane = hardPattern[(bar * 3 + b) % hardPattern.length] as 0 | 1 | 2 | 3 | 4;
      }

      notes.push({
        id: `note_${bar}_${b}_${noteIndex++}`,
        lane,
        time,
        chordName: chord,
      });
    }
  }
  return notes;
}

export const FESTIVAL_GUITAR_SONGS: GuitarSong[] = [
  ...(midiCharts as GuitarSong[]),
  {
    id: 'wehikul',
    title: 'Ogniskowy rock — ćwiczenie akordów',
    artist: 'Ćwiczenie autorskie, bez nagrania',
    bpm: 100,
    duration: 32,
    difficulty: 'Średni',
    chords: ['A', 'C#m', 'D', 'E'],
    notes: createSongNotes(100, ['A', 'C#m', 'D', 'E'], 12, 'Średni'),
  },
  {
    id: 'arahja',
    title: 'Ogniskowy puls — riff rockowy',
    artist: 'Ćwiczenie autorskie, bez nagrania',
    bpm: 125,
    duration: 30,
    difficulty: 'Trudny',
    chords: ['Em', 'C', 'G', 'D'],
    notes: createSongNotes(125, ['Em', 'C', 'G', 'D'], 14, 'Trudny'),
  },
  {
    id: 'jolka',
    title: 'Ballada — ćwiczenie akordów',
    artist: 'Ćwiczenie autorskie, bez nagrania',
    bpm: 85,
    duration: 34,
    difficulty: 'Łatwy',
    chords: ['C', 'G', 'Am', 'F'],
    notes: createSongNotes(85, ['C', 'G', 'Am', 'F'], 11, 'Łatwy'),
  },
  {
    id: 'zegarmistrz',
    title: 'Wieczorny rytm — wirtuozerski sweep',
    artist: 'Ćwiczenie autorskie, bez nagrania',
    bpm: 110,
    duration: 30,
    difficulty: 'Trudny',
    chords: ['Dm', 'G', 'C', 'Am'],
    notes: createSongNotes(110, ['Dm', 'G', 'C', 'Am'], 13, 'Trudny'),
  },
].map((song) => ({
  ...song,
  difficulty: song.difficulty as GuitarSong['difficulty'],
  duration: Math.max(song.duration, song.notes.at(-1)!.time + 3),
}));

export const NOTE_FALL_SPEED = 2.0; // Sekundy na przebycie od góry gryfu do linii uderzenia
export const PERFECT_WINDOW = 0.09; // Sekundy dopuszczalnego błędu dla Perfect
export const GOOD_WINDOW = 0.22; // Sekundy dopuszczalnego błędu dla Good
export const HITTABLE_WINDOW = 0.35; // Sekundy okna reakcji

export class CampfireGuitarGame {
  private phase: GuitarHudState['phase'] = 'idle';
  private currentSong: GuitarSong | null = null;
  private currentTime = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private multiplier = 1;
  private cheerLevel = 0.2;
  private perfectHits = 0;
  private goodHits = 0;
  private misses = 0;
  private lastFeedback?: GuitarHudState['lastFeedback'];
  private callbacks?: CampfireGuitarCallbacks;
  private readonly synth: CampfireGuitarSynth;

  constructor(callbacks?: CampfireGuitarCallbacks, synth?: CampfireGuitarSynth) {
    this.callbacks = callbacks;
    this.synth = synth ?? new CampfireGuitarSynth();
  }

  public setCallbacks(callbacks: CampfireGuitarCallbacks): void {
    this.callbacks = callbacks;
  }

  public getPhase(): GuitarHudState['phase'] {
    return this.phase;
  }

  public getAvailableSongs(): GuitarSong[] {
    return [...FESTIVAL_GUITAR_SONGS];
  }

  public openSongSelect(): void {
    this.phase = 'song_select';
  }

  public startSong(songId: string): boolean {
    const song = FESTIVAL_GUITAR_SONGS.find((s) => s.id === songId);
    if (!song) return false;

    // Głęboka kopia nut
    this.currentSong = {
      ...song,
      notes: song.notes.map((n) => ({ ...n, hit: false, rating: undefined })),
    };
    this.phase = 'playing';
    this.currentTime = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.cheerLevel = 0.35;
    this.perfectHits = 0;
    this.goodHits = 0;
    this.misses = 0;
    this.lastFeedback = undefined;

    this.callbacks?.onToast?.(`🎸 ZACZYNAMY: „${song.title}”! Uderzaj klawisze [A, S, D, F, G] na linii ognia!`);
    this.synth.startBackingTrack(song.bpm, song.chords);
    return true;
  }

  public stopSong(): void {
    this.synth.stopBackingTrack();
    this.phase = 'idle';
    this.currentSong = null;
    this.currentTime = 0;
    this.lastFeedback = undefined;
  }

  /**
   * Obsługuje naciśnięcie ścieżki (lane 0, 1, 2, 3, 4)
   */
  public hitLane(lane: number, forcedTime?: number): HitResult {
    if (this.phase !== 'playing' || !this.currentSong) {
      return { rating: 'none', lane, scoreAwarded: 0, combo: this.combo, multiplier: this.multiplier };
    }

    const t = forcedTime ?? this.currentTime;

    // Szukamy najbliższej nieuderzonej nuty na tej ścieżce w oknie trafienia
    const candidate = this.currentSong.notes.find(
      (n) => n.lane === lane && !n.hit && Math.abs(n.time - t) <= HITTABLE_WINDOW,
    );

    if (!candidate) {
      // Wciśnięcie w pustkę – brak nuty
      this.combo = 0;
      this.multiplier = 1;
      this.misses++;
      this.cheerLevel = Math.max(0, this.cheerLevel - 0.08);
      this.lastFeedback = { text: 'PUDŁO!', color: '#ef4444', timestamp: performance.now() };
      this.synth.playMissBuzz();
      this.callbacks?.onMissSfx?.();
      return { rating: 'miss', lane, scoreAwarded: 0, combo: 0, multiplier: 1 };
    }

    const diff = Math.abs(candidate.time - t);
    candidate.hit = true;

    if (diff <= PERFECT_WINDOW) {
      candidate.rating = 'perfect';
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.updateMultiplier();
      const points = 100 * this.multiplier;
      this.score += points;
      this.perfectHits++;
      this.cheerLevel = Math.min(1.0, this.cheerLevel + 0.06);
      this.lastFeedback = { text: 'IDEALNIE! ✨', color: '#22c55e', timestamp: performance.now() };

      this.synth.playChord(candidate.chordName, candidate.lane);
      this.callbacks?.onPlayChord?.(candidate.chordName);

      if (this.combo === 10 || this.combo === 20) {
        this.synth.playCrowdCheer();
        this.callbacks?.onCrowdCheerSfx?.();
        this.callbacks?.onToast?.(`🔥 COMBO x${this.combo}! Ognisko płonie z zachwytu!`);
      }

      return {
        rating: 'perfect',
        lane,
        scoreAwarded: points,
        combo: this.combo,
        multiplier: this.multiplier,
        chordName: candidate.chordName,
      };
    } else if (diff <= GOOD_WINDOW) {
      candidate.rating = 'good';
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.updateMultiplier();
      const points = 50 * this.multiplier;
      this.score += points;
      this.goodHits++;
      this.cheerLevel = Math.min(1.0, this.cheerLevel + 0.03);
      this.lastFeedback = { text: 'DOBRZE! 🎵', color: '#eab308', timestamp: performance.now() };

      this.synth.playChord(candidate.chordName, candidate.lane);
      this.callbacks?.onPlayChord?.(candidate.chordName);

      return {
        rating: 'good',
        lane,
        scoreAwarded: points,
        combo: this.combo,
        multiplier: this.multiplier,
        chordName: candidate.chordName,
      };
    } else {
      candidate.rating = 'miss';
      this.combo = 0;
      this.multiplier = 1;
      this.misses++;
      this.cheerLevel = Math.max(0, this.cheerLevel - 0.08);
      this.lastFeedback = { text: 'PUDŁO! 💥', color: '#ef4444', timestamp: performance.now() };
      this.synth.playMissBuzz();
      this.callbacks?.onMissSfx?.();

      return { rating: 'miss', lane, scoreAwarded: 0, combo: 0, multiplier: 1 };
    }
  }

  private updateMultiplier(): void {
    if (this.combo >= 20) {
      this.multiplier = 4;
    } else if (this.combo >= 10) {
      this.multiplier = 3;
    } else if (this.combo >= 5) {
      this.multiplier = 2;
    } else {
      this.multiplier = 1;
    }
  }

  public update(dt: number): void {
    if (this.phase !== 'playing' || !this.currentSong) return;

    this.currentTime += dt;
    this.synth.updateBackingTrack(this.currentTime, this.currentSong.bpm, this.currentSong.chords);

    // Sprawdzanie nut, które minęły linię uderzenia bez reakcji gracza
    for (const note of this.currentSong.notes) {
      if (!note.hit && this.currentTime - note.time > HITTABLE_WINDOW) {
        note.hit = true;
        note.rating = 'miss';
        if (this.combo > 0) {
          this.combo = 0;
          this.multiplier = 1;
          this.lastFeedback = { text: 'MINIĘTO! ❌', color: '#ef4444', timestamp: performance.now() };
        }
        this.misses++;
        this.cheerLevel = Math.max(0, this.cheerLevel - 0.05);
      }
    }

    // Subtelny spadek nastroju z czasem
    this.cheerLevel = Math.max(0.1, this.cheerLevel - dt * 0.015);
    this.callbacks?.onCheerChange?.(this.cheerLevel);

    // Koniec utworu
    if (this.currentTime >= this.currentSong.duration) {
      this.finishSong();
    }
  }

  private finishSong(): void {
    this.synth.stopBackingTrack();
    this.phase = 'song_finished';
    const totalNotes = this.perfectHits + this.goodHits + this.misses;
    const accuracyPercent =
      totalNotes > 0 ? Math.round(((this.perfectHits + this.goodHits * 0.7) / totalNotes) * 100) : 0;

    const stats: NonNullable<GuitarHudState['stats']> = {
      perfectHits: this.perfectHits,
      goodHits: this.goodHits,
      misses: this.misses,
      accuracyPercent,
      finalScore: this.score,
    };

    if (accuracyPercent >= 60) {
      this.synth.playCrowdCheer();
      this.callbacks?.onCrowdCheerSfx?.();
      this.callbacks?.onToast?.(
        `🎉 BRAWO! Ukończono utwór „${this.currentSong?.title}”! Wynik: ${this.score} pkt (${accuracyPercent}% trafień)!`,
      );
    } else {
      this.callbacks?.onToast?.(`👏 Koniec utworu. Wynik: ${this.score} pkt. Poćwicz jeszcze przy ognisku!`);
    }

    this.callbacks?.onSongFinished?.(stats);
  }

  public getHudState(): GuitarHudState {
    const activeNotes: GuitarHudState['activeNotes'] = [];

    if (this.phase === 'playing' && this.currentSong) {
      for (const note of this.currentSong.notes) {
        if (note.hit) continue;
        const timeDiff = note.time - this.currentTime;
        // Pokazujemy nuty, które są w oknie spadania (od góry NOTE_FALL_SPEED do linii 0)
        if (timeDiff <= NOTE_FALL_SPEED && timeDiff >= -HITTABLE_WINDOW) {
          const progress = 1.0 - timeDiff / NOTE_FALL_SPEED;
          activeNotes.push({
            id: note.id,
            lane: note.lane,
            progress: Math.max(0, Math.min(1.2, progress)),
            chordName: note.chordName,
          });
        }
      }
    }

    const totalNotes = this.perfectHits + this.goodHits + this.misses;
    const accuracyPercent =
      totalNotes > 0 ? Math.round(((this.perfectHits + this.goodHits * 0.7) / totalNotes) * 100) : 0;

    return {
      active: this.phase !== 'idle',
      phase: this.phase,
      currentSong: this.currentSong
        ? {
            id: this.currentSong.id,
            title: this.currentSong.title,
            artist: this.currentSong.artist,
            duration: this.currentSong.duration,
          }
        : undefined,
      currentTime: this.currentTime,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.multiplier,
      cheerLevel: this.cheerLevel,
      activeNotes,
      lastFeedback: this.lastFeedback,
      stats:
        this.phase === 'song_finished'
          ? {
              perfectHits: this.perfectHits,
              goodHits: this.goodHits,
              misses: this.misses,
              accuracyPercent,
              finalScore: this.score,
            }
          : undefined,
    };
  }

  public dispose(): void {
    this.synth.dispose();
    this.phase = 'idle';
    this.currentSong = null;
  }
}
