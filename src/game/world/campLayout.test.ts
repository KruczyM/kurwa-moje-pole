import { describe, expect, it } from 'vitest';
import assetCatalog from '../assets/assetCatalog.json';
import { campPosition, isOutsideTentColliders, tentLayout } from './campLayout';

describe('camp tent layout', () => {
  it('contains stable, unique identifiers T01–T15', () => {
    const expected = Array.from({ length: 15 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`);
    expect(tentLayout.map(({ id }) => id)).toEqual(expected);
    expect(new Set(tentLayout.map(({ id }) => id)).size).toBe(15);
  });

  it('uses the dedicated large tent for T09 and T14 from the reference map', () => {
    expect(tentLayout.find(({ id }) => id === 'T09')?.model).toBe('large');
    expect(tentLayout.find(({ id }) => id === 'T14')?.model).toBe('large');
  });

  it('uses big2 once beside the toilet with its measured size and clockwise quarter turn', () => {
    const big2 = tentLayout.filter(({ model }) => model === 'big2');
    expect(big2).toHaveLength(1);
    expect(big2[0].id).toBe('T01');
    expect(big2[0].physicalSize).toEqual([2.2, 1.5, 5.5]);
    expect(big2[0].rotationY).toBeCloseTo(Math.PI / 2);
    expect(big2[0].groundOffset).toBeLessThan(0);
  });

  it('uses one physical size for every small tent and no classic namiot.glb instance', () => {
    const smallTents = tentLayout.filter(({ id }) => !['T01', 'T09', 'T14'].includes(id));
    smallTents.forEach(({ physicalSize }) => expect(physicalSize).toEqual([2.1, 1.4, 1.8]));
    expect(assetCatalog.tents).not.toHaveProperty('classic');
  });

  it('converts percentage positions to the 30 × 30 metre campsite', () => {
    expect(campPosition(0, 0)).toEqual([-15, 0, -15]);
    expect(campPosition(50, 50)).toEqual([0, 0, 0]);
    expect(campPosition(100, 100)).toEqual([15, 0, 15]);
    expect(tentLayout.find(({ id }) => id === 'T01')?.position).toEqual(campPosition(24, 17));
  });

  it('keeps small tents physically smaller than six-person family tents', () => {
    const small = tentLayout.find(({ id }) => id === 'T02')!;
    const family = tentLayout.find(({ id }) => id === 'T01')!;
    expect(small.physicalSize[0]).toBeLessThan(family.physicalSize[0]);
    expect(small.physicalSize[1]).toBeLessThan(family.physicalSize[1]);
    expect(small.physicalSize[2]).toBeLessThan(family.physicalSize[2]);
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
