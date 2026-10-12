import type { SoundEvent } from './types';
import { ambientPhrase } from './Music';

/** Original WebAudio effects require no copyrighted samples, downloads or paid APIs. */
export class ArcadeAudio {
  private context?: AudioContext;
  private active = new Set<OscillatorNode>();
  private last: Partial<Record<SoundEvent, number>> = {};
  private music = new Set<OscillatorNode>();
  private nextBeat = 0;
  private beat = 0;
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
  updateMusic(biome: number, playing: boolean): void {
    const context = this.context;
    if (!playing || this.muted || !context || context.state !== 'running') return;
    const now = context.currentTime;
    if (this.nextBeat < now) this.nextBeat = now + 0.025;
    if (this.nextBeat > now + 0.12 || this.music.size >= 12) return;
    const start = this.nextBeat;
    ambientPhrase(biome, this.beat++).forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(index ? 0.025 : 0.018, start + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.music.add(oscillator);
      oscillator.onended = () => {
        this.music.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 1.85);
    });
    this.nextBeat += 0.8;
  }

  /** Plays short biome-specific motifs with throttling and a bounded voice count. */
  play(event: SoundEvent, biome: number): void {
    const context = this.context;
    if (this.muted || !context || context.state !== 'running' || this.active.size > 16) return;
    const now = context.currentTime;
    if (now - (this.last[event] ?? -100) < (event === 'dig' ? 0.09 : 0.06)) return;
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
    this.nextBeat = 0;
    this.beat = 0;
  }

  /** Releases the sole audio context when the game host is removed. */
  dispose(): void {
    this.silence();
    void this.context?.close().catch(() => undefined);
  }
}
