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

describe('level soundtrack positions', () => {
  it('retains phrase position on pause and theme change, resets on level change, and can restore after preview', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = new ArcadeAudio();
    audio.unlock();
    audio.updateMusic(0, true, false, { level: 2, biome: 0, theme: 'storybook' });
    const saved = audio.position();
    expect(saved.beat).toBe(1);
    audio.silence(false);
    expect(audio.position().beat).toBe(1);
    FakeContext.latest.currentTime += 1;
    audio.updateMusic(0, true, false, { level: 2, biome: 0, theme: 'luminous' });
    expect(audio.position().beat).toBe(2);
    audio.restorePosition(saved);
    expect(audio.position()).toEqual(saved);
    audio.updateMusic(0, true, false, { level: 3, biome: 0, theme: 'mysterious' });
    expect(audio.position().beat).toBe(1);
    audio.dispose();
  });
});

class RecordedContext extends FakeContext {
  buffers: {
    buffer: unknown;
    loop: boolean;
    loopStart: number;
    loopEnd: number;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onended?: () => void;
  }[] = [];
  decodeAudioData = vi.fn(async () => ({ duration: 8, length: 384000, numberOfChannels: 2 }) as AudioBuffer);
  createBufferSource() {
    const source = {
      buffer: undefined as unknown,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: undefined,
    };
    this.buffers.push(source);
    return source;
  }
}

