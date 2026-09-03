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

  it('uses big2 once beside the toilet with a collider that excludes guy lines', () => {
    const big2 = tentLayout.filter(({ model }) => model === 'big2');
    expect(big2).toHaveLength(1);
    expect(big2[0].id).toBe('T01');
    expect(big2[0].physicalSize).toEqual([7.56, 5.04, 11.592]);
    expect(big2[0].rotationY).toBeCloseTo(Math.PI * 1.5);
    expect(big2[0].groundOffset).toBeLessThan(0);
    expect(big2[0].collider.size).toEqual([5.2, 7.6]);
    expect(big2[0].collider.size[0]).toBeLessThan(big2[0].physicalSize[0]);
    expect(big2[0].collider.size[1]).toBeLessThan(big2[0].physicalSize[2]);
  });

  it('uses one physical size for every small tent and no classic namiot.glb instance', () => {
    const smallTents = tentLayout.filter(({ id }) => !['T01', 'T09', 'T14'].includes(id));
    smallTents.forEach(({ physicalSize }) => expect(physicalSize).toEqual([4.2, 2.8, 3.6]));
    expect(assetCatalog.tents).not.toHaveProperty('classic');
  });

  it('grounds both white tents below their source bounding-box minimum', () => {
    const whiteTents = tentLayout.filter(({ model }) => model === 'white');
    expect(whiteTents).toHaveLength(2);
    whiteTents.forEach(({ groundOffset }) => expect(groundOffset).toBe(-0.45));
  });

  it('uses the same enlarged physical size for both large family tents', () => {
    const largeTents = tentLayout.filter(({ id }) => ['T09', 'T14'].includes(id));
    largeTents.forEach(({ physicalSize, collider }) => {
      expect(physicalSize).toEqual([4.1975, 2.8, 6.44]);
      expect(collider.size).toEqual([4.1975, 6.44]);
    });
  });

  it('converts percentage positions to the 30 × 30 metre campsite', () => {
    expect(campPosition(0, 0)).toEqual([-15, 0, -15]);
    expect(campPosition(50, 50)).toEqual([0, 0, 0]);
    expect(campPosition(100, 100)).toEqual([15, 0, 15]);
    expect(tentLayout.find(({ id }) => id === 'T01')?.position).toEqual(campPosition(24, 17));
  });

  it('keeps the requested doubled dimensions for a representative small tent', () => {
    const small = tentLayout.find(({ id }) => id === 'T02')!;
    expect(small.physicalSize).toEqual([4.2, 2.8, 3.6]);
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
