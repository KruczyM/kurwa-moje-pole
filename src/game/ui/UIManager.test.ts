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
    dataset: {} as Record<string, string>,
    textContent: '',
    innerHTML: '',
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
      '#setting-aspect-ratio',
      '#festival-guide',
      '#festival-map',
      '#guide-step-indicator',
      '#guide-prev-btn',
      '#guide-next-btn',
      '#guide-close',
      '#bingo-card-container',
      '#passport-stamps-container',
      '#guitar-hud',
      '#guitar-score-val',
      '#guitar-combo-val',
      '#guitar-cheer-val',
      '#guitar-multiplier-badge',
      '#guitar-song-info',
      '#guitar-feedback',
      '#guitar-song-select-modal',
      '#guitar-songs-list',
      '#guitar-notes-container',
      '#guitar-exit-btn',
      '#can-rush-hud',
      '#can-rush-time-val',
      '#can-rush-count-val',
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

    ui.syncSettings({ ...defaultVisualSettings, intensity: 0.75 }, defaultAudioSettings);
    expect(intensity.value).toBe('75');
    expect(elements.get('#setting-aspect-ratio')!.value).toBe('auto');
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
    expect(indicator.textContent).toBe('Krok 1 z 7');
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.textContent).toBe('Dalej →');

    // Step 2: activities
    ui.switchGuideTab('activities');
    expect(indicator.textContent).toBe('Krok 2 z 7');
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.textContent).toBe('Dalej →');

    // Step 7: passport (last step)
    ui.switchGuideTab('passport');
    expect(indicator.textContent).toBe('Krok 7 z 7');
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.textContent).toBe('Gotowe ✓');
  });

  it('renders Bingo 3x3 cards and win banner', () => {
    const ui = new UIManager();
    const container = elements.get('#bingo-card-container') as any;

    const mockBingo = {
      getGrid: () => [
        { id: 'mlyn', label: 'Diabelski Młyn', description: 'Przejedź się kołem', checked: true },
        { id: 'woda', label: 'Grzybek Wodny', description: 'Napij się wody', checked: false },
      ],
      hasBingo: () => true,
    };

    ui.renderBingo(mockBingo);
    expect(container.innerHTML).toContain('BINGO!');
    expect(container.innerHTML).toContain('Diabelski Młyn');
    expect(container.innerHTML).toContain('checked');
  });

  it('renders Passport stamps and progress summary', () => {
    const ui = new UIManager();
    const container = elements.get('#passport-stamps-container') as any;

    const mockPassport = {
      getStamps: () => [
        {
          id: 'mlyn_pasazer',
          name: 'Zdobywca Młyna',
          category: 'atrakcje',
          description: 'Lot nad Czaplinkiem',
        },
      ],
      getProgress: () => ({ collected: 1, total: 8, percentage: 13 }),
    };

    ui.renderPassport(mockPassport);
    expect(container.innerHTML).toContain('Zdobywca Młyna');
    expect(container.innerHTML).toContain('1 / 8');
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

  it('updates guitar rhythm HUD state with active notes, score, and combo', () => {
    const ui = new UIManager();
    const hud = elements.get('#guitar-hud')!;
    hud.hidden = true;

    ui.updateGuitarHud({
      active: true,
      phase: 'playing',
      currentTime: 10,
      score: 450,
      combo: 12,
      maxCombo: 12,
      multiplier: 3,
      cheerLevel: 0.85,
      activeNotes: [{ id: 'n1', lane: 1, progress: 0.6, chordName: 'Em' }],
      currentSong: {
        id: 'arahja',
        title: 'Arahja',
        artist: 'Kult',
        duration: 30,
      },
    });

    expect(hud.hidden).toBe(false);
    expect(elements.get('#guitar-score-val')!.textContent).toBe('450');
    expect(elements.get('#guitar-combo-val')!.textContent).toBe('12');
    expect(elements.get('#guitar-multiplier-badge')!.textContent).toBe('x3');
    expect(elements.get('#guitar-song-info')!.textContent).toContain('Arahja');
    expect(elements.get('#guitar-notes-container')!.innerHTML).toContain('Em');
  });

  it('updates can rush HUD with countdown timer and collected count', () => {
    const ui = new UIManager();
    const hud = elements.get('#can-rush-hud')!;
    hud.hidden = true;

    ui.updateCanRushHud(true, 75, 8);
    expect(hud.hidden).toBe(false);
    expect(elements.get('#can-rush-time-val')!.textContent).toBe('75s');
    expect(elements.get('#can-rush-count-val')!.textContent).toBe('8 pkt');
    ui.updateCanRushHud(true, 65, 12, 'EKO-FALA ×2');
    expect(elements.get('#can-rush-count-val')!.textContent).toBe('12 pkt | EKO-FALA ×2');

    ui.updateCanRushHud(false);
    expect(hud.hidden).toBe(true);
  });
});
