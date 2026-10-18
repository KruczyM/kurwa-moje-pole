import { describe, it, expect } from 'vitest';
import { LEVELS } from './Levels';
import {
  composeScene,
  rootForest,
  soilIslands,
  soilSceneBounds,
  paintedSoilCrop,
  COMPOSITION_MOTIFS,
} from './SceneComposition';
import { validateScenery } from './SceneryArt';
const rooms = LEVELS.flatMap((level) => [
  { level, id: 'main', room: level },
  ...(level.chambers ?? []).map((room) => ({ level, id: room.id, room })),
]);
describe('storybook scene compositions', () => {
  it('covers all 27 authored spaces and has a distinct motif per level', () => {
    expect(rooms.length).toBe(27);
    expect(new Set(COMPOSITION_MOTIFS).size).toBe(24);
  });
  it.each(rooms)('keeps collision data unchanged in level $level.id / $id', ({ level, id, room }) => {
    const before = JSON.stringify(level),
      scene = composeScene(level, id, room.scenery);
    expect(JSON.stringify(level)).toBe(before);
    expect(scene.rows).toEqual(room.rows);
    expect(() => validateScenery(room.rows, scene.scenery)).not.toThrow();
    for (const index of scene.roots.keys())
      expect(room.rows[Math.floor(index / room.rows[0].length)][index % room.rows[0].length]).toBe('.');
    expect([...rootForest(room.rows)]).toEqual([...scene.roots]);
  });
  it('has matching connection endpoints in the immutable soil forest', () => {
    for (const { room } of rooms) {
      const w = room.rows[0].length,
        forest = rootForest(room.rows);
      for (const [index, mask] of forest)
        for (const [side, dx, dy] of [
          [0, 0, -1],
          [1, 1, 0],
          [2, 0, 1],
          [3, -1, 0],
        ]) {
          if (!(mask & (1 << side))) continue;
          const x = (index % w) + dx,
            y = Math.floor(index / w) + dy;
          const neighbour = y * w + x;
          if (x >= 0 && x < w && y >= 0 && y < room.rows.length && forest.has(neighbour))
            expect(forest.get(neighbour)! & (1 << ((side + 2) % 4))).toBeTruthy();
          else expect(side).toBe(0); // Only the original top root can anchor outside the earth island.
        }
    }
  });
  it('keeps the dense receiving halls free of extra objects and makes the throne part of a supported room', () => {
    expect(composeScene(LEVELS[8], 'main', LEVELS[8].scenery).scenery.props).toHaveLength(0);
    const props = composeScene(LEVELS[19], 'main', LEVELS[19].scenery).scenery.props;
    expect(props.some((p) => p.asset === 'throne')).toBe(true);
    expect(props.filter((p) => p.asset === 'column').length).toBeGreaterThanOrEqual(4);
  });
  it('uses one painting across disconnected terraces and has a safe empty-room fallback', () => {
    const rows = ['#######', '#..#..#', '#######', '#..#K.#', '#######'];
    expect(soilSceneBounds(rows)).toEqual({ x: 1, y: 1, width: 5, height: 3 });
    const bounds = soilSceneBounds(rows),
      a = paintedSoilCrop(bounds, 1, 1, 1000, 600),
      b = paintedSoilCrop(bounds, 4, 3, 1000, 600);
    expect(b.x - a.x).toBeCloseTo(a.width * 3);
    expect(b.y - a.y).toBeCloseTo(a.height * 2);
    expect(soilSceneBounds(['###', '# #', '###'])).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  });
  it('anchors adjacent tile crops to immutable islands and preserves the painting aspect ratio', () => {
    const rows = ['#####', '#...#', '#...#', '#####'],
      islands = soilIslands(rows);
    const bounds = islands.get(6)!;
    expect(bounds).toEqual({ x: 1, y: 1, width: 3, height: 2 });
    expect(islands.size).toBe(6);
    const a = paintedSoilCrop(bounds, 1, 1, 896, 1200),
      b = paintedSoilCrop(bounds, 2, 1, 896, 1200),
      c = paintedSoilCrop(bounds, 1, 2, 896, 1200);
    expect(a.width).toBe(a.height);
    expect(a.x + a.width).toBeCloseTo(b.x);
    expect(a.y + a.height).toBeCloseTo(c.y);
    const dug = rows.map((row) => row.replace(/\./g, ' '));
    expect(soilIslands(dug).size).toBe(0);
    expect(paintedSoilCrop(bounds, 1, 1, 896, 1200)).toEqual(a);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(c.y + c.height).toBeLessThanOrEqual(1200);
  });
});
