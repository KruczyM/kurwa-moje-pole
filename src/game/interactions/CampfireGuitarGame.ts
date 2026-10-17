import midiCharts from './guitarMidiCharts.json';
import { CampfireGuitarSampler } from '../audio/CampfireGuitarSampler';

/**
 * CampfireGuitarGame — Rytmiczna mini-gra na gitarze akustycznej przy ognisku
 * („Guitar Hero Pol'and'Rock Edition”).
 * Gracz uderza w struny (klawisze A, S, D, F, G / 1, 2, 3, 4, 5) w rytm klasycznych
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
  audioBackingUrl?: string;
  audioBackingOffset?: number;
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
    audioBackingUrl?: string;
    audioBackingOffset?: number;
    chords?: string[];
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
  // H7 / B7: B2, D#3, A3, B3, F#4
  H7: [123.47, 155.56, 220.0, 246.94, 369.99],
  B7: [123.47, 155.56, 220.0, 246.94, 369.99],
};

export function guitarFrequencies(name: string): number[] {
  const pitch = /^([A-G])(#?)(-?\d)$/.exec(name);
  if (!pitch) return GUITAR_CHORD_FREQUENCIES[name] || [220, 330, 440];
  const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (Number(pitch[3]) + 1) * 12 + semitones[pitch[1]] + (pitch[2] ? 1 : 0);
  return [440 * Math.pow(2, (midi - 69) / 12)];
}

/**
 * Web Audio syntezator gitary akustycznej Karplus-Strong / addytywnego wybrzmiewania
 */
