import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEVELS } from './Levels';
import { Simulation } from './Simulation';
import {
  authoredCellRect,
  authoredColony,
  authoredEdges,
  authoredRoomDefinition,
  colonyBlobMask,
} from './AuthoredScenery';
import { loadProgress, saveProgress } from './Progress';
import {
  collectiblePreviewPath,
  MENU_VISUAL_THEMES,
  presentationPreferences,
  THEME_LABELS,
} from './Presentation';
import type { World, Cell } from './types';

describe('approved per-map raster geometry', () => {
  it('covers all24 maps and all27 actual simulation rooms with exactly matching immutable geometry', () => {
    let rooms = 0;
    for (const level of LEVELS) {
      const game = new Simulation(level),
        actual = Reflect.get(game, 'rooms') as Map<string, World>;
      for (const [name, world] of actual) {
        const scene = authoredRoomDefinition(level.id, name)!;
        expect(scene, `${level.id}/${name}`).toBeDefined();
        expect([scene.width, scene.height, scene.initial.length]).toEqual([
          world.width,
          world.height,
          world.cells.length,
        ]);
        expect([...scene.initial].map((cell) => cell === '#')).toEqual(
          world.cells.map((cell) => cell === 'wall'),
        );
        expect([...scene.initial].map((cell) => '.v'.includes(cell))).toEqual(
          world.cells.map((cell) => cell === 'soil' || cell === 'buried-bush'),
        );
        for (const layer of ['soil', 'walls', 'background'])
          expect(
            existsSync(resolve(`public/game-assets/2d/bongo-rush/authored-v6/${scene.path}/${layer}.webp`)),
          ).toBe(true);
        rooms++;
      }
    }
    expect(rooms).toBe(27);
  });

  it('keeps source coordinates continuous over38 horizontal and27 vertical cells, including isolated survivors', () => {
    for (const points of [
      Array.from({ length: 38 }, (_, i) => [i + 1, 3]),
      Array.from({ length: 27 }, (_, i) => [3, i + 1]),
    ]) {
      const original = points.map(([x, y]) => authoredCellRect(x, y));
      for (let removed = 0; removed < points.length; removed++) {
        const remaining = points.filter((_, i) => i !== removed).map(([x, y]) => authoredCellRect(x, y));
        expect(remaining).toEqual(original.filter((_, i) => i !== removed));
      }
      for (let i = 1; i < original.length; i++)
        expect(original[i][0] + original[i][1] - original[i - 1][0] - original[i - 1][1]).toBe(40);
    }
  });

  it('has no internal lips in a filled mass; a single dig adds exactly four fresh edges and preserves original ledges', () => {
    const cells = Array<Cell>(49).fill('soil'),
      initial = '.'.repeat(49),
      world = { width: 7, height: 7, cells };
    expect(authoredEdges(world, initial)).toHaveLength(0);
    cells[24] = 'air';
    const before = [...cells];
    expect(authoredEdges(world, initial)).toHaveLength(4);
    expect(authoredEdges(world, initial).every((edge) => !edge.old)).toBe(true);
    const old = initial.slice(0, 24) + ' ' + initial.slice(25);
    expect(authoredEdges(world, old).every((edge) => edge.old)).toBe(true);
    expect(cells).toEqual(before);
    cells[24] = 'bush';
    expect(authoredEdges(world, initial)).toHaveLength(4);
  });

  it('joins Kobra through47 painted topologies, keeps diagonal bodies separate and retains one oldest core on merge', () => {
    expect(new Set(Array.from({ length: 256 }, (_, bits) => colonyBlobMask(bits))).size).toBe(47);
    const cells = Array<Cell>(25).fill('air');
    cells[6] = cells[18] = 'bush';
    const initial = cells.map((cell) => (cell === 'bush' ? 'b' : ' ')).join(''),
      world = { width: 5, height: 5, cells };
    expect([...authoredColony(world, initial).cores]).toEqual([6, 18]);
    cells[12] = 'bush';
    expect(authoredColony(world, initial).cores.size).toBe(3);
    cells[7] = cells[13] = 'bush';
    const merged = authoredColony(world, initial);
    expect([...merged.cores]).toEqual([6]);
    expect(merged.tiles.size).toBe(5);
  });
});

describe('standard/artistic appearance preference', () => {
  it('offers exactly two clearly named choices and persists both without changing campaign progress', () => {
    expect(MENU_VISUAL_THEMES.map((theme) => THEME_LABELS[theme])).toEqual(['Standardowa', 'Artystyczna']);
    let value = '';
    const storage = {
      getItem: () => value,
      setItem: (_key: string, input: string) => {
        value = input;
      },
    };
    const progress = { ...loadProgress(storage), unlocked: 19, hero: 'korba', completed: false };
    for (const visualTheme of MENU_VISUAL_THEMES) {
      for (let biome = 0; biome < 4; biome++) {
        const preferences = presentationPreferences({ visualTheme, collectibleStyle: 'fantasy' });
        const path = collectiblePreviewPath('', preferences, biome);
        expect(existsSync(resolve('public', path))).toBe(true);
        expect(path).toContain(visualTheme === 'standard' ? 'standard-items-' : 'fantasy-items-');
      }
      saveProgress(storage, {
        ...progress,
        ...presentationPreferences({ visualTheme, collectibleStyle: 'fantasy' }),
      });
      expect(loadProgress(storage)).toMatchObject({
        visualTheme,
        unlocked: 19,
        hero: 'korba',
        completed: false,
        collectibleStyle: visualTheme === 'standard' ? 'festival' : 'fantasy',
      });
    }
  });
});
