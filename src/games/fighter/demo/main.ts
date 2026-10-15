import './demo.css';
import './cabinet.css';
import { ROSTER, ROSTER_KEYS, CharacterRosterEntry, getFighterStats } from '../data/fighters/roster';
import { STAGES, STAGE_KEYS } from '../data/stages';
import { FighterSimulation, type SimulationEvent } from '../simulation/FighterSimulation';
import { INPUT, type MatchState } from '../simulation/CombatTypes';
import { BotController, type BotDifficulty } from '../ai/BotController';
import { CameraRig2D } from '../presentation/CameraRig2D';
import { FighterView } from '../presentation/FighterView';
import { FighterHud } from '../presentation/FighterHud';
import { FighterAudio } from '../presentation/FighterAudio';
import { renderFighterHelp } from './fighterHelp';
import { selectionArtUrl } from './selectionArt';
import { FighterOnline } from '../network/FighterOnline';
import type { FighterFrame, FighterRoomState } from '../network/fighterProtocol';
import { interpolateMatch } from '../network/interpolate';

class FighterDemo {
  private canvas = document.getElementById('fighter-canvas') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d')!;

  private p1Key = 'amper';
  private p2Key = 'korba';
  private p1Entry: CharacterRosterEntry = ROSTER['amper']!;
  private p2Entry: CharacterRosterEntry = ROSTER['korba']!;
  private selectedStageId = 'main_stage';
  private selectionSlot: 1 | 2 = 1;
  private p1CinematicPlayed = false;
  private p2CinematicPlayed = false;

  private sim!: FighterSimulation;
  private bot = new BotController('normal');
  private camera = new CameraRig2D();
  private view = new FighterView();
  private hud = new FighterHud();
  private audio = new FighterAudio();

  private portraitImages = new Map<string, HTMLImageElement>();
  private keyMask = 0;
  private keyMaskP1 = 0;
  private keyMaskP2 = 0;
  private touchMask = 0;
  private isBotEnabled = true;
  private botDifficulty: BotDifficulty = 'normal';
  private isPaused = false;
  private inSelectScreen = true;
  private isVsSplashActive = false;
  private creditCount = 99;
  private lastTime = performance.now();
  private accumulator = 0;
  private previousLocalState: MatchState | null = null;
  private heldKeys = new Set<string>();
  private pointerInputs = new Map<number, number>();
  private readonly step = 1 / 60;
  private mode: 'bot' | 'training' | 'online' | 'hotseat' = 'bot';
  private online = new FighterOnline(
    (room) => this.receiveRoom(room),
    (frame) => this.receiveFrame(frame),
    (message) => this.onlineStatus(message),
  );
  private refreshOnlineSelection = () => {};
  private onlineMatchId = -1;
  private previousOnlineState: MatchState | null = null;
  private onlineFrameAt = 0;
  private roomReceivedAt = 0;

