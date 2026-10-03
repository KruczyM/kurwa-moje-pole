import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UIManager } from './UIManager';
import { defaultVisualSettings } from '../effects/EffectManager';
import { defaultAudioSettings } from '../services/SettingsService';
import { ConsumableInventory } from '../inventory/ConsumableInventory';

function createMockElement(id = '') {
  const classList = new Set<string>();
  const style = new Map<string, string>();
  const attributes = new Map<string, string>();
  return {
    id,
    textContent: '',
    value: '',
    type: 'text',
    checked: false,
    hidden: false,
    disabled: false,
    classList: {
      add: (c: string) => classList.add(c),
      remove: (c: string) => classList.delete(c),
      contains: (c: string) => classList.has(c),
      toggle: (c: string, force?: boolean) => {
        if (force === undefined) {
          if (classList.has(c)) classList.delete(c);
          else classList.add(c);
        } else if (force) classList.add(c);
        else classList.delete(c);
      },
    },
    style: {
      setProperty: (k: string, v: string) => style.set(k, v),
      removeProperty: (k: string) => style.delete(k),
      getPropertyValue: (k: string) => style.get(k) || '',
    },
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    getAttribute: (k: string) => attributes.get(k) ?? null,
    querySelector: () => null,
    focus: () => {},
  };
}

