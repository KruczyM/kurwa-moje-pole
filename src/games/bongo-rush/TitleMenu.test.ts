import { describe, expect, it } from 'vitest';
import { continueLevel, biomeMenu } from './TitleMenu';
import { loadProgress } from './Progress';

describe('title menu campaign navigation', () => {
  it('resumes the last started unlocked map, without mistaking a preview for progress', () => {
    expect(continueLevel({ unlocked: 18, lastLevel: 6 })).toBe(6);
    expect(continueLevel({ unlocked: 18 })).toBe(18);
    expect(continueLevel({ unlocked: 3, lastLevel: 24 })).toBe(3);
    for (const lastLevel of [NaN, Infinity, -1, 0, 1.5])
      expect(continueLevel({ unlocked: 8, lastLevel })).toBe(8);
  });
  it('validates the new optional field without changing old saves or unlock migration', () => {
    const load = (data: object) =>
      loadProgress({
        getItem: () => JSON.stringify({ version: 1, campaignRevision: 3, unlocked: 10, ...data }),
      });
    expect(load({ lastLevel: 6 }).lastLevel).toBe(6);
    expect(load({ lastLevel: 24 }).lastLevel).toBe(10);
    expect(load({ unlocked: 1, completed: true, lastLevel: 20 }).lastLevel).toBe(20);
    for (const lastLevel of ['6', null, 0, 25, -4]) expect(load({ lastLevel }).lastLevel).toBeUndefined();
    expect(load({}).lastLevel).toBeUndefined();
  });
  it('keeps all 24 real maps grouped by biome, with honest available counts and locked cards', () => {
    for (let biome = 0; biome < 4; biome++)
      expect(biomeMenu(biome, 24, 1)).toMatchObject({ total: 6, available: 6 });
    expect(biomeMenu(1, 5, 6)).toEqual({ total: 6, available: 0, level: undefined });
    expect(biomeMenu(1, 8, 7)).toEqual({ total: 6, available: 3, level: 7 });
    expect(biomeMenu(1, 8, 24)).toEqual({ total: 6, available: 3, level: 6 });
    expect(biomeMenu(0, 21, 21).level).toBe(21);
  });
});
