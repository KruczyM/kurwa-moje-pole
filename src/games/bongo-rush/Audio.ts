import { levelMusicPhrase, levelMusicRoot } from './LevelMusic';
import type { LevelMusicProfile } from './LevelMusic';
import type { SoundEvent } from './types';
import { musicPhrase, MUSIC_BPM } from './Music';
import { musicSoundtrack, soundtrackUrl } from './Soundtrack';

interface RecordedVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  started: number;
  offset: number;
}

const GAME_MUSIC_GAIN = 1.8;
const PICKUP_GAIN = 0.03;

/** One gesture-unlocked WebAudio context owns both effects and the curated soundtrack. */
export class ArcadeAudio {
  private context?: AudioContext;
  private active = new Set<OscillatorNode>();
  private last: Partial<Record<SoundEvent, number>> = {};
  private music = new Set<OscillatorNode>();
  private nextBeat = 0;
  private beat = 0;
  private musicBiome = -1;
  private musicLevel = -1;
  private musicTheme = 'storybook';
  private musicMenu = false;
  private musicGains = new Map<OscillatorNode, GainNode>();
  private duckUntil = 0;
  private recording?: { id: string; buffer: AudioBuffer };
  private requestedRecording?: string;
  private recordingRequest?: AbortController;
  private recordingToken = 0;
  private recordingLoading = false;
  private recordingFailed = false;
  private recordedVoice?: RecordedVoice;
  private readonly recordedVoices = new Set<RecordedVoice>();
  private recordedOffset = 0;
  private restoredRecording?: { id: string; offset: number };
  private recordedVolume = -1;
  private disposed = false;
  muted = false;

  /** The existing synth remains available for older hosts and failed file loads. */
  constructor(private readonly soundtrackBase?: string) {}

  /** Unlocks iOS audio from a user gesture, never from the render loop. */
  unlock(): void {
    if (this.disposed) return;
    // A new explicit gesture permits retry after a failed request, never a RAF retry loop.
    if (this.recordingFailed) {
      this.requestedRecording = undefined;
      this.recordingFailed = false;
    }
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch {
      /* Sound is optional on unsupported devices. */
    }
  }

