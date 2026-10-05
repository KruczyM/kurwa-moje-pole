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

  it('includes Woda and Okulary as supported festival items', () => {
    expect(inventoryEffects).toContain('Woda');
    expect(inventoryEffects).toContain('Okulary');

    const inventory = new ConsumableInventory({ Woda: 3, Okulary: 1 });
    expect(inventory.quantity('Woda')).toBe(3);
    expect(inventory.quantity('Okulary')).toBe(1);
    expect(inventory.total).toBe(4);
  });

  it('Woda reduces active trip/effect duration by 40%', () => {
    const inventory = new ConsumableInventory({ Woda: 2 });
    let shortenedFraction = 0;
    const effectMock = {
      shortenActiveEffect: (fraction: number) => {
        shortenedFraction = fraction;
      },
    };

    expect(inventory.useWater(effectMock)).toBe(true);
    expect(inventory.quantity('Woda')).toBe(1);
    expect(shortenedFraction).toBeCloseTo(0.4);

    expect(inventory.useWater(effectMock)).toBe(true);
    expect(inventory.quantity('Woda')).toBe(0);

    // When empty, cannot use water
    expect(inventory.useWater(effectMock)).toBe(false);
  });

  it('Okulary activates sunglasses effect with 50% bloom/exposure reduction for 60 seconds', () => {
    const inventory = new ConsumableInventory({ Okulary: 1 });
    let appliedDuration = 0;
    const effectMock = {
      applySunglasses: (durationSeconds?: number) => {
        appliedDuration = durationSeconds ?? 0;
      },
    };

    expect(inventory.useSunglasses(effectMock)).toBe(true);
    expect(inventory.quantity('Okulary')).toBe(0);
    expect(appliedDuration).toBe(60);

    // When empty, cannot use sunglasses
    expect(inventory.useSunglasses(effectMock)).toBe(false);
  });
});
