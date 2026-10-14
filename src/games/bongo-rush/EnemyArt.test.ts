import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SpriteAnimator } from '../after/presentation/SpriteAnimator';
import { PatrolAnimator } from './PatrolAnimator';
import { Simulation } from './Simulation';
import { LEGACY_LEVELS as LEVELS } from './Levels';
import { same } from './types';

describe('fully animated detailed enemy atlases', () => {
  it.each([2, 4])('plays every gait frame at actual patrol cadence on level %s', (level) => {
    const game = new Simulation(LEVELS[level - 1]);
    const metadata = JSON.parse(
      readFileSync('public/game-assets/2d/bongo-rush/characters/patrol-red-v3/meta.json', 'utf8'),
    );
    const animator = new PatrolAnimator(metadata);
    const columns = new Set<number>();
    for (let tick = 0; tick < 120; tick++) {
      game.step();
      const enemy = game.world.enemies[0];
      for (let frame = 0; frame < 12; frame++) {
        const image = animator.update(1 / 60, 'east', !same(enemy, enemy.previous));
        if (image.x >= 256) columns.add(image.x / 128);
      }
    }
    expect([...columns].sort()).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    const held = animator.update(0, 'east', false, false, true);
    expect(animator.update(10, 'east', false, false, true)).toEqual(held);
    for (let frame = 0; frame < 120; frame++) animator.update(1 / 60, 'east', false);
    expect(animator.update(0, 'east', false).x).toBeLessThan(256);
    animator.update(0.1, 'east', true);
    expect(animator.update(0.1, 'east', true, false, false, true).x).toBeLessThan(256);
  });
  it.each(['patrol-red-v3', 'patrol-blue-v3', 'undercover-v3'])(
    'ships complete views, independent animation and consistent frame dimensions: %s',
    (name) => {
      const path = `public/game-assets/2d/bongo-rush/characters/${name}`;
      const metadata = JSON.parse(readFileSync(`${path}/meta.json`, 'utf8'));
      const png = readFileSync(`${path}/spritesheet.png`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1280, 512]);
      expect(metadata.animationColumns.idle).toHaveLength(2);
      expect(metadata.animationColumns.walk).toHaveLength(8);
      const first = new SpriteAnimator(metadata),
        second = new SpriteAnimator(metadata);
      first.update(0.25, 'east', true);
      expect(second.update(0, 'west', false).x).toBe(0);
      const paused = first.update(0, 'east', true, false, true);
      expect(first.update(1, 'east', true, false, true)).toEqual(paused);
      expect(first.update(0.25, 'east', true, false, false).x).not.toBe(paused.x);
      expect(readFileSync(metadata.source).subarray(0, 4).toString()).toBe('glTF');
    },
  );
});
