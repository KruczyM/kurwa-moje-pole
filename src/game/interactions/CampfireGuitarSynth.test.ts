import { describe, expect, it, vi } from 'vitest';
import { CampfireGuitarSynth, type GuitarNote } from './CampfireGuitarGame';

function readySynth() {
  const synth = new CampfireGuitarSynth();
  const internals = synth as any;
  internals.ctx = { state: 'running', currentTime: 100 };
  internals.masterGain = {};
  internals.backingGain = {};
  const play = vi.spyOn(internals, 'playBackingStep').mockImplementation(() => {});
  synth.startBackingTrack();
  return { synth, play, internals };
}

describe('guitar backing lifecycle', () => {
  it('skips stale beats after a stall rather than stacking them at the same time', () => {
    const { synth, play } = readySynth();
    synth.updateBackingTrack(0, 120, ['Am']);
    synth.updateBackingTrack(30, 120, ['Am']);
    expect(play).toHaveBeenCalledTimes(2);
    synth.updateBackingTrack(30, 120, ['Am']);
    synth.updateBackingTrack(NaN, 120, ['Am']);
    synth.updateBackingTrack(31, 0, ['Am']);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('follows the actual MIDI melody rather than treating a sorted pitch list as chords', () => {
    const { synth, play } = readySynth();
    const notes: GuitarNote[] = [
      { id: 'a', lane: 0, time: 2.5, chordName: 'C#4' },
      { id: 'b', lane: 4, time: 3, chordName: 'G4' },
    ];
    synth.updateBackingTrack(0, 120, ['A4', 'C#4', 'G4'], notes);
    expect(play).not.toHaveBeenCalled();
    synth.updateBackingTrack(2.5, 120, ['A4', 'C#4', 'G4'], notes);
    expect(play).toHaveBeenLastCalledWith('C#4', expect.any(Number), 100);
    synth.updateBackingTrack(3, 120, ['A4', 'C#4', 'G4'], notes);
    expect(play).toHaveBeenLastCalledWith('G4', expect.any(Number), 100);
  });

  it('stops and disconnects active backing voices when exiting, with idempotent cleanup', () => {
    const { synth, internals } = readySynth();
    const voice = { stop: vi.fn(), disconnect: vi.fn(), onended: null };
    const filter = { disconnect: vi.fn() };
    internals.trackBackingVoice(voice, filter);
    synth.stopBackingTrack();
    synth.stopBackingTrack();
    expect(voice.stop).toHaveBeenCalledTimes(1);
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(filter.disconnect).toHaveBeenCalledTimes(1);
    expect(internals.backingVoices.size).toBe(0);
  });

  it('backing track does not invoke guitar string plucking, leaving guitar exclusively for player hits', () => {
    const synth = new CampfireGuitarSynth();
    const internals = synth as any;
    internals.ctx = {
      state: 'running',
      currentTime: 100,
      sampleRate: 44100,
      createOscillator: () => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }),
      createBiquadFilter: () => ({
        type: 'lowpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
      createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
      createBufferSource: () => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
    };
    internals.masterGain = { connect: vi.fn() };
    internals.backingGain = { connect: vi.fn() };
    const playPlucked = vi.spyOn(internals, 'playPluckedString');

    synth.startBackingTrack();
    internals.playBackingStep('Am', 0, 100);
    internals.playBackingStep('Am', 2, 100.5);

    expect(playPlucked).not.toHaveBeenCalled();
    expect(internals.backingVoices.size).toBeGreaterThan(0);
  });
});
