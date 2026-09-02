import { describe, expect, it } from 'vitest';
import { inspectableItems, itemById } from './itemConfig';

describe('itemConfig', () => {
  it('provides a visible description for every inspectable item', () => {
    for (const item of inspectableItems) {
      expect(item.description.trim().length).toBeGreaterThan(20);
      expect(itemById.get(item.id)?.description).toBe(item.description);
      expect(item.tableQuantity).toBe(1);
      expect(Number.isInteger(item.tableQuantity)).toBe(true);
    }
  });
});
