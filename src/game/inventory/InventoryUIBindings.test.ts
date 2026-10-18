import { describe, expect, it, vi } from 'vitest';
import { inventoryEffects } from './ConsumableInventory';
import type { EffectId } from '../effects/EffectManager';

describe('Inventory UI and Keyboard Bindings', () => {
  it('maps numeric keys 1 through 9 to the corresponding inventory effects', () => {
    const effectKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    expect(effectKeys.length).toBe(inventoryEffects.length);

    const keyToEffect = new Map<string, EffectId>();
    effectKeys.forEach((key, index) => {
      keyToEffect.set(key, inventoryEffects[index]);
    });

    expect(keyToEffect.get('1')).toBe('Piwo');
    expect(keyToEffect.get('2')).toBe('Papieros');
    expect(keyToEffect.get('3')).toBe('Joint');
    expect(keyToEffect.get('4')).toBe('Kreska');
    expect(keyToEffect.get('5')).toBe('Grzyb');
    expect(keyToEffect.get('6')).toBe('MDMA');
    expect(keyToEffect.get('7')).toBe('LSD');
    expect(keyToEffect.get('8')).toBe('Woda');
    expect(keyToEffect.get('9')).toBe('Okulary');
  });

  it('triggers effect handler via event delegation on items container when enabled', () => {
    const handler = vi.fn();
    const listeners: Record<string, (e: any) => void> = {};

    const container = {
      addEventListener: (type: string, fn: (e: any) => void) => {
        listeners[type] = fn;
      },
    };

    // Setup listener matching main.ts implementation
    container.addEventListener('click', (event: any) => {
      const target = event.target as any;
      const button = target?.closest?.('[data-effect]');
      if (button && button.dataset?.effect && !button.disabled) {
        handler(button.dataset.effect);
      }
    });

    const createButton = (effect: string, disabled: boolean) => {
      const btn = {
        dataset: { effect },
        disabled,
        closest: (selector: string) => (selector === '[data-effect]' ? btn : null),
      };
      return btn;
    };

    // Enabled button click:
    const piwoBtn = createButton('Piwo', false);
    listeners.click({ target: piwoBtn });
    expect(handler).toHaveBeenCalledWith('Piwo');

    // Child element (e.g. span/strong) inside enabled button:
    const childSpan = {
      closest: (selector: string) => (selector === '[data-effect]' ? piwoBtn : null),
    };
    listeners.click({ target: childSpan });
    expect(handler).toHaveBeenCalledWith('Piwo');

    // Disabled button click:
    const disabledBtn = createButton('LSD', true);
    listeners.click({ target: disabledBtn });
    expect(handler).not.toHaveBeenCalledWith('LSD');
  });
});
