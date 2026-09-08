import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INTENSE_EFFECTS, detectSystemReducedMotion, isIntenseEffect, loadVisualSettings } from './Game';
import { defaultVisualSettings } from './effects/EffectManager';

describe('Game Accessibility & Settings', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalMatchMedia = globalThis.matchMedia;

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
    Object.defineProperty(globalThis, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    });
  });

  it('correctly categorizes intense vs mild effects', () => {
    expect(INTENSE_EFFECTS).toContain('Grzyb');
    expect(INTENSE_EFFECTS).toContain('MDMA');
    expect(INTENSE_EFFECTS).toContain('LSD');
    expect(INTENSE_EFFECTS).toContain('Kreska');

    expect(isIntenseEffect('LSD')).toBe(true);
    expect(isIntenseEffect('Grzyb')).toBe(true);
    expect(isIntenseEffect('MDMA')).toBe(true);
    expect(isIntenseEffect('Kreska')).toBe(true);

    expect(isIntenseEffect('Piwo')).toBe(false);
    expect(isIntenseEffect('Papieros')).toBe(false);
    expect(isIntenseEffect('Joint')).toBe(false);
  });

  it('loads default settings when localStorage is empty and system motion preference is normal', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
      writable: true,
      configurable: true,
    });

    expect(detectSystemReducedMotion()).toBe(false);
    const settings = loadVisualSettings();
    expect(settings).toEqual(defaultVisualSettings);
    expect(settings.reduceMotion).toBe(false);
    expect(settings.disableFlashes).toBe(false);
    expect(settings.disableAberration).toBe(false);
  });

  it('automatically defaults to safe reduced-motion mode when OS prefers reduced motion and no manual settings exist', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
      writable: true,
      configurable: true,
    });

    expect(detectSystemReducedMotion()).toBe(true);
    const settings = loadVisualSettings();
    expect(settings.reduceMotion).toBe(true);
    expect(settings.limitSway).toBe(true);
    expect(settings.disableShake).toBe(true);
    expect(settings.disableFlashes).toBe(true);
    expect(settings.disableAberration).toBe(true);
  });

  it('preserves user preference overrides from localStorage even if OS prefers reduced motion', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      value: () => ({
        matches: true,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
      writable: true,
      configurable: true,
    });

    // User explicitly chose to enable full motion:
    localStorage.setItem(
      'camp-visual-settings',
      JSON.stringify({
        reduceMotion: false,
        limitSway: false,
        disableShake: false,
        disableFlashes: false,
        disableAberration: false,
        intensity: 0.8,
      }),
    );

    const settings = loadVisualSettings();
    expect(settings.reduceMotion).toBe(false);
    expect(settings.limitSway).toBe(false);
    expect(settings.disableShake).toBe(false);
    expect(settings.intensity).toBe(0.8);
  });

  it('clamps intensity within valid [0, 1] range', () => {
    localStorage.setItem(
      'camp-visual-settings',
      JSON.stringify({
        intensity: 2.5,
      }),
    );
    expect(loadVisualSettings().intensity).toBe(1);

    localStorage.setItem(
      'camp-visual-settings',
      JSON.stringify({
        intensity: -0.5,
      }),
    );
    expect(loadVisualSettings().intensity).toBe(0);
  });
});
