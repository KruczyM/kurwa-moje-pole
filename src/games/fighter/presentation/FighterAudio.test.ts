import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FighterAudio } from './FighterAudio';

describe('FighterAudio (Funny Cartoon Sound Effects & Comic Reactions)', () => {
  let createdNodes: any[];

  function createMockAudioContext() {
    createdNodes = [];

    const mockParam = () => ({
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      value: 1.0,
    });

    const mockNode = (type: string) => {
      const node = {
        _type: type,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: mockParam(),
        gain: mockParam(),
        Q: mockParam(),
        playbackRate: mockParam(),
        buffer: null,
      };
      createdNodes.push(node);
      return node;
    };

    return class MockAudioContext {
      currentTime = 0;
      sampleRate = 44100;
      state = 'running';
      destination = mockNode('destination');
      resume = vi.fn().mockResolvedValue(undefined);
      createOscillator = vi.fn(() => mockNode('oscillator'));
      createGain = vi.fn(() => mockNode('gain'));
      createBiquadFilter = vi.fn(() => mockNode('filter'));
      createBuffer = vi.fn((_ch, len) => ({
        getChannelData: vi.fn(() => new Float32Array(len)),
      }));
      createBufferSource = vi.fn(() => mockNode('bufferSource'));
      decodeAudioData = vi.fn().mockResolvedValue({ duration: 1.0 });
    };
  }

  const originalWindow = globalThis.window;

  beforeEach(() => {
    createdNodes = [];
    (globalThis as any).window = {
      AudioContext: createMockAudioContext(),
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('instantiates cleanly and respects setEnabled toggle', () => {
    const audio = new FighterAudio();
    expect(audio.isEnabled()).toBe(true);

    audio.setEnabled(false);
    expect(audio.isEnabled()).toBe(false);

    createdNodes = [];
    audio.playBonk();
    expect(createdNodes.length).toBe(0);
  });

  it('plays Bonk (frying pan clonk) with main oscillator and metallic resonance filter', () => {
    const audio = new FighterAudio();
    audio.playBonk();

    const oscillators = createdNodes.filter((n) => n._type === 'oscillator');
    const filters = createdNodes.filter((n) => n._type === 'filter');
    const gains = createdNodes.filter((n) => n._type === 'gain');

    expect(oscillators.length).toBe(2); // Fundamental + metallic ping
    expect(filters.length).toBe(1); // Bandpass metallic resonance
    expect(gains.length).toBe(2);
    expect(oscillators[0].start).toHaveBeenCalled();
    expect(oscillators[1].start).toHaveBeenCalled();
  });

  it('plays Slap (wet cartoon slap) using shaped noise buffer and transient pop', () => {
    const audio = new FighterAudio();
    audio.playSlap();

    const bufferSources = createdNodes.filter((n) => n._type === 'bufferSource');
    const oscillators = createdNodes.filter((n) => n._type === 'oscillator');
    const filters = createdNodes.filter((n) => n._type === 'filter');

    expect(bufferSources.length).toBe(1); // Noise burst
    expect(oscillators.length).toBe(1); // High pitch pop
    expect(filters.length).toBe(1); // Bandpass
    expect(bufferSources[0].start).toHaveBeenCalled();
    expect(oscillators[0].start).toHaveBeenCalled();
  });

  it('plays Boing (cartoon spring) with vibrato LFO modulating carrier frequency', () => {
    const audio = new FighterAudio();
    audio.playBoing();

    const oscillators = createdNodes.filter((n) => n._type === 'oscillator');
    expect(oscillators.length).toBe(2); // Carrier + LFO
    expect(oscillators[0].connect).toHaveBeenCalled(); // Carrier connected
    expect(oscillators[1].connect).toHaveBeenCalled(); // LFO connected to frequency
  });

  it('plays Squeak (rubber duck / toy squeak) with sharp double chirp frequency ramps', () => {
    const audio = new FighterAudio();
    audio.playSqueak();

    const oscillators = createdNodes.filter((n) => n._type === 'oscillator');
    expect(oscillators.length).toBe(1);
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalled();
    expect(oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledTimes(2);
  });

  it('plays Honk (clown bike horn) with dual detuned oscillators and double-honk envelope', () => {
    const audio = new FighterAudio();
    audio.playHonk();

    const oscillators = createdNodes.filter((n) => n._type === 'oscillator');
    const filters = createdNodes.filter((n) => n._type === 'filter');

    expect(oscillators.length).toBe(2); // Detuned pair
    expect(filters.length).toBe(1);
    expect(oscillators[0].start).toHaveBeenCalled();
    expect(oscillators[1].start).toHaveBeenCalled();
  });

  it('plays Fart (comic buzz / prrr) with low-frequency flutter tremolo on sweeps', () => {
    const audio = new FighterAudio();
    audio.playFart();

    const oscillators = createdNodes.filter((n) => n._type === 'oscillator');
    const filters = createdNodes.filter((n) => n._type === 'filter');

    expect(oscillators.length).toBe(2); // Sawtooth + square tremolo
    expect(filters.length).toBe(1); // Lowpass
    expect(oscillators[0].start).toHaveBeenCalled();
    expect(oscillators[1].start).toHaveBeenCalled();
  });

  it('plays Pop (popping cork) and Slide Whistle in both directions', () => {
    const audio = new FighterAudio();
    audio.playPop();
    expect(createdNodes.some((n) => n._type === 'oscillator')).toBe(true);

    createdNodes = [];
    audio.playSlideWhistle('up');
    expect(createdNodes.some((n) => n._type === 'oscillator')).toBe(true);

    createdNodes = [];
    audio.playSlideWhistle('down');
    expect(createdNodes.some((n) => n._type === 'oscillator')).toBe(true);
  });

  it('dispatches funny hit audio intelligently based on launcher, juggle, knockdown, height, and damage', () => {
    const audio = new FighterAudio();

    // Launcher (uppercut) -> Boing + Whistle Up
    createdNodes = [];
    audio.playFunnyHit({ isLauncher: true, defenderId: 'amper' });
    expect(createdNodes.length).toBeGreaterThanOrEqual(3);

    // Airborne juggle -> Pop / Squeak / Boing
    createdNodes = [];
    audio.playFunnyHit({ isAirJuggle: true, defenderId: 'korba' });
    expect(createdNodes.length).toBeGreaterThanOrEqual(1);

    // Knockdown / Low Sweep -> Fart or Whistle Down
    createdNodes = [];
    audio.playFunnyHit({ causesKnockdown: true, hitHeight: 'low', defenderId: 'korba' });
    expect(createdNodes.length).toBeGreaterThanOrEqual(2);

    // High punch (face hit) -> Slap / Bonk / Squeak
    createdNodes = [];
    audio.playFunnyHit({ hitHeight: 'high', damage: 45, defenderId: 'amper' });
    expect(createdNodes.length).toBeGreaterThanOrEqual(2);

    // Heavy punch -> Frying Pan Bonk or Clown Honk
    createdNodes = [];
    audio.playFunnyHit({ isHeavy: true, damage: 90, defenderId: 'pien' });
    expect(createdNodes.length).toBeGreaterThanOrEqual(2);
  });

  it('handles block, swing and funny KO gong correctly', () => {
    const audio = new FighterAudio();

    createdNodes = [];
    audio.playBlock();
    expect(createdNodes.some((n) => n._type === 'oscillator')).toBe(true);

    createdNodes = [];
    audio.playSwing();
    expect(createdNodes.some((n) => n._type === 'oscillator')).toBe(true);

    createdNodes = [];
    audio.playFunnyKO();
    expect(createdNodes.length).toBeGreaterThanOrEqual(2);
  });
});
