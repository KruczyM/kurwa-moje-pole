import { describe, expect, it } from 'vitest';
import {
  festivalAreaAt,
  festivalAreaLabel,
  MOBILE_FESTIVAL_AREAS,
  mobileBotBudget,
  MobileBotAllowance,
} from './mobileFestivalAreas';

describe('festival places on mobile', () => {
  it('keeps the six requested landmarks and complete neighbouring camp plots together', () => {
    expect(MOBILE_FESTIVAL_AREAS).toHaveLength(6);
    for (const [x, z, area] of [
      [0, -35, 'north-passage'],
      [-120, -44, 'north-passage'],
      [0, 0, 'camp'],
      [-98, 40, 'camp'],
      [50, 40, 'camp'],
      [-125, 87, 'lidl-wheel'],
      [116, -59, 'lidl-wheel'],
      [116, -51, 'lidl-wheel'],
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
    expect(festivalAreaAt(0, -60)).toBe('north-passage');
    expect(festivalAreaAt(0, -60.01)).toBe('north-camps');
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
