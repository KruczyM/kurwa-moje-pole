import { describe, it, expect, vi } from 'vitest';
import {
  computeVoiceSpatialGain,
  computeVoiceStereoPan,
  SpatialVoiceManager,
  VOICE_INNER_RADIUS,
  VOICE_OUTER_RADIUS,
} from './SpatialVoiceManager';

describe('SpatialVoiceManager - Attenuation and Spatialization', () => {
  it('gives full volume at distance within inner radius (<= 2m)', () => {
    expect(computeVoiceSpatialGain(0, false)).toBe(1.0);
    expect(computeVoiceSpatialGain(1.0, false)).toBe(1.0);
    expect(computeVoiceSpatialGain(VOICE_INNER_RADIUS, false)).toBe(1.0);
  });

  it('gives 0 volume at or beyond outer radius (>= 50m)', () => {
    expect(computeVoiceSpatialGain(VOICE_OUTER_RADIUS, false)).toBe(0.0);
    expect(computeVoiceSpatialGain(60, false)).toBe(0.0);
    expect(computeVoiceSpatialGain(100, false)).toBe(0.0);
  });

  it('attenuates quadratically between 2m and 50m', () => {
    // at midpoint: distance = 2 + (50 - 2) * 0.5 = 26m
    // ratio = 1 - (26 - 2)/48 = 0.5
    // gain = 0.5^2 = 0.25
    const gainMid = computeVoiceSpatialGain(26, false);
    expect(gainMid).toBeCloseTo(0.25, 4);

    // at quarter distance: distance = 2 + 12 = 14m
    // ratio = 1 - 12/48 = 0.75
    // gain = 0.75^2 = 0.5625
    const gainQuarter = computeVoiceSpatialGain(14, false);
    expect(gainQuarter).toBeCloseTo(0.5625, 4);
  });

  it('returns 0 volume when peer is muted regardless of distance', () => {
    expect(computeVoiceSpatialGain(0, true)).toBe(0.0);
    expect(computeVoiceSpatialGain(1.5, true)).toBe(0.0);
    expect(computeVoiceSpatialGain(10, true)).toBe(0.0);
  });

  it('scales volume according to userVolume parameter', () => {
    expect(computeVoiceSpatialGain(1.0, false, 0.5)).toBeCloseTo(0.5, 4);
    expect(computeVoiceSpatialGain(26, false, 0.8)).toBeCloseTo(0.25 * 0.8, 4);
    expect(computeVoiceSpatialGain(1.0, false, 0)).toBe(0);
  });

  it('computes stereo pan according to listener orientation and sound position', () => {
    // Listener at (0, 0) looking North (yaw = 0):
    // Source straight East at (10, 0): should be to the right (pan = 1)
    const panEast = computeVoiceStereoPan({ x: 0, z: 0 }, 0, { x: 10, z: 0 });
    expect(panEast).toBeCloseTo(1.0, 2);

    // Source straight West at (-10, 0): should be to the left (pan = -1)
    const panWest = computeVoiceStereoPan({ x: 0, z: 0 }, 0, { x: -10, z: 0 });
    expect(panWest).toBeCloseTo(-1.0, 2);

    // Source straight North at (0, -10): should be center (pan = 0)
    const panNorth = computeVoiceStereoPan({ x: 0, z: 0 }, 0, { x: 0, z: -10 });
    expect(panNorth).toBeCloseTo(0.0, 2);
  });
});

describe('SpatialVoiceManager - State and Lifecycle', () => {
  it('initializes in off state and supports mute toggling', () => {
    const onStateChange = vi.fn();
    const manager = new SpatialVoiceManager(undefined, { onMicStateChange: onStateChange });

    expect(manager.getMicState()).toBe('off');
    expect(manager.isMuted()).toBe(false);

    manager.setMute(true);
    expect(manager.isMuted()).toBe(true);

    manager.setMute(false);
    expect(manager.isMuted()).toBe(false);

    manager.dispose();
    expect(manager.getMicState()).toBe('off');
  });

  it('cleans up without error on dispose', () => {
    const manager = new SpatialVoiceManager();
    expect(() => manager.dispose()).not.toThrow();
    // multiple dispose calls should be safe:
    expect(() => manager.dispose()).not.toThrow();
  });
});
