import { describe, expect, it } from 'vitest';
import { buildCampaignV6 } from './CampaignV6';
import { rayOpacity, sceneryEdges, sceneryMaterial, sceneryTileRect, validateScenery } from './SceneryArt';
import type { Cell } from './types';
describe('authored v6 scenery', () => {
  it.each(buildCampaignV6())('keeps level $id views and props on solid walls after compaction', (level) => {
    expect(() => validateScenery(level.rows, level.scenery)).not.toThrow();
    for (const room of level.chambers ?? [])
      expect(() => validateScenery(room.rows, room.scenery)).not.toThrow();
    expect(level.scenery?.materials).toHaveLength(2);
    expect(sceneryMaterial(level.scenery, 1, 1)).toBe(0);
    expect(sceneryMaterial(level.scenery, 1, level.rows.length - 2)).toBe(1);
  });
  it('leaves both level9 receiving halls free of window masks and blocking props', () => {
    const scene = buildCampaignV6()[8].scenery!;
    expect(scene.views).toHaveLength(0);
    expect(scene.props).toHaveLength(0);
    expect(scene.rays).toHaveLength(2);
  });
  it('preserves the southern portal approach beside the level18 chamber window', () => {
    const room = buildCampaignV6()[17].chambers![0],
      view = room.scenery!.views[0];
    expect(view.bounds).toEqual({ x: 16, y: 4, width: 4, height: 5 });
    expect(view.mask.every((p) => p.y <= 8)).toBe(true);
    expect(room.rows[9][17]).not.toBe('#');
  });
  it.each(Array.from({ length: 16 }, (_, i) => i))('covers edge and concave mask %s', (mask) => {
    const cells = Array<Cell>(25).fill('wall');
    [
      [2, 1],
      [3, 2],
      [2, 3],
      [1, 2],
    ].forEach(([x, y], i) => {
      if (mask & (1 << i)) cells[y * 5 + x] = 'air';
    });
    expect(sceneryEdges({ width: 5, height: 5, cells }, 2, 2).sides).toBe(mask);
    cells.fill('wall');
    [
      [3, 1],
      [3, 3],
      [1, 3],
      [1, 1],
    ].forEach(([x, y], i) => {
      if (mask & (1 << i)) cells[y * 5 + x] = 'air';
    });
    expect(sceneryEdges({ width: 5, height: 5, cells }, 2, 2)).toEqual({ sides: 0, corners: mask });
  });
  it('keeps four soil/floor regions separate from the two wall materials', () => {
    expect(sceneryTileRect('wall', 0).y).toBe(0);
    expect(sceneryTileRect('wall', 4).y).toBe(128);
    expect(sceneryTileRect('soil', 0).y).toBe(256);
    expect(sceneryTileRect('floor', 0).y).toBe(384);
    expect(new Set([0, 1, 2, 3].map((i) => sceneryTileRect('soil', i).x)).size).toBe(4);
  });
  it('caps light and limits mobile/reduced-motion animation', () => {
    for (let time = 0; time < 100; time += 0.1) {
      expect(rayOpacity(false, false, time, 0)).toBeLessThanOrEqual(0.18);
      expect(rayOpacity(true, false, time, 0)).toBeLessThanOrEqual(0.12);
    }
    expect(rayOpacity(true, false, 1, 1)).toBe(rayOpacity(true, false, 20, 1));
    expect(rayOpacity(false, true, 1, 0)).toBe(rayOpacity(false, true, 20, 0));
  });
});
