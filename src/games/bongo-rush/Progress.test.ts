import { describe, expect, it } from 'vitest';
import { HEROES, loadProgress, saveProgress } from './Progress';

describe('versioned local campaign progress', () => {
  it.each([1, 2, 3])('migrates revision %s without losing unlocked levels or preferences', (revision) => {
    for (let unlocked = 1; unlocked <= 24; unlocked++) {
      const data = {
        version: 1,
        campaignRevision: revision,
        unlocked,
        hero: 'korba',
        muted: true,
        completed: true,
      };
      const result = loadProgress({ getItem: () => JSON.stringify(data) });
      expect(result.campaignRevision).toBe(3);
      expect(result.unlocked).toBeGreaterThanOrEqual(unlocked);
      expect(result.unlocked).toBeLessThanOrEqual(24);
      expect(result.hero).toBe('korba');
      expect(result.muted).toBe(true);
      expect(result.completed).toBe(revision === 3);
    }
  });
  it('retains an unfinished v5 unlock number exactly and does not claim v6 completion', () => {
    for (let unlocked = 1; unlocked <= 24; unlocked++)
      expect(
        loadProgress({
          getItem: () =>
            JSON.stringify({
              version: 1,
              campaignRevision: 2,
              unlocked,
              hero: 'antena',
              muted: false,
              completed: false,
            }),
        }),
      ).toMatchObject({ campaignRevision: 3, unlocked, hero: 'antena', muted: false, completed: false });
  });
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
      musicPack: 'pack-1',
      version: 1,
      campaignRevision: 3,
      visualTheme: 'storybook',
      collectibleStyle: 'festival',
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
      musicPack: 'pack-2' as const,
      visualTheme: 'storybook' as const,
      collectibleStyle: 'festival' as const,
      version: 1 as const,
      campaignRevision: 3 as const,
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
  it('defaults old and invalid music preferences without changing campaign progress', () => {
    for (const musicPack of [undefined, null, '<script>', 'pack-99']) {
      const result = loadProgress({
        getItem: () =>
          JSON.stringify({ version: 1, campaignRevision: 3, unlocked: 17, hero: 'korba', musicPack }),
      });
      expect(result).toMatchObject({ musicPack: 'pack-1', unlocked: 17, hero: 'korba' });
    }
  });
});
