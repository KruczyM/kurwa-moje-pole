import { describe, expect, it } from 'vitest';
import { minimapLayout } from './MinimapLayout';
import { MenuFlow } from './MenuFlow';

describe('mobile minimap separation', () => {
  it.each([
    [320, 450, 220, 52],
    [390, 720, 220, 52],
    [844, 280, 160, 30],
    [667, 230, 160, 30],
    [360, 390, 220, 52],
  ])(
    'keeps tall and wide maps outside gameplay and away from the joystick at %i×%i',
    (width, height, strip, footer) => {
      const top = 58,
        playHeight = Math.max(1, height - top - strip);
      for (const [columns, rows] of [
        [19, 24],
        [21, 39],
        [35, 15],
        [7, 60],
      ]) {
        const map = minimapLayout(width, height, top, playHeight, columns, rows, true, footer)!;
        expect(map.y - 5).toBeGreaterThanOrEqual(top + playHeight);
        expect(map.y + map.height + 5).toBeLessThanOrEqual(height - footer);
        expect(map.x - 5).toBeGreaterThan(width / 2 + 62);
        expect(map.x + map.width + 5).toBeLessThan(width);
        expect(map.width / map.height).toBeCloseTo(columns / rows);
      }
    },
  );
  it('omits the overview when no non-gameplay space remains', () => {
    expect(minimapLayout(320, 120, 58, 60, 19, 24, true)).toBeUndefined();
  });
});

describe('quick level selection retained from main', () => {
  it('reuses the hero while keeping locked levels guarded and allowing explicit hero changes', () => {
    const menu = new MenuFlow('pierscien');
    menu.openLevels();
    expect(menu.hero).toBe('pierscien');
    expect(menu.screen).toBe('levels');
    expect(menu.canStart(5, 6)).toBe(true);
    for (const index of [6, -1, 0.5, NaN]) expect(menu.canStart(index, 6)).toBe(false);
    menu.back();
    expect(menu.screen).toBe('heroes');
    expect(menu.canStart(0, 6)).toBe(false);
    menu.choose('amper');
    menu.confirm();
    menu.openLevels();
    expect(menu.hero).toBe('amper');
    expect(menu.canStart(1, 6)).toBe(true);
  });
});
