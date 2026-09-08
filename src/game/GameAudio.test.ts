import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultAudioSettings, loadAudioSettings } from './Game';

describe('Game audio settings persistence & fallback', () => {
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

  it('returns default audio settings when localStorage is empty', () => {
    const settings = loadAudioSettings();
    expect(settings).toEqual(defaultAudioSettings);
  });

  it('loads valid custom audio settings from localStorage', () => {
    localStorage.setItem(
      'camp-audio-settings',
      JSON.stringify({ speakerVolume: 0.9, ambientVolume: 0.2, speakerEnabled: true }),
    );
    const settings = loadAudioSettings();
    expect(settings.speakerVolume).toBe(0.9);
    expect(settings.ambientVolume).toBe(0.2);
    expect(settings.speakerEnabled).toBe(true);
  });

  it('clamps out-of-range volume values between 0 and 1', () => {
    localStorage.setItem(
      'camp-audio-settings',
      JSON.stringify({ speakerVolume: 2.5, ambientVolume: -0.8, speakerEnabled: false }),
    );
    const settings = loadAudioSettings();
    expect(settings.speakerVolume).toBe(1);
    expect(settings.ambientVolume).toBe(0);
    expect(settings.speakerEnabled).toBe(false);
  });

  it('handles invalid JSON gracefully and falls back to defaults', () => {
    localStorage.setItem('camp-audio-settings', 'invalid-json{{{');
    const settings = loadAudioSettings();
    expect(settings).toEqual(defaultAudioSettings);
  });
});
