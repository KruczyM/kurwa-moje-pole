import { describe, expect, it, vi } from 'vitest';
import {
  TentMenuAudio,
  DEFAULT_TENT_CUTOFF,
  DEFAULT_OPEN_CUTOFF,
  DEFAULT_TENT_VOLUME,
} from './TentMenuAudio';

function createMockAudioContext() {
  const gainNode = {
    gain: {
      value: DEFAULT_TENT_VOLUME,
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

  const biquadFilters: Array<{
    type: string;
    frequency: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      cancelScheduledValues: ReturnType<typeof vi.fn>;
    };
    Q: { value: number };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  const mediaSource = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    currentTime: 10,
    state: 'running',
    destination: {},
    createBiquadFilter: vi.fn(() => {
      const f = {
        type: 'lowpass',
        frequency: {
          value: DEFAULT_TENT_CUTOFF,
          setValueAtTime: vi.fn((v: number) => {
            f.frequency.value = v;
          }),
          exponentialRampToValueAtTime: vi.fn((v: number) => {
            f.frequency.value = v;
          }),
          cancelScheduledValues: vi.fn(),
        },
        Q: { value: 1.15 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      biquadFilters.push(f);
      return f;
    }),
    createGain: vi.fn(() => gainNode),
    createMediaElementSource: vi.fn(() => mediaSource),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };

  return { ctx: ctx as unknown as AudioContext, biquadFilters, gainNode, mediaSource };
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
  it('initializes with tent muffled cutoff (185 Hz) and volume', () => {
    const { ctx, biquadFilters } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    expect(tentAudio.muffled).toBe(true);
    expect(tentAudio.active).toBe(false);

    tentAudio.startTentAudio();

    expect(tentAudio.active).toBe(true);
    expect(biquadFilters.length).toBe(2);
    expect(biquadFilters[0].type).toBe('lowpass');
    expect(biquadFilters[0].frequency.value).toBe(DEFAULT_TENT_CUTOFF);
    expect(biquadFilters[1].type).toBe('lowpass');
    expect(biquadFilters[1].frequency.value).toBe(DEFAULT_TENT_CUTOFF);
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('unmuffleAndOpen smoothly opens cascaded filters from 185 Hz to 20000 Hz', () => {
    const { ctx, biquadFilters } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    tentAudio.startTentAudio();
    tentAudio.unmuffleAndOpen(1.0);

    expect(tentAudio.muffled).toBe(false);
    expect(biquadFilters.length).toBe(2);
    expect(biquadFilters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_OPEN_CUTOFF,
      expect.any(Number),
    );
    expect(biquadFilters[1].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_OPEN_CUTOFF,
      expect.any(Number),
    );
  });

  it('muffleToTent smoothly ramps cascaded filters back to 185 Hz on return', () => {
    const { ctx, biquadFilters } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    tentAudio.startTentAudio();
    tentAudio.unmuffleAndOpen(1.0);
    tentAudio.muffleToTent(0.8);

    expect(tentAudio.muffled).toBe(true);
    expect(biquadFilters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_TENT_CUTOFF,
      expect.any(Number),
    );
    expect(biquadFilters[1].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_TENT_CUTOFF,
      expect.any(Number),
    );
  });

  it('stops immediately without fade duration', () => {
    const { ctx, gainNode } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    tentAudio.startTentAudio();
    expect(tentAudio.active).toBe(true);

    tentAudio.stopImmediate();
    expect(tentAudio.active).toBe(false);
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(gainNode.gain.cancelScheduledValues).toHaveBeenCalledWith(ctx.currentTime);
    expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, ctx.currentTime);
  });

  it('disposes cleanly without throwing', () => {
    const { ctx, biquadFilters, gainNode } = createMockAudioContext();
    const mockAudio = createMockAudioElement();

    const tentAudio = new TentMenuAudio({
      audioContext: ctx,
      audioFactory: () => mockAudio,
    });

    tentAudio.startTentAudio();
    tentAudio.dispose();

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(biquadFilters[0].disconnect).toHaveBeenCalled();
    expect(biquadFilters[1].disconnect).toHaveBeenCalled();
    expect(gainNode.disconnect).toHaveBeenCalled();
  });
});
