import { describe, expect, it, vi } from 'vitest';
import { TentMenuAudio, DEFAULT_TENT_CUTOFF, DEFAULT_OPEN_CUTOFF } from './TentMenuAudio';

function createMockAudioContext() {
  const gainNode = {
    gain: {
      value: 0.42,
      setValueAtTime: vi.fn((v: number) => {
        gainNode.gain.value = v;
      }),
      setTargetAtTime: vi.fn((target: number) => {
        gainNode.gain.value = target;
      }),
      linearRampToValueAtTime: vi.fn((v: number) => {
        gainNode.gain.value = v;
      }),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const biquadFilter = {
    type: 'lowpass',
    frequency: {
      value: DEFAULT_TENT_CUTOFF,
      setValueAtTime: vi.fn((v: number) => {
        biquadFilter.frequency.value = v;
      }),
      exponentialRampToValueAtTime: vi.fn((v: number) => {
        biquadFilter.frequency.value = v;
      }),
      cancelScheduledValues: vi.fn(),
    },
    Q: { value: 1.15 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mediaSource = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    currentTime: 10,
    state: 'running',
    destination: {},
    createBiquadFilter: vi.fn(() => biquadFilter),
    createGain: vi.fn(() => gainNode),
    createMediaElementSource: vi.fn(() => mediaSource),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };

  return { ctx: ctx as unknown as AudioContext, biquadFilter, gainNode, mediaSource };
}

function createMockAudioElement() {
  return {
    loop: false,
    preload: '',
    paused: true,
    currentTime: 0,
    src: '',
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
  } as unknown as HTMLAudioElement;
}

describe('TentMenuAudio', () => {
  it('initializes with tent muffled cutoff (350 Hz) and volume', () => {
    const { ctx, biquadFilter } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    expect(tentAudio.muffled).toBe(true);
    expect(tentAudio.active).toBe(false);

    tentAudio.startTentAudio();

    expect(tentAudio.active).toBe(true);
    expect(biquadFilter.type).toBe('lowpass');
    expect(biquadFilter.frequency.value).toBe(DEFAULT_TENT_CUTOFF);
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('unmuffleAndOpen smoothly opens filter from 350 Hz to 20000 Hz', () => {
    const { ctx, biquadFilter } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    tentAudio.startTentAudio();
    tentAudio.unmuffleAndOpen(1.0);

    expect(tentAudio.muffled).toBe(false);
    expect(biquadFilter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_OPEN_CUTOFF,
      expect.any(Number),
    );
  });

  it('muffleToTent smoothly ramps filter back to 350 Hz on return', () => {
    const { ctx, biquadFilter } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    tentAudio.startTentAudio();
    tentAudio.unmuffleAndOpen(1.0);
    tentAudio.muffleToTent(0.8);

    expect(tentAudio.muffled).toBe(true);
    expect(biquadFilter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_TENT_CUTOFF,
      expect.any(Number),
    );
  });

  it('disposes cleanly without throwing', () => {
    const { ctx, biquadFilter, gainNode } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    tentAudio.startTentAudio();
    tentAudio.dispose();

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(biquadFilter.disconnect).toHaveBeenCalled();
    expect(gainNode.disconnect).toHaveBeenCalled();
  });
});
