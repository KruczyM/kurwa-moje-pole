import { type EffectId, type EffectPhase, type VisualSettings } from '../effects/EffectManager';
import { type AudioSettings } from '../services/SettingsService';
import { type AppState } from '../lifecycle/AppStateMachine';
import { controlHintForState } from '../lifecycle/InputBindings';
import { type ConsumableInventory } from '../inventory/ConsumableInventory';

/**
 * UIManager hermetyzuje zapytania do drzewa DOM i aktualizacje widoków HTML/CSS,
 * całkowicie odcinając logikę silnika Three.js od bezpośrednich zależności od DOM.
 */
export class UIManager {
  private toastTimer = 0;

  private qs<T extends HTMLElement>(selector: string): T | null {
    if (typeof document === 'undefined') return null;
    return document.querySelector<T>(selector);
  }

  showToast(message: string, durationMs = 2200): void {
    const toast = this.qs<HTMLElement>('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    if (typeof window !== 'undefined') {
      this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), durationMs);
    }
  }

  setInteractionPrompt(text: string | null): void {
    const prompt = this.qs<HTMLElement>('#prompt');
    if (!prompt) return;
    if (text) {
      prompt.textContent = text;
      prompt.hidden = false;
    } else {
      prompt.hidden = true;
    }
  }

  updateEffectHud(
    active: EffectId | null,
    phase: EffectPhase,
    remaining: number,
    visualIntensity = 0,
    reduceMotion = false,
  ): void {
    const effectHud = this.qs<HTMLElement>('#effect-hud');
    if (effectHud) {
      const phaseLabels = {
        inactive: 'nieaktywny',
        fadeIn: 'wchodzenie',
        active: 'aktywny',
        fadeOut: 'wygaszanie',
      } as const;
      effectHud.textContent = active
        ? `${active} · ${phaseLabels[phase]} · ${Math.ceil(remaining)} s`
        : 'Brak aktywnego efektu';
    }

    const smoke = this.qs<HTMLElement>('#smoke');
    if (smoke) {
      smoke.hidden = active !== 'Papieros';
    }

    const lsdOverlay = this.qs<HTMLElement>('#lsd-overlay');
    if (lsdOverlay) {
      lsdOverlay.hidden = active !== 'LSD';
      lsdOverlay.style.setProperty(
        '--lsd-strength',
        String(active === 'LSD' ? visualIntensity : 0),
      );
      lsdOverlay.classList.toggle('reduced-motion', reduceMotion);
    }
  }

  syncInventory(inventory: ConsumableInventory): void {
    if (typeof document === 'undefined') return;
    document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((button) => {
      const effect = button.dataset.effect as EffectId;
      const quantity = inventory.quantity(effect);
      button.disabled = quantity < 1;
      const countEl = button.querySelector<HTMLElement>('.item-count');
      if (countEl) countEl.textContent = `× ${quantity}`;
      button.setAttribute('aria-label', `${effect}, liczba sztuk: ${quantity}`);
    });

    const statusEl = this.qs<HTMLElement>('#inventory-status');
    if (statusEl) {
      statusEl.textContent = inventory.total
        ? `Przedmioty w plecaku: ${inventory.total}. Wybierz jeden, aby go użyć.`
        : 'Plecak jest pusty. Przedmioty możesz znaleźć w obozie.';
    }
  }

  syncSettings(visual: VisualSettings, audio: AudioSettings): void {
    const set = (id: string, value: boolean | number) => {
      const input = this.qs<HTMLInputElement>(id);
      if (!input) return;
      if (input.type === 'range') input.value = String(Math.round(Number(value) * 100));
      else input.checked = Boolean(value);
    };

    set('#setting-intensity', visual.intensity);
    set('#setting-speaker-volume', audio.speakerVolume);
    set('#setting-ambient-volume', audio.ambientVolume);
    set('#setting-reduce-motion', visual.reduceMotion);
    set('#setting-limit-sway', visual.limitSway);
    set('#setting-disable-shake', visual.disableShake);
    set('#setting-disable-bloom', visual.disableBloom);
    set('#setting-disable-flashes', visual.disableFlashes);
    set('#setting-disable-aberration', visual.disableAberration);

    const grassSelect = this.qs<HTMLSelectElement>('#setting-grass-quality');
    if (grassSelect) grassSelect.value = visual.grassQuality;
    const matrixModeSelect = this.qs<HTMLSelectElement>('#setting-matrix-mode');
    if (matrixModeSelect) matrixModeSelect.value = visual.matrixMode;
    const matrixQualitySelect = this.qs<HTMLSelectElement>('#setting-matrix-quality');
    if (matrixQualitySelect) matrixQualitySelect.value = visual.matrixQuality;
  }

  syncState(state: AppState, mobileInput: boolean): void {
    const gameVisible = !['start', 'loading', 'error'].includes(state);
    const setHidden = (selector: string, hidden: boolean) => {
      const el = this.qs<HTMLElement>(selector);
      if (el) el.hidden = hidden;
    };

    setHidden('#hud', !gameVisible);
    setHidden('#inspect', state !== 'inspecting');
    setHidden('#dialog', state !== 'dialog');
    setHidden('#inventory', state !== 'inventory');
    setHidden('#pause', state !== 'paused');
    setHidden('#effect-warning', state !== 'effect-warning');
    setHidden('#use-sequence', state !== 'using-item');
    setHidden('#crosshair', state !== 'playing');
    if (!gameVisible) {
      setHidden('#festival-guide', true);
      setHidden('#festival-map', true);
    }

    const inputMode = mobileInput ? 'mobile' : 'desktop';
    const setText = (selector: string, text: string) => {
      const el = this.qs<HTMLElement>(selector);
      if (el) el.textContent = text;
    };

    setText('#controls-hud', controlHintForState(state, inputMode));
    setText('#inventory-help', controlHintForState('inventory', inputMode));
    setText('#pause-help', controlHintForState('paused', inputMode));
    setText('#dialog-help', controlHintForState('dialog', inputMode));
    setText('#effect-warning-help', controlHintForState('effect-warning', inputMode));

    if (state === 'effect-warning') {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          this.qs<HTMLButtonElement>('#warning-proceed')?.focus();
        });
      }
    }

    if (mobileInput) {
      setText('#inspect-use', 'UŻYJ');
      setText('#inspect-take', 'WEŹ');
      setText('#inspect-close', 'WRÓĆ');
    }

    if (state !== 'playing') {
      setHidden('#prompt', true);
    }
  }

  openDialog(name: string, text: string): void {
    const nameEl = this.qs<HTMLElement>('#dialog-name');
    if (nameEl) nameEl.textContent = name;
    const textEl = this.qs<HTMLElement>('#dialog-text');
    if (textEl) textEl.textContent = text;
  }

  openInspect(name: string, description: string, help: string): void {
    const nameEl = this.qs<HTMLElement>('#inspect-name');
    if (nameEl) nameEl.textContent = name;
    const descEl = this.qs<HTMLElement>('#inspect-text');
    if (descEl) descEl.textContent = description;
    const helpEl = this.qs<HTMLElement>('#inspect-help');
    if (helpEl) helpEl.textContent = help;
  }

  setUseSequenceLabel(label: string): void {
    const el = this.qs<HTMLElement>('#use-sequence-label');
    if (el) el.textContent = label;
  }

  setFade(show: boolean): void {
    const fade = this.qs<HTMLElement>('#fade');
    if (!fade) return;
    if (show) fade.classList.add('show');
    else fade.classList.remove('show');
  }

  setFreeCameraBadge(active: boolean): void {
    const badge = this.qs<HTMLElement>('#freecam-badge');
    if (badge) badge.hidden = !active;
  }

  initLsdOverlays(imageA: string, imageB: string): void {
    const lsdOverlay = this.qs<HTMLElement>('#lsd-overlay');
    if (!lsdOverlay) return;
    lsdOverlay.style.setProperty('--lsd-image-a', `url("${imageA}")`);
    lsdOverlay.style.setProperty('--lsd-image-b', `url("${imageB}")`);
  }

  isWarningDontShowAgainChecked(): boolean {
    return this.qs<HTMLInputElement>('#warning-dont-show-again')?.checked ?? false;
  }

  populateMotionSelect(animationNames: string[]): void {
    const motionSelect = this.qs<HTMLSelectElement>('#player-motion');
    if (!motionSelect) return;
    motionSelect.replaceChildren(
      ...animationNames.map(
        (name) => new Option(name.replace(/([a-z])([A-Z])/g, '$1 $2'), name),
      ),
    );
  }

  /** Przełącza widoczność modala Przewodnika Festiwalowicza */
  toggleGuide(open?: boolean): boolean {
    const guide = this.qs<HTMLElement>('#festival-guide');
    if (!guide) return false;
    const shouldOpen = open !== undefined ? open : guide.hidden;
    guide.hidden = !shouldOpen;
    if (shouldOpen) {
      const activeTab = document?.querySelector?.('.guide-tab-btn.active');
      if (!activeTab) {
        this.switchGuideTab('controls');
      }
    }
    return !guide.hidden;
  }

  isGuideOpen(): boolean {
    const guide = this.qs<HTMLElement>('#festival-guide');
    return guide ? !guide.hidden : false;
  }

  public static readonly GUIDE_TAB_ORDER = [
    'controls',
    'activities',
    'interactions',
    'items',
    'dialogue',
  ] as const;

  /** Przełącza aktywną zakładkę w przewodniku */
  switchGuideTab(tabId: string): void {
    if (typeof document === 'undefined') return;
    const tabs = UIManager.GUIDE_TAB_ORDER;
    const currentIndex = tabs.indexOf(tabId as any);
    const validIndex = currentIndex >= 0 ? currentIndex : 0;
    const activeTab = tabs[validIndex];

    const tabButtons = document.querySelectorAll<HTMLButtonElement>('.guide-tab-btn');
    tabButtons.forEach((btn) => {
      const match = btn.dataset.tab === activeTab;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', String(match));
    });

    const panels = document.querySelectorAll<HTMLElement>('.guide-panel');
    panels.forEach((panel) => {
      const match = panel.id === `guide-panel-${activeTab}`;
      panel.hidden = !match;
      panel.classList.toggle('active', match);
    });

    const stepIndicator = this.qs<HTMLElement>('#guide-step-indicator');
    if (stepIndicator) {
      stepIndicator.textContent = `Krok ${validIndex + 1} z ${tabs.length}`;
    }

    const prevBtn = this.qs<HTMLButtonElement>('#guide-prev-btn');
    if (prevBtn) {
      prevBtn.disabled = validIndex === 0;
    }

    const nextBtn = this.qs<HTMLButtonElement>('#guide-next-btn');
    if (nextBtn) {
      nextBtn.textContent = validIndex === tabs.length - 1 ? 'Gotowe ✓' : 'Dalej →';
    }
  }

  /** Inicjalizuje nasłuchiwacze kliknięć w zakładki i nawigację przewodnika */
  initGuideTabs(): void {
    if (typeof document === 'undefined') return;
    const tabs = UIManager.GUIDE_TAB_ORDER;
    const tabButtons = document.querySelectorAll<HTMLButtonElement>('.guide-tab-btn');
    tabButtons.forEach((btn) => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        if (tab) this.switchGuideTab(tab);
      };
    });

    const prevBtn = this.qs<HTMLButtonElement>('#guide-prev-btn');
    if (prevBtn) {
      prevBtn.onclick = () => {
        const activeBtn = document.querySelector<HTMLButtonElement>('.guide-tab-btn.active');
        const currentTab = activeBtn?.dataset.tab;
        const currentIndex = tabs.indexOf(currentTab as any);
        if (currentIndex > 0) {
          this.switchGuideTab(tabs[currentIndex - 1]);
        }
      };
    }

    const nextBtn = this.qs<HTMLButtonElement>('#guide-next-btn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        const activeBtn = document.querySelector<HTMLButtonElement>('.guide-tab-btn.active');
        const currentTab = activeBtn?.dataset.tab;
        const currentIndex = tabs.indexOf(currentTab as any);
        if (currentIndex >= 0 && currentIndex < tabs.length - 1) {
          this.switchGuideTab(tabs[currentIndex + 1]);
        } else {
          this.toggleGuide(false);
        }
      };
    }

    const closeBtn = this.qs<HTMLButtonElement>('#guide-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.toggleGuide(false);
    }
    const okBtn = this.qs<HTMLButtonElement>('#guide-ok-btn');
    if (okBtn) {
      okBtn.onclick = () => this.toggleGuide(false);
    }
  }

  /** Przełącza widoczność modala Mapy Festiwalu */
  toggleMap(open?: boolean): boolean {
    const map = this.qs<HTMLElement>('#festival-map');
    if (!map) return false;
    const shouldOpen = open !== undefined ? open : map.hidden;
    map.hidden = !shouldOpen;
    return !map.hidden;
  }

  isMapOpen(): boolean {
    const map = this.qs<HTMLElement>('#festival-map');
    return map ? !map.hidden : false;
  }

  dispose(): void {
    clearTimeout(this.toastTimer);
    const prompt = this.qs<HTMLElement>('#prompt');
    if (prompt) prompt.hidden = true;
    const toast = this.qs<HTMLElement>('#toast');
    if (toast) toast.classList.remove('visible');
    const fade = this.qs<HTMLElement>('#fade');
    if (fade) fade.classList.remove('show');
    const lsdOverlay = this.qs<HTMLElement>('#lsd-overlay');
    if (lsdOverlay) {
      lsdOverlay.hidden = true;
      lsdOverlay.style.removeProperty('--lsd-strength');
    }
    const guide = this.qs<HTMLElement>('#festival-guide');
    if (guide) guide.hidden = true;
    const map = this.qs<HTMLElement>('#festival-map');
    if (map) map.hidden = true;
  }
}
