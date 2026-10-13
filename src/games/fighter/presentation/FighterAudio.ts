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
    this.play('ultimate-' + id);
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
