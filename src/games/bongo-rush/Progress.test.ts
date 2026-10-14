import { describe, expect, it } from 'vitest';
import { HEROES, loadProgress, saveProgress } from './Progress';

describe('versioned local campaign progress', () => {
  it('offers fifteen cosmetic heroes without character-specific physics', () => {
    expect(new Set(HEROES).size).toBe(15);
    expect([...HEROES] as string[]).not.toContain('kobra');
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
      campaignRevision: 2,
      unlocked: 24,
      hero: 'amper',
      muted: false,
      completed: false,
    });
    data.unlocked = -3;
    expect(loadProgress({ getItem: () => JSON.stringify(data) }).unlocked).toBe(1);
  });
  it('unlocks challenges for a save which already completed the original campaign', () => {
    expect(
      loadProgress({ getItem: () => JSON.stringify({ version: 1, unlocked: 12, completed: true }) }).unlocked,
    ).toBe(21);
  });
  it('round-trips valid preferences and does not block play on failed writes', () => {
    let value = '';
    const progress = {
      version: 1 as const,
      campaignRevision: 2 as const,
      unlocked: 8,
      hero: 'pierscien',
      muted: true,
      completed: false,
    };
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
