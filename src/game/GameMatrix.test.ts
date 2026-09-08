import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadVisualSettings } from './Game';
import { defaultVisualSettings } from './effects/EffectManager';

describe('Game Matrix Visual Settings', () => {
  const originalLocalStorage = globalThis.localStorage;
  let storageMock: Record<string, string> = {};

  beforeEach(() => {
    storageMock = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => storageMock[key] ?? null,
        setItem: (key: string, value: string) => {
          storageMock[key] = String(value);
        },
        removeItem: (key: string) => {
          delete storageMock[key];
        },
        clear: () => {
          storageMock = {};
        },
      },
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

  it('loads default matrix settings when localStorage is empty', () => {
    const settings = loadVisualSettings();
    expect(settings.matrixMode).toBe('auto');
    expect(settings.matrixQuality).toBe('medium');
  });

  it('loads valid custom matrix settings from localStorage', () => {
    storageMock['camp-visual-settings'] = JSON.stringify({
      matrixMode: 'always',
      matrixQuality: 'high',
    });

    const settings = loadVisualSettings();
    expect(settings.matrixMode).toBe('always');
    expect(settings.matrixQuality).toBe('high');
  });

  it('falls back to defaults for invalid matrix mode or quality values', () => {
    storageMock['camp-visual-settings'] = JSON.stringify({
      matrixMode: 'invalid_mode',
      matrixQuality: 'super_ultra_fake',
    });

    const settings = loadVisualSettings();
    expect(settings.matrixMode).toBe(defaultVisualSettings.matrixMode);
    expect(settings.matrixQuality).toBe(defaultVisualSettings.matrixQuality);
  });
});
