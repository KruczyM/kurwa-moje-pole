import { describe, expect, it, vi } from 'vitest';
import { CampfireGuitarGame } from './CampfireGuitarGame';
import { CampfireGuitarSampler, normalizePitchToSample } from '../audio/CampfireGuitarSampler';

describe('Campfire Guitar Audio Muting and Performance', () => {
  it('normalizes MIDI and sharp notes to sampled acoustic guitar notes', () => {
    expect(normalizePitchToSample('C#4').sampleName).toBe('Db4');
    expect(normalizePitchToSample('F#4').sampleName).toBe('Gb4');
    expect(normalizePitchToSample('G#3').sampleName).toBe('Ab3');
    expect(normalizePitchToSample('D#5').sampleName).toBe('Eb5');
    expect(normalizePitchToSample('A#4').sampleName).toBe('Bb4');
    expect(normalizePitchToSample('A4').sampleName).toBe('A4');
    expect(normalizePitchToSample('E2').sampleName).toBe('E2');
    expect(normalizePitchToSample('C3').sampleName).toBe('C3');
  });

  it('sampler provides physical Karplus-Strong string synthesis when samples are not yet loaded', () => {
    const mockCtx = {
      sampleRate: 44100,
      currentTime: 0,
      state: 'running',
      createBuffer: vi.fn((_c, len) => ({ getChannelData: () => new Float32Array(len) })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        playbackRate: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'peaking',
        frequency: { value: 520 },
        Q: { value: 1.2 },
        gain: { value: 3.0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      resume: vi.fn(() => Promise.resolve()),
    } as unknown as AudioContext;

    const sampler = new CampfireGuitarSampler({ context: mockCtx });
    sampler.playPlucked('C#4', 0);
    expect(mockCtx.createBuffer).toHaveBeenCalled();
    expect(mockCtx.createBufferSource).toHaveBeenCalled();
  });

  it('guitar phase changes between idle, song_select, playing and song_finished correctly', () => {
    const game = new CampfireGuitarGame();
    expect(game.getPhase()).toBe('idle');

    game.openSongSelect();
    expect(game.getPhase()).toBe('song_select');

    game.startSong('czerwony-cegla-midi');
    expect(game.getPhase()).toBe('playing');

    game.stopSong();
    expect(game.getPhase()).toBe('idle');
  });

  it('hitLane invokes sampler playPlucked with the authentic chord or note', () => {
    const playChordSpy = vi.fn();
    const mockSynth = {
      init: vi.fn(),
      startBackingTrack: vi.fn(),
      stopBackingTrack: vi.fn(),
      updateBackingTrack: vi.fn(),
      playChord: playChordSpy,
      playMissBuzz: vi.fn(),
      playCrowdCheer: vi.fn(),
      dispose: vi.fn(),
    };

    const game = new CampfireGuitarGame(
      {},
      mockSynth as any,
    );

    game.startSong('czerwony-cegla-midi');
    const song = (game as any).currentSong;
    const firstNote = song.notes[0];

    game.hitLane(firstNote.lane, firstNote.time);
    expect(playChordSpy).toHaveBeenCalledWith(firstNote.chordName, firstNote.lane, 'czerwony-cegla-midi');
  });
});
