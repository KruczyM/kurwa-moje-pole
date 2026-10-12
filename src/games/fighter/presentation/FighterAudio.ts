export type FunnySoundType =
  'bonk' | 'slap' | 'boing' | 'squeak' | 'honk' | 'fart' | 'pop' | 'slide_up' | 'slide_down' | 'wood_knock';

export interface FunnyHitOptions {
  hitHeight?: 'high' | 'mid' | 'low';
  isHeavy?: boolean;
  isLauncher?: boolean;
  isAirJuggle?: boolean;
  causesKnockdown?: boolean;
  damage?: number;
  moveId?: string;
  attackerId?: string;
  defenderId?: string;
}

export class FighterAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private voiceBuffers: Map<string, AudioBuffer> = new Map();
  private voicesLoading = false;
  private lastVoiceTime = 0;
  private voiceCooldownMs = 300;

  private femaleFighters = new Set(['korba', 'klatwa', 'szerszen', 'ambona', 'dziaslo']);
  private heavyFighters = new Set(['pien', 'hemoroid', 'krwiak']);

  private voiceFiles: Record<string, string> = {
    oof: 'dude_oof.wav',
    ow: 'dude_ow.wav',
    whuff: 'dude_whuff.wav',
    oops: 'dude_oops.wav',
    mybad: 'dude_mybad.wav',
    sissy: 'dude_sissy.wav',
    ohmyhead: 'dude_ohmyhead.wav',
    ohmynads: 'dude_ohmynads.wav',
    ohthatsgottahurt: 'dude_ohthatsgottahurt.wav',
    owmyclavichord: 'dude_owmyclavichord.wav',
    ughnowmyspleens: 'dude_ughnowmyspleens.wav',
    shit: 'dude_shit.wav',
    sweet: 'dude_sweet.wav',
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.preloadVoices();
    }
  }

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async preloadVoices(): Promise<void> {
    if (this.voicesLoading || this.voiceBuffers.size > 0) return;
    this.voicesLoading = true;
    const ctx = this.getContext();
    if (!ctx) return;

    const rawBase = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
    const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

    for (const [key, filename] of Object.entries(this.voiceFiles)) {
      try {
        const url = `${base}game-assets/audio/Teksty%20Kolesia/${encodeURIComponent(filename)}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.voiceBuffers.set(key, audioBuf);
      } catch {
        // Safe fallback if offline or mock testing environment
      }
    }
  }

  public playVoiceReaction(keys: string[], pitch = 1.0): void {
    if (!this.enabled || this.voiceBuffers.size === 0) return;
    const now = Date.now();
    if (now - this.lastVoiceTime < this.voiceCooldownMs) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const available = keys.filter((k) => this.voiceBuffers.has(k));
    if (available.length === 0) return;

    const chosenKey = available[Math.floor(Math.random() * available.length)]!;
    const buffer = this.voiceBuffers.get(chosenKey);
    if (!buffer) return;

    this.lastVoiceTime = now;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(pitch * (0.95 + Math.random() * 0.1), ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.42, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {
      // Audio playback failed silently
    }
  }

  // --- Procedural Funny Comic Sound Effects ---

  /** Cartoon frying pan / metallic coconut hit */
  playBonk(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const mainFreq = (400 + Math.random() * 40) * pitchMult;

    // Pan body impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(mainFreq, t);
    osc.frequency.exponentialRampToValueAtTime(110 * pitchMult, t + 0.14);

    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);

    // High metallic resonance ping
    const metal = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const metalGain = ctx.createGain();

    metal.type = 'square';
    metal.frequency.setValueAtTime(1220 * pitchMult, t);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1220 * pitchMult, t);
    filter.Q.setValueAtTime(10, t);

    metalGain.gain.setValueAtTime(0.18, t);
    metalGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    metal.connect(filter);
    filter.connect(metalGain);
    metalGain.connect(ctx.destination);
    metal.start(t);
    metal.stop(t + 0.22);
  }

  /** Wet cartoon face slap / plaskacz */
  playSlap(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dur = 0.055;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1750 * pitchMult, t);
    filter.Q.setValueAtTime(3.2, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);

    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(800 * pitchMult, t);
    pop.frequency.exponentialRampToValueAtTime(160 * pitchMult, t + 0.035);

    popGain.gain.setValueAtTime(0.24, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    pop.connect(popGain);
    popGain.connect(ctx.destination);
    pop.start(t);
    pop.stop(t + 0.035);
  }

  /** Cartoon spring boing */
  playBoing(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const carrier = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(140 * pitchMult, t);
    carrier.frequency.exponentialRampToValueAtTime(460 * pitchMult, t + 0.28);

    // Spring vibrato
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(28, t);
    lfoGain.gain.setValueAtTime(65 * pitchMult, t);
    lfo.connect(carrier.frequency);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    carrier.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(t);
    carrier.start(t);
    lfo.stop(t + 0.32);
    carrier.stop(t + 0.32);
  }

  /** Rubber duck / toy squeak */
  playSqueak(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1050 * pitchMult, t);
    osc.frequency.exponentialRampToValueAtTime(1850 * pitchMult, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(820 * pitchMult, t + 0.09);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.11);
  }

  /** Cartoon clown horn (honk-honk!) */
  playHonk(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(285 * pitchMult, t);
    osc2.frequency.setValueAtTime(335 * pitchMult, t);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750 * pitchMult, t);
    filter.Q.setValueAtTime(3.8, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
    gain.gain.setValueAtTime(0.28, t + 0.06);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.075);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.09);
    gain.gain.setValueAtTime(0.28, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.18);
    osc2.stop(t + 0.18);
  }

  /** Comic buzz / prrr / fart on low sweep / knockdown */
  playFart(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    const mainGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85 * pitchMult, t);
    osc.frequency.exponentialRampToValueAtTime(36 * pitchMult, t + 0.24);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450 * pitchMult, t);

    tremolo.type = 'square';
    tremolo.frequency.setValueAtTime(38, t);
    tremoloGain.gain.setValueAtTime(0.4, t);
    tremolo.connect(mainGain.gain);

    mainGain.gain.setValueAtTime(0.35, t);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    osc.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(ctx.destination);

    tremolo.start(t);
    osc.start(t);
    tremolo.stop(t + 0.26);
    osc.stop(t + 0.26);
  }

  /** Popping cork */
  playPop(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 * pitchMult, t);
    osc.frequency.exponentialRampToValueAtTime(740 * pitchMult, t + 0.02);
    osc.frequency.exponentialRampToValueAtTime(120 * pitchMult, t + 0.045);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  /** Cartoon slide whistle */
  playSlideWhistle(direction: 'up' | 'down', pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    if (direction === 'up') {
      osc.frequency.setValueAtTime(260 * pitchMult, t);
      osc.frequency.exponentialRampToValueAtTime(940 * pitchMult, t + 0.26);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    } else {
      osc.frequency.setValueAtTime(880 * pitchMult, t);
      osc.frequency.exponentialRampToValueAtTime(190 * pitchMult, t + 0.32);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    }
  }

  /** Hollow cartoon wooden block knock / puk */
  playFunnyBlock(pitchMult = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360 * pitchMult, t);
    osc.frequency.exponentialRampToValueAtTime(90 * pitchMult, t + 0.05);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * Main intelligent funny hit dispatcher.
   * Plays a hilarious synthesized cartoon sound and triggers funny vocal reactions.
   */
  public playFunnyHit(opts: FunnyHitOptions): void {
    if (!this.enabled) return;

    let charPitch = 1.0;
    const defId = (opts.defenderId || '').toLowerCase();
    if (this.femaleFighters.has(defId)) {
      charPitch = 1.28;
    } else if (this.heavyFighters.has(defId)) {
      charPitch = 0.88;
    }

    const jitter = 0.94 + Math.random() * 0.12;
    const finalPitch = charPitch * jitter;

    if (opts.isLauncher) {
      this.playBoing(finalPitch);
      this.playSlideWhistle('up', finalPitch);
      this.playVoiceReaction(['ohthatsgottahurt', 'oof', 'whuff', 'ohmynads'], charPitch);
    } else if (opts.isAirJuggle) {
      const r = Math.random();
      if (r < 0.4) {
        this.playBoing(finalPitch * 1.15);
      } else if (r < 0.75) {
        this.playSqueak(finalPitch);
      } else {
        this.playPop(finalPitch);
      }
    } else if (opts.causesKnockdown || (opts.hitHeight === 'low' && opts.isHeavy)) {
      if (Math.random() < 0.65) {
        this.playFart(finalPitch);
      } else {
        this.playSlideWhistle('down', finalPitch);
      }
      this.playVoiceReaction(['owmyclavichord', 'ughnowmyspleens', 'shit', 'whuff'], charPitch);
    } else if (opts.hitHeight === 'high') {
      const r = Math.random();
      if (r < 0.45) {
        this.playSlap(finalPitch);
      } else if (r < 0.8) {
        this.playBonk(finalPitch);
      } else {
        this.playSqueak(finalPitch);
      }
      this.playVoiceReaction(['ow', 'oof', 'ohmyhead', 'oops'], charPitch);
    } else if (opts.isHeavy) {
      if (Math.random() < 0.65) {
        this.playBonk(finalPitch);
      } else {
        this.playHonk(finalPitch);
      }
      this.playVoiceReaction(['ohmynads', 'ohmyhead', 'ohthatsgottahurt', 'shit'], charPitch);
    } else {
      const r = Math.random();
      if (r < 0.38) {
        this.playSqueak(finalPitch);
      } else if (r < 0.72) {
        this.playPop(finalPitch);
      } else {
        this.playSlap(finalPitch);
      }
      this.playVoiceReaction(['oof', 'ow', 'whuff', 'mybad'], charPitch);
    }
  }

  // --- Classic / Retro sounds kept for backward compatibility ---

  playSwing(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  playHit(type: 'light' | 'heavy' | 'special'): void {
    this.playFunnyHit({
      isHeavy: type === 'heavy' || type === 'special',
      damage: type === 'heavy' ? 80 : 30,
    });
  }

  playBlock(): void {
    if (!this.enabled) return;
    this.playFunnyBlock();
  }

  playLaunch(): void {
    if (!this.enabled) return;
    this.playBoing();
    this.playSlideWhistle('up');
  }

  playRoundBell(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  }

  playKOGong(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Resonant gong with cartoon wobble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 1.2);

    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.2);

    this.playVoiceReaction(['ughnowmyspleens', 'sissy', 'shit', 'ohthatsgottahurt'], 1.0);
  }

  playFunnyKO(): void {
    this.playKOGong();
    this.playSlideWhistle('down');
  }

  /** Dull buzz click when attempting Super without 100% meter */
  playEmptyMeterBuzz(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.setValueAtTime(95, t + 0.05);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  // --- Dedicated Super / Ultimate Move Audio Effects ---

  /** Dramatic Super Freeze & Portrait Flash startup */
  playSuperStartup(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    // Dramatic golden bell / cinematic chime
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, t); // C5
    osc1.frequency.exponentialRampToValueAtTime(1046.5, t + 0.35); // C6

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, t); // E5
    osc2.frequency.exponentialRampToValueAtTime(1318.5, t + 0.35); // E6

    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.6);
    osc2.stop(t + 0.6);
  }

  /** Amper: Glass mirror shatter */
  playGlassShatter(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dur = 0.28;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
  }

  /** Korba: Propeller chopper whirr */
  playPropellerSpin(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.45);

    lfo.type = 'square';
    lfo.frequency.setValueAtTime(22, t);
    lfoGain.gain.setValueAtTime(0.5, t);
    lfo.connect(gain.gain);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.6);
    osc.stop(t + 0.6);
  }

  /** Antena: High-energy plasma laser */
  playLaserBeam(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1250, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.4);

    gain.gain.setValueAtTime(0.36, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  /** Gruczoł: Toi-Toi flush & paper barrage */
  playFlushToilet(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dur = 0.55;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
  }

  /** Chlebak: DJ vinyl scratching */
  playDJScratch(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.08);
    osc.frequency.linearRampToValueAtTime(260, t + 0.16);
    osc.frequency.linearRampToValueAtTime(940, t + 0.24);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.28);
  }

  /** Hemoroid: Off-road 4x4 engine rev */
  playEngineRoar(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.exponentialRampToValueAtTime(145, t + 0.35);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  /** Jęczmień: Rapid lighter spark clicks */
  playLighterFlicks(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const ft = t + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, ft);
      osc.frequency.exponentialRampToValueAtTime(350, ft + 0.035);
      gain.gain.setValueAtTime(0.2, ft);
      gain.gain.exponentialRampToValueAtTime(0.001, ft + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ft);
      osc.stop(ft + 0.035);
    }
  }

  /** Pień: Megaphone siren & screech */
  playMegaphoneScreech(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.linearRampToValueAtTime(2400, t + 0.18);
    osc.frequency.linearRampToValueAtTime(1100, t + 0.36);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Pierścień: Heavy JBL Sub-Bass drop */
  playJBLBassDrop(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.45);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.55);
  }

  /** Szerszeń: Eerie whispers & stone crash */
  playWhispers(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.5);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.6);
  }
}
