import { describe, expect, it } from 'vitest';
import assetCatalog from '../assets/assetCatalog.json';
import { isOutsideTentColliders, tentLayout } from './campLayout';

describe('camp tent layout', () => {
  it('contains stable, unique identifiers T01–T15', () => {
    const expected = Array.from({ length: 15 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
    expect(tentLayout.map(({ id }) => id)).toEqual(expected);
    expect(new Set(tentLayout.map(({ id }) => id)).size).toBe(15);
  });

  it('uses the dedicated large tent for T10 and T15', () => {
    expect(tentLayout.find(({ id }) => id === 'T10')?.model).toBe('large');
    expect(tentLayout.find(({ id }) => id === 'T15')?.model).toBe('large');
  });

  it('keeps routes from Mad Dog to every side passable with 1.1 m clearance', () => {
    const step = 0.5;
    const key = (x: number, z: number) => `${x.toFixed(1)},${z.toFixed(1)}`;
    const queue: [number, number][] = [[0, 0]];
    const visited = new Set([key(0, 0)]);
    const targets: [number, number][] = [
      [0, -15],
      [15, 0],
      [-15, 0],
      [0, 17],
    ];

    while (queue.length) {
      const [x, z] = queue.shift()!;
      for (const [dx, dz] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const nextX = x + dx;
        const nextZ = z + dz;
        const nextKey = key(nextX, nextZ);
        if (
          Math.abs(nextX) > 16 ||
          nextZ < -16 ||
          nextZ > 18 ||
          visited.has(nextKey) ||
          !isOutsideTentColliders(nextX, nextZ, 0.55)
        )
          continue;
        visited.add(nextKey);
        queue.push([nextX, nextZ]);
      }
    }

    targets.forEach(([x, z]) => expect(visited.has(key(x, z))).toBe(true));
  });

  it('uses simplified box colliders for every tent', () => {
    tentLayout.forEach((tent) => {
      expect(tent.collider.type).toBe('box');
      expect(tent.collider.size[0]).toBeGreaterThan(0);
      expect(tent.collider.size[1]).toBeGreaterThan(0);
    });
  });

  it('references only tent models registered in the central asset catalog', () => {
    tentLayout.forEach((tent) => expect(assetCatalog.tents[tent.model]).toMatch(/\.glb$/));
  });
});
