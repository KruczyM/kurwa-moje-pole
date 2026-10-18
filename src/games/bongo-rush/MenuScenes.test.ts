import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HEROES } from './Progress';
import { hasMenuScene, menuSceneFile, PAINTED_MENU_HEROES } from './MenuScenes';
import { MenuFlow } from './MenuFlow';
import sceneSources from '../../../docs/bongo-menu-character-scenes.json';

describe('painted character menu scenes', () => {
  it('restores the original Amper scene and rejects untrusted paths', () => {
    expect(menuSceneFile('amper')).toBe('scene.webp');
    expect(menuSceneFile('../outside')).toBe('scene.webp');
    expect(
      createHash('sha256')
        .update(readFileSync(`public/game-assets/2d/bongo-rush/menu-v1/${menuSceneFile('amper')}`))
        .digest('hex'),
    ).toBe('eca4929ac9b45a82c5bbce018a9959088f2e5f33b2467bd12fe5ef0b3f053069');
    expect(new Set(HEROES.map(menuSceneFile)).size).toBe(HEROES.length);
  });

  it.each(PAINTED_MENU_HEROES)('ships a complete painted scene for %s', (hero) => {
    expect(hasMenuScene(hero)).toBe(true);
    const path = `public/game-assets/2d/bongo-rush/menu-v1/${menuSceneFile(hero)}`;
    expect(existsSync(path)).toBe(true);
    if (hero !== 'amper') {
      const source = sceneSources.scenes.find((scene) => scene.hero === hero);
      expect(source?.runtime).toBe(path);
      expect(source?.dimensions).toEqual([1672, 941]);
      expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(source?.runtimeSha256);
    }
  });

  it('does not treat opponents or untrusted paths as playable menu scenes', () => {
    for (const hero of ['owsiak', 'patrol-red-v3', '../outside', 'unknown'])
      expect(hasMenuScene(hero)).toBe(false);
  });

  it.each(HEROES)('returns %s to the title after confirmation, before choosing how to play', (hero) => {
    const menu = new MenuFlow('amper');
    menu.openHeroes();
    expect(menu.choose(hero)).toBe(true);
    menu.confirm();
    expect(menu.screen).toBe('title');
    expect(menu.hero).toBe(hero);
    expect(menu.canStart(0, 6)).toBe(false);
    menu.openLevels();
    expect(menu.canStart(0, 6)).toBe(true);
    expect(menu.canStart(6, 6)).toBe(false);
  });
});
