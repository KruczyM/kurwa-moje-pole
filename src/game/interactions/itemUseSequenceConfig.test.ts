import { describe, expect, it } from 'vitest';
import { inspectableItems } from './itemConfig';
import { itemUseSequenceConfig, validUseSequenceTiming } from './itemUseSequenceConfig';

describe('itemUseSequenceConfig', () => {
  it('assigns a prop and a valid effect marker to every table item', () => {
    for (const item of inspectableItems) {
      const config = itemUseSequenceConfig[item.effect];
      expect(config.propId).toBe(item.id);
      expect(config.label.length).toBeGreaterThan(3);
      expect(validUseSequenceTiming(config)).toBe(true);
    }
  });

  it('uses a local can for beer and distinct gesture profiles', () => {
    expect(itemUseSequenceConfig.Piwo.propId).toBeUndefined();
    expect(itemUseSequenceConfig.Papieros.propId).toBe('cigarette');
    expect(validUseSequenceTiming(itemUseSequenceConfig.Piwo)).toBe(true);
    expect(validUseSequenceTiming(itemUseSequenceConfig.Papieros)).toBe(true);
    expect(itemUseSequenceConfig.Papieros.gesture).toBe('smoke');
    expect(itemUseSequenceConfig.Kreska.gesture).toBe('sniff');
    expect(itemUseSequenceConfig.Grzyb.gesture).toBe('eat');
    expect(itemUseSequenceConfig.Grzyb.consumeProp).toBe(true);
  });
});
