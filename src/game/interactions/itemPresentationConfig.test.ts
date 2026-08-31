import { describe, expect, it } from 'vitest';
import { inspectableItems } from './itemConfig';
import { itemPresentation } from './itemPresentationConfig';

describe('itemPresentation', () => {
  it('defines separate table and inspection transforms for every item', () => {
    for (const item of inspectableItems) {
      const presentation = itemPresentation[item.id];
      expect(presentation.tableSize).toBeGreaterThan(0);
      expect(presentation.tableRotation[0]).toBeCloseTo(Math.PI / 2);
      expect(presentation.inspectRotation).toEqual([0, 0, 0]);
      expect(presentation.inspectSize).toBeGreaterThan(presentation.tableSize);
    }
  });

  it('keeps LSD and mushrooms easy to resize independently', () => {
    expect(itemPresentation.lsd.tableSize).not.toBe(itemPresentation.mushrooms.tableSize);
  });
});
