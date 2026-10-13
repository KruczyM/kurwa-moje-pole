import type { SoundEvent } from './types';
import { musicPhrase, MUSIC_BPM } from './Music';

/** Original WebAudio effects require no copyrighted samples, downloads or paid APIs. */
export class ArcadeAudio {
  private context?: AudioContext;
  private active = new Set<OscillatorNode>();
  private last: Partial<Record<SoundEvent, number>> = {};
  private music = new Set<OscillatorNode>();
  private nextBeat = 0;
  private beat = 0;
  private musicBiome = -1;
  private musicGains = new Map<OscillatorNode, GainNode>();
  private duckUntil = 0;
  muted = false;

  /** Unlocks iOS audio from a user gesture, never from the render loop. */
  unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch {
      /* Sound is optional on unsupported devices. */
    }
  }

  /** Schedules a quiet ambient soundtrack from the existing RAF, with at most a short look-ahead. */
  updateMusic(biome: number, playing: boolean, menu = false): void {
    const context = this.context;
    if (!playing || this.muted || !context || context.state !== 'running') return;
    const now = context.currentTime;
    if (this.musicBiome !== biome) {
      this.fadeMusic();
      this.musicBiome = biome;
      this.beat = 0;
      this.nextBeat = now + 0.025;
    }
    if (this.nextBeat < now) this.nextBeat = now + 0.025;
    if (this.nextBeat > now + 0.12 || this.music.size >= 12) return;
    const start = this.nextBeat;
    musicPhrase(biome, this.beat++, menu).forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(note.cutoff, start);
      oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.gain * (now < this.duckUntil ? 0.4 : 1), start + 0.09);
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
    if (event !== 'dig') {
      this.duckUntil = now + 0.25;
      for (const gain of this.musicGains.values()) gain.gain.setTargetAtTime(0.003, now, 0.03);
    }
    this.last[event] = now;
    const pickup = [
      [523, 659, 784],
      [392, 587, 784],
      [659, 988, 1318],
      [440, 660, 880],
    ][biome];
    const notes: Record<SoundEvent, number[]> = {
      pickup,
      dig: [130, 90],
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
      gain.gain.linearRampToValueAtTime(0.075, start + 0.006);
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
  silence(): void {
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
    this.beat = 0;
  }

  /** Releases the sole audio context when the game host is removed. */
  dispose(): void {
    this.silence();
    void this.context?.close().catch(() => undefined);
  }
}
