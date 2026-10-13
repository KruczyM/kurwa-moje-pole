import { afterEach, describe, expect, it, vi } from 'vitest';
import { FighterAudio } from './FighterAudio';

function harness() {
  const sources: any[] = [],
    gains: any[] = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const context = {
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: () => {
      const gain = { ...node(), gain: parameter() };
      gains.push(gain);
      return gain;
    },
    createDynamicsCompressor: () => ({ ...node(), threshold: parameter(), ratio: parameter() }),
    createBufferSource: () => {
      const source = { ...node(), buffer: null, loop: false, start: vi.fn(), stop: vi.fn(), onended: null };
      sources.push(source);
      return source;
    },
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 1 }),
  };
  vi.stubGlobal('window', {
    AudioContext: function () {
      return context;
    },
  });
  const fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  vi.stubGlobal('fetch', fetch);
  return { audio: new FighterAudio(), context, fetch, sources, gains };
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
afterEach(() => vi.unstubAllGlobals());

describe('original fighter audio graph', () => {
  it('waits for interaction, caches samples, uses correct hit/guard/launch sounds and respects mute', async () => {
    const h = harness();
    h.audio.playLaunch();
    expect(h.fetch).not.toHaveBeenCalled();
    await h.audio.unlock();
    await flush();
    h.audio.playFunnyHit({ moveId: 'light_kick' });
    h.audio.playFunnyHit({ isHeavy: true });
    h.audio.playLaunch();
    h.audio.playBlock();
    h.audio.playLanding();
    await flush();
    for (const name of ['kick', 'heavy', 'launch', 'guard', 'land'])
      expect(h.fetch.mock.calls.some(([url]) => url.endsWith('/' + name + '.wav'))).toBe(true);
    h.audio.playLaunch();
    await flush();
    expect(h.fetch.mock.calls.filter(([url]) => url.endsWith('/launch.wav'))).toHaveLength(1);
    const count = h.sources.length;
    h.audio.setEnabled(false);
    h.audio.playHit('light');
    await flush();
    expect(h.sources).toHaveLength(count);
    h.audio.dispose();
  });
  it('crossfades menu and fight, ducks music for ultimate and releases every node', async () => {
    const h = harness();
    await h.audio.unlock();
    await flush();
    expect(h.sources[0].loop).toBe(true);
    h.audio.setScene('fight');
    await flush();
    expect(h.sources[0].stop).toHaveBeenCalledWith(0.42);
    h.audio.setVolumes(0.5, 0.7);
    h.audio.playSuperStartup();
    expect(h.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.11, 0, 0.08);
    h.audio.setVisible(false);
    expect(h.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.03);
    h.audio.dispose();
    await flush();
    expect(h.context.close).toHaveBeenCalled();
    for (const source of h.sources) expect(source.disconnect).toHaveBeenCalled();
  });
  it('does not start late sounds after disposal or a delayed download', async () => {
    const h = harness();
    await h.audio.unlock();
    await flush();
    let complete!: (reply: unknown) => void;
    h.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    h.audio.playUltimateImpact('gruczol');
    const count = h.sources.length;
    h.audio.dispose();
    complete({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await flush();
    expect(h.sources).toHaveLength(count);
  });
});
