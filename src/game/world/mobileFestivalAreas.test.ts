import { describe, expect, it } from 'vitest';
import {
  festivalAreaAt,
  FESTIVAL_BOUNDARIES,
  nearestFestivalBoundary,
  festivalAreaLabel,
  MOBILE_FESTIVAL_AREAS,
  mobileBotBudget,
  MobileBotAllowance,
} from './mobileFestivalAreas';

describe('festival places on mobile', () => {
  it('tiles the world with one rectangle per area, no overlaps or fallback holes', () => {
    for (const area of MOBILE_FESTIVAL_AREAS) expect(area.regions).toHaveLength(1);
    const xs = [...new Set(MOBILE_FESTIVAL_AREAS.flatMap((a) => a.regions[0].slice(0, 2)))].sort(
      (a, b) => a - b,
    );
    const zs = [...new Set(MOBILE_FESTIVAL_AREAS.flatMap((a) => a.regions[0].slice(2, 4)))].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < zs.length - 1; j++) {
        for (const [x, z] of [
          [xs[i], zs[j]],
          [(xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2],
        ]) {
          const owners = MOBILE_FESTIVAL_AREAS.filter((a) => {
            const [x1, x2, z1, z2] = a.regions[0];
            return x >= x1 && x < x2 && z >= z1 && z < z2;
          });
          expect(owners).toHaveLength(1);
          expect(festivalAreaAt(x, z)).toBe(owners[0].id);
        }
      }
  });
  it('keeps the full rotated ASP footprint and its approach inside the southern sector', () => {
    for (const x of [-92, -65, -38])
      for (const z of [78, 97, 116]) expect(festivalAreaAt(x, z)).toBe('south-passage');
    expect(festivalAreaAt(-95, 97)).toBe('south-passage');
    expect(festivalAreaLabel('south-passage')).toContain('ASP');
  });
  it('finds the actual neighbour and measures distance to finite shared edges', () => {
    expect(nearestFestivalBoundary(109.9, 60, 'camp', 'south-passage')).toMatchObject({
      target: 'south-passage',
      distance: 4,
    });
    expect(nearestFestivalBoundary(0, 60, 'camp')).toMatchObject({ target: 'south-passage', distance: 4 });
    expect(nearestFestivalBoundary(108, 0, 'camp')).toMatchObject({ target: 'main-stage', distance: 2 });
    expect(nearestFestivalBoundary(-107, 90, 'lidl')).toMatchObject({ target: 'south-passage', distance: 2 });
    for (const edge of FESTIVAL_BOUNDARIES) {
      const x = (edge.x1 + edge.x2) / 2,
        z = (edge.z1 + edge.z2) / 2;
      const neighbours =
        edge.x1 === edge.x2
          ? [festivalAreaAt(x - 0.01, z), festivalAreaAt(x + 0.01, z)]
          : [festivalAreaAt(x, z - 0.01), festivalAreaAt(x, z + 0.01)];
      expect(new Set(neighbours)).toEqual(new Set([edge.a, edge.b]));
    }
  });
  it('keeps the seven requested landmarks and complete neighbouring camp plots together', () => {
    expect(MOBILE_FESTIVAL_AREAS).toHaveLength(7);
    for (const [x, z, area] of [
      [0, -35, 'north-passage'],
      [-120, -44, 'north-passage'],
      [0, 0, 'camp'],
      [-98, 40, 'camp'],
      [50, 40, 'camp'],
      [-125, 87, 'lidl'],
      [116, -59, 'wheel'],
      [116, -51, 'wheel'],
      [223, 21, 'main-stage'],
      [130, 26, 'main-stage'],
      [195, -24, 'main-stage'],
      [-100, -122, 'north-camps'],
      [100, -122, 'north-camps'],
      [0, 73, 'south-passage'],
      [76, 93, 'south-passage'],
      [-65, 110, 'south-passage'],
    ] as const)
      expect(festivalAreaAt(x, z)).toBe(area);
    expect(festivalAreaLabel('camp')).toContain('Kurwa Moje Pole');
  });
  it('has deterministic boundaries and never falls into an unnamed empty grid cell', () => {
    expect(festivalAreaAt(0, -96)).toBe('north-passage');
    expect(festivalAreaAt(0, -96.01)).toBe('north-camps');
    expect(festivalAreaAt(0, -25)).toBe('camp');
    expect(festivalAreaAt(0, 64)).toBe('south-passage');
    const ids = new Set(MOBILE_FESTIVAL_AREAS.map((area) => area.id));
    for (let x = -260; x <= 260; x += 10)
      for (let z = -260; z <= 260; z += 10) expect(ids.has(festivalAreaAt(x, z))).toBe(true);
  });
  it('prioritizes humans and the measured performance allowance over ambient bots', () => {
    expect(mobileBotBudget('camp', 0)).toBe(3);
    expect(mobileBotBudget('main-stage', 0)).toBe(3);
    expect(mobileBotBudget('north-camps', 0)).toBe(1);
    expect(mobileBotBudget('camp', 3)).toBe(2);
    expect(mobileBotBudget('camp', 15)).toBe(0);
    expect(mobileBotBudget('camp', 0, 1)).toBe(1);
    expect(mobileBotBudget('missing', 0)).toBe(0);
  });
  it('reduces bots on sustained low FPS and recovers slowly without reacting to tab gaps', () => {
    const budget = new MobileBotAllowance();
    for (let frame = 0; frame < 41; frame++) budget.update(1 / 20);
    expect(budget.value).toBe(4);
    for (const delta of [NaN, Infinity, -1, 0, 20]) budget.update(delta);
    expect(budget.value).toBe(4);
    for (let frame = 0; frame < 120; frame++) budget.update(1 / 60);
    expect(budget.value).toBe(4);
    for (let frame = 0; frame < 500; frame++) budget.update(1 / 60);
    expect(budget.value).toBe(5);
    for (let frame = 0; frame < 400; frame++) budget.update(1 / 20);
    expect(budget.value).toBe(0);
  });
});
