import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArcadeAudio } from './Audio';
import { musicPhrase } from './Music';

/** Captures actual scheduling and cleanup without browser audio hardware or wall-clock waiting. */
class FakeContext {
  static latest: FakeContext;
  currentTime = 10;
  state = 'running';
  destination = {};
  peaks: ReturnType<typeof vi.fn>[] = [];
  ducks: ReturnType<typeof vi.fn>[] = [];
  oscillators: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  close = vi.fn(async () => undefined);
  resume = vi.fn(async () => undefined);
  constructor() {
    FakeContext.latest = this;
  }
  createOscillator() {
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined,
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const peak = vi.fn(),
      duck = vi.fn();
    this.peaks.push(peak);
    this.ducks.push(duck);
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        value: 0.02,
        cancelScheduledValues: vi.fn(),
        setTargetAtTime: duck,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: peak,
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
  }
  createBiquadFilter() {
    return { type: '', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('ambient audio lifecycle', () => {
  it.each([0, 1, 2, 3])(
    'raises gameplay music in biome %s, lowers pickups and keeps other effects unchanged',
    (biome) => {
      vi.stubGlobal('AudioContext', FakeContext);
      const audio = new ArcadeAudio();
      audio.unlock();
      const context = FakeContext.latest;
      audio.updateMusic(biome, true);
      const phrase = musicPhrase(biome, 0);
      phrase.forEach((note, index) =>
        expect(context.peaks[index].mock.calls[0][0]).toBeCloseTo(note.gain * 1.8),
      );
      audio.play('pickup', biome);
      for (const peak of context.peaks.slice(phrase.length)) expect(peak.mock.calls[0][0]).toBe(0.03);
      for (const duck of context.ducks) expect(duck).not.toHaveBeenCalled();
      const count = context.peaks.length;
      audio.play('impact', biome);
      for (const peak of context.peaks.slice(count)) expect(peak.mock.calls[0][0]).toBe(0.075);
      expect(context.ducks[0]).toHaveBeenCalled();
      audio.dispose();
    },
  );

  it('retains the quieter menu arrangement', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = new ArcadeAudio();
    audio.unlock();
    audio.updateMusic(0, true, true);
    musicPhrase(0, 0, true).forEach((note, index) =>
      expect(FakeContext.latest.peaks[index].mock.calls[0][0]).toBe(note.gain),
    );
    audio.dispose();
  });
  it('does not create a context before a user gesture or schedule while muted/paused', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = new ArcadeAudio();
    audio.updateMusic(0, true);
    audio.unlock();
    const context = FakeContext.latest;
    audio.updateMusic(0, false);
    audio.muted = true;
    audio.updateMusic(0, true);
    expect(context.oscillators).toHaveLength(0);
    audio.dispose();
  });
  it('uses bounded RAF lookahead, stops all queued music on pause and reuses the context', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = new ArcadeAudio();
    audio.unlock();
    const context = FakeContext.latest;
    audio.updateMusic(0, true);
    expect(context.oscillators).toHaveLength(2);
    for (let frame = 0; frame < 300; frame++) audio.updateMusic(0, true);
    expect(context.oscillators).toHaveLength(2);
    audio.silence();
    for (const node of context.oscillators) expect(node.stop).toHaveBeenCalledTimes(2);
    audio.unlock();
    expect(FakeContext.latest).toBe(context);
    context.currentTime += 0.8;
    audio.updateMusic(1, true);
    expect(context.oscillators).toHaveLength(4);
    audio.dispose();
    expect(context.close).toHaveBeenCalledOnce();
  });
  it('fades old biome voices and still stops fading notes when paused immediately afterwards', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = new ArcadeAudio();
    audio.unlock();
    const context = FakeContext.latest;
    audio.updateMusic(0, true);
    const old = [...context.oscillators];
    audio.updateMusic(1, true);
    for (const voice of old) expect(voice.stop).toHaveBeenLastCalledWith(10.3);
    audio.silence();
    for (const voice of context.oscillators) expect(voice.stop).toHaveBeenLastCalledWith();
    const count = context.oscillators.length;
    audio.updateMusic(1, false);
    expect(context.oscillators).toHaveLength(count);
    audio.dispose();
  });
});
