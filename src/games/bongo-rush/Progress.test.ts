import { describe, expect, it } from 'vitest';
import { HEROES, loadProgress, saveProgress } from './Progress';

describe('versioned local campaign progress', () => {
  it('offers sixteen cosmetic heroes without character-specific physics', () => {
    expect(new Set(HEROES).size).toBe(16);
  });
  it('defaults safely on missing, corrupt, incompatible or inaccessible storage', () => {
    for (const value of [null, '{oops', '{}', '{"version":2}'])
      expect(loadProgress({ getItem: () => value }).unlocked).toBe(1);
    expect(
      loadProgress({
        getItem: () => {
          throw new Error('blocked');
        },
      }).hero,
    ).toBe('amper');
  });
  it('clamps levels and validates hero and mute values', () => {
    const data = { version: 1, unlocked: 99, hero: '<script>', muted: 'yes', completed: false };
    expect(loadProgress({ getItem: () => JSON.stringify(data) })).toEqual({
      version: 1,
      unlocked: 12,
      hero: 'amper',
      muted: false,
      completed: false,
    });
    data.unlocked = -3;
    expect(loadProgress({ getItem: () => JSON.stringify(data) }).unlocked).toBe(1);
  });
  it('round-trips valid preferences and does not block play on failed writes', () => {
    let value = '';
    const progress = { version: 1 as const, unlocked: 8, hero: 'pierscien', muted: true, completed: false };
    saveProgress(
      {
        setItem: (_key, data) => {
          value = data;
        },
      },
      progress,
    );
    expect(loadProgress({ getItem: () => value })).toEqual(progress);
    expect(() =>
      saveProgress(
        {
          setItem: () => {
            throw new Error('full');
          },
        },
        progress,
      ),
    ).not.toThrow();
  });
});
