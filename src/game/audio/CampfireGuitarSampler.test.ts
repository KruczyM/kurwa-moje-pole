import { describe, expect, it, vi } from 'vitest';
import {
  CampfireGuitarSampler,
  normalizePitchToSample,
  pitchNameToMidi,
  CHORD_NOTE_MAP,
} from './CampfireGuitarSampler';

function createMockAudioContext() {
  const gainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const bufferSource = {
    buffer: null as unknown,
    playbackRate: {
      setValueAtTime: vi.fn(),
    },
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
    gain: { value: 3.0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    sampleRate: 44100,
    currentTime: 10,
    state: 'running',
    destination: {},
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => ({ ...bufferSource, playbackRate: { ...bufferSource.playbackRate } })),
    createBiquadFilter: vi.fn(() => biquadFilter),
    createGain: vi.fn(() => ({ ...gainNode, gain: { ...gainNode.gain } })),
    resume: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn((buf: ArrayBuffer) => Promise.resolve({ length: buf.byteLength } as unknown as AudioBuffer)),
  };

  return { ctx: ctx as unknown as AudioContext, gainNode, bufferSource, biquadFilter };
}

describe('CampfireGuitarSampler', () => {
  it('correctly maps note pitches and enharmonics to sample names', () => {
    expect(pitchNameToMidi('A4')).toBe(69);
    expect(pitchNameToMidi('C4')).toBe(60);
    expect(pitchNameToMidi('C#4')).toBe(61);
    expect(pitchNameToMidi('Db4')).toBe(61);
    expect(pitchNameToMidi('F#4')).toBe(66);
    expect(pitchNameToMidi('Gb4')).toBe(66);

    const a4 = normalizePitchToSample('A4');
    expect(a4.sampleName).toBe('A4');
    expect(a4.pitchRatio).toBeCloseTo(1.0);

    const cs4 = normalizePitchToSample('C#4');
    expect(cs4.sampleName).toBe('Db4');
    expect(cs4.pitchRatio).toBeCloseTo(1.0);

    const fs4 = normalizePitchToSample('F#4');
    expect(fs4.sampleName).toBe('Gb4');
    expect(fs4.pitchRatio).toBeCloseTo(1.0);

    // Dźwięk spoza bezpośredniego zakresu (np. oktawa -1) dobiera najbliższą próbkę z przesunięciem pitchRatio
    const cNeg1 = normalizePitchToSample('C-1');
    expect(cNeg1.sampleName).toBe('E2');
    expect(cNeg1.pitchRatio).toBeLessThan(1.0);
  });

  it('contains guitar chord voicings with appropriate low and high notes', () => {
    expect(CHORD_NOTE_MAP['C']).toBeDefined();
    expect(CHORD_NOTE_MAP['C']).toContain('C3');
    expect(CHORD_NOTE_MAP['C']).toContain('E4');

    expect(CHORD_NOTE_MAP['Am']).toBeDefined();
    expect(CHORD_NOTE_MAP['Am']).toContain('A2');
    expect(CHORD_NOTE_MAP['Am']).toContain('E4');

    expect(CHORD_NOTE_MAP['G']).toBeDefined();
    expect(CHORD_NOTE_MAP['G']).toContain('G2');
    expect(CHORD_NOTE_MAP['G']).toContain('G4');
  });

  it('plays note with Karplus-Strong fallback when sample is not yet loaded', () => {
    const { ctx } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    sampler.playPlucked('C4', 10);
    expect(ctx.createBuffer).toHaveBeenCalled();
    expect(ctx.createBufferSource).toHaveBeenCalled();
  });

  it('strums all strings of a chord when lane is undefined', () => {
    const { ctx } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    sampler.playPlucked('Am', 10);
    // Am ma 5 strun
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(5);
  });

  it('strums all strings of a chord when lane is provided with lane dynamics', () => {
    const { ctx } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    sampler.playPlucked('Am', 10, 2);
    // Am ma 5 strun — autentyczne bicie chwytu gitarowego w tonacji
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(5);
  });

  it('plays single string when a melodic pitch name is provided', () => {
    const { ctx } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    sampler.playPlucked('E4', 10);
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it('playPluckedFrequency converts Hz to acoustic string pluck', () => {
    const { ctx } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    sampler.playPluckedFrequency(440, 10); // A4
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it('finds nearest loaded buffer and pitch shifts it rather than falling back to Karplus-Strong', () => {
    const { ctx } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    // Manually inject a loaded buffer for A4 (MIDI 69)
    const mockA4 = { duration: 2.0 } as AudioBuffer;
    (sampler as any).buffers.set('A4', mockA4);

    const nearest = sampler.findNearestLoadedBuffer(71); // B4 (MIDI 71, +2 semitones)
    expect(nearest).not.toBeNull();
    expect(nearest!.buffer).toBe(mockA4);
    expect(nearest!.pitchRatio).toBeCloseTo(Math.pow(2, 2 / 12));

    // When playing B4, it should use the pitch-shifted loaded buffer instead of createBuffer for KS
    vi.mocked(ctx.createBuffer).mockClear();
    sampler.playPlucked('B4', 10);
    expect(ctx.createBuffer).not.toHaveBeenCalled();
    expect(ctx.createBufferSource).toHaveBeenCalled();
  });

  it('dampPreviousVoices chokes previous sounding strings when switching chords', () => {
    const { ctx } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    sampler.playPlucked('Am', 10);
    expect((sampler as any).activeVoices.size).toBe(5);

    sampler.dampPreviousVoices(0.045);
    // dampPreviousVoices schedules stop on all previous voices
    for (const v of (sampler as any).activeVoices) {
      expect(v.source.stop).toHaveBeenCalled();
    }
  });

  it('disposes resources and disconnects nodes cleanly', () => {
    const { ctx, biquadFilter } = createMockAudioContext();
    const sampler = new CampfireGuitarSampler({ context: ctx });

    sampler.playPlucked('E4', 10);
    sampler.dispose();
    expect(biquadFilter.disconnect).toHaveBeenCalled();
  });
});