  /** Schedules a quiet ambient soundtrack from the existing RAF, with at most a short look-ahead. */
  updateMusic(biome: number, playing: boolean, menu = false, profile?: LevelMusicProfile): void {
    const context = this.context;
    if (!playing || this.muted) {
      if (this.recordedVoice) this.stopRecording(false);
      return;
    }
    if (this.disposed || !context) return;
    if (profile && this.soundtrackBase !== undefined && this.updateRecording(profile, menu)) return;
    if (context.state !== 'running') return;
    const now = context.currentTime;
    if (this.musicBiome !== biome || (profile && this.musicLevel !== profile.level)) {
      this.fadeMusic();
      this.musicBiome = biome;
      this.musicLevel = profile?.level ?? -1;
      this.beat = 0;
      this.nextBeat = now + 0.025;
    }
    if (profile && this.musicTheme !== profile.theme) {
      this.fadeMusic();
      this.musicTheme = profile.theme;
    }
    if (this.nextBeat < now) this.nextBeat = now + 0.025;
    if (this.nextBeat > now + 0.12 || this.music.size >= 12) return;
    const start = this.nextBeat;
    const phrase = profile
      ? levelMusicPhrase(profile, this.beat++, menu)
      : musicPhrase(biome, this.beat++, menu);
    phrase.slice(0, Math.max(0, 12 - this.music.size)).forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(note.cutoff, start);
      oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        note.gain * (menu ? 1 : GAME_MUSIC_GAIN) * (now < this.duckUntil ? 0.4 : 1),
        start + 0.09,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      this.music.add(oscillator);
      this.musicGains.set(oscillator, gain);
      oscillator.onended = () => {
        this.music.delete(oscillator);
        this.musicGains.delete(oscillator);
        oscillator.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.05);
    });
    this.nextBeat += 60 / MUSIC_BPM[biome];
  }

  /** One decoded active track; async completion never starts playback on its own. */
  private updateRecording(profile: LevelMusicProfile, menu: boolean): boolean {
    const context = this.context!,
      track = musicSoundtrack(profile.level, menu),
      now = context.currentTime;
    if (this.requestedRecording !== track.id || (!menu && this.musicLevel !== profile.level)) {
      this.stopRecording(true, 0.25);
      this.beat = 0;
    }
    this.musicBiome = profile.biome;
    this.musicLevel = profile.level;
    this.musicTheme = profile.theme;
    this.musicMenu = menu;
    const restored = this.restoredRecording;
    this.restoredRecording = undefined;
    if (this.requestedRecording !== track.id) {
      this.recordingRequest?.abort();
      const token = ++this.recordingToken;
      this.requestedRecording = track.id;
      this.recording = undefined;
      this.recordedOffset = restored?.id === track.id ? restored.offset : 0;
      this.recordingLoading = true;
      this.recordingFailed = false;
      const controller = (this.recordingRequest = new AbortController());
      void fetch(soundtrackUrl(this.soundtrackBase!, profile.level, menu), { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
          const data = await response.arrayBuffer();
          if (this.disposed || token !== this.recordingToken) throw new Error('Stale music request');
          return context.decodeAudioData(data);
        })
        .then((buffer) => {
          if (this.disposed || token !== this.recordingToken) return;
          if (!buffer.length || !Number.isFinite(buffer.duration) || buffer.duration > (menu ? 75 : 50))
            throw new Error('Invalid soundtrack buffer');
          this.recording = { id: track.id, buffer };
        })
        .catch(() => {
          if (!this.disposed && token === this.recordingToken) this.recordingFailed = true;
        })
        .finally(() => {
          if (token === this.recordingToken) {
            this.recordingLoading = false;
            this.recordingRequest = undefined;
          }
        });
    }
    if (this.recordingFailed) return false;
    if (!this.recording) return true;
    if (context.state !== 'running') return true;
    if (!this.recordedVoice) {
      this.fadeMusic();
      // A rapid sequence of selections cannot accumulate fading source nodes.
      while (this.recordedVoices.size >= 2)
        this.releaseRecordedVoice(this.recordedVoices.values().next().value!);
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = this.recording.buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = source.buffer.duration;
      source.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0, now);
      const offset = this.recordedOffset % source.buffer.duration;
      const voice = { source, gain, started: now, offset };
      source.onended = () => {
        this.recordedVoices.delete(voice);
        if (this.recordedVoice === voice) this.recordedVoice = undefined;
        source.disconnect();
        gain.disconnect();
      };
      this.recordedVoice = voice;
      this.recordedVoices.add(voice);
      this.recordedVolume = -1;
      source.start(now, offset);
    }
    const volume = (menu ? 0.24 : 0.48) * (now < this.duckUntil ? 0.4 : 1);
    if (this.recordedVolume !== volume) {
      this.recordedVoice.gain.gain.setTargetAtTime(volume, now, 0.08);
      this.recordedVolume = volume;
    }
    return true;
  }

  private recordingPosition(): number {
    const voice = this.recordedVoice;
    return voice && this.recording
      ? (voice.offset + Math.max(0, this.context!.currentTime - voice.started)) %
          this.recording.buffer.duration
      : this.recordedOffset;
  }

  private releaseRecordedVoice(voice: RecordedVoice): void {
    this.recordedVoices.delete(voice);
    try {
      voice.source.stop();
    } catch {
      /* Already stopped. */
    }
    voice.source.disconnect();
    voice.gain.disconnect();
    if (this.recordedVoice === voice) this.recordedVoice = undefined;
  }

  private stopRecording(reset: boolean, fade = 0): void {
    const voice = this.recordedVoice;
    this.recordedOffset = reset ? 0 : this.recordingPosition();
    this.recordedVoice = undefined;
    if (!voice) return;
    if (fade && this.context) {
      const now = this.context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + fade);
      voice.source.stop(now + fade + 0.01);
    } else this.releaseRecordedVoice(voice);
  }

  diagnostics() {
    return {
      track: this.requestedRecording,
      title: this.musicLevel > 0 ? musicSoundtrack(this.musicLevel, this.musicMenu).title : undefined,
      state: this.recordingFailed
        ? 'synth-fallback'
        : this.recordingLoading
          ? 'loading'
          : this.recording
            ? 'ready'
            : 'idle',
      playing: Boolean(this.recordedVoice),
      offset: this.recordingPosition(),
      voices: this.recordedVoices.size,
      buffers: this.recording ? 1 : 0,
      decodedBytes: this.recording
        ? this.recording.buffer.length * this.recording.buffer.numberOfChannels * 4
        : 0,
      contextState: this.context?.state,
    };
  }

  /** Fades biome transitions without owning timers or another scheduler. */
  private fadeMusic(): void {
    const now = this.context?.currentTime ?? 0;
    for (const [oscillator, gain] of this.musicGains) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      try {
        oscillator.stop(now + 0.3);
      } catch {
        /* Voice already ended. */
      }
    }
  }

  /** Plays short biome-specific motifs with throttling and a bounded voice count. */
  play(event: SoundEvent, biome: number): void {
    const context = this.context;
    if (this.muted || !context || context.state !== 'running' || this.active.size > 16) return;
    const now = context.currentTime;
    if (now - (this.last[event] ?? -100) < (event === 'dig' ? 0.09 : 0.06)) return;
    // Quiet, frequent pickups should not repeatedly bury the soundtrack.
    if (event !== 'dig' && event !== 'pickup') {
      this.duckUntil = now + 0.25;
      for (const gain of this.musicGains.values()) gain.gain.setTargetAtTime(0.003, now, 0.03);
    }
    this.last[event] = now;
    const pickup =
      this.musicLevel > 0
        ? [0, 4, 7].map((pitch) => levelMusicRoot(biome) * 2 ** (1 + pitch / 12))
        : [
            [523, 659, 784],
            [392, 587, 784],
            [659, 988, 1318],
            [440, 660, 880],
          ][biome];
    const notes: Record<SoundEvent, number[]> = {
      pickup,
      dig:
        this.musicLevel > 0
          ? [
              [115, 75],
              [190, 85],
              [300, 150],
              [105, 55],
            ][biome]
          : [130, 90],
      push: [180, 130],
      impact: [100, 45],
      lost: [330, 247, 165, 82],
      exit: [392, 523, 659, 784],
      won: [523, 659, 784, 1047, 784, 1047],
      trap: [220, 440, 660, 880],
    };
    notes[event].forEach((frequency, index) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      const start = now + index * 0.065;
      oscillator.type = event === 'impact' || event === 'dig' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(event === 'pickup' ? PICKUP_GAIN : 0.075, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.active.add(oscillator);
      oscillator.onended = () => {
        this.active.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
  }

  /** Stops queued notes when leaving a run or muting, without closing the unlocked context. */
  silence(reset = true): void {
    this.stopRecording(reset);
    for (const voice of [...this.recordedVoices]) this.releaseRecordedVoice(voice);
    for (const oscillator of [...this.active, ...this.music]) {
      try {
        oscillator.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.active.clear();
    this.music.clear();
    this.musicGains.clear();
    this.nextBeat = 0;
    if (reset) this.beat = 0;
  }

  position() {
    return {
      beat: this.beat,
      biome: this.musicBiome,
      level: this.musicLevel,
      theme: this.musicTheme,
      recording: this.requestedRecording,
      offset: this.recordingPosition(),
    };
  }
  restorePosition(position: ReturnType<ArcadeAudio['position']>): void {
    this.silence();
    this.beat = position.beat;
    this.musicBiome = position.biome;
    this.musicLevel = position.level;
    this.musicTheme = position.theme;
    if (position.recording === this.requestedRecording) this.recordedOffset = position.offset;
    else if (position.recording) this.restoredRecording = { id: position.recording, offset: position.offset };
  }

  /** Releases the sole audio context when the game host is removed. */
  dispose(): void {
    this.disposed = true;
    this.recordingToken++;
    this.recordingRequest?.abort();
    this.recordingRequest = undefined;
    this.recordingLoading = false;
    this.silence();
    this.recording = undefined;
    void this.context?.close().catch(() => undefined);
  }
}
