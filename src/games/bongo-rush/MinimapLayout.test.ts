import { describe, expect, it } from 'vitest';
import { minimapLayout } from './MinimapLayout';
import { MenuFlow } from './MenuFlow';

describe('optional minimap overlay', () => {
  it.each([
    [320, 450],
    [390, 720],
    [844, 280],
    [667, 230],
    [1912, 760],
  ])('fits the overlay under the HUD without distorting tall or wide maps at %i×%i', (width, height) => {
    for (const [columns, rows] of [
      [19, 24],
      [21, 39],
      [35, 15],
      [7, 60],
    ]) {
      const map = minimapLayout(width, height, 58, columns, rows, width <= 844)!;
      expect(map.y - 5).toBeGreaterThanOrEqual(58);
      expect(map.x - 5).toBeGreaterThanOrEqual(0);
      expect(map.x + map.width + 5).toBeLessThan(width);
      expect(map.y + map.height + 5).toBeLessThan(height);
      expect(map.width / map.height).toBeCloseTo(columns / rows);
    }
  });
  it('omits the overview if the HUD leaves no room', () => {
    expect(minimapLayout(320, 80, 70, 19, 24, true)).toBeUndefined();
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