  constructor() {
    this.preloadPortraits();
    this.setupResize();
    this.setupKeyboard();
    this.setupTouchControls();
    this.setupSelectScreen();
    this.setupModals();
    this.startMatch();
    this.setupOnline();
    this.setupAudio();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  private setupAudio(): void {
    const controls = document.querySelector<HTMLElement>('.audio-settings')!;
    const selection = controls.cloneNode(true) as HTMLElement;
    selection.querySelectorAll<HTMLElement>('[id]').forEach((item) => {
      item.id += '-select';
    });
    document.getElementById('selection-audio-settings')!.append(selection);
    let music = 0.45,
      effects = 0.8;
    let reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let crt = true;
    try {
      const saved = JSON.parse(localStorage.getItem('fighter-av-settings') ?? '{}');
      if (Number.isFinite(saved?.music)) music = Math.max(0, Math.min(1, saved.music));
      if (Number.isFinite(saved?.effects)) effects = Math.max(0, Math.min(1, saved.effects));
      if (typeof saved?.reduced === 'boolean') reduced = saved.reduced;
      if (typeof saved?.crt === 'boolean') crt = saved.crt;
    } catch {
      /* Optional persistence. */
    }
    const apply = () => {
      this.audio.setVolumes(music, effects);
      this.camera.reducedEffects = reduced;
      this.view.superCinematic.reducedEffects = reduced;
      document.getElementById('crt-overlay')?.classList.toggle('disabled', !crt);
      for (const suffix of ['', '-select']) {
        const musEl = document.getElementById('music-volume' + suffix) as HTMLInputElement | null;
        const sfxEl = document.getElementById('sfx-volume' + suffix) as HTMLInputElement | null;
        const redEl = document.getElementById('reduced-effects' + suffix) as HTMLInputElement | null;
        const crtEl = document.getElementById('crt-toggle' + suffix) as HTMLInputElement | null;
        if (musEl) musEl.value = String(music * 100);
        if (sfxEl) sfxEl.value = String(effects * 100);
        if (redEl) redEl.checked = reduced;
        if (crtEl) crtEl.checked = crt;
      }
    };
    for (const suffix of ['', '-select']) {
      for (const id of ['music-volume', 'sfx-volume', 'reduced-effects', 'crt-toggle']) {
        document.getElementById(id + suffix)?.addEventListener('input', (event) => {
          const input = event.target as HTMLInputElement;
          if (id === 'music-volume') music = Number(input.value) / 100;
          else if (id === 'sfx-volume') effects = Number(input.value) / 100;
          else if (id === 'reduced-effects') reduced = input.checked;
          else if (id === 'crt-toggle') crt = input.checked;
          apply();
          try {
            localStorage.setItem('fighter-av-settings', JSON.stringify({ music, effects, reduced, crt }));
          } catch {
            /* Optional persistence. */
          }
        });
      }
    }
    apply();
    const unlock = () => {
      void this.audio.unlock().then(() => {
        this.audio.preloadCombat();
        this.audio.preloadFighters([this.p1Key, this.p2Key]);
      });
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => this.audio.setVisible(!document.hidden));
    window.addEventListener('pagehide', () => this.audio.dispose());
  }

  private preloadPortraits(): void {
    const base = import.meta.env.BASE_URL || '/';
    for (const key of ROSTER_KEYS) {
      const img = new Image();
      img.src = `${base}game-assets/2d/after/portraits/${key}.png`;
      this.portraitImages.set(key, img);
    }
    for (const sKey of STAGE_KEYS) {
      this.view.getStageImage(sKey);
    }
  }

  private startMatch(): void {
    this.clearInput();
    this.accumulator = 0;
    this.previousLocalState = null;
    this.view.reset();
    this.p1CinematicPlayed = this.p2CinematicPlayed = false;
    this.view.retainFighters([this.p1Key, this.p2Key]);
    this.audio.preloadFighters([this.p1Key, this.p2Key]);
    this.p1Entry = ROSTER[this.p1Key]!;
    this.p2Entry = ROSTER[this.p2Key]!;
    this.view.getFighterSprites(this.p1Key);
    this.view.getFighterSprites(this.p2Key);
    this.view.setStage(this.selectedStageId);
    this.sim = new FighterSimulation(this.p1Entry.definition, this.p2Entry.definition, {
      training: this.mode === 'training',
    });
    this.bot = new BotController(this.botDifficulty);
    document
      .querySelectorAll<HTMLElement>('.controls-helper-box, .pause-controls-guide')
      .forEach((host) => renderFighterHelp(host, this.p1Entry.definition));
    (window as any).__fighterSim = this.sim;
    if (import.meta.env.DEV) {
      (window as any).__fighterView = this.view;
      (window as any).__fighterCamera = this.camera;
    }
  }

  private setupResize(): void {
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', resize);
    resize();
  }

  private setupKeyboard(): void {
    const keyMapSingle: Record<string, number> = {
      // Movement (WASD lub Strzałki)
      KeyW: INPUT.UP,
      KeyS: INPUT.DOWN,
      KeyA: INPUT.LEFT,
      KeyD: INPUT.RIGHT,
      ArrowUp: INPUT.UP,
      ArrowDown: INPUT.DOWN,
      ArrowLeft: INPUT.LEFT,
      ArrowRight: INPUT.RIGHT,

      // Ciosy (Układ arcade 3x2)
      KeyU: INPUT.LP,
      KeyI: INPUT.RP,
      KeyH: INPUT.DOWN | INPUT.RP,
      KeyN: INPUT.DOWN | INPUT.RK,
      KeyP: INPUT.TECHNIQUE,
      KeyO: INPUT.SPECIAL,

      KeyJ: INPUT.LK,
      KeyK: INPUT.RK,
      KeyL: INPUT.BLOCK,
      Space: INPUT.BLOCK,

      // Numpad
      Numpad4: INPUT.LP,
      Numpad5: INPUT.RP,
      Numpad6: INPUT.SPECIAL,
      Numpad1: INPUT.LK,
      Numpad2: INPUT.RK,
      Numpad3: INPUT.BLOCK,
      Numpad0: INPUT.BLOCK,
    };

    // Hotseat P1 (Lewa strona klawiatury)
    const hotseatP1Map: Record<string, number> = {
      KeyW: INPUT.UP,
      KeyS: INPUT.DOWN,
      KeyA: INPUT.LEFT,
      KeyD: INPUT.RIGHT,
      KeyF: INPUT.LP,
      KeyG: INPUT.RP,
      KeyV: INPUT.LK,
      KeyB: INPUT.RK,
      KeyR: INPUT.TECHNIQUE,
      KeyT: INPUT.SPECIAL,
      KeyC: INPUT.BLOCK,
    };

    // Hotseat P2 (Prawa strona klawiatury / Strzałki + Numpad)
    const hotseatP2Map: Record<string, number> = {
      ArrowUp: INPUT.UP,
      ArrowDown: INPUT.DOWN,
      ArrowLeft: INPUT.LEFT,
      ArrowRight: INPUT.RIGHT,
      KeyI: INPUT.LP,
      Numpad4: INPUT.LP,
      KeyO: INPUT.RP,
      Numpad5: INPUT.RP,
      KeyK: INPUT.LK,
      Numpad1: INPUT.LK,
      KeyL: INPUT.RK,
      Numpad2: INPUT.RK,
      KeyP: INPUT.TECHNIQUE,
      Numpad6: INPUT.TECHNIQUE,
      BracketLeft: INPUT.SPECIAL,
      NumpadAdd: INPUT.SPECIAL,
      Enter: INPUT.BLOCK,
      Numpad0: INPUT.BLOCK,
      Numpad3: INPUT.BLOCK,
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modal = document.querySelector<HTMLElement>('.modal-overlay:not([hidden])');
        const focusable = modal
          ? Array.from(
              modal.querySelectorAll<HTMLElement>('button, a, input, select, summary, [tabindex="0"]'),
            ).filter((item) => item.offsetParent !== null && !item.matches(':disabled'))
          : [];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (
          first &&
          last &&
          (!modal?.contains(document.activeElement) ||
            (e.shiftKey && document.activeElement === first) ||
            (!e.shiftKey && document.activeElement === last))
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }

      if (!this.isPaused && !this.inSelectScreen && !this.isVsSplashActive) {
        if (this.mode === 'hotseat') {
          const isP1 = Boolean(hotseatP1Map[e.code]);
          const isP2 = Boolean(hotseatP2Map[e.code]);
          if (isP1 || isP2) {
            this.heldKeys.add(e.code);
            this.keyMaskP1 = [...this.heldKeys].reduce((mask, code) => mask | (hotseatP1Map[code] ?? 0), 0);
            this.keyMaskP2 = [...this.heldKeys].reduce((mask, code) => mask | (hotseatP2Map[code] ?? 0), 0);
            e.preventDefault();
          }
        } else {
          if (keyMapSingle[e.code]) {
            this.heldKeys.add(e.code);
            this.keyMask = [...this.heldKeys].reduce((mask, code) => mask | (keyMapSingle[code] ?? 0), 0);
            if (this.mode === 'online') this.online.sendInput(this.keyMask | this.touchMask);
            e.preventDefault();
          }
        }
      }

      if (e.code === 'Escape' && !e.repeat) {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.mode === 'hotseat') {
        const isP1 = Boolean(hotseatP1Map[e.code]);
        const isP2 = Boolean(hotseatP2Map[e.code]);
        if (isP1 || isP2) {
          this.heldKeys.delete(e.code);
          this.keyMaskP1 = [...this.heldKeys].reduce((mask, code) => mask | (hotseatP1Map[code] ?? 0), 0);
          this.keyMaskP2 = [...this.heldKeys].reduce((mask, code) => mask | (hotseatP2Map[code] ?? 0), 0);
          e.preventDefault();
        }
      } else {
        if (keyMapSingle[e.code]) {
          this.heldKeys.delete(e.code);
          this.keyMask = [...this.heldKeys].reduce((mask, code) => mask | (keyMapSingle[code] ?? 0), 0);
          if (this.mode === 'online') this.online.sendInput(this.keyMask | this.touchMask);
          e.preventDefault();
        }
      }
    });
    window.addEventListener('blur', () => {
      this.clearInput();
      if (!this.inSelectScreen && !this.isPaused) this.togglePause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearInput();
        if (!this.inSelectScreen && !this.isPaused) this.togglePause();
      }
    });
  }

  private setupTouchControls(): void {
    const buttons = document.querySelectorAll<HTMLElement>('[data-input]');
    buttons.forEach((btn) => {
      const bit = parseInt(btn.dataset.input!, 10);

      const press = (e: PointerEvent) => {
        e.preventDefault();
        if (this.isPaused || this.inSelectScreen) return;
        this.pointerInputs.set(e.pointerId, bit);
        btn.setPointerCapture(e.pointerId);
        this.touchMask = [...this.pointerInputs.values()].reduce((mask, value) => mask | value, 0);
        if (this.mode === 'online') this.online.sendInput(this.keyMask | this.touchMask);
        btn.classList.add('active');
      };
      const release = (e: PointerEvent) => {
        e.preventDefault();
        this.pointerInputs.delete(e.pointerId);
        this.touchMask = [...this.pointerInputs.values()].reduce((mask, value) => mask | value, 0);
        if (this.mode === 'online') this.online.sendInput(this.keyMask | this.touchMask);
        btn.classList.remove('active');
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    });
  }

  private setupSelectScreen(): void {
    const grid = document.getElementById('roster-grid')!;
    const previewPortrait = document.getElementById('preview-portrait') as HTMLImageElement;
    const previewName = document.getElementById('preview-name')!;
    const previewTitle = document.getElementById('preview-title')!;
    const previewStyle = document.getElementById('preview-style')!;
    const previewDesc = document.getElementById('preview-desc')!;
    const previewSpecial = document.getElementById('preview-special')!;
    const previewUltimate = document.getElementById('preview-ultimate')!;
    const selectScreen = document.getElementById('char-select-screen')!;
    const startFightBtn = document.getElementById('start-fight-btn')!;
    const randomBtn = document.getElementById('random-btn')!;
    const rawBase = import.meta.env.BASE_URL || '/';
    const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

    const updatePreview = (key: string) => {
      const entry = ROSTER[key]!;
      previewPortrait.src = selectionArtUrl(base, key, 'full');
      previewPortrait.alt = `${entry.definition.name} — poza bojowa`;
      previewPortrait.decoding = 'async';
      previewName.textContent = entry.definition.name.toUpperCase();
      previewTitle.textContent = entry.definition.title;
      previewStyle.textContent = `Styl: ${entry.fightingStyle}`;
      previewDesc.textContent = entry.description;
      previewSpecial.textContent = entry.definition.moves['special']?.name || 'Ruch specjalny';
      previewUltimate.textContent = entry.definition.moves['ultimate']?.name || 'Super cios';

      // Update stat meters
      const stats = getFighterStats(key);
      const fillPower = document.getElementById('stat-fill-power');
      const fillSpeed = document.getElementById('stat-fill-speed');
      const fillHangover = document.getElementById('stat-fill-hangover');
      const numPower = document.getElementById('stat-num-power');
      const numSpeed = document.getElementById('stat-num-speed');
      const numHangover = document.getElementById('stat-num-hangover');
      if (fillPower) fillPower.style.width = `${stats.power * 10}%`;
      if (fillSpeed) fillSpeed.style.width = `${stats.speed * 10}%`;
      if (fillHangover) fillHangover.style.width = `${stats.hangoverRes * 10}%`;
      if (numPower) numPower.textContent = `${stats.power}/10`;
      if (numSpeed) numSpeed.textContent = `${stats.speed}/10`;
      if (numHangover) numHangover.textContent = `${stats.hangoverRes}/10`;
    };

    const refreshGridCards = () => {
      for (const [seat, key] of [
        [1, this.p1Key],
        [2, this.p2Key],
      ] as const) {
        const image = document.getElementById(`matchup-p${seat}`) as HTMLImageElement;
        image.src = selectionArtUrl(base, key, 'full');
        image.alt = ROSTER[key]!.definition.name;
        document.getElementById(`matchup-name-p${seat}`)!.textContent = ROSTER[key]!.definition.name;
      }
      document.querySelectorAll('.roster-card').forEach((card) => {
        const key = card.getAttribute('data-key');
        card.classList.toggle('selected-p1', key === this.p1Key);
        card.classList.toggle('selected-p2', key === this.p2Key);
      });
    };

    // Arcade Coin Slot Button
    const coinBtn = document.getElementById('arcade-coin-btn');
    const creditCountEl = document.getElementById('arcade-credit-count');
    coinBtn?.addEventListener('click', () => {
      this.creditCount++;
      if (creditCountEl) creditCountEl.textContent = String(this.creditCount);
      this.audio.playCoinInsert();
      setTimeout(() => this.audio.playAnnouncerChooseFighter(), 520);
      const marquee = document.querySelector('.cabinet-marquee');
      marquee?.classList.add('cabinet-shake');
      setTimeout(() => marquee?.classList.remove('cabinet-shake'), 380);
    });

    // Build 16 character cards
    grid.innerHTML = '';
    for (const key of ROSTER_KEYS) {
      const entry = ROSTER[key]!;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'roster-card';
      card.setAttribute('data-key', key);

      const img = document.createElement('img');
      img.src = selectionArtUrl(base, key, 'thumb');
      img.alt = entry.definition.name;
      img.width = 192;
      img.height = 192;
      img.decoding = 'async';
      img.loading = 'lazy';

      const label = document.createElement('span');
      label.textContent = entry.definition.name;

      card.appendChild(img);
      card.appendChild(label);

      card.addEventListener('click', () => {
        if (this.mode === 'online') {
          void this.online.request({ action: 'select', characterId: key });
          return;
        }
        if (this.selectionSlot === 1) this.p1Key = key;
        else this.p2Key = key;
        updatePreview(key);
        refreshGridCards();
        this.audio.playUi();
      });

      grid.appendChild(card);
    }

    updatePreview(this.p1Key);
    refreshGridCards();
    this.refreshOnlineSelection = () => {
      refreshGridCards();
      updatePreview(this.selectionSlot === 1 ? this.p1Key : this.p2Key);
    };
    document.querySelectorAll<HTMLButtonElement>('[data-select-slot]').forEach((button) => {
      button.addEventListener('click', () => {
        if (this.mode === 'online') return;
        this.selectionSlot = button.dataset.selectSlot === '2' ? 2 : 1;
        document
          .querySelectorAll('[data-select-slot]')
          .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        updatePreview(this.selectionSlot === 1 ? this.p1Key : this.p2Key);
      });
    });

    randomBtn.addEventListener('click', () => {
      const randKey = ROSTER_KEYS[Math.floor(Math.random() * ROSTER_KEYS.length)]!;
      if (this.mode === 'online') {
        void this.online.request({ action: 'select', characterId: randKey });
        return;
      }
      if (this.selectionSlot === 1) this.p1Key = randKey;
      else this.p2Key = randKey;
      updatePreview(randKey);
      refreshGridCards();
      this.audio.playUi();
    });

    const stageChips = document.querySelectorAll<HTMLButtonElement>('.stage-chip');
    stageChips.forEach((chip) => {
      const stage = STAGES[chip.dataset.stage!];
      if (stage) chip.style.setProperty('--stage-art', `url("${base}${stage.imagePath}")`);
      chip.addEventListener('click', () => {
        const stageId = chip.dataset.stage;
        if (stageId && STAGES[stageId]) {
          if (this.mode === 'online') {
            void this.online.request({ action: 'stage', stageId });
            return;
          }
          this.selectedStageId = stageId;
          this.view.setStage(stageId);
          stageChips.forEach((c) => c.classList.toggle('active', c.dataset.stage === stageId));
          this.audio.playUi();
        }
      });
    });

    startFightBtn.addEventListener('click', () => {
      if (this.mode === 'online') {
        const ready = this.online.room?.players[this.online.seat]?.ready ?? false;
        void this.online.request({ action: 'ready', ready: !ready });
        return;
      }
      this.isBotEnabled = this.mode === 'bot';
      const difficulty = (document.getElementById('bot-difficulty') as HTMLSelectElement).value;
      this.botDifficulty = difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'normal';

      selectScreen.setAttribute('hidden', '');
      this.inSelectScreen = false;
      this.isPaused = false;

      this.showVsSplash(() => {
        this.startMatch();
        this.audio.playAnnouncerRound(1);
        setTimeout(() => {
          this.audio.playAnnouncerFight();
        }, 1100);
      });
    });

    const openSelectBtn = document.getElementById('char-select-btn');
    openSelectBtn?.addEventListener('click', () => {
      if (this.mode === 'online') {
        this.leaveOnline();
        return;
      }
      this.inSelectScreen = true;
      this.isPaused = true;
      selectScreen.removeAttribute('hidden');
    });
  }

  private setupOnline(): void {
    const mode = document.getElementById('fight-mode') as HTMLSelectElement;
    const changeMode = () => {
      this.online.close();
      this.onlineMatchId = -1;
      this.previousOnlineState = null;
      this.mode =
        mode.value === 'online'
          ? 'online'
          : mode.value === 'training'
            ? 'training'
            : mode.value === 'hotseat'
              ? 'hotseat'
              : 'bot';
      this.isBotEnabled = this.mode === 'bot';
      document.querySelectorAll<HTMLButtonElement>('[data-fight-mode]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.fightMode === this.mode));
      });
      document.getElementById('online-lobby')!.hidden = this.mode !== 'online';
      (document.getElementById('bot-difficulty') as HTMLSelectElement).disabled = this.mode !== 'bot';
      document.querySelectorAll<HTMLButtonElement>('[data-select-slot]').forEach((button) => {
        button.hidden = this.mode === 'online';
      });
      this.receiveRoom(null);
    };
    mode.addEventListener('change', changeMode);
    document.querySelectorAll<HTMLButtonElement>('[data-fight-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        if (mode.value === button.dataset.fightMode) return;
        mode.value = button.dataset.fightMode!;
        changeMode();
        this.audio.playUi();
      });
    });
    document.getElementById('online-create')!.addEventListener('click', () => this.online.open('create'));
    document.getElementById('online-join')!.addEventListener('click', () => {
      const code = (document.getElementById('online-code') as HTMLInputElement).value.trim().toUpperCase();
      this.online.open('join', code);
    });
    document.getElementById('online-copy')!.addEventListener('click', () => {
      if (!this.online.room) return;
      const url = new URL(location.href);
      url.searchParams.set('room', this.online.room.code);
      if (!navigator.clipboard) {
        this.onlineStatus('Podaj znajomemu kod pokoju: ' + this.online.room.code);
        return;
      }
      void navigator.clipboard
        ?.writeText(url.href)
        .then(() => this.onlineStatus('Zaproszenie skopiowane. Wyślij je znajomemu.'))
        .catch(() =>
          this.onlineStatus(
            'Nie można skopiować linku. Podaj znajomemu kod pokoju: ' + this.online.room?.code,
          ),
        );
    });
    document.getElementById('online-leave')!.addEventListener('click', () => this.leaveOnline());
    let code = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
    if (!code) {
      try {
        const saved = JSON.parse(sessionStorage.getItem('fighter-online-session') ?? '{}');
        if (typeof saved?.code === 'string' && /^[A-F0-9]{6}$/.test(saved.code)) code = saved.code;
      } catch {
        /* Optional persistence. */
      }
    }
    if (code) {
      mode.value = 'online';
      changeMode();
      (document.getElementById('online-code') as HTMLInputElement).value = code;
      this.online.open('join', code);
    }
    window.addEventListener('pagehide', () => this.leaveOnline(false));
  }

  private onlineStatus(message: string): void {
    document.getElementById('online-status')!.textContent = message;
    const banner = document.getElementById('online-match-status')!;
    banner.textContent = message;
    banner.hidden = this.mode !== 'online' || this.inSelectScreen || !message;
  }

  private receiveRoom(room: FighterRoomState | null): void {
    this.roomReceivedAt = performance.now();
    const online = this.mode === 'online';
    const active = Boolean(room && room.phase !== 'closed');
    const start = document.getElementById('start-fight-btn') as HTMLButtonElement;
    start.disabled = online && (!active || !['lobby', 'countdown'].includes(room!.phase));
    start.textContent = online
      ? room?.players[this.online.seat]?.ready
        ? 'COFNIJ GOTOWOŚĆ'
        : 'JESTEM GOTOWY'
      : 'WRZUĆ COMBO / START';
    for (const id of ['online-copy', 'online-leave'])
      (document.getElementById(id) as HTMLButtonElement).disabled = !room;
    for (const id of ['online-create', 'online-join'])
      (document.getElementById(id) as HTMLButtonElement).disabled = Boolean(room);
    (document.getElementById('random-btn') as HTMLButtonElement).disabled =
      online && (!active || !['lobby', 'countdown'].includes(room!.phase));
    document.querySelectorAll<HTMLButtonElement>('.roster-card').forEach((card) => {
      card.disabled = online && start.disabled;
    });
    document.querySelectorAll<HTMLButtonElement>('.stage-chip').forEach((chip) => {
      chip.disabled = online && (start.disabled || this.online.seat !== 0);
      if (room) chip.classList.toggle('active', chip.dataset.stage === room.stageId);
    });
    const details = document.getElementById('online-room-details')!;
    if (!room) {
      this.onlineMatchId = -1;
      this.previousOnlineState = null;
      details.textContent = '';
      this.onlineStatus(online ? 'Utwórz pokój albo wpisz kod od znajomego.' : '');
      return;
    }
    this.selectionSlot = this.online.seat === 0 ? 1 : 2;
    this.p1Key = room.players[0]?.characterId ?? 'amper';
    this.p2Key = room.players[1]?.characterId ?? 'korba';
    this.selectedStageId = room.stageId;
    details.textContent =
      `Pokój ${room.code} · Jesteś graczem ${this.online.seat + 1} · ` +
      room.players
        .map((p, index) =>
          p
            ? `G${index + 1}: ${ROSTER[p.characterId]!.definition.name}${p.ready ? ' — gotowy' : ''}${p.connected ? '' : ' — rozłączony'}`
            : 'Czekamy na znajomego',
        )
        .join(' · ');
    this.refreshOnlineSelection();
    this.onlineStatus(
      room.message ||
        (room.phase === 'countdown'
          ? 'Obaj gotowi. Start za 3 sekundy…'
          : room.phase === 'fight'
            ? `Online · Sterujesz graczem ${this.online.seat + 1}`
            : room.phase === 'finished'
              ? 'Koniec meczu. Rewanż wymaga zgody obu graczy.'
              : 'Wybierz swoją postać i potwierdź gotowość. Arenę wybiera gospodarz.'),
    );
    if (room.phase === 'closed') {
      this.inSelectScreen = true;
      document.getElementById('char-select-screen')!.hidden = false;
      document.getElementById('pause-modal')!.hidden = true;
      document.getElementById('rematch-modal')!.hidden = true;
    }
    if (room.phase === 'countdown') document.getElementById('rematch-modal')!.hidden = true;
  }

  private receiveFrame(frame: FighterFrame): void {
    if (this.mode !== 'online' || !this.online.room) return;
    const changed = frame.matchId !== this.onlineMatchId;
    if (changed) {
      this.onlineMatchId = frame.matchId;
      this.startMatch();
      this.isPaused = false;
      document.getElementById('pause-modal')!.hidden = true;
      document.getElementById('rematch-modal')!.hidden = true;
    }
    this.previousOnlineState = changed ? null : this.sim.getSnapshot();
    this.onlineFrameAt = performance.now();
    this.sim.loadSnapshot(frame.snapshot);
    this.inSelectScreen = false;
    document.getElementById('char-select-screen')!.hidden = true;
    this.presentTick(frame.events);
  }

  private leaveOnline(intentional = true): void {
    this.online.close(intentional);
    this.onlineMatchId = -1;
    this.previousOnlineState = null;
    this.clearInput();
    this.inSelectScreen = true;
    this.isPaused = false;
    document.getElementById('char-select-screen')!.hidden = false;
    document.getElementById('pause-modal')!.hidden = true;
    document.getElementById('rematch-modal')!.hidden = true;
    document.getElementById('online-match-status')!.hidden = true;
  }

  private showVsSplash(onFinish: () => void): void {
    const splash = document.getElementById('matchup-vs-splash');
    if (!splash) {
      onFinish();
      return;
    }
    this.isVsSplashActive = true;
    const rawBase = import.meta.env.BASE_URL || '/';
    const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

    const p1Img = document.getElementById('vs-splash-p1-img') as HTMLImageElement | null;
    const p2Img = document.getElementById('vs-splash-p2-img') as HTMLImageElement | null;
    const p1Name = document.getElementById('vs-splash-p1-name');
    const p2Name = document.getElementById('vs-splash-p2-name');
    const p1Title = document.getElementById('vs-splash-p1-title');
    const p2Title = document.getElementById('vs-splash-p2-title');
    const arenaName = document.getElementById('vs-splash-arena');

    if (p1Img) p1Img.src = selectionArtUrl(base, this.p1Key, 'full');
    if (p2Img) p2Img.src = selectionArtUrl(base, this.p2Key, 'full');
    if (p1Name) p1Name.textContent = this.p1Entry.definition.name.toUpperCase();
    if (p2Name) p2Name.textContent = this.p2Entry.definition.name.toUpperCase();
    if (p1Title) p1Title.textContent = this.p1Entry.definition.title;
    if (p2Title) p2Title.textContent = this.p2Entry.definition.title;
    if (arenaName) arenaName.textContent = STAGES[this.selectedStageId]?.name ?? 'ARENA WALKI';

    splash.removeAttribute('hidden');
    this.audio.playVersusGong();
    this.camera.shake(12, 0.4);

    const app = document.getElementById('fighter-app');
    app?.classList.add('cabinet-shake');
    setTimeout(() => app?.classList.remove('cabinet-shake'), 450);

    setTimeout(() => {
      splash.setAttribute('hidden', '');
      this.isVsSplashActive = false;
      onFinish();
    }, 1800);
  }

  private setupModals(): void {
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const pauseModal = document.getElementById('pause-modal');
    const rematchModal = document.getElementById('rematch-modal');
    const rematchBtn = document.getElementById('rematch-btn');
    const selectScreen = document.getElementById('char-select-screen')!;
    const reselectPause = document.getElementById('reselect-from-pause-btn');
    const reselectWin = document.getElementById('reselect-from-win-btn');

    const helpBtn = document.getElementById('help-btn');
    pauseBtn?.addEventListener('click', () => this.togglePause());
    helpBtn?.addEventListener('click', () => this.togglePause());
    resumeBtn?.addEventListener('click', () => this.togglePause());
    document.getElementById('close-help-btn')?.addEventListener('click', () => this.togglePause());

    const openSelect = () => {
      if (this.mode === 'online') {
        this.leaveOnline();
        return;
      }
      pauseModal?.setAttribute('hidden', '');
      rematchModal?.setAttribute('hidden', '');
      selectScreen.removeAttribute('hidden');
      this.inSelectScreen = true;
      this.isPaused = true;
    };

    reselectPause?.addEventListener('click', openSelect);
    reselectWin?.addEventListener('click', openSelect);

    rematchBtn?.addEventListener('click', () => {
      if (this.mode === 'online') {
        void this.online.request({ action: 'rematch' });
        return;
      }
      this.clearInput();
      this.view.reset();
      this.accumulator = 0;
      this.previousLocalState = null;
      rematchModal?.setAttribute('hidden', '');
      this.isPaused = false;
      this.showVsSplash(() => {
        this.sim.restartMatch();
        this.audio.playAnnouncerRound(1);
        setTimeout(() => {
          this.audio.playAnnouncerFight();
        }, 1100);
      });
    });
  }

  private togglePause(): void {
    if (this.inSelectScreen) return;
    if (this.sim.getState().roundState === 'matchOver') return;
    this.isPaused = !this.isPaused;
    this.clearInput();
    this.accumulator = 0;
    this.previousLocalState = null;
    const pauseModal = document.getElementById('pause-modal');
    if (this.isPaused) {
      if (this.mode === 'online') this.onlineStatus('Menu otwarte — walka online trwa.');
      pauseModal?.removeAttribute('hidden');
    } else {
      pauseModal?.setAttribute('hidden', '');
      this.canvas.tabIndex = 0;
      this.canvas.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  private clearInput(): void {
    this.keyMask = this.keyMaskP1 = this.keyMaskP2 = this.touchMask = 0;
    this.heldKeys.clear();
    this.pointerInputs.clear();
    document.querySelectorAll('[data-input].active').forEach((button) => button.classList.remove('active'));
    if (this.mode === 'online') this.online.sendInput(0);
  }

  private loop(now: number): void {
    this.audio.setScene(this.inSelectScreen ? 'menu' : 'fight');
    this.audio.update();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const room = this.online.room;
    if (this.mode === 'online' && room?.phase === 'countdown') {
      const seconds = Math.max(1, Math.ceil(3 - (now - this.roomReceivedAt) / 1000));
      this.onlineStatus(`Start za ${seconds}…`);
    }

    if ((!this.isPaused || this.mode === 'online') && !this.inSelectScreen && this.sim) {
      this.accumulator += dt;
      while (this.accumulator >= this.step) {
        this.fixedTick();
        this.accumulator -= this.step;
      }
    }

    if (!this.inSelectScreen && this.sim) {
      this.render(dt);
    }
    requestAnimationFrame(this.loop);
  }

  private fixedTick(): void {
    if (this.mode === 'online') {
      this.online.sendInput(this.isPaused ? 0 : this.keyMask | this.touchMask);
      this.view.update();
      return;
    }
    const state = this.sim.getState();
    this.previousLocalState = {
      ...state,
      p1: { ...state.p1 },
      p2: { ...state.p2 },
    };

    const p1Input = this.mode === 'hotseat' ? (this.keyMaskP1 | this.touchMask) : (this.keyMask | this.touchMask);
    const p2Input = this.mode === 'hotseat' ? this.keyMaskP2 : (this.isBotEnabled ? this.bot.update(state.p2, state.p1) : 0);

    this.sim.update(p1Input, p2Input);
    this.presentTick(this.sim.getEvents());
  }

  private presentTick(events: SimulationEvent[]): void {
    const state = this.sim.getState();

    // Effects read the same combat tick as the sprites, including hitstop.
    if (this.view.superCinematic.isCinematicActive()) {
      this.view.superCinematic.update(state, this.camera, this.audio);
    }

    // 2. Check if either fighter initiated their Special or Ultimate move
    if (state.p1.state !== 'attack') {
      this.p1CinematicPlayed = false;
    }
    if (state.p2.state !== 'attack') {
      this.p2CinematicPlayed = false;
    }

    if (
      state.p1.state === 'attack' &&
      state.p1.currentMove &&
      (state.p1.currentMove.id === 'special' || state.p1.currentMove.id === 'ultimate') &&
      !this.p1CinematicPlayed &&
      !this.view.superCinematic.isCinematicActive()
    ) {
      this.p1CinematicPlayed = true;
      const sprites = this.view.getFighterSprites(this.p1Entry.definition.id);
      this.view.superCinematic.startCinematic(
        state.p1,
        state.p2,
        state.p1.currentMove.id,
        state.p1.currentMove.name,
        this.p1Entry.definition.name,
        sprites.portrait,
        this.p1Entry.themeColor,
        this.audio,
      );
    } else if (
      state.p2.state === 'attack' &&
      state.p2.currentMove &&
      (state.p2.currentMove.id === 'special' || state.p2.currentMove.id === 'ultimate') &&
      !this.p2CinematicPlayed &&
      !this.view.superCinematic.isCinematicActive()
    ) {
      this.p2CinematicPlayed = true;
      const sprites = this.view.getFighterSprites(this.p2Entry.definition.id);
      this.view.superCinematic.startCinematic(
        state.p2,
        state.p1,
        state.p2.currentMove.id,
        state.p2.currentMove.name,
        this.p2Entry.definition.name,
        sprites.portrait,
        this.p2Entry.themeColor,
        this.audio,
      );
    }

    if (
      this.view.superCinematic.isCinematicActive() &&
      state.p1.currentMove?.id === 'ultimate' &&
      state.p2.currentMove?.id === 'ultimate'
    ) {
      this.p1CinematicPlayed = this.p2CinematicPlayed = true;
    }
    if (this.mode !== 'online') this.view.update();
    this.view.addEvents(events);

    for (const ev of events) {
      if (ev.type === 'swing') {
        this.audio.playSwing(ev.data?.moveId);
      } else if (ev.type === 'land') {
        this.audio.playLanding();
      } else if (ev.type === 'meter_ready') {
        this.audio.playReady();
        const fighter = ev.data?.slot === 1 ? state.p1 : state.p2;
        this.view.addComicPopup(fighter.x, fighter.y + 140, 'ULTIMATE GOTOWE!', '#fde047', '#422006');
      } else if (ev.type === 'launch') {
        const hitData = ev.data ?? {};
        if (hitData.moveId === 'ultimate') this.audio.playUltimateImpact(hitData.attackerId);
        else
          this.audio.playFunnyHit({
            ...hitData,
            isLauncher: true,
            defenderId:
              hitData.defenderId ??
              (state.p2.isAirJuggle ? this.p2Entry.definition.id : this.p1Entry.definition.id),
          });
        this.camera.shake(12, 0.28);
      } else if (ev.type === 'hit') {
        const hitData = ev.data ?? {};
        const isHeavy = hitData.damage > 75;
        if (hitData.moveId === 'ultimate') this.audio.playUltimateImpact(hitData.attackerId);
        else
          this.audio.playFunnyHit({
            ...hitData,
            isHeavy,
            defenderId: hitData.defenderId,
          });
        if (isHeavy) this.camera.shake(10, 0.22);
      } else if (ev.type === 'block') {
        this.audio.playBlock();
      } else if (ev.type === 'ko') {
        if (state.p1.hp <= 0 && state.p2.hp <= 0) {
          this.audio.playAnnouncerDraw(true);
        } else {
          this.audio.playAnnouncerKO();
          const winnerHp = state.winner === 1 ? state.p1.hp : state.p2.hp;
          if (winnerHp >= 1000) {
            setTimeout(() => this.audio.playAnnouncerPerfect(), 1250);
          }
        }
        this.camera.shake(16, 0.4);
      } else if (ev.type === 'round_end') {
        if (ev.data?.timeout) {
          this.audio.playAnnouncerTimeOver();
        }
      } else if (ev.type === 'round_start') {
        this.view.reset();
        const isFinal = state.p1Wins === 1 && state.p2Wins === 1;
        this.audio.playAnnouncerRound(state.roundNumber, isFinal);
        setTimeout(() => {
          this.audio.playAnnouncerFight();
        }, 1100);
      } else if (ev.type === 'meter_empty') {
        this.audio.playEmptyMeterBuzz();
        const fId = ev.data?.fighterId;
        const fighter = fId === state.p1.id ? state.p1 : state.p2;
        this.view.addComicPopup(fighter.x, fighter.y + 115, 'ZA MAŁO ENERGII!', '#f59e0b', '#78350f');
      }
    }

    if (state.roundState === 'matchOver' && (state.stateTicks === 120 || this.mode === 'online')) {
      const rematchModal = document.getElementById('rematch-modal');
      const rematchText = document.getElementById('rematch-text');
      if (rematchText) {
        const winnerName = state.winner === 1 ? this.p1Entry.definition.name : this.p2Entry.definition.name;
        const isPlayerWinner = state.winner === (this.mode === 'online' ? this.online.seat + 1 : 1);
        if (state.winner !== 'draw') {
          this.audio.playAnnouncerWin(winnerName, isPlayerWinner);
          if (!isPlayerWinner) {
            setTimeout(() => this.audio.playAnnouncerGameOver(), 2100);
          }
        } else {
          this.audio.playAnnouncerDraw(false);
        }
        rematchText.textContent =
          isPlayerWinner
            ? `Zwycięstwo! ${winnerName} wygrywa pojedynek!`
            : state.winner !== 'draw'
              ? `Porażka! ${winnerName} dominuje pole!`
              : 'Remis!';
      }
      rematchModal?.removeAttribute('hidden');
    }
  }

  private render(dt: number): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const current = this.sim.getState();
    const alpha = this.step > 0 ? Math.max(0, Math.min(1, this.accumulator / this.step)) : 1;
    const state =
      this.mode === 'online'
        ? interpolateMatch(this.previousOnlineState, current, (performance.now() - this.onlineFrameAt) / 50)
        : interpolateMatch(this.previousLocalState, current, alpha);

    this.camera.cinematic = (state.superFreezeTicks ?? 0) > 0;
    this.camera.update(state.p1.x, state.p2.x, dt, width, height);

    // Render 2D Fighting Stage & Characters with individual theme colors
    this.view.render(
      this.ctx,
      width,
      height,
      state,
      this.p1Entry.definition,
      this.p2Entry.definition,
      this.camera,
      this.p1Entry.themeColor,
      this.p1Entry.glowColor,
      this.p2Entry.themeColor,
      this.p2Entry.glowColor,
    );

    // Render HUD with loaded portraits
    const p1Img = this.portraitImages.get(this.p1Key);
    const p2Img = this.portraitImages.get(this.p2Key);
    this.hud.draw(
      this.ctx,
      width,
      height,
      state,
      this.p1Entry.definition.name,
      this.p2Entry.definition.name,
      p1Img,
      p2Img,
    );
  }
}

new FighterDemo();