describe('UIManager', () => {
  const elements = new Map<string, ReturnType<typeof createMockElement>>();
  const originalDocument = globalThis.document;

  beforeEach(() => {
    elements.clear();
    const selectors = [
      '#toast',
      '#prompt',
      '#hud',
      '#effect-hud',
      '#controls-hud',
      '#smoke',
      '#lsd-overlay',
      '#crosshair',
      '#dialog',
      '#dialog-name',
      '#dialog-text',
      '#dialog-help',
      '#inspect',
      '#inspect-name',
      '#inspect-text',
      '#inspect-help',
      '#inspect-use',
      '#inspect-take',
      '#inspect-close',
      '#inventory',
      '#inventory-status',
      '#inventory-help',
      '#pause',
      '#pause-help',
      '#effect-warning',
      '#effect-warning-help',
      '#warning-proceed',
      '#use-sequence',
      '#use-sequence-label',
      '#fade',
      '#freecam-badge',
      '#warning-dont-show-again',
      '#player-motion',
      '#setting-intensity',
      '#setting-speaker-volume',
      '#setting-ambient-volume',
      '#setting-reduce-motion',
      '#setting-limit-sway',
      '#setting-disable-shake',
      '#setting-disable-bloom',
      '#setting-disable-flashes',
      '#setting-disable-aberration',
      '#setting-grass-quality',
      '#setting-matrix-mode',
      '#setting-matrix-quality',
      '#festival-guide',
      '#festival-map',
      '#guide-step-indicator',
      '#guide-prev-btn',
      '#guide-next-btn',
      '#guide-close',
      '#guide-ok-btn',
    ];

    selectors.forEach((sel) => {
      elements.set(sel, createMockElement(sel));
    });

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: (sel: string) => elements.get(sel) ?? null,
        querySelectorAll: () => [],
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      writable: true,
      configurable: true,
    });
  });

  it('shows and hides interaction prompt', () => {
    const ui = new UIManager();
    const prompt = elements.get('#prompt')!;
    prompt.hidden = true;

    ui.setInteractionPrompt('E — Wejdź do toi-toia');
    expect(prompt.hidden).toBe(false);
    expect(prompt.textContent).toBe('E — Wejdź do toi-toia');

    ui.setInteractionPrompt(null);
    expect(prompt.hidden).toBe(true);
  });

  it('displays toast notifications', () => {
    const ui = new UIManager();
    const toast = elements.get('#toast')!;
    ui.showToast('Testowa wiadomość');
    expect(toast.textContent).toBe('Testowa wiadomość');
    expect(toast.classList.contains('visible')).toBe(true);
  });

  it('synchronizes inventory status text', () => {
    const ui = new UIManager();
    const inventory = new ConsumableInventory();
    ui.syncInventory(inventory);
    expect(elements.get('#inventory-status')!.textContent).toContain('Plecak jest pusty');

    inventory.add('Piwo');
    ui.syncInventory(inventory);
    expect(elements.get('#inventory-status')!.textContent).toContain('Przedmioty w plecaku: 1');
  });

  it('updates effect HUD and overlays accurately', () => {
    const ui = new UIManager();
    const hud = elements.get('#effect-hud')!;
    const smoke = elements.get('#smoke')!;
    const lsd = elements.get('#lsd-overlay')!;

    ui.updateEffectHud('Papieros', 'active', 12, 1, false);
    expect(hud.textContent).toContain('Papieros');
    expect(smoke.hidden).toBe(false);
    expect(lsd.hidden).toBe(true);

    ui.updateEffectHud('LSD', 'active', 20, 0.85, true);
    expect(smoke.hidden).toBe(true);
    expect(lsd.hidden).toBe(false);
    expect(lsd.classList.contains('reduced-motion')).toBe(true);
  });

  it('synchronizes modal states and visibility', () => {
    const ui = new UIManager();
    ui.syncState('playing', false);
    expect(elements.get('#hud')!.hidden).toBe(false);
    expect(elements.get('#pause')!.hidden).toBe(true);

    ui.syncState('paused', false);
    expect(elements.get('#pause')!.hidden).toBe(false);

    ui.syncState('dialog', false);
    expect(elements.get('#dialog')!.hidden).toBe(false);
  });

  it('synchronizes settings inputs without errors', () => {
    const ui = new UIManager();
    const intensity = elements.get('#setting-intensity')!;
    intensity.type = 'range';

    ui.syncSettings(
      { ...defaultVisualSettings, intensity: 0.75 },
      defaultAudioSettings,
    );
    expect(intensity.value).toBe('75');
  });

  it('controls free camera badge visibility', () => {
    const ui = new UIManager();
    ui.setFreeCameraBadge(true);
    expect(elements.get('#freecam-badge')!.hidden).toBe(false);
    ui.setFreeCameraBadge(false);
    expect(elements.get('#freecam-badge')!.hidden).toBe(true);
  });

  it('checks warning checkbox state and configures lsd overlay css variables', () => {
    const ui = new UIManager();
    const warningCheckbox = elements.get('#warning-dont-show-again')!;
    warningCheckbox.checked = true;
    expect(ui.isWarningDontShowAgainChecked()).toBe(true);

    ui.initLsdOverlays('imgA.png', 'imgB.png');
    const lsd = elements.get('#lsd-overlay')!;
    expect(lsd.style.getPropertyValue('--lsd-image-a')).toBe('url("imgA.png")');
    expect(lsd.style.getPropertyValue('--lsd-image-b')).toBe('url("imgB.png")');
  });

  it('toggles and queries festival guide visibility', () => {
    const ui = new UIManager();
    const guide = elements.get('#festival-guide')!;
    guide.hidden = true;

    expect(ui.isGuideOpen()).toBe(false);
    expect(ui.toggleGuide()).toBe(true);
    expect(guide.hidden).toBe(false);
    expect(ui.isGuideOpen()).toBe(true);

    expect(ui.toggleGuide(false)).toBe(false);
    expect(guide.hidden).toBe(true);
    expect(ui.isGuideOpen()).toBe(false);
  });

  it('updates step navigation indicator and buttons when switching tabs', () => {
    const ui = new UIManager();
    const indicator = elements.get('#guide-step-indicator')!;
    const prevBtn = elements.get('#guide-prev-btn')!;
    const nextBtn = elements.get('#guide-next-btn')!;

    // Step 1: controls
    ui.switchGuideTab('controls');
    expect(indicator.textContent).toBe('Krok 1 z 5');
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.textContent).toBe('Dalej →');

    // Step 2: activities
    ui.switchGuideTab('activities');
    expect(indicator.textContent).toBe('Krok 2 z 5');
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.textContent).toBe('Dalej →');

    // Step 5: dialogue (last step)
    ui.switchGuideTab('dialogue');
    expect(indicator.textContent).toBe('Krok 5 z 5');
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.textContent).toBe('Gotowe ✓');
  });

  it('toggles and queries festival map visibility', () => {
    const ui = new UIManager();
    const map = elements.get('#festival-map')!;
    map.hidden = true;

    expect(ui.isMapOpen()).toBe(false);
    expect(ui.toggleMap()).toBe(true);
    expect(map.hidden).toBe(false);
    expect(ui.isMapOpen()).toBe(true);

    expect(ui.toggleMap(false)).toBe(false);
    expect(map.hidden).toBe(true);
    expect(ui.isMapOpen()).toBe(false);
  });

  it('gracefully handles disposal', () => {
    const ui = new UIManager();
    expect(() => ui.dispose()).not.toThrow();
  });
});
