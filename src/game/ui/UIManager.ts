import { type EffectId, type EffectPhase, type VisualSettings } from '../effects/EffectManager';
import { type AudioSettings } from '../services/SettingsService';
import { type AppState } from '../lifecycle/AppStateMachine';
import { controlHintForState } from '../lifecycle/InputBindings';
import { type ConsumableInventory } from '../inventory/ConsumableInventory';
import { type FlankiHudState } from '../interactions/FlankiGame';
import { type FlankiRoster } from '../interactions/FlankiRoster';
import { type GuitarHudState, FESTIVAL_GUITAR_SONGS } from '../interactions/CampfireGuitarGame';

/**
 * UIManager hermetyzuje zapytania do drzewa DOM i aktualizacje widoków HTML/CSS,
 * całkowicie odcinając logikę silnika Three.js od bezpośrednich zależności od DOM.
 */
export class UIManager {
  isEcoPanelOpen(): boolean {
    return this.qs<HTMLElement>('#eco-panel')?.hidden === false;
  }
  setEcoPanelOpen(open: boolean): void {
    const panel = this.qs<HTMLElement>('#eco-panel');
    if (panel) panel.hidden = !open;
  }
  updateEcoPanel(
    summary: string,
    rows: readonly { name: string; score: number }[],
    actions: Record<string, { enabled: boolean; run: () => void }>,
  ): void {
    const summaryElement = this.qs<HTMLElement>('#eco-summary');
    if (summaryElement) summaryElement.textContent = summary;
    const list = this.qs<HTMLElement>('#eco-leaderboard');
    const key = JSON.stringify(rows);
    if (list && list.dataset.rows !== key) {
      list.dataset.rows = key;
      list.replaceChildren(
        ...rows.map((row) => {
          const item = document.createElement('li');
          item.textContent = `${row.name} — ${row.score} pkt`;
          return item;
        }),
      );
    }
    for (const [id, action] of Object.entries(actions)) {
      const button = this.qs<HTMLButtonElement>(`#eco-${id}`);
      if (!button) continue;
      button.disabled = !action.enabled;
      button.onclick = action.run;
    }
  }
  private toastTimer = 0;

