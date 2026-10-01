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

  it('configures contextual SFX sounds for substances', () => {
    expect(itemUseSequenceConfig.Piwo.sfx?.sound).toBe('beer_open');
    expect(itemUseSequenceConfig.Piwo.sfx?.delay).toBeGreaterThan(0);
    expect(itemUseSequenceConfig.Papieros.sfx?.sound).toBe('lighter_flick');
    expect(itemUseSequenceConfig.Joint.sfx?.sound).toBe('lighter_flick');
    expect(itemUseSequenceConfig.Kreska.sfx?.sound).toBe('sniff');
    expect(itemUseSequenceConfig.MDMA.sfx?.sound).toBe('swallow');
    expect(itemUseSequenceConfig.LSD.sfx?.sound).toBe('swallow');
  });
});