const profile = (level = 1) => ({ level, biome: 0, theme: 'storybook' as const });
const response = () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) });
const flushMusic = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('recorded soundtrack in the existing audio host', () => {
  it('loops the full menu song continuously through selections, then restores level music', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<ReturnType<typeof response>>>(
      async () => response(),
    );
    vi.stubGlobal('fetch', fetcher);
    const audio = new ArcadeAudio('/');
    audio.unlock();
    const context = FakeContext.latest as RecordedContext;
    context.decodeAudioData.mockResolvedValueOnce({
      duration: 67.056,
      length: 3218688,
      numberOfChannels: 2,
    } as AudioBuffer);
    audio.updateMusic(0, true, true, profile());
    await flushMusic();
    audio.updateMusic(0, true, true, profile());
    const voice = context.buffers[0];
    context.currentTime += 3;
    audio.updateMusic(1, true, true, { ...profile(6), biome: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(context.buffers).toHaveLength(1);
    expect(voice.stop).not.toHaveBeenCalled();
    expect(audio.diagnostics()).toMatchObject({
      track: 'menu-jazz',
      playing: true,
      state: 'ready',
      offset: 3,
    });
    audio.updateMusic(1, true, false, { ...profile(6), biome: 1 });
    await flushMusic();
    audio.updateMusic(1, true, false, { ...profile(6), biome: 1 });
    expect(audio.diagnostics()).toMatchObject({ track: 'android-forest', playing: true });
    expect(fetcher.mock.calls[0][0]).toContain('/menu-jazz.mp3');
    audio.dispose();
  });
  it('preloads and decodes menu soundtrack while suspended, and begins playing immediately when resumed', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    const fetcher = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetcher);
    const audio = new ArcadeAudio('/');
    audio.unlock();
    const context = FakeContext.latest as RecordedContext;
    context.state = 'suspended';
    audio.updateMusic(0, true, true, profile());
    await flushMusic();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(context.buffers).toHaveLength(0);
    expect(audio.diagnostics()).toMatchObject({
      track: 'menu-jazz',
      playing: false,
      state: 'ready',
    });
    context.state = 'running';
    audio.updateMusic(0, true, true, profile());
    expect(context.buffers).toHaveLength(1);
    expect(audio.diagnostics()).toMatchObject({
      track: 'menu-jazz',
      playing: true,
      state: 'ready',
    });
    audio.dispose();
  });
  it('resumes the menu position after a level-track preview evicts its decoded buffer', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response()),
    );
    const audio = new ArcadeAudio('/');
    audio.unlock();
    audio.updateMusic(0, true, true, profile());
    await flushMusic();
    audio.updateMusic(0, true, true, profile());
    const context = FakeContext.latest as RecordedContext;
    context.currentTime += 3;
    const saved = audio.position();
    audio.silence(false);
    audio.updateMusic(0, true, false, profile());
    await flushMusic();
    audio.updateMusic(0, true, false, profile());
    audio.restorePosition(saved);
    audio.updateMusic(0, true, true, profile());
    await flushMusic();
    audio.updateMusic(0, true, true, profile());
    expect(audio.diagnostics()).toMatchObject({ track: 'menu-jazz', playing: true, offset: 3 });
    expect(context.buffers.at(-1)!.start).toHaveBeenLastCalledWith(context.currentTime, 3);
    audio.dispose();
  });
  it('reuses a returning motif across levels, restarts its phrase and ignores the retired voice ending', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    const fetcher = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetcher);
    const audio = new ArcadeAudio('/');
    audio.unlock();
    audio.updateMusic(1, true, false, { ...profile(6), biome: 1 });
    await flushMusic();
    audio.updateMusic(1, true, false, { ...profile(6), biome: 1 });
    const context = FakeContext.latest as RecordedContext;
    const retired = context.buffers[0];
    context.currentTime += 2;
    audio.updateMusic(1, true, false, { ...profile(10), biome: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(context.buffers).toHaveLength(2);
    expect(context.buffers[1].start).toHaveBeenCalledWith(12, 0);
    retired.onended?.();
    expect(audio.diagnostics()).toMatchObject({
      track: 'android-forest',
      playing: true,
      voices: 1,
      buffers: 1,
    });
    audio.dispose();
  });

  it('waits for a gesture, coalesces RAF loads, loops decoded audio and bounds the active buffer', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    const fetcher = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetcher);
    const audio = new ArcadeAudio('/kurwa-moje-pole/');
    audio.updateMusic(0, true, false, profile());
    expect(fetcher).not.toHaveBeenCalled();
    audio.unlock();
    for (let i = 0; i < 100; i++) audio.updateMusic(0, true, false, profile());
    await flushMusic();
    audio.updateMusic(0, true, false, profile());
    const context = FakeContext.latest as RecordedContext;
    expect(fetcher).toHaveBeenCalledOnce();
    expect(context.buffers).toHaveLength(1);
    expect(context.buffers[0].loop).toBe(true);
    expect(audio.diagnostics()).toMatchObject({
      state: 'ready',
      playing: true,
      voices: 1,
      buffers: 1,
      decodedBytes: 3072000,
    });
    for (let i = 0; i < 100; i++) audio.updateMusic(0, true, false, profile());
    expect(context.buffers).toHaveLength(1);
    audio.dispose();
    expect(context.buffers[0].disconnect).toHaveBeenCalled();
    expect(audio.diagnostics().buffers).toBe(0);
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('retains exact loop position through pause, mute and preview restore, and resets on level change', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response()),
    );
    const audio = new ArcadeAudio('/');
    audio.unlock();
    audio.updateMusic(0, true, false, profile());
    await flushMusic();
    audio.updateMusic(0, true, false, profile());
    const context = FakeContext.latest as RecordedContext;
    context.currentTime += 3;
    audio.silence(false);
    const saved = audio.position();
    expect(saved.offset).toBe(3);
    context.currentTime += 100;
    audio.updateMusic(0, true, false, profile());
    expect(context.buffers.at(-1)!.start).toHaveBeenCalledWith(113, 3);
    audio.muted = true;
    audio.updateMusic(0, true, false, profile());
    expect(audio.diagnostics().playing).toBe(false);
    audio.muted = false;
    audio.updateMusic(0, true, false, profile());
    context.currentTime += 1;
    audio.restorePosition(saved);
    expect(audio.position()).toEqual(saved);
    audio.updateMusic(0, true, false, profile(2));
    await flushMusic();
    audio.updateMusic(0, true, false, profile(2));
    expect(context.buffers.at(-1)!.start).toHaveBeenLastCalledWith(114, 0);
    expect(audio.diagnostics().buffers).toBe(1);
    audio.dispose();
  });

  it('does not autoplay after a paused load and never revives disposed or stale requests', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    const pending: ((value: ReturnType<typeof response>) => void)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((resolve) => pending.push(resolve))),
    );
    const audio = new ArcadeAudio('/');
    audio.unlock();
    audio.updateMusic(0, true, false, profile());
    const context = FakeContext.latest as RecordedContext;
    audio.updateMusic(0, false, false, profile());
    pending[0](response());
    await flushMusic();
    expect(context.buffers).toHaveLength(0);
    expect(audio.diagnostics().playing).toBe(false);
    audio.updateMusic(0, true, false, profile());
    audio.updateMusic(0, true, false, profile(2));
    audio.updateMusic(0, true, false, profile(3));
    pending[2](response());
    await flushMusic();
    pending[1](response());
    await flushMusic();
    audio.updateMusic(0, true, false, profile(3));
    expect(audio.diagnostics().track).toBe('intrigued');
    expect(context.decodeAudioData).toHaveBeenCalledTimes(2);
    audio.updateMusic(0, true, false, profile(4));
    audio.dispose();
    pending[3](response());
    await flushMusic();
    expect(audio.diagnostics()).toMatchObject({ buffers: 0, voices: 0, playing: false });
  });

  it('falls back to original synth after a failed request, with retry only after another gesture', async () => {
    vi.stubGlobal('AudioContext', RecordedContext);
    const fetcher = vi.fn(async () => ({ ...response(), ok: false, status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const audio = new ArcadeAudio('/');
    audio.unlock();
    audio.updateMusic(0, true, false, profile());
    await flushMusic();
    for (let i = 0; i < 100; i++) audio.updateMusic(0, true, false, profile());
    expect(fetcher).toHaveBeenCalledOnce();
    expect(audio.diagnostics().state).toBe('synth-fallback');
    expect(FakeContext.latest.oscillators.length).toBeGreaterThan(0);
    fetcher.mockImplementation(async () => ({ ...response(), status: 200 }));
    audio.unlock();
    audio.updateMusic(0, true, false, profile());
    await flushMusic();
    audio.updateMusic(0, true, false, profile());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(audio.diagnostics().playing).toBe(true);
    audio.dispose();
  });
});
