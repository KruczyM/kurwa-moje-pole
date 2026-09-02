import { describe, expect, it } from 'vitest';
import { ConsumableInventory, inventoryEffects } from './ConsumableInventory';

describe('ConsumableInventory', () => {
  it('starts empty for every supported effect', () => {
    const inventory = new ConsumableInventory();

    expect(inventory.total).toBe(0);
    inventoryEffects.forEach((effect) => expect(inventory.quantity(effect)).toBe(0));
  });

  it('supports collecting multiple copies and consuming them one at a time', () => {
    const inventory = new ConsumableInventory();

    inventory.add('LSD', 2);
    expect(inventory.quantity('LSD')).toBe(2);
    expect(inventory.consume('LSD')).toBe(true);
    expect(inventory.quantity('LSD')).toBe(1);
    expect(inventory.consume('LSD')).toBe(true);
    expect(inventory.consume('LSD')).toBe(false);
    expect(inventory.quantity('LSD')).toBe(0);
  });

  it('rejects invalid collection quantities', () => {
    const inventory = new ConsumableInventory();

    expect(() => inventory.add('Joint', 0)).toThrow('dodatnią liczbą całkowitą');
    expect(() => inventory.add('Joint', 1.5)).toThrow('dodatnią liczbą całkowitą');
  });
});
