import { describe, expect, it, vi } from 'vitest';
import { CampAmbientAudio, DEFAULT_AMBIENT_VOLUME } from './CampAmbientAudio';

function createMockAudioContext() {
  const gainNode = {
    gain: {
      value: 1,
      setTargetAtTime: vi.fn((target: number) => {
        gainNode.gain.value = target;
      }),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const bufferSource = {
    buffer: null as unknown,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };

  const biquadFilter = {
    type: 'lowpass',
    frequency: { value: 350 },
    Q: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const oscillator = {
    type: 'sine',
    frequency: { value: 0.1 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    sampleRate: 44100,
    currentTime: 0,
    state: 'running',
    destination: {},
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(44100 * 2)),
    })),
    createBufferSource: vi.fn(() => bufferSource),
    createBiquadFilter: vi.fn(() => biquadFilter),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gainNode),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };

  return { ctx: ctx as unknown as AudioContext, gainNode, bufferSource, oscillator };
}

describe('CampAmbientAudio', () => {
  it('initializes with default or custom volume', () => {
    const ambientDefault = new CampAmbientAudio();
    expect(ambientDefault.volume).toBe(DEFAULT_AMBIENT_VOLUME);
    expect(ambientDefault.active).toBe(false);

    const ambientCustom = new CampAmbientAudio({ defaultVolume: 0.6 });
    expect(ambientCustom.volume).toBe(0.6);
  });

  it('connects audio graph and starts playback with AudioContext', () => {
    const { ctx, bufferSource, oscillator } = createMockAudioContext();
    const ambient = new CampAmbientAudio({ audioContext: ctx, defaultVolume: 0.5 });

    ambient.start();
    expect(ambient.active).toBe(true);
    expect(bufferSource.start).toHaveBeenCalled();
    expect(oscillator.start).toHaveBeenCalled();
  });

  it('handles pause, resume and volume adjustment', () => {
    const { ctx, gainNode } = createMockAudioContext();
    const ambient = new CampAmbientAudio({ audioContext: ctx, defaultVolume: 0.5 });

    ambient.start();
    expect(ambient.active).toBe(true);

    ambient.setVolume(0.8);
    expect(ambient.volume).toBe(0.8);
    expect(gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, expect.any(Number), expect.any(Number));

    ambient.pause();
    expect(ambient.active).toBe(false);
    expect(gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));

    ambient.resume();
    expect(ambient.active).toBe(true);
    expect(gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, expect.any(Number), expect.any(Number));

    ambient.dispose();
    expect(ambient.active).toBe(false);
  });

  it('runs safely without AudioContext in unsupported environments', () => {
    const ambient = new CampAmbientAudio();
    // In node environment with no window.AudioContext
    expect(() => ambient.start()).not.toThrow();
    expect(() => ambient.pause()).not.toThrow();
    expect(() => ambient.resume()).not.toThrow();
    expect(() => ambient.dispose()).not.toThrow();
  });
});