export class CampfireGuitarSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private backingGain: GainNode | null = null;
  private guitarGain: GainNode | null = null;
  private guitarHpf: BiquadFilterNode | null = null;
  private guitarComp: DynamicsCompressorNode | null = null;
  private backingActive = false;
  private lastBackingStep = -1;
  private readonly backingVoices = new Set<AudioScheduledSourceNode>();
  private shakerBuffer: AudioBuffer | null = null;
  private backingAudio: HTMLAudioElement | null = null;
  private backingAudioSource: MediaElementAudioSourceNode | null = null;
  private hasActiveAudioTrack = false;
  private readonly sampler: CampfireGuitarSampler;

  constructor(audioContext?: AudioContext, sampler?: CampfireGuitarSampler) {
    this.sampler = sampler ?? new CampfireGuitarSampler();
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
      this.masterGain.gain.value = 0.72;
      this.masterGain.connect(this.ctx.destination);

      this.backingGain = this.ctx.createGain();
      this.backingGain.gain.value = 0.70;
      this.backingGain.connect(this.masterGain);

      this.guitarGain = this.ctx.createGain();
      this.guitarGain.gain.value = 0.32; // Zrównoważony poziom gitary w miksie z podkładem

      // Filtr górnoprzepustowy (High-Pass 95 Hz) - odcina sub-dudnienie pudła,
      // dzięki czemu struny nie kolidują z basem i stopą w podkładzie
      if (typeof this.ctx.createBiquadFilter === 'function') {
        this.guitarHpf = this.ctx.createBiquadFilter();
        this.guitarHpf.type = 'highpass';
        this.guitarHpf.frequency.value = 95;
        this.guitarHpf.Q.value = 0.707;
      }

      // Kompresor dynamiki gitary akustycznej (mix glue) -
      // wkleja gitarę w podkład, stabilizuje energię bicia i eliminuje nieprzyjemne skoki głośności
      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        this.guitarComp = this.ctx.createDynamicsCompressor();
        this.guitarComp.threshold.value = -16;
        this.guitarComp.knee.value = 8;
        this.guitarComp.ratio.value = 3.2;
        this.guitarComp.attack.value = 0.005;
        this.guitarComp.release.value = 0.12;
      }

      // Ścieżka sygnału: sampler -> guitarGain -> [guitarHpf -> guitarComp] -> masterGain
      let currentGuitarOut: AudioNode = this.guitarGain;
      if (this.guitarHpf) {
        currentGuitarOut.connect(this.guitarHpf);
        currentGuitarOut = this.guitarHpf;
      }
      if (this.guitarComp) {
        currentGuitarOut.connect(this.guitarComp);
        currentGuitarOut = this.guitarComp;
      }
      currentGuitarOut.connect(this.masterGain);

      this.sampler.init(this.ctx, this.guitarGain);
    } catch {
      // AudioContext może być wyciszony lub zawieszony
    }
  }

  /**
   * Rozpoczyna ciągły akompaniament (podkład w stylu Guitar Hero).
   * Jeśli podano audioUrl (i plik istnieje), odtwarzany jest prawdziwy podkład audio bez gitary.
   * startOffset określa punkt rozpoczęcia utworu w pliku audio (np. pomijając wielominutowe cisze lub dopasowując count-in).
   * W przeciwnym razie wykorzystywany jest syntetyczny podkład proceduralny.
   */
  public startBackingTrack(audioUrl?: string, startOffset = 0): void {
    if (!this.ctx || !this.masterGain) {
      this.init();
      if (!this.ctx || !this.masterGain) return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.backingActive = true;
    this.lastBackingStep = -1;
    this.hasActiveAudioTrack = false;

    if (audioUrl && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        if (!this.backingAudio) {
          this.backingAudio = new Audio();
          if (this.ctx && this.backingGain) {
            try {
              this.backingAudioSource = this.ctx.createMediaElementSource(this.backingAudio);
              this.backingAudioSource.connect(this.backingGain);
            } catch {
              this.backingAudio.volume = 0.45;
            }
          }
        }
        this.backingAudio.src = audioUrl;
        this.backingAudio.currentTime = Math.max(0, startOffset);
        const playPromise = this.backingAudio.play();
        if (playPromise) {
          playPromise
            .then(() => {
              this.hasActiveAudioTrack = true;
            })
            .catch(() => {
              // Plik audio nie został jeszcze wgrany (np. 404) — płynny fallback na syntezę
              this.hasActiveAudioTrack = false;
            });
        }
      } catch {
        this.hasActiveAudioTrack = false;
      }
    }
  }

  /**
   * Zwraca aktualny czas odtwarzania pliku audio, jeśli jest aktywny i odtwarzany
   */
  public getAudioCurrentTime(): number | null {
    if (this.hasActiveAudioTrack && this.backingAudio && !this.backingAudio.paused) {
      return this.backingAudio.currentTime;
    }
    return null;
  }

  /**
   * Zatrzymuje akompaniament
   */
  public stopBackingTrack(): void {
    this.backingActive = false;
    this.lastBackingStep = -1;
    this.hasActiveAudioTrack = false;
    if (this.backingAudio) {
      try {
        this.backingAudio.pause();
        this.backingAudio.currentTime = 0;
      } catch {
        // ignore
      }
    }
    for (const voice of this.backingVoices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
      voice.onended?.(new Event('ended'));
    }
    this.backingVoices.clear();
  }

  private trackBackingVoice(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    this.backingVoices.add(source);
    source.onended = () => {
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      this.backingVoices.delete(source);
      source.onended = null;
    };
  }

  /**
   * Aktualizuje podkład muzyczny zsynchronizowany z rytmem utworu
   */
  public updateBackingTrack(
    currentTime: number,
    bpm: number,
    chords: string[],
    melody?: readonly GuitarNote[],
  ): void {
    if (!this.backingActive || !this.ctx || !this.backingGain || chords.length === 0) return;
    if (this.hasActiveAudioTrack) return;
    if (this.ctx.state === 'suspended') return;
    if (!Number.isFinite(currentTime) || currentTime < 0 || !Number.isFinite(bpm) || bpm <= 0) return;

    const beatDuration = 60 / bpm;
    const stepDuration = beatDuration * 0.5; // Krok ósemkowy
    const currentStep = Math.floor(currentTime / stepDuration);

    if (this.lastBackingStep < 0) {
      this.lastBackingStep = currentStep - 1;
    }

    if (currentStep <= this.lastBackingStep) return;

    // Skip stale beats after a stalled frame instead of stacking eight sounds at once.
    const stepsToPlay = 1;
    this.lastBackingStep = currentStep - 1;
    for (let i = 1; i <= stepsToPlay; i++) {
      const step = this.lastBackingStep + i;
      const barIndex = Math.floor(step / 8);
      let chord = melody ? undefined : chords[barIndex % chords.length];
      if (melody) {
        for (let j = melody.length - 1; j >= 0; j--) {
          if (melody[j].time <= currentTime) {
            chord = melody[j].chordName;
            break;
          }
        }
      }
      if (!chord) continue;
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
      const freqs = guitarFrequencies(chord);
      const rootFreq = freqs[0] || 110;

      // 1. Kick Drum (stopa perkusyjna) na kroki 0 i 4 (bity 1 i 3)
      if (stepInBar === 0 || stepInBar === 4) {
        const kickOsc = this.ctx.createOscillator();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(130, time);
        kickOsc.frequency.exponentialRampToValueAtTime(42, time + 0.12);

        const kickGain = this.ctx.createGain();
        kickGain.gain.setValueAtTime(0.38, time);
        kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

        kickOsc.connect(kickGain);
        kickGain.connect(this.backingGain);
        this.trackBackingVoice(kickOsc, kickGain);

        kickOsc.start(time);
        kickOsc.stop(time + 0.24);
      }

      // 2. Snare / Handclap (werbel / klask) na kroki 2 i 6 (bity 2 i 4)
      if (stepInBar === 2 || stepInBar === 6) {
        // Ciało werbla (tonalne)
        const snareOsc = this.ctx.createOscillator();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(185, time);
        snareOsc.frequency.exponentialRampToValueAtTime(75, time + 0.06);

        const snareToneGain = this.ctx.createGain();
        snareToneGain.gain.setValueAtTime(0.18, time);
        snareToneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

        snareOsc.connect(snareToneGain);
        snareToneGain.connect(this.backingGain);
        this.trackBackingVoice(snareOsc, snareToneGain);

        snareOsc.start(time);
        snareOsc.stop(time + 0.09);

        // Szum werbla / klask
        const snareNoiseBufSize = Math.floor(this.ctx.sampleRate * 0.14);
        const snareBuf = this.ctx.createBuffer(1, snareNoiseBufSize, this.ctx.sampleRate);
        const snareData = snareBuf.getChannelData(0);
        for (let j = 0; j < snareNoiseBufSize; j++) snareData[j] = Math.random() * 2 - 1;

        const snareNoise = this.ctx.createBufferSource();
        snareNoise.buffer = snareBuf;

        const snareFilter = this.ctx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.setValueAtTime(1250, time);
        snareFilter.Q.setValueAtTime(1.2, time);

        const snareNoiseGain = this.ctx.createGain();
        snareNoiseGain.gain.setValueAtTime(0.24, time);
        snareNoiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

        snareNoise.connect(snareFilter);
        snareFilter.connect(snareNoiseGain);
        snareNoiseGain.connect(this.backingGain);
        this.trackBackingVoice(snareNoise, snareFilter, snareNoiseGain);

        snareNoise.start(time);
        snareNoise.stop(time + 0.15);
      }

      // 3. Hi-hat / Shaker na każdej ósemce (kroki 0..7) z akcentem na off-beaty
      const bufSize = Math.floor(this.ctx.sampleRate * 0.035);
      if (!this.shakerBuffer) {
        this.shakerBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = this.shakerBuffer.getChannelData(0);
        for (let j = 0; j < bufSize; j++) data[j] = Math.random() * 2 - 1;
      }
      const hatNoise = this.ctx.createBufferSource();
      hatNoise.buffer = this.shakerBuffer;

      const hatFilter = this.ctx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(5500, time);

      const isOffBeat = stepInBar % 2 === 1;
      const hatGain = this.ctx.createGain();
      hatGain.gain.setValueAtTime(isOffBeat ? 0.055 : 0.025, time);
      hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.032);

      hatNoise.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(this.backingGain);
      this.trackBackingVoice(hatNoise, hatFilter, hatGain);

      hatNoise.start(time);
      hatNoise.stop(time + 0.035);

      // 4. Linia basowa (ciepły bas elektryczny/akustyczny)
      if (stepInBar === 0 || stepInBar === 3 || stepInBar === 4 || stepInBar === 6) {
        let bassFreq = Math.max(45, rootFreq * 0.5);
        if (stepInBar === 4) {
          bassFreq = (freqs[1] || rootFreq * 1.5) * 0.5;
        } else if (stepInBar === 3 || stepInBar === 6) {
          bassFreq = Math.max(50, rootFreq * 0.5);
        }

        const bassOsc = this.ctx.createOscillator();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, time);

        const bassFilter = this.ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(220, time);

        const bassDur = stepInBar === 0 || stepInBar === 4 ? 0.42 : 0.22;
        const bassGain = this.ctx.createGain();
        bassGain.gain.setValueAtTime(0.001, time);
        bassGain.gain.linearRampToValueAtTime(0.25, time + 0.012);
        bassGain.gain.exponentialRampToValueAtTime(0.001, time + bassDur);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.backingGain);
        this.trackBackingVoice(bassOsc, bassFilter, bassGain);

        bassOsc.start(time);
        bassOsc.stop(time + bassDur + 0.02);
      }

      // 5. Ciepłe tło harmoniczne (Hammond Organ / Rhodes Pad — BEZ GITARY)
      // Daje pełne harmoniczne brzmienie utworu, pozostawiając całą partię gitary dla gracza
      if (stepInBar === 0 || stepInBar === 4) {
        const padChord = freqs.slice(0, 3);
        padChord.forEach((f) => {
          const padOsc = this.ctx!.createOscillator();
          padOsc.type = 'sine';
          padOsc.frequency.setValueAtTime(f, time);

          const padFilter = this.ctx!.createBiquadFilter();
          padFilter.type = 'lowpass';
          padFilter.frequency.setValueAtTime(480, time);

          const padGain = this.ctx!.createGain();
          padGain.gain.setValueAtTime(0.001, time);
          padGain.gain.linearRampToValueAtTime(0.042, time + 0.05);
          padGain.gain.exponentialRampToValueAtTime(0.001, time + 0.52);

          padOsc.connect(padFilter);
          padFilter.connect(padGain);
          padGain.connect(this.backingGain!);
          this.trackBackingVoice(padOsc, padFilter, padGain);

          padOsc.start(time);
          padOsc.stop(time + 0.55);
        });
      }
    } catch {
      // AudioContext safety
    }
  }

  /**
   * Gra partię solową / akord przy celnym uderzeniu nuty na danym torze
   * z użyciem autentycznych próbek dźwiękowych gitary akustycznej.
   */
  public playChord(chordName: string, lane?: number, songId?: string): void {
    if (!this.ctx || !this.masterGain) {
      this.init();
      if (!this.ctx || !this.masterGain) return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    this.sampler.playPlucked(chordName, now, lane, songId);
  }

  private playPluckedString(freq: number, startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    this.sampler.playPluckedFrequency(freq, startTime);
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
       gain.connect(this.guitarGain ?? this.masterGain);
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
    this.sampler.dispose();
    if (this.backingAudio) {
      try {
        this.backingAudio.pause();
        this.backingAudio.src = '';
      } catch {
        // ignore
      }
      this.backingAudio = null;
    }
    if (this.backingAudioSource) {
      try {
        this.backingAudioSource.disconnect();
      } catch {
        // ignore
      }
      this.backingAudioSource = null;
    }
    if (this.ctx) {
      try {
        if (this.backingGain) this.backingGain.disconnect();
        if (this.guitarGain) this.guitarGain.disconnect();
        if (this.guitarHpf) this.guitarHpf.disconnect();
        if (this.guitarComp) this.guitarComp.disconnect();
        if (this.masterGain) this.masterGain.disconnect();
        if (this.ctx.state !== 'closed') void this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
      this.masterGain = null;
      this.backingGain = null;
      this.guitarGain = null;
      this.guitarHpf = null;
      this.guitarComp = null;
      this.shakerBuffer = null;
    }
  }
}

const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

export const GUITAR_AUDIO_BACKING_MAP: Record<string, string> = {
  'czerwony-cegla-midi': 'game-assets/audio/guitar/czerwony-jak-cegla.mp3',
  'sen-victoria-midi': 'game-assets/audio/guitar/sen-o-victorii.mp3',
  'pila-tango-midi': 'game-assets/audio/guitar/pila-tango.mp3',
  'czarny-chleb-midi': 'game-assets/audio/guitar/czarny-chleb.mp3',
};

/**
 * Autentyczne chwyty gitarowe przypisane do 5 torów gryfu dla każdego utworu,
 * w 100% tożsame z tonacją i harmonicznym przebiegiem akordów oryginalnych utworów:
 * - Czarny chleb i czarna kawa (Strachy na Lachy, A-moll): Am, C, G, Dm, E
 * - Piła tango (Strachy na Lachy, A-moll): Am, Dm, E, C, G
 * - Sen o Victorii (Dżem, C-dur): C, F, Dm, G, Am
 * - Czerwony jak cegła (Dżem, E-dur blues): E, A, H7, D, C#m
 * - Zegarmistrz światła (Tadeusz Woźniak, A-moll): Am, G, D, C, Em
 */
export const SONG_LANE_CHORDS: Record<string, [string, string, string, string, string]> = {
  'czarny-chleb-midi': ['Am', 'C', 'G', 'Dm', 'E'],
  'pila-tango-midi': ['Am', 'Dm', 'E', 'C', 'G'],
  'sen-victoria-midi': ['C', 'F', 'Dm', 'G', 'Am'],
  'czerwony-cegla-midi': ['E', 'A', 'H7', 'D', 'C#m'],
  'zegarmistrz-midi': ['Am', 'G', 'D', 'C', 'Em'],
};

export const FESTIVAL_GUITAR_SONGS: GuitarSong[] = (midiCharts as GuitarSong[])
  .filter((song) => Boolean(GUITAR_AUDIO_BACKING_MAP[song.id]))
  .map((song) => {
    // MIDI vocal tracks can begin minutes into the source. Keep their relative
    // rhythm, but provide the same short, playable count-in for every chart.
    const offset = song.notes[0].time - 2.5;
    const relPath = GUITAR_AUDIO_BACKING_MAP[song.id]!;
    const audioBackingUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${relPath}`;
    const laneChords = SONG_LANE_CHORDS[song.id] ?? ['Am', 'Dm', 'G', 'C', 'E'];
    const artist = song.id === 'pila-tango-midi' ? 'Strachy na Lachy' : song.artist;

    return {
      id: song.id,
      title: song.title,
      artist,
      bpm: song.bpm,
      duration: song.notes[song.notes.length - 1].time - offset + 3,
      difficulty: song.difficulty as GuitarSong['difficulty'],
      chords: laneChords,
      notes: song.notes.map((note) => ({
        ...note,
        time: note.time - offset,
        chordName: laneChords[note.lane] ?? 'Am',
      })),
      audioBackingOffset: offset,
      audioBackingUrl,
    };
  });

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

    this.callbacks?.onToast?.(
      `🎸 ZACZYNAMY: „${song.title}”! Uderzaj klawisze [A, S, D, F, G] na linii ognia!`,
    );
    this.synth.startBackingTrack(this.currentSong.audioBackingUrl, this.currentSong.audioBackingOffset ?? 0);
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

      this.synth.playChord(candidate.chordName, candidate.lane, this.currentSong?.id);
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

      this.synth.playChord(candidate.chordName, candidate.lane, this.currentSong?.id);
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

    const audioPos = this.synth.getAudioCurrentTime?.() ?? null;
    if (audioPos !== null && Number.isFinite(audioPos)) {
      const targetTime = audioPos - (this.currentSong.audioBackingOffset ?? 0);
      if (Math.abs(this.currentTime - targetTime) > 0.04) {
        this.currentTime = targetTime;
      } else {
        this.currentTime += dt;
      }
    } else {
      this.currentTime += dt;
    }

    this.synth.updateBackingTrack(
      this.currentTime,
      this.currentSong.bpm,
      this.currentSong.chords,
      this.currentSong.source ? this.currentSong.notes : undefined,
    );

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
            audioBackingUrl: this.currentSong.audioBackingUrl,
            audioBackingOffset: this.currentSong.audioBackingOffset,
            chords: this.currentSong.chords,
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