  constructor() {
    this.initGuideTabs();
    this.initMapControls();
  }

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
      lsdOverlay.style.setProperty('--lsd-strength', String(active === 'LSD' ? visualIntensity : 0));
      lsdOverlay.classList.toggle('reduced-motion', reduceMotion);
    }
  }

  updateFlankiHud(state: FlankiHudState | null): void {
    const hud = this.qs<HTMLElement>('#flanki-hud');
    if (!hud) return;
    if (!state || !state.active) {
      hud.hidden = true;
      return;
    }
    hud.hidden = false;

    const phaseBadge = this.qs<HTMLElement>('#flanki-phase-badge');
    if (phaseBadge) {
      const phaseNames: Record<string, string> = {
        aiming: 'Celowanie',
        projectile_flying: 'Rzut',
        player_drinking: 'Pijesz!',
        bot_turn: 'Rzut bota',
        bot_drinking: 'Bot pije!',
        game_over: 'Koniec',
      };
      phaseBadge.textContent = phaseNames[state.phase] ?? state.phase;
    }

    const playerFill = this.qs<HTMLElement>('#flanki-player-beer-fill');
    const playerVal = this.qs<HTMLElement>('#flanki-player-beer-val');
    if (playerFill && playerVal) {
      const pct = Math.round(state.playerBeer * 100);
      playerFill.style.width = `${pct}%`;
      playerVal.textContent = `${pct}%`;
    }

    const botFill = this.qs<HTMLElement>('#flanki-bot-beer-fill');
    const botVal = this.qs<HTMLElement>('#flanki-bot-beer-val');
    if (botFill && botVal) {
      const pct = Math.round(state.botBeer * 100);
      botFill.style.width = `${pct}%`;
      botVal.textContent = `${pct}%`;
    }

    const powerContainer = this.qs<HTMLElement>('#flanki-power-container');
    const powerFill = this.qs<HTMLElement>('#flanki-power-fill');
    if (powerContainer && powerFill) {
      if (state.phase === 'aiming') {
        powerContainer.hidden = false;
        const powerPct = Math.round(state.throwPower * 100);
        powerFill.style.width = `${powerPct}%`;
        powerFill.classList.toggle('sweet-spot', Boolean(state.isSweetSpot));
        const band = this.qs<HTMLElement>('#flanki-recommended-power');
        if (band && state.recommendedPower !== undefined) {
          const low = Math.max(0, state.recommendedPower - 0.06);
          band.style.left = `${low * 100}%`;
          band.style.width = `${(Math.min(1, state.recommendedPower + 0.06) - low) * 100}%`;
          band.title = `Zalecana siła: ${Math.round(state.recommendedPower * 100)}% ±6`;
        }
      } else {
        powerContainer.hidden = true;
      }
    }

    const prompt = this.qs<HTMLElement>('#flanki-prompt');
    if (prompt) {
      prompt.textContent = state.promptText;
    }

    hud.classList.toggle('choking', Boolean(state.isChoking));

    const throwerEl = this.qs<HTMLElement>('#flanki-thrower-name');
    if (throwerEl && state.activeThrowerName) {
      throwerEl.textContent = `${state.activeThrowerName} (${state.activeThrowerTeam === (state.localTeam ?? 'A') ? 'Twoja Ekipa' : 'Rywale'})`;
    }

    const runnerEl = this.qs<HTMLElement>('#flanki-runner-name');
    if (runnerEl && state.defendingRunnerName) {
      runnerEl.textContent = state.defendingRunnerName;
    }

    const stopBanner = this.qs<HTMLElement>('#flanki-stop-banner');
    if (stopBanner) {
      stopBanner.hidden = !state.isStopActive;
      const stopSub = this.qs<HTMLElement>('#flanki-stop-subtitle');
      if (stopSub && state.stopBannerText) {
        stopSub.textContent = state.stopBannerText;
      }
    }
  }

  showFlankiRoster(
    roster: FlankiRoster,
    onStart: () => void | boolean,
    onCancel: () => void,
    options: {
      canStart?: boolean;
      status?: string;
      localTeam?: 'A' | 'B';
      onRunnerChange?: (team: 'A' | 'B', id: string) => void | boolean | Promise<boolean>;
    } = {},
  ): void {
    const modal = this.qs<HTMLElement>('#flanki-roster-modal');
    if (!modal) return;
    modal.hidden = false;
    let status = modal.querySelector<HTMLElement>('[data-flanki-lobby-status]');
    if (!status) {
      status = document.createElement('p');
      status.dataset.flankiLobbyStatus = '';
      status.setAttribute('role', 'status');
      modal.querySelector('.flanki-roster-header')?.append(status);
    }
    status.textContent = options.status ?? 'Możesz rozpocząć mecz z botami.';
    const aTitle = modal.querySelector<HTMLElement>('.team-a h3');
    const bTitle = modal.querySelector<HTMLElement>('.team-b h3');
    if (aTitle)
      aTitle.textContent = options.localTeam === 'B' ? 'Drużyna A — Rywale' : 'Drużyna A — Twoja ekipa';
    if (bTitle)
      bTitle.textContent = options.localTeam === 'B' ? 'Drużyna B — Twoja ekipa' : 'Drużyna B — Rywale';

    const teamAList = this.qs<HTMLElement>('#flanki-team-a-players');
    if (teamAList) {
      teamAList.innerHTML = roster.teamA.throwers
        .map((t) => `<li><span class="role-icon">🎯</span> <strong>${t.name}</strong> — Rzucający</li>`)
        .concat(
          `<li><span class="role-icon">⚡</span> <strong>${roster.teamA.runner.name}</strong> — <span class="runner-badge">STAŁY BIEGACZ</span></li>`,
        )
        .join('');
    }

    const teamBList = this.qs<HTMLElement>('#flanki-team-b-players');
    if (teamBList) {
      teamBList.innerHTML = roster.teamB.throwers
        .map((t) => `<li><span class="role-icon">🎯</span> <strong>${t.name}</strong> — Rzucający</li>`)
        .concat(
          `<li><span class="role-icon">⚡</span> <strong>${roster.teamB.runner.name}</strong> — <span class="runner-badge">STAŁY BIEGACZ</span></li>`,
        )
        .join('');
    }

    for (const [teamId, team, list] of [
      ['A', roster.teamA, teamAList],
      ['B', roster.teamB, teamBList],
    ] as const) {
      if (!list || !options.onRunnerChange) continue;
      const row = document.createElement('li');
      const label = document.createElement('label');
      label.textContent = 'Stały biegacz: ';
      const select = document.createElement('select');
      select.dataset.flankiRunner = teamId;
      select.setAttribute('aria-label', `Stały biegacz drużyny ${teamId}`);
      select.disabled = options.canStart === false;
      for (const participant of [team.runner, ...team.throwers]) {
        const option = document.createElement('option');
        option.value = participant.id;
        option.textContent = participant.name;
        select.append(option);
      }
      select.value = team.runner.id;
      select.onchange = async () => {
        const selected = select.value;
        select.disabled = true;
        status!.textContent = 'Zapisywanie wyboru biegacza…';
        const accepted = await options.onRunnerChange?.(teamId, selected);
        if (!modal.hidden) {
          this.showFlankiRoster(roster, onStart, onCancel, options);
          if (accepted === false)
            status!.textContent =
              'Nie zapisano wyboru. Sprawdź komunikat serwera; skład zmienia gospodarz przed startem.';
        }
      };
      label.append(select);
      row.append(label);
      list.append(row);
    }
    let instructions = modal.querySelector<HTMLElement>('[data-flanki-join-help]');
    if (!instructions) {
      instructions = document.createElement('p');
      instructions.dataset.flankiJoinHelp = '';
      modal.querySelector('.flanki-roster-header')?.append(instructions);
    }
    instructions.textContent =
      'Drugi gracz: otwórz ten sam adres gry i serwera, wybierz inną wolną postać i pseudonim, wejdź na pole, podejdź do boiska i naciśnij E. Na jednym komputerze użyj okna prywatnego lub innej przeglądarki, nie duplikuj karty. Gospodarz uruchamia mecz dopiero po dołączeniu wszystkich. Rzut: wybierz chwiejną trajektorię, przytrzymaj LPM lub Spację, aby wybrać siłę, i puść, aby rzucić.';
    const startBtn = this.qs<HTMLButtonElement>('#flanki-start-btn');
    if (startBtn) {
      startBtn.disabled = options.canStart === false;
      startBtn.textContent = options.canStart === false ? 'CZEKAJ NA GOSPODARZA' : '🍻 ROZPOCZNIJ MECZ';
      startBtn.onclick = () => {
        if (onStart() !== false) this.hideFlankiRoster();
      };
    }

    const cancelBtn = this.qs<HTMLButtonElement>('#flanki-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.hideFlankiRoster();
        onCancel();
      };
    }
  }

  hideFlankiRoster(): void {
    const modal = this.qs<HTMLElement>('#flanki-roster-modal');
    if (modal) modal.hidden = true;
  }

  isFlankiRosterOpen(): boolean {
    const modal = this.qs<HTMLElement>('#flanki-roster-modal');
    return modal ? !modal.hidden : false;
  }

  updateGuitarHud(
    state: GuitarHudState,
    onSelectSong?: (songId: string) => void,
    onHitLane?: (lane: number) => void,
    onExit?: () => void,
  ): void {
    const hud = this.qs<HTMLElement>('#guitar-hud');
    if (!hud) return;
    hud.dataset.phase = state.phase;

    if (!state.active) {
      hud.hidden = true;
      return;
    }

    hud.hidden = false;

    const scoreVal = this.qs<HTMLElement>('#guitar-score-val');
    if (scoreVal) scoreVal.textContent = String(state.score);

    const comboVal = this.qs<HTMLElement>('#guitar-combo-val');
    if (comboVal) comboVal.textContent = String(state.combo);

    const cheerVal = this.qs<HTMLElement>('#guitar-cheer-val');
    if (cheerVal) cheerVal.textContent = `${Math.round(state.cheerLevel * 100)}%`;

    const multiplierBadge = this.qs<HTMLElement>('#guitar-multiplier-badge');
    if (multiplierBadge) {
      multiplierBadge.textContent = `x${state.multiplier}`;
      if (state.multiplier >= 4) {
        multiplierBadge.classList.add('fever');
      } else {
        multiplierBadge.classList.remove('fever');
      }
    }

    const songInfo = this.qs<HTMLElement>('#guitar-song-info');
    if (songInfo) {
      songInfo.textContent = state.currentSong
        ? `🎵 ${state.currentSong.title} — ${state.currentSong.artist}`
        : 'Wybierz utwór z repertuaru';
    }

    const feedback = this.qs<HTMLElement>('#guitar-feedback');
    if (feedback) {
      if (state.lastFeedback) {
        feedback.textContent = state.lastFeedback.text;
        feedback.style.color = state.lastFeedback.color;
      } else {
        feedback.textContent = '';
      }
    }

    // Modal wyboru utworu
    const modal = this.qs<HTMLElement>('#guitar-song-select-modal');
    if (modal) {
      modal.hidden = state.phase !== 'song_select';
      if (state.phase === 'song_select') {
        const list = this.qs<HTMLElement>('#guitar-songs-list');
        if (list && list.children.length === 0) {
          list.innerHTML = FESTIVAL_GUITAR_SONGS.map(
            (s) =>
              `<button type="button" class="guitar-song-option" data-song-id="${s.id}">
                <strong>${s.title}</strong>
                <span>${s.artist} · ${s.difficulty}${s.license ? ` · ${s.license}` : ''}</span>
              </button>`,
          ).join('');

          list.querySelectorAll<HTMLElement>('.guitar-song-option').forEach((el) => {
            el.onclick = () => {
              const sid = el.getAttribute('data-song-id');
              if (sid && onSelectSong) onSelectSong(sid);
            };
          });
        }
      }
    }

    // Spadające nuty na gryfie
    const container = this.qs<HTMLElement>('#guitar-notes-container');
    if (container) {
      container.innerHTML = state.activeNotes
        .map((note) => {
          const leftPercent = note.lane * 25 + 12.5;
          const topPercent = Math.min(95, note.progress * 86);
          return `<div class="guitar-note-gem lane-${note.lane}" style="left: ${leftPercent}%; top: ${topPercent}%;">${note.chordName}</div>`;
        })
        .join('');
    }

    // Klawisze dotykowe
    const hitButtons =
      typeof hud.querySelectorAll === 'function'
        ? hud.querySelectorAll<HTMLButtonElement>('.guitar-hit-btn')
        : [];
    hitButtons.forEach((btn) => {
      btn.onclick = () => {
        const lane = Number(btn.getAttribute('data-lane'));
        if (!isNaN(lane) && onHitLane) onHitLane(lane);
      };
    });

    const exitBtn = this.qs<HTMLButtonElement>('#guitar-exit-btn');
    if (exitBtn) {
      exitBtn.onclick = () => {
        if (onExit) onExit();
      };
    }
  }

  updateCanRushHud(active: boolean, timeRemaining = 0, cansCollected = 0, bonus = ''): void {
    const hud = this.qs<HTMLElement>('#can-rush-hud');
    if (!hud) return;

    if (!active) {
      hud.hidden = true;
      return;
    }

    hud.hidden = false;
    const timeVal = this.qs<HTMLElement>('#can-rush-time-val');
    if (timeVal) timeVal.textContent = `${timeRemaining}s`;

    const countVal = this.qs<HTMLElement>('#can-rush-count-val');
    if (countVal) countVal.textContent = `${cansCollected} pkt${bonus ? ` | ${bonus}` : ''}`;
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
      ...animationNames.map((name) => new Option(name.replace(/([a-z])([A-Z])/g, '$1 $2'), name)),
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
    'bingo',
    'passport',
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

  /** Inicjalizuje przyciski sterowania powiększeniem i zamykania mapy */
  initMapControls(
    festivalMap?: {
      zoomIn: () => void;
      zoomOut: () => void;
      resetView: () => void;
      centerOnPlayer: (x: number, z: number) => void;
    },
    getPlayerPos?: () => { x: number; z: number } | null,
    onClose?: () => void,
  ): void {
    if (typeof document === 'undefined') return;

    const zoomInBtn = this.qs<HTMLButtonElement>('#map-zoom-in');
    if (zoomInBtn) {
      zoomInBtn.onclick = (e) => {
        e.stopPropagation();
        festivalMap?.zoomIn();
      };
    }

    const zoomOutBtn = this.qs<HTMLButtonElement>('#map-zoom-out');
    if (zoomOutBtn) {
      zoomOutBtn.onclick = (e) => {
        e.stopPropagation();
        festivalMap?.zoomOut();
      };
    }

    const zoomResetBtn = this.qs<HTMLButtonElement>('#map-zoom-reset');
    if (zoomResetBtn) {
      zoomResetBtn.onclick = (e) => {
        e.stopPropagation();
        festivalMap?.resetView();
      };
    }

    const centerMeBtn = this.qs<HTMLButtonElement>('#map-center-me');
    if (centerMeBtn) {
      centerMeBtn.onclick = (e) => {
        e.stopPropagation();
        const pos = getPlayerPos?.();
        if (pos) {
          festivalMap?.centerOnPlayer(pos.x, pos.z);
        }
      };
    }

    const mapCloseBtn = this.qs<HTMLButtonElement>('#map-close');
    if (mapCloseBtn) {
      mapCloseBtn.onclick = (e) => {
        e.stopPropagation();
        if (onClose) {
          onClose();
        } else {
          this.toggleMap(false);
        }
      };
    }

    const mapModal = this.qs<HTMLElement>('#festival-map');
    if (mapModal) {
      mapModal.onclick = (e) => {
        if (e.target === mapModal) {
          if (onClose) {
            onClose();
          } else {
            this.toggleMap(false);
          }
        }
      };
    }

    const container = this.qs<HTMLElement>('.festival-map-container');
    if (container) {
      container.onclick = (e) => {
        e.stopPropagation();
      };
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

  /** Renderuje dynamiczny stan siatki Bingo 3x3 w przewodniku */
  renderBingo(bingo: {
    getGrid(): readonly { id: string; label: string; description: string; checked: boolean }[];
    hasBingo(): boolean;
  }): void {
    const container = this.qs<HTMLElement>('#bingo-card-container');
    if (!container) return;
    const squares = bingo.getGrid();
    const hasWon = bingo.hasBingo();

    const bannerHtml = hasWon
      ? `<div class="bingo-banner">🎉 BINGO! Gratulacje — ukończono pełną linię festiwalowych wyzwań!</div>`
      : '';

    const gridHtml = squares
      .map((sq) => {
        const checkedClass = sq.checked ? 'checked' : '';
        const badge = sq.checked ? '✅' : '⬜';
        return `<div class="bingo-square ${checkedClass}" data-square-id="${sq.id}"><div class="bingo-square-title">${sq.label}</div><div class="bingo-square-desc">${sq.description}</div><div class="bingo-square-badge">${badge}</div></div>`;
      })
      .join('');

    container.innerHTML = bannerHtml + gridHtml;
  }

  /** Renderuje listę pieczątek i postęp w Paszporcie Festiwalowym */
  renderPassport(passport: {
    getStamps(): readonly {
      id: string;
      title?: string;
      name?: string;
      description: string;
      icon?: string;
      unlocked?: boolean;
    }[];
    getProgress(): { collected: number; total: number; percentage: number };
  }): void {
    const container = this.qs<HTMLElement>('#passport-stamps-container');
    if (!container) return;
    const stamps = passport.getStamps();
    const progress = passport.getProgress();

    const progressHtml = `<div class="passport-summary" style="margin-bottom: 12px; font-size: 12px; color: #ffe34d;">🏆 Zdobyte pieczątki: <strong>${progress.collected} / ${progress.total}</strong> (${progress.percentage}%)</div>`;

    const stampsHtml = stamps.length
      ? stamps
          .map((s) => {
            const name = s.title || s.name || s.id;
            const icon = s.icon || '🎖️';
            const isUnlocked = s.unlocked !== false;
            const cardClass = isUnlocked ? 'passport-stamp-card awarded' : 'passport-stamp-card locked';
            return `<div class="${cardClass}"><span class="passport-stamp-icon">${icon}</span><div class="passport-stamp-info"><strong>${name}</strong><small>${s.description}</small></div></div>`;
          })
          .join('')
      : '<p style="font-size: 12px; color: #bbb0c2;">Brak zdobytych pieczątek. Weź udział w atrakcjach pola, aby zdobyć swoje pierwsze pieczątki!</p>';

    container.innerHTML = progressHtml + stampsHtml;
  }

  dispose(): void {
    this.setEcoPanelOpen(false);
    for (const id of ['deposit', 'solo', 'create', 'join', 'start', 'leave', 'close']) {
      const button = this.qs<HTMLButtonElement>(`#eco-${id}`);
      if (button) button.onclick = null;
    }
    this.hideFlankiRoster();
    const start = this.qs<HTMLButtonElement>('#flanki-start-btn');
    const cancel = this.qs<HTMLButtonElement>('#flanki-cancel-btn');
    if (start) start.onclick = null;
    if (cancel) cancel.onclick = null;
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
