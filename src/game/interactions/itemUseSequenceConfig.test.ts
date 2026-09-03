import { describe, expect, it } from 'vitest';
import { inspectableItems } from './itemConfig';
import { itemUseSequenceConfig, validUseSequenceTiming } from './itemUseSequenceConfig';

describe('itemUseSequenceConfig', () => {
  it('assigns a prop and a valid effect marker to all five table items', () => {
    for (const item of inspectableItems) {
      const config = itemUseSequenceConfig[item.effect];
      expect(config.propId).toBe(item.id);
      expect(config.label.length).toBeGreaterThan(3);
      expect(validUseSequenceTiming(config)).toBe(true);
    }
  });

  it('provides an explicit no-prop fallback for inventory-only effects', () => {
    expect(itemUseSequenceConfig.Piwo.propId).toBeUndefined();
    expect(itemUseSequenceConfig.Papieros.propId).toBeUndefined();
    expect(validUseSequenceTiming(itemUseSequenceConfig.Piwo)).toBe(true);
    expect(validUseSequenceTiming(itemUseSequenceConfig.Papieros)).toBe(true);
  });
});
