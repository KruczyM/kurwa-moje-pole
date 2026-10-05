import { describe, expect, it, vi } from 'vitest';
import { AcousticGuitarSynth, CAMPFIRE_CHORDS, DEFAULT_CAMPFIRE_PROGRESSION } from './AcousticGuitarSynth';

function createMockAudioContext() {
  const gainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
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
    onended: null as (() => void) | null,
    disconnect: vi.fn(),
  };

  const biquadFilter = {
    type: 'peaking',
    frequency: { value: 520 },
    Q: { value: 1.2 },
    gain: { value: 4.0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    sampleRate: 44100,
    currentTime: 0,
    state: 'running',
    destination: {},
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => ({ ...bufferSource })),
    createBiquadFilter: vi.fn(() => biquadFilter),
    createGain: vi.fn(() => ({ ...gainNode, gain: { ...gainNode.gain } })),
    resume: vi.fn(() => Promise.resolve()),
  };

  return { ctx: ctx as unknown as AudioContext, gainNode, bufferSource, biquadFilter };
}

describe('AcousticGuitarSynth', () => {
  it('initializes with chords and progression', () => {
    const synth = new AcousticGuitarSynth();
    expect(synth.running).toBe(false);
    expect(CAMPFIRE_CHORDS.C.length).toBeGreaterThan(0);
    expect(DEFAULT_CAMPFIRE_PROGRESSION).toEqual(['G', 'D', 'Em', 'C']);
  });

  it('starts and stops playback correctly', () => {
    const { ctx } = createMockAudioContext();
    const synth = new AcousticGuitarSynth({ audioContext: ctx });

    synth.start();
    expect(synth.running).toBe(true);

    synth.stop();
    expect(synth.running).toBe(false);
  });

  it('strums chord with AudioContext and triggers buffer sources', () => {
    const { ctx } = createMockAudioContext();
    const synth = new AcousticGuitarSynth({ audioContext: ctx });

    synth.start();
    synth.strumChord('G', 'down');
    expect(ctx.createBufferSource).toHaveBeenCalled();

    synth.strumChord('C', 'up');
    expect(ctx.createBufferSource).toHaveBeenCalled();
    synth.dispose();
  });

  it('calculates spatial gain based on distance to campfire', () => {
    const synth = new AcousticGuitarSynth({
      campfirePosition: { x: 5, y: 0, z: -3 },
      innerRadius: 3,
      outerRadius: 30,
      baseVolume: 1.0,
    });

    // Close to fire (< 3m)
    const closeGain = synth.calculateSpatialGain({ x: 5.5, y: 0, z: -3 });
    expect(closeGain).toBe(1.0);

    // Far from fire (> 30m)
    const farGain = synth.calculateSpatialGain({ x: 50, y: 0, z: -3 });
    expect(farGain).toBe(0.0);

    // Mid distance (around 16.5m)
    const midGain = synth.calculateSpatialGain({ x: 21.5, y: 0, z: -3 });
    expect(midGain).toBeGreaterThan(0.1);
    expect(midGain).toBeLessThan(0.9);
  });

  it('advances rhythm and changes chords across delta time', () => {
    const { ctx } = createMockAudioContext();
    const synth = new AcousticGuitarSynth({ audioContext: ctx });

    synth.start();
    const createSourceCountBefore = vi.mocked(ctx.createBufferSource).mock.calls.length;

    // Simulate 2 seconds of playback
    for (let i = 0; i < 20; i++) {
      synth.update(0.1, { x: 5.5, y: 0, z: -3 });
    }

    const createSourceCountAfter = vi.mocked(ctx.createBufferSource).mock.calls.length;
    expect(createSourceCountAfter).toBeGreaterThan(createSourceCountBefore);
    synth.dispose();
  });
});
