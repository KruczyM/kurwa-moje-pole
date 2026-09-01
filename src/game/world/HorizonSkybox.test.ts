import { describe, expect, it } from 'vitest';
import { skyboxPeriodForHour, skyboxVariantForPeriod } from './HorizonSkybox';

describe('skyboxPeriodForHour', () => {
  it.each([
    [0, 'night'],
    [5, 'night'],
    [6, 'day'],
    [17, 'day'],
    [18, 'evening'],
    [21, 'evening'],
    [22, 'night'],
    [23, 'night'],
  ] as const)('dla godziny %i wybiera %s', (hour, expected) => {
    expect(skyboxPeriodForHour(hour)).toBe(expected);
  });
});

describe('skyboxVariantForPeriod', () => {
  it('nie zmienia wariantu dziennego ani wieczornego', () => {
    expect(skyboxVariantForPeriod('day', 0.9)).toBe('day');
    expect(skyboxVariantForPeriod('evening', 0.1)).toBe('evening');
  });

  it('losuje noc i nebulę z dwóch równych połówek zakresu', () => {
    expect(skyboxVariantForPeriod('night', 0)).toBe('night');
    expect(skyboxVariantForPeriod('night', 0.4999)).toBe('night');
    expect(skyboxVariantForPeriod('night', 0.5)).toBe('nebula');
    expect(skyboxVariantForPeriod('night', 0.9999)).toBe('nebula');
  });
});
