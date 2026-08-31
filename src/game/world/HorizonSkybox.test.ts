import { describe, expect, it } from 'vitest';
import { skyboxPeriodForHour } from './HorizonSkybox';

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
