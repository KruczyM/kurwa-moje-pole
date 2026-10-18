import { describe, expect, it, vi } from 'vitest';
import { ItemUseSfxPlayer, DEFAULT_ITEM_USE_SFX_VOLUME } from './ItemUseSfx';

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
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };

  const biquadFilter = {
    type: 'lowpass',
    frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    Q: { setValueAtTime: vi.fn() },
    gain: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const oscillator = {
    type: 'sine',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
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
      getChannelData: vi.fn(() => new Float32Array(44100)),
    })),
    createBufferSource: vi.fn(() => bufferSource),
    createBiquadFilter: vi.fn(() => biquadFilter),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gainNode),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };

  return { ctx: ctx as unknown as AudioContext, gainNode, bufferSource, oscillator, biquadFilter };
}

describe('ItemUseSfxPlayer', () => {
  it('initializes with default or custom volume', () => {
    const player = new ItemUseSfxPlayer();
    expect(player.volume).toBe(DEFAULT_ITEM_USE_SFX_VOLUME);

    const playerCustom = new ItemUseSfxPlayer({ defaultVolume: 0.5 });
    expect(playerCustom.volume).toBe(0.5);

    playerCustom.setVolume(0.7);
    expect(playerCustom.volume).toBe(0.7);
  });

  it('synthesizes beer_open sfx with snap and hiss', () => {
    const { ctx, oscillator, bufferSource } = createMockAudioContext();
    const player = new ItemUseSfxPlayer({ audioContext: ctx });

    const played = player.play('beer_open');
    expect(played).toBe(true);
    expect(oscillator.start).toHaveBeenCalled();
    expect(bufferSource.start).toHaveBeenCalled();
  });

  it('synthesizes lighter_flick sfx with friction and gas rush', () => {
    const { ctx, bufferSource } = createMockAudioContext();
    const player = new ItemUseSfxPlayer({ audioContext: ctx });

    const played = player.play('lighter_flick');
    expect(played).toBe(true);
    expect(bufferSource.start).toHaveBeenCalled();
  });

  it('synthesizes sniff and swallow sfx', () => {
    const { ctx, bufferSource, oscillator } = createMockAudioContext();
    const player = new ItemUseSfxPlayer({ audioContext: ctx });

    expect(player.play('sniff')).toBe(true);
    expect(bufferSource.start).toHaveBeenCalled();

    expect(player.play('swallow')).toBe(true);
    expect(oscillator.start).toHaveBeenCalled();
  });

  it('returns false for unknown sound IDs', () => {
    const { ctx } = createMockAudioContext();
    const player = new ItemUseSfxPlayer({ audioContext: ctx });

    expect(player.play('unknown_sound')).toBe(false);
  });

  it('handles dispose and uninitialized audio context safely', () => {
    const player = new ItemUseSfxPlayer();
    expect(() => player.play('beer_open')).not.toThrow();
    player.dispose();
    expect(player.play('beer_open')).toBe(false);
  });
});
