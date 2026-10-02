import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DayNightCycle } from './DayNightCycle';
import type { TimeOfDaySkybox } from './HorizonSkybox';

describe('DayNightCycle', () => {
  function createTestSetup() {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    const ambient = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    const fog = new THREE.Fog(0x8da1b5, 100, 380);

    const mockSkybox = {
      setPeriod: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    } as unknown as TimeOfDaySkybox;

    const cycle = new DayNightCycle(scene, sun, ambient, mockSkybox, fog, undefined, {
      cycleDurationSec: 60, // 60s dla szybkich testów
      initialTime: 0.35,     // Dzień
      autoAdvance: true,
    });

    return { scene, sun, ambient, fog, mockSkybox, cycle };
  }

  it('initializes in daytime with bright sunlight and low fairy lights', () => {
    const { cycle, sun, ambient } = createTestSetup();

    expect(cycle.getPeriod()).toBe('day');
    expect(cycle.isNight()).toBe(false);
    expect(sun.intensity).toBeGreaterThan(2.0);
    expect(ambient.intensity).toBeGreaterThan(1.0);

    const state = cycle.getState();
    expect(state.fairyLightsIntensity).toBe(0);
    expect(state.isFlashlightOn).toBe(false);
  });

  it('switches to night lighting when timeOfDay is set to midnight/night', () => {
    const { cycle, sun, ambient, fog, mockSkybox } = createTestSetup();

    cycle.setTimeOfDay(0.95); // Noc
    expect(cycle.getPeriod()).toBe('night');
    expect(cycle.isNight()).toBe(true);
    expect(mockSkybox.setPeriod).toHaveBeenCalledWith('night');

    // Nocne słońce/księżyc i chłodny ambient
    expect(sun.intensity).toBeLessThan(1.0);
    expect(ambient.intensity).toBeLessThan(0.8);
    expect(fog.far).toBeLessThan(250);

    const state = cycle.getState();
    expect(state.fairyLightsIntensity).toBeGreaterThan(1.0);
  });

  it('cycles through periods using advancePeriod()', () => {
    const { cycle } = createTestSetup();

    cycle.setTimeOfDay(0.35); // Dzień
    const evening = cycle.advancePeriod();
    expect(evening).toBe('evening');

    const night = cycle.advancePeriod();
    expect(night).toBe('night');

    const day = cycle.advancePeriod();
    expect(day).toBe('day');
  });

  it('toggles player flashlight and adjusts headlamp intensity', () => {
    const { cycle } = createTestSetup();
    const camera = new THREE.PerspectiveCamera();

    cycle.attachCamera(camera);
    expect(cycle.getFlashlightState()).toBe(false);

    const turnedOn = cycle.toggleFlashlight();
    expect(turnedOn).toBe(true);
    expect(cycle.getFlashlightState()).toBe(true);

    const turnedOff = cycle.toggleFlashlight();
    expect(turnedOff).toBe(false);
    expect(cycle.getFlashlightState()).toBe(false);
  });

  it('advances timeOfDay smoothly with delta time', () => {
    const { cycle } = createTestSetup();
    const initialTime = cycle.timeOfDay;

    cycle.update(15); // 15 sekund przy 60-sekundowym cyklu = +0.25 obrotu
    expect(cycle.timeOfDay).toBeCloseTo((initialTime + 0.25) % 1.0, 3);
  });

  it('disposes resources cleanly', () => {
    const { cycle, scene } = createTestSetup();
    expect(() => cycle.dispose()).not.toThrow();
  });
});
