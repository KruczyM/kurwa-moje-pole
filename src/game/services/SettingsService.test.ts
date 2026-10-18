import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SettingsService,
  loadVisualSettings,
  loadAudioSettings,
  defaultAudioSettings,
  INTENSE_EFFECTS,
  isIntenseEffect,
} from './SettingsService';
import { defaultVisualSettings } from '../effects/EffectManager';

describe('SettingsService', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('identifies intense effects correctly', () => {
    expect(INTENSE_EFFECTS).toContain('Grzyb');
    expect(INTENSE_EFFECTS).toContain('LSD');
    expect(isIntenseEffect('LSD')).toBe(true);
    expect(isIntenseEffect('Piwo')).toBe(false);
  });

  it('loads default visual settings when storage is empty', () => {
    const settings = loadVisualSettings();
    expect(settings.intensity).toBe(defaultVisualSettings.intensity);
    expect(settings.matrixMode).toBe(defaultVisualSettings.matrixMode);
    expect(settings.aspectRatio).toBe('auto');
  });

  it('loads default audio settings when storage is empty', () => {
    const settings = loadAudioSettings();
    expect(settings).toEqual(defaultAudioSettings);
  });

  it('updates visual settings and persists to localStorage', () => {
    const service = new SettingsService();
    let notified = false;
    service.onVisualChange((updated) => {
      if (updated.intensity === 0.42) notified = true;
    });

    service.updateVisual({ intensity: 0.42, reduceMotion: true, aspectRatio: '16:9' });
    expect(service.visual.intensity).toBe(0.42);
    expect(service.visual.reduceMotion).toBe(true);
    expect(service.visual.aspectRatio).toBe('16:9');
    expect(notified).toBe(true);

    const stored = JSON.parse(localStorage.getItem('camp-visual-settings') || '{}');
    expect(stored.intensity).toBe(0.42);
    expect(stored.reduceMotion).toBe(true);
    expect(stored.aspectRatio).toBe('16:9');
    service.dispose();
  });

  it('updates audio settings and persists to localStorage', () => {
    const service = new SettingsService();
    let notified = false;
    service.onAudioChange((updated) => {
      if (updated.speakerVolume === 0.9) notified = true;
    });

    service.updateAudio({ speakerVolume: 0.9 });
    expect(service.audio.speakerVolume).toBe(0.9);
    expect(notified).toBe(true);

    const stored = JSON.parse(localStorage.getItem('camp-audio-settings') || '{}');
    expect(stored.speakerVolume).toBe(0.9);
    service.dispose();
  });
});
