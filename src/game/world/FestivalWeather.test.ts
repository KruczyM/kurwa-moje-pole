import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FestivalWeather } from './FestivalWeather';

function createMockAudioContext() {
  const gainNode = {
    gain: {
      value: 0,
      setTargetAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
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

  const filter = {
    type: 'lowpass',
    frequency: { value: 1400 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    sampleRate: 44100,
    currentTime: 0,
    destination: {},
    createBuffer: vi.fn((_c: number, len: number) => ({
      getChannelData: vi.fn(() => new Float32Array(len)),
    })),
    createBufferSource: vi.fn(() => ({ ...bufferSource })),
    createBiquadFilter: vi.fn(() => ({ ...filter })),
    createGain: vi.fn(() => ({ ...gainNode })),
  };

  return { ctx: ctx as unknown as AudioContext, gainNode, bufferSource };
}

describe('FestivalWeather', () => {
  it('initializes with clear weather and particle system', () => {
    const scene = new THREE.Scene();
    const weather = new FestivalWeather(scene, { particleCount: 100 });

    expect(weather.currentWeather).toBe('clear');
    expect(weather.isRaining).toBe(false);

    const rainGroup = scene.getObjectByName('FestivalWeather_Rain');
    expect(rainGroup).toBeDefined();

    weather.dispose();
  });

  it('toggles rain and updates opacity and audio gain', () => {
    const scene = new THREE.Scene();
    const { ctx } = createMockAudioContext();
    const weather = new FestivalWeather(scene, { particleCount: 100, audioContext: ctx });

    const next = weather.toggleRain();
    expect(next).toBe('rain');
    expect(weather.isRaining).toBe(true);

    const rainPoints = scene.getObjectByName('FestivalWeather_Rain')?.children[0] as THREE.Points;
    const mat = rainPoints.material as THREE.PointsMaterial;
    expect(mat.opacity).toBeGreaterThan(0);

    // Toggle back to clear
    const back = weather.toggleRain();
    expect(back).toBe('clear');
    expect(weather.isRaining).toBe(false);
    expect(mat.opacity).toBe(0);

    weather.dispose();
  });

  it('updates falling particles relative to camera position', () => {
    const scene = new THREE.Scene();
    const weather = new FestivalWeather(scene, {
      particleCount: 50,
      initialWeather: 'rain',
    });

    const camPos = new THREE.Vector3(10, 1.8, -20);
    weather.update(0.1, camPos);

    const rainGroup = scene.getObjectByName('FestivalWeather_Rain');
    expect(rainGroup?.position.x).toBe(10);
    expect(rainGroup?.position.z).toBe(-20);

    weather.dispose();
  });
});
