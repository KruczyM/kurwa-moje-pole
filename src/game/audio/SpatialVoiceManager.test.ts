import { describe, it, expect, vi } from 'vitest';
import {
  computeVoiceSpatialGain,
  computeVoiceStereoPan,
  computeVoiceRms,
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

describe('SpatialVoiceManager - Speaking Detection', () => {
  it('computes RMS correctly from Float32Array audio buffer', () => {
    expect(computeVoiceRms(new Float32Array([]))).toBe(0);
    expect(computeVoiceRms(new Float32Array([0, 0, 0, 0]))).toBe(0);
    expect(computeVoiceRms(new Float32Array([0.1, -0.1, 0.1, -0.1]))).toBeCloseTo(0.1, 5);
    const data = new Float32Array([0, 0.5, 1.0, 0.5, 0, -0.5, -1.0, -0.5]);
    expect(computeVoiceRms(data)).toBeCloseTo(Math.sqrt(3 / 8), 4);
  });

  it('reports speaking status and triggers callbacks on peer speaking change', () => {
    const onSpeakingChange = vi.fn();
    const onSpeakingPeersChange = vi.fn();
    const manager = new SpatialVoiceManager(undefined, {
      onSpeakingChange,
      onSpeakingPeersChange,
    });

    const listener = vi.fn();
    const unsub = manager.onSpeakingPeersChange(listener);

    expect(manager.isPeerSpeaking('peer-1')).toBe(false);
    expect(manager.getSpeakingPeers().size).toBe(0);

    // Peer 1 starts speaking:
    manager.setPeerSpeaking('peer-1', true);
    expect(manager.isPeerSpeaking('peer-1')).toBe(true);
    expect(manager.getSpeakingPeers().has('peer-1')).toBe(true);
    expect(onSpeakingChange).toHaveBeenCalledWith('peer-1', true);
    expect(onSpeakingPeersChange).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith(expect.any(Set));

    // Peer 1 stops speaking:
    manager.setPeerSpeaking('peer-1', false);
    expect(manager.isPeerSpeaking('peer-1')).toBe(false);
    expect(manager.getSpeakingPeers().has('peer-1')).toBe(false);
    expect(onSpeakingChange).toHaveBeenCalledWith('peer-1', false);

    unsub();
    manager.dispose();
  });

  it('detects speaking in update loop based on AnalyserNode RMS', () => {
    const manager = new SpatialVoiceManager(undefined, { speakingThreshold: 0.02 });

    const peer: any = (manager as any).getOrCreatePeer('peer-test', false);

    let mockBufferValues = new Float32Array(256).fill(0);
    peer.analyserNode = {
      fftSize: 256,
      getFloatTimeDomainData: (arr: Float32Array) => {
        arr.set(mockBufferValues);
      },
      disconnect: vi.fn(),
    };

    const remotePositions = new Map([['peer-test', { x: 5, y: 0, z: 0 }]]);

    // Update with silence:
    manager.update({ x: 0, y: 0, z: 0 }, 0, remotePositions);
    expect(manager.isPeerSpeaking('peer-test')).toBe(false);

    // Update with speech (RMS = 0.05 > 0.02):
    mockBufferValues = new Float32Array(256).fill(0.05);
    manager.update({ x: 0, y: 0, z: 0 }, 0, remotePositions);
    expect(manager.isPeerSpeaking('peer-test')).toBe(true);

    // Update with silence again:
    mockBufferValues = new Float32Array(256).fill(0.005);
    manager.update({ x: 0, y: 0, z: 0 }, 0, remotePositions);
    expect(manager.isPeerSpeaking('peer-test')).toBe(false);

    manager.dispose();
  });
});
