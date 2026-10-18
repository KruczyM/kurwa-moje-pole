import { describe, it, expect } from 'vitest';
import {
  paintedWallRect,
  paintedWallVariant,
  macroRect,
  macroVariant,
  presentationPreferences,
  collectibleName,
  VISUAL_THEMES,
} from './Presentation';
import { loadProgress } from './Progress';
import { LEVEL_MOTIFS, LEVEL_RHYTHMS, levelMusicPhrase, LEVEL_MUSIC_BEATS } from './LevelMusic';
import { LEVELS } from './Levels';
import { sceneryEdges } from './SceneryArt';
import type { Cell } from './types';

describe('presentation preferences and continuous materials', () => {
  it('migrates old progress and rejects unknown cosmetic values without resetting progress', () => {
    const value = loadProgress({
      getItem: () =>
        JSON.stringify({
          version: 1,
          campaignRevision: 3,
          unlocked: 19,
          hero: 'korba',
          muted: true,
          visualTheme: 'bad',
          collectibleStyle: 'bad',
        }),
    });
    expect(value).toMatchObject({
      unlocked: 19,
      hero: 'korba',
      muted: true,
      visualTheme: 'storybook',
      collectibleStyle: 'festival',
    });
    for (const visualTheme of VISUAL_THEMES)
      for (const collectibleStyle of ['festival', 'fantasy'] as const) {
        expect(presentationPreferences({ visualTheme, collectibleStyle })).toEqual({
          visualTheme,
          collectibleStyle,
        });
        expect(collectibleName({ visualTheme, collectibleStyle }, 1)).toBeTruthy();
      }
  });
  it('samples contiguous regions across logical tiles, repeats only at macro boundaries and separates foundation', () => {
    for (let y = -8; y < 8; y++)
      for (let x = -8; x < 8; x++)
        for (const material of [0, 1]) {
          const rect = macroRect('wall', macroVariant(x, y, material));
          expect(rect.x).toBeGreaterThanOrEqual(material * 512);
          expect(rect.x + 128).toBeLessThanOrEqual((material + 1) * 512);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.y + 128).toBeLessThanOrEqual(512);
          expect(macroVariant(x + 4, y + 4, material)).toBe(macroVariant(x, y, material));
          if (((x % 4) + 4) % 4 !== 3)
            expect(macroRect('wall', macroVariant(x + 1, y, material)).x).toBe(rect.x + 128);
        }
  });
  it('keeps hand-painted wall sampling contiguous at the full runtime resolution', () => {
    for (let x = -8; x < 8; x++)
      for (let y = -8; y < 8; y++)
        for (const material of [0, 1]) {
          const variant = paintedWallVariant(x, y, material),
            rect = paintedWallRect(variant);
          expect(rect.width).toBe(64);
          expect(rect.height).toBe(64);
          expect(rect.x).toBeGreaterThanOrEqual(material * 512);
          expect(rect.x + 64).toBeLessThanOrEqual((material + 1) * 512);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.y + 64).toBeLessThanOrEqual(512);
          if (((x % 8) + 8) % 8 !== 7)
            expect(paintedWallRect(paintedWallVariant(x + 1, y, material)).x).toBe(rect.x + 64);
          expect(paintedWallVariant(x + 8, y + 8, material)).toBe(variant);
        }
  });
  it('exposes a newly dug edge without modifying cells or inventing collisions', () => {
    const world = { width: 3, height: 3, cells: Array<Cell>(9).fill('wall') };
    expect(sceneryEdges(world, 1, 1).sides).toBe(0);
    world.cells[1] = 'air';
    const before = [...world.cells];
    expect(sceneryEdges(world, 1, 1).sides).toBe(1);
    expect(world.cells).toEqual(before);
  });
});
describe('24 original motifs and three arrangements', () => {
  it('has distinct authored melodies and combined rhythmic identities for every level', () => {
    expect(LEVEL_MOTIFS).toHaveLength(24);
    expect(LEVEL_RHYTHMS).toHaveLength(24);
    expect(new Set(LEVEL_MOTIFS.map((m) => JSON.stringify(m))).size).toBe(24);
  });
  it.each(LEVELS)(
    'has a deterministic complete bounded loop and three distinct arrangements for level $id',
    (level) => {
      const signatures = [];
      for (const theme of VISUAL_THEMES) {
        const profile = { level: level.id, biome: level.biome, theme };
        const loop = Array.from({ length: LEVEL_MUSIC_BEATS }, (_, beat) => levelMusicPhrase(profile, beat));
        signatures.push(JSON.stringify(loop));
        expect(levelMusicPhrase(profile, 0)).toEqual(levelMusicPhrase(profile, 128));
        expect(loop.slice(64, 96).flat().length).toBeLessThan(loop.slice(0, 32).flat().length);
        for (const notes of loop) {
          expect(notes.length).toBeLessThanOrEqual(4);
          for (const note of notes) {
            expect(Number.isFinite(note.frequency)).toBe(true);
            expect(note.frequency).toBeGreaterThan(20);
            expect(note.frequency).toBeLessThan(12000);
            expect(note.gain).toBeGreaterThan(0);
            expect(note.gain).toBeLessThanOrEqual(0.022);
            expect(note.duration).toBeGreaterThan(0.09);
          }
        }
      }
      expect(new Set(signatures).size).toBe(3);
    },
  );
});
