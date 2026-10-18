import { describe, expect, it } from 'vitest';
import { prepareSoundtrackLoop, soundtrackLoopPosition } from './SoundtrackLoop';

describe('soundtrack overlap', () => {
  it('blends stereo tail into opening with continuous endpoints and no gain overshoot', () => {
    const channels = [new Float32Array(40).fill(0.6), new Float32Array(40).fill(-0.6)];
    channels[0].fill(-0.4, 32);
    channels[1].fill(0.4, 32);
    const buffer = {
      sampleRate: 10,
      length: 40,
      numberOfChannels: 2,
      getChannelData: (channel: number) => channels[channel],
    } as AudioBuffer;
    expect(prepareSoundtrackLoop(buffer)).toBe(0.8);
    expect(channels[0][32]).toBeCloseTo(-0.4);
    expect(channels[0][39]).toBeCloseTo(channels[0][7]);
    expect(channels[1][39]).toBeCloseTo(channels[1][7]);
    expect(channels[0][36]).toBeGreaterThan(-0.4);
    expect(channels[0][36]).toBeLessThan(0.6);
    expect(channels[0][8]).toBeCloseTo(0.6);
    expect(Math.max(...channels[0].map(Math.abs))).toBeLessThan(0.601);
  });

  it('bounds overlap for short clips and leaves tiny buffers alone', () => {
    const data = new Float32Array(8);
    expect(
      prepareSoundtrackLoop({
        sampleRate: 100,
        length: 8,
        numberOfChannels: 1,
        getChannelData: () => data,
      } as unknown as AudioBuffer),
    ).toBe(0.02);
    expect(prepareSoundtrackLoop({ sampleRate: 100, length: 1, numberOfChannels: 1 } as AudioBuffer)).toBe(0);
  });

  it('keeps intro and exact phase through loop boundaries', () => {
    expect(soundtrackLoopPosition(0, 8, 0.8)).toBe(0);
    expect(soundtrackLoopPosition(7.9, 8, 0.8)).toBe(7.9);
    expect(soundtrackLoopPosition(8, 8, 0.8)).toBe(0.8);
    expect(soundtrackLoopPosition(8 + 7.2 * 3 + 2, 8, 0.8)).toBeCloseTo(2.8);
  });
});
