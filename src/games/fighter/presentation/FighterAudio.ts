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

type Scene = 'menu' | 'fight';
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/** One lazily unlocked graph, cached original samples, bounded voices and crossfaded score. */
export class FighterAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private unlocked = false;
  private visible = true;
  private scene: Scene = 'menu';
  private musicVolume = 0.45;
  private effectsVolume = 0.8;
  private musicBus?: GainNode;
  private effectsBus?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private downloads = new AbortController();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private voices = new Set<Voice>();
  private music?: Voice;
  private musicScene?: Scene;
  private generation = 0;
  private duckUntil = 0;
  private musicPending = false;

  async unlock(): Promise<void> {
    if (!this.ctx && typeof window !== 'undefined') {
      const Context =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.musicBus = this.ctx.createGain();
      this.effectsBus = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -10;
      this.compressor.ratio.value = 5;
      this.musicBus.connect(this.compressor);
      this.effectsBus.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    if (!this.ctx) return;
    try {
      await this.ctx.resume();
    } catch {
      return;
    }
    this.unlocked = true;
    this.update();
    void this.ensureMusic();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.update();
  }
  isEnabled(): boolean {
    return this.enabled;
  }
  setVolumes(music: number, effects: number): void {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.effectsVolume = Math.max(0, Math.min(1, effects));
    this.update();
  }
  setScene(scene: Scene): void {
    this.scene = scene;
    void this.ensureMusic();
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.update();
  }
  update(): void {
    if (!this.ctx) return;
    const active = this.enabled && this.visible;
    this.musicBus?.gain.setTargetAtTime(
      active ? this.musicVolume * (Date.now() < this.duckUntil ? 0.22 : 1) : 0,
      this.ctx.currentTime,
      0.08,
    );
    this.effectsBus?.gain.setTargetAtTime(active ? this.effectsVolume : 0, this.ctx.currentTime, 0.03);
  }

  private load(name: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return cached;
    const context = this.ctx;
    if (!context) return Promise.resolve(null);
    const base = import.meta.env.BASE_URL || '/';
    const pending = fetch(`${base}game-assets/2d/fighter/audio-v2/${name}.wav`, {
      signal: this.downloads.signal,
    })
      .then(async (response) => (response.ok ? context.decodeAudioData(await response.arrayBuffer()) : null))
      .catch(() => null);
    this.buffers.set(name, pending);
    return pending;
  }

  private makeVoice(buffer: AudioBuffer, bus: GainNode, loop = false): Voice {
    const context = this.ctx!;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain);
    gain.connect(bus);
    const voice = { source, gain };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    this.voices.add(voice);
    return voice;
  }

  private async ensureMusic(): Promise<void> {
    if (!this.unlocked || !this.ctx || this.musicScene === this.scene || this.musicPending) return;
    const scene = this.scene,
      generation = this.generation;
    this.musicPending = true;
    const buffer = await this.load(scene);
    if (generation !== this.generation || !this.ctx) return;
    this.musicPending = false;
    if (scene !== this.scene) {
      void this.ensureMusic();
      return;
    }
    if (!buffer) return;
    const t = this.ctx.currentTime;
    const voice = this.makeVoice(buffer, this.musicBus!, true);
    voice.gain.gain.setValueAtTime(0, t);
    voice.gain.gain.linearRampToValueAtTime(1, t + 0.4);
    voice.source.start();
    if (this.music) {
      this.music.gain.gain.cancelScheduledValues(t);
      this.music.gain.gain.setValueAtTime(1, t);
      this.music.gain.gain.linearRampToValueAtTime(0, t + 0.4);
      this.music.source.stop(t + 0.42);
    }
    this.music = voice;
    this.musicScene = scene;
  }

  private play(name: string, volume = 1): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    const generation = this.generation;
    const deadline = Date.now() + 250;
    void this.load(name).then((buffer) => {
      // Slow downloads never replay a stale hit after the action has ended.
      if (
        !buffer ||
        generation !== this.generation ||
        !this.enabled ||
        !this.visible ||
        Date.now() > deadline ||
        !this.ctx
      )
        return;
      if (this.voices.size >= 18) return;
      const voice = this.makeVoice(buffer, this.effectsBus!);
      voice.gain.gain.value = volume;
      voice.source.start();
    });
  }

  /** Warm combat samples after a user gesture, while selection or countdown is visible. */
  preloadCombat(): void {
    if (!this.ctx) return;
    for (const name of [
      'punch',
      'heavy',
      'kick',
      'guard',
      'launch',
      'land',
      'swing',
      'swing-heavy',
      'ready',
      'empty',
      'bell',
      'ko',
      'charge',
      'announcer-round-1',
      'announcer-round-2',
      'announcer-final-round',
      'announcer-fight',
      'announcer-ko',
      'announcer-you-win',
      'announcer-you-lose',
      'announcer-draw',
      'announcer-double-ko',
      'announcer-time-over',
      'announcer-perfect',
      'announcer-sudden-death',
      'announcer-game-over',
      'announcer-continue',
      'announcer-choose-fighter',
      'versus-whoosh',
    ])
      void this.load(name);
  }
  preloadFighters(ids: string[]): void {
    if (this.ctx) for (const id of ids) void this.load('ultimate-' + id);
  }
  playUi(): void {
    this.play('select', 0.4);
  }
  playHit(type: 'light' | 'heavy' | 'special'): void {
    this.play(type === 'light' ? 'punch' : 'heavy');
  }
  playFunnyHit(options: FunnyHitOptions): void {
    this.play(
      options.isLauncher
        ? 'launch'
        : options.isHeavy
          ? 'heavy'
          : options.moveId?.includes('kick')
            ? 'kick'
            : 'punch',
    );
  }
  playBlock(): void {
    this.play('guard');
  }
  playLaunch(): void {
    this.play('launch');
  }
  playLanding(): void {
    this.play('land', 0.65);
  }
  playSwing(moveId = ''): void {
    if (moveId === 'ultimate') return;
    this.play(
      moveId.includes('heavy') || moveId === 'uppercut' || moveId === 'special' ? 'swing-heavy' : 'swing',
      0.4,
    );
  }
  playReady(): void {
    this.play('ready', 0.5);
  }
  playRoundBell(): void {
    this.play('bell', 0.6);
  }
  playFunnyKO(): void {
    this.play('ko');
  }
  playEmptyMeterBuzz(): void {
    this.play('empty', 0.45);
  }
  playSuperStartup(): void {
    this.duckUntil = Date.now() + 2800;
    this.update();
    this.play('charge', 0.7);
  }
  playUltimateImpact(id: string): void {
    this.play(id === 'antena' ? 'heavy' : 'ultimate-' + id);
  }

  playCoinInsert(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.effectsBus!);
      osc.start(now);
      osc.stop(now + 0.46);
    } catch {
      /* AudioContext may be suspended or busy */
    }
  }

  playVersusGong(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play('versus-whoosh', 0.85);
    try {
      const now = this.ctx.currentTime;
      [110, 164.8, 220, 311.1, 440].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 1.2);
        const amp = 0.22 / (idx + 1);
        gain.gain.setValueAtTime(amp, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
        osc.connect(gain);
        gain.connect(this.effectsBus!);
        osc.start(now);
        osc.stop(now + 1.45);
      });
    } catch {
      /* Safe fallback */
    }
  }

  speakAnnouncer(_text: string): void {
    void _text;
    // Replaced in favor of dynamic retro-arcade procedural synthesizers (zero robotic TTS)
  }

  playAnnouncerRound(roundNumber: number, isFinal = false): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    if (isFinal) {
      this.play('announcer-final-round', 0.95);
    } else if (roundNumber === 2) {
      this.play('announcer-round-2', 0.95);
    } else {
      this.play('announcer-round-1', 0.95);
    }
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const bus = this.effectsBus!;

      // 1. Punchy low-end kick transient (arcade boom)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(isFinal ? 120 : 160, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.35);
      subGain.gain.setValueAtTime(0.35, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      subOsc.connect(subGain);
      subGain.connect(bus);
      subOsc.start(now);
      subOsc.stop(now + 0.38);

      if (isFinal) {
        // Dramatic minor tension chord for Final Round: C3, Eb3, G3, C4
        const freqs = [130.81, 155.56, 196.0, 261.63];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.18 / (idx + 1), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
          osc.connect(gain);
          gain.connect(bus);
          osc.start(now);
          osc.stop(now + 1.15);
        });

        // High-tension rising sweep
        const sweep = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweep.type = 'square';
        sweep.frequency.setValueAtTime(380, now + 0.05);
        sweep.frequency.exponentialRampToValueAtTime(1100, now + 0.45);
        sweepGain.gain.setValueAtTime(0.08, now + 0.05);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        sweep.connect(sweepGain);
        sweepGain.connect(bus);
        sweep.start(now + 0.05);
        sweep.stop(now + 0.52);
      } else if (roundNumber === 2) {
        // Round 2: Energetic rising triad D4 -> F#4 -> A4 -> D5 + bright brass
        const notes = [293.66, 369.99, 440.0, 587.33];
        notes.forEach((freq, idx) => {
          const startT = now + idx * 0.06;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, startT);
          gain.gain.setValueAtTime(0.16, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.55);
          osc.connect(gain);
          gain.connect(bus);
          osc.start(startT);
          osc.stop(startT + 0.6);
        });
      } else {
        // Round 1: Classic heroic brass stinger C4 -> G4 -> C5
        const notes = [
          { f: 261.63, t: 0, dur: 0.25 },
          { f: 392.0, t: 0.1, dur: 0.3 },
          { f: 523.25, t: 0.22, dur: 0.65 },
        ];
        notes.forEach(({ f, t, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          const startT = now + t;
          osc.frequency.setValueAtTime(f, startT);
          gain.gain.setValueAtTime(0.18, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);
          osc.connect(gain);
          gain.connect(bus);
          osc.start(startT);
          osc.stop(startT + dur + 0.05);
        });
      }
    } catch {
      /* Fallback */
    }
  }

  playAnnouncerFight(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play('announcer-fight', 0.95);
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const bus = this.effectsBus!;

      // 1. Noise crash burst for metallic impact
      try {
        const bufferSize = Math.floor(ctx.sampleRate * 0.18);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.Q.setValueAtTime(2.0, now);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(bus);
        noise.start(now);
      } catch {
        /* Noise fallback */
      }

      // 2. Punchy downward laser bass drop
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.setValueAtTime(240, now);
      bass.frequency.exponentialRampToValueAtTime(45, now + 0.32);
      bassGain.gain.setValueAtTime(0.32, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      bass.connect(bassGain);
      bassGain.connect(bus);
      bass.start(now);
      bass.stop(now + 0.36);

      // 3. Fast high-energy arcade flourish (C5 -> E5 -> G5 -> C6)
      const flourish = [523.25, 659.25, 783.99, 1046.5];
      flourish.forEach((freq, idx) => {
        const startT = now + idx * 0.04;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.12, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.25);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(startT);
        osc.stop(startT + 0.28);
      });

      this.playRoundBell();
    } catch {
      /* Fallback */
    }
  }

  playAnnouncerKO(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play('announcer-ko', 0.95);
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const bus = this.effectsBus!;

      // 1. Deep seismic earthquake boom (110Hz -> 28Hz)
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.7);
      subGain.gain.setValueAtTime(0.45, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      sub.connect(subGain);
      subGain.connect(bus);
      sub.start(now);
      sub.stop(now + 0.78);

      // 2. Beating metallic gong chords (dramatic slowdown)
      [440, 434, 880].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.9);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(now);
        osc.stop(now + 1.0);
      });

      this.playFunnyKO();
    } catch {
      /* Fallback */
    }
  }

  playAnnouncerWin(_winnerName?: string, isPlayerWinner = true): void {
    void _winnerName;
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    if (isPlayerWinner) {
      this.play('announcer-you-win', 0.95);
    } else {
      this.play('announcer-you-lose', 0.95);
    }
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const bus = this.effectsBus!;

      if (isPlayerWinner) {
        // Triumphant 5-note arcade fanfare progression
        const melody = [
          { f: 392.0, t: 0.0, d: 0.18 }, // G4
          { f: 523.25, t: 0.12, d: 0.18 }, // C5
          { f: 659.25, t: 0.24, d: 0.18 }, // E5
          { f: 783.99, t: 0.36, d: 0.22 }, // G5
          { f: 1046.5, t: 0.5, d: 0.8 }, // C6
        ];

        melody.forEach(({ f, t, d }) => {
          const startT = now + t;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, startT);
          gain.gain.setValueAtTime(0.2, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + d);
          osc.connect(gain);
          gain.connect(bus);
          osc.start(startT);
          osc.stop(startT + d + 0.05);
        });

        // Bass punch backing the final hit
        const kick = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(130.81, now + 0.5); // C3
        kick.frequency.exponentialRampToValueAtTime(40, now + 0.9);
        kickGain.gain.setValueAtTime(0.3, now + 0.5);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
        kick.connect(kickGain);
        kickGain.connect(bus);
        kick.start(now + 0.5);
        kick.stop(now + 1.0);
      } else {
        // Minor defeat progression (sad descending stinger)
        const defeatMelody = [
          { f: 329.63, t: 0.0, d: 0.25 }, // E4
          { f: 311.13, t: 0.15, d: 0.25 }, // Eb4
          { f: 293.66, t: 0.3, d: 0.3 }, // D4
          { f: 261.63, t: 0.5, d: 0.7 }, // C4
        ];
        defeatMelody.forEach(({ f, t, d }) => {
          const startT = now + t;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, startT);
          gain.gain.setValueAtTime(0.22, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + d);
          osc.connect(gain);
          gain.connect(bus);
          osc.start(startT);
          osc.stop(startT + d + 0.05);
        });
      }
    } catch {
      /* Fallback */
    }
  }

  playAnnouncerDraw(isDoubleKO = false): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play(isDoubleKO ? 'announcer-double-ko' : 'announcer-draw', 0.95);
  }

  playAnnouncerTimeOver(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play('announcer-time-over', 0.95);
  }

  playAnnouncerPerfect(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play('announcer-perfect', 0.95);
  }

  playAnnouncerGameOver(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play('announcer-game-over', 0.95);
  }

  playAnnouncerChooseFighter(): void {
    if (!this.unlocked || !this.enabled || !this.visible || !this.ctx) return;
    this.play('announcer-choose-fighter', 0.95);
  }

  dispose(): void {
    this.generation++;
    this.downloads.abort();
    this.downloads = new AbortController();
    for (const voice of this.voices) {
      try {
        voice.source.stop();
      } catch {
        /* Already ended. */
      }
      voice.source.disconnect();
      voice.gain.disconnect();
    }
    this.voices.clear();
    this.buffers.clear();
    this.musicBus?.disconnect();
    this.effectsBus?.disconnect();
    this.compressor?.disconnect();
    void this.ctx?.close();
    this.ctx = null;
    this.music = undefined;
    this.musicScene = undefined;
    this.musicPending = false;
    this.unlocked = false;
  }
}
