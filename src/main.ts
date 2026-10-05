import './style.css';
import './ui-additions.css';
import './preview.css';
import './lifecycle.css';
import { Game } from './game/Game';
import { CharacterPreview } from './game/ui/CharacterPreview';
import { FestivalMap } from './game/ui/FestivalMap';
import type { EffectId } from './game/effects/EffectManager';
import { AppState, AppStateMachine } from './game/lifecycle/AppStateMachine';
import { controlHintForState, inputBindings, startControlHint } from './game/lifecycle/InputBindings';
import { isMobileInputDevice } from './game/player/MobileControls';
import { isGrassQualityPreset } from './game/world/grassQuality';
import { NetworkClient } from './game/network/NetworkClient';
import {
  CANONICAL_CHARACTERS,
  type CharacterName,
  validateAndSanitizeNickname,
} from './game/network/networkProtocol';

/** Zwraca wymagany element interfejsu i zachowuje jego typ TypeScript. */
const qs = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const names: readonly CharacterName[] = CANONICAL_CHARACTERS;
const state = new AppStateMachine();
let game: Game | undefined;
let preview: CharacterPreview | undefined;
const savedSessionChar =
  typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('camp-player-character') as CharacterName | null)
    : null;
let selected: CharacterName =
  savedSessionChar && names.includes(savedSessionChar) ? savedSessionChar : names[0];

const networkClient = new NetworkClient({ autoConnect: true });

// UI Pseudonimu gracza:
const nicknameInput = qs<HTMLInputElement>('#player-nickname');
const nicknameCount = qs<HTMLSpanElement>('#nickname-count');
const nicknameError = qs<HTMLSpanElement>('#nickname-error');
const networkBadge = qs<HTMLDivElement>('#network-status-badge');
const networkStatusText = qs<HTMLSpanElement>('#network-status-text');

if (nicknameInput) {
  nicknameInput.value = networkClient.getNickname();
  if (nicknameCount) nicknameCount.textContent = `${nicknameInput.value.length}/18`;

  nicknameInput.oninput = () => {
    const val = nicknameInput.value;
    if (nicknameCount) nicknameCount.textContent = `${val.length}/18`;
    const validation = validateAndSanitizeNickname(val);
    if (!validation.valid && val.length > 0) {
      if (nicknameError) {
        nicknameError.textContent = validation.error ?? '';
        nicknameError.hidden = false;
      }
    } else {
      if (nicknameError) nicknameError.hidden = true;
      if (validation.valid) {
        networkClient.setNickname(validation.sanitized);
        if (networkClient.isOnline()) {
          networkClient.reserveCharacter(selected, validation.sanitized);
        }
      }
    }
  };
}

let hasInitialReservation = false;

// UI Statusu sieci:
networkClient.onStatusChange((status) => {
  if (!networkBadge || !networkStatusText) return;
  networkBadge.className = `network-status-badge ${status}`;
  if (status === 'connected') {
    networkStatusText.textContent = 'Online (Pokój: główny obóz)';
  } else if (status === 'connecting') {
    networkStatusText.textContent = 'Łączenie z serwerem...';
  } else {
    hasInitialReservation = false;
    networkStatusText.textContent = 'Tryb lokalny (Offline)';
  }
});

// Tworzenie przycisków wyboru postaci:
const selection = qs('#character-select');
const characterButtons = new Map<CharacterName, HTMLButtonElement>();

names.forEach((name) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.className = name === selected ? 'selected' : '';
  button.onclick = () => {
    if (button.disabled) return;
    selected = name;
    sessionStorage.setItem('camp-player-character', selected);
    void preview?.show(name);
    selection
      .querySelectorAll('button')
      .forEach((item) => item.classList.toggle('selected', item.textContent === name));

    if (networkClient.isOnline()) {
      networkClient.reserveCharacter(name, nicknameInput?.value);
    }
  };
  characterButtons.set(name, button);
  selection.append(button);
});

// Synchronizacja stanu slotów z serwera:
networkClient.onStateChange((roomState) => {
  if (!hasInitialReservation && networkClient.isOnline()) {
    hasInitialReservation = true;
    networkClient.reserveCharacter(selected, nicknameInput?.value);
  }

  const myId = networkClient.getMyPlayerId();
  const myToken = networkClient.getSessionToken();
  for (const name of names) {
    const btn = characterButtons.get(name);
    if (!btn) continue;
    const slot = roomState.slots[name];
    if (!slot) continue;

    btn.classList.remove('occupied', 'reserving');
    const isMine = slot.playerId === myId || (slot.sessionToken && slot.sessionToken === myToken);

    if (slot.status === 'occupied' && !isMine) {
      btn.classList.add('occupied');
      btn.disabled = true;
      btn.title = `Zajęta przez: ${slot.nickname || 'innego gracza'}`;
    } else if (slot.status === 'reserving' && !isMine) {
      btn.classList.add('reserving');
      btn.disabled = true;
      btn.title = `Rezerwowana przez: ${slot.nickname || 'innego gracza'}`;
    } else {
      btn.disabled = false;
      btn.title = isMine ? 'Twoja postać' : '';
    }
  }

  // Jeśli aktualnie wybrana postać została zajęta lub zarezerwowana przez kogoś innego, automatycznie przełącz na pierwszą wolną:
  const currentSlot = roomState.slots[selected];
  const isCurrentMine =
    currentSlot &&
    (currentSlot.playerId === myId || (currentSlot.sessionToken && currentSlot.sessionToken === myToken));
  if (currentSlot && currentSlot.status !== 'free' && !isCurrentMine) {
    const freeName = names.find((name) => {
      const s = roomState.slots[name];
      return (
        s && (s.status === 'free' || s.playerId === myId || (s.sessionToken && s.sessionToken === myToken))
      );
    });
    if (freeName) {
      selected = freeName;
      sessionStorage.setItem('camp-player-character', selected);
      void preview?.show(selected);
      characterButtons.forEach((btn, name) => {
        btn.classList.toggle('selected', name === selected);
      });
      if (networkClient.isOnline()) {
        networkClient.reserveCharacter(selected, nicknameInput?.value);
      }
    }
  }
});

networkClient.onError((err) => {
  if (nicknameError && err.code !== 'UNAUTHORIZED') {
    nicknameError.textContent = err.message;
    nicknameError.hidden = false;
  }
});

/** Synchronizuje widoczność głównych ekranów HTML z aktualnym stanem aplikacji. */
function syncShell(next: AppState) {
  document.body.dataset.appState = next;
  qs('#start').hidden = next !== 'start';
  qs('#loading').hidden = next !== 'loading' && next !== 'error';
  qs('#load-actions').hidden = next !== 'error';
  if (next === 'start' || next === 'loading' || next === 'error') {
    ['#hud', '#pause', '#inventory', '#dialog', '#inspect'].forEach(
      (selector) => (qs(selector).hidden = true),
    );
  }
  if (next === 'loading') {
    qs('#load-error').hidden = true;
    qs('#load-error').textContent = '';
    qs('#load-text').textContent = 'Przygotowywanie sceny…';
    const progressBar = document.querySelector<HTMLDivElement>('#load-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    const skipBtn = document.querySelector<HTMLButtonElement>('#skip-crowd-btn');
    if (skipBtn) skipBtn.hidden = true;
  }
}

/** Tworzy przezroczysty podgląd wybranej postaci na ekranie startowym. */
function createPreview() {
  preview?.dispose();
  try {
    preview = new CharacterPreview(qs('#character-preview-layer'), (status) => {
      const message = qs('#character-preview-status');
      message.hidden = status.state !== 'error';
      message.textContent = status.message || '';
    });
    void preview.show(selected);
  } catch (error) {
    preview = undefined;
    const message = qs('#character-preview-status');
    message.hidden = false;
    message.textContent = 'Podgląd 3D jest niedostępny. Menu i wybór postaci nadal działają.';
    console.error('Nie udało się uruchomić podglądu postaci', error);
  }
}

/** Zwalnia podgląd menu, zapisuje wybór postaci i uruchamia właściwą scenę gry. */
async function startGame(freeCamera = false) {
  if (state.current !== 'start' && state.current !== 'error') return;

  if (freeCamera) {
    sessionStorage.setItem('camp-free-camera', '1');
  }

  // Walidacja pseudonimu:
  const rawNick = nicknameInput?.value?.trim() || networkClient.getNickname() || (freeCamera ? 'Kamera' : '');
  const nickVal = validateAndSanitizeNickname(rawNick);
  if (!nickVal.valid) {
    if (freeCamera) {
      networkClient.setNickname('Kamera');
    } else {
      if (nicknameError) {
        nicknameError.textContent = nickVal.error ?? 'Wpisz poprawny pseudonim.';
        nicknameError.hidden = false;
      }
      nicknameInput?.focus();
      return;
    }
  } else {
    networkClient.setNickname(nickVal.sanitized);
  }

  if (networkClient.isOnline()) {
    networkClient.confirmCharacter(selected);
  }

  game?.dispose();
  game = undefined;
  preview?.dispose();
  preview = undefined;
  sessionStorage.setItem('camp-player-character', selected);
  localStorage.setItem('camp-player-character', selected);
  state.transition('loading');
  try {
    const nextGame = new Game(state, networkClient);
    game = nextGame;
    (window as unknown as { __camp_game?: Game }).__camp_game = nextGame;
    if (!isMobileInputDevice()) nextGame.canvas.requestPointerLock().catch?.(() => undefined);
    await nextGame.start();
  } catch (cause) {
    qs('#load-error').textContent = cause instanceof Error ? cause.message : String(cause);
    qs('#load-error').hidden = false;
    state.transition('error');
  }
}

/** Uruchamia swobodną kamerę bezpośrednio z menu głównego (Ctrl+K lub przycisk). */
async function startFreeCameraGame() {
  if (state.current !== 'start' && state.current !== 'error') return;
  await startGame(true);
}

/** Zamyka bieżącą grę i odtwarza ekran startowy wraz z podglądem postaci. */
function backToStart() {
  game?.dispose();
  game = undefined;
  if (state.current !== 'start') state.transition('start');
  createPreview();
}

state.subscribe(({ to }) => syncShell(to));
syncShell(state.current);
qs('#start-controls').textContent = startControlHint(isMobileInputDevice() ? 'mobile' : 'desktop');
qs('#inventory-help').textContent = controlHintForState('inventory');
qs('#pause-help').textContent = controlHintForState('paused');
qs('#dialog-help').textContent = controlHintForState('dialog');
qs('#inspect-use').textContent = `${inputBindings.interact} — uruchom efekt`;
qs('#inspect-close').textContent = `${inputBindings.escape} — wróć`;
createPreview();

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'k') {
    if (state.current === 'start' || state.current === 'error') {
      event.preventDefault();
      event.stopImmediatePropagation();
      void startFreeCameraGame();
    }
  }
});

qs<HTMLButtonElement>('#play').onclick = () => void startGame();
const playFreecamBtn = document.querySelector<HTMLButtonElement>('#play-freecam');
if (playFreecamBtn) {
  playFreecamBtn.onclick = () => void startFreeCameraGame();
}
qs<HTMLButtonElement>('#retry-load').onclick = () => void startGame();
qs<HTMLButtonElement>('#back-to-start').onclick = backToStart;
qs<HTMLButtonElement>('#resume').onclick = () => game?.setPause(false);
qs<HTMLButtonElement>('#perform-motion').onclick = () =>
  game?.performMotion(qs<HTMLSelectElement>('#player-motion').value);
qs<HTMLButtonElement>('#exit-to-start').onclick = backToStart;
qs<HTMLButtonElement>('#close-dialog').onclick = () => game?.closeDialog();
qs<HTMLButtonElement>('#inspect-close').onclick = () => game?.closeInspect();
qs<HTMLButtonElement>('#inspect-dismiss').onclick = () => game?.closeInspect();
qs<HTMLButtonElement>('#inspect-use').onclick = () => game?.acceptInspect();
qs<HTMLButtonElement>('#inspect-take').onclick = () => game?.takeInspectedItem();
qs<HTMLButtonElement>('#cancel-effect').onclick = () => game?.cancelEffect();
qs<HTMLButtonElement>('#cancel-use-sequence').onclick = () => game?.cancelUseSequence();
qs<HTMLButtonElement>('#warning-proceed').onclick = () => game?.confirmWarning(false);
qs<HTMLButtonElement>('#warning-safe-mode').onclick = () => game?.confirmWarning(true);
qs<HTMLButtonElement>('#warning-cancel').onclick = () => game?.cancelWarning();
document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((button) => {
  button.onclick = () => game?.useInventoryEffect(button.dataset.effect as EffectId);
});
const inventoryContainer = document.querySelector('#inventory .items');
if (inventoryContainer) {
  inventoryContainer.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('[data-effect]');
    if (button && button.dataset.effect) {
      game?.useInventoryEffect(button.dataset.effect as EffectId);
    }
  });
}
const inventoryCloseBtn = document.querySelector<HTMLButtonElement>('#inventory-close');
if (inventoryCloseBtn) {
  inventoryCloseBtn.onclick = () => game?.toggleInventory();
}

qs<HTMLInputElement>('#setting-intensity').oninput = (event) => {
  game?.updateSettings({ intensity: Number((event.target as HTMLInputElement).value) / 100 });
};

qs<HTMLInputElement>('#setting-speaker-volume').oninput = (event) => {
  game?.updateAudioSettings({ speakerVolume: Number((event.target as HTMLInputElement).value) / 100 });
};

qs<HTMLInputElement>('#setting-ambient-volume').oninput = (event) => {
  game?.updateAudioSettings({ ambientVolume: Number((event.target as HTMLInputElement).value) / 100 });
};

const grassQualitySelect = document.querySelector<HTMLSelectElement>('#setting-grass-quality');
if (grassQualitySelect) {
  grassQualitySelect.onchange = (event) => {
    const val = (event.target as HTMLSelectElement).value;
    if (isGrassQualityPreset(val)) {
      game?.updateSettings({ grassQuality: val });
    }
  };
}

const matrixModeSelect = document.querySelector<HTMLSelectElement>('#setting-matrix-mode');
if (matrixModeSelect) {
  matrixModeSelect.onchange = (event) => {
    const val = (event.target as HTMLSelectElement).value;
    if (val === 'auto' || val === 'always' || val === 'off') {
      game?.updateSettings({ matrixMode: val });
    }
  };
}

const matrixQualitySelect = document.querySelector<HTMLSelectElement>('#setting-matrix-quality');
if (matrixQualitySelect) {
  matrixQualitySelect.onchange = (event) => {
    const val = (event.target as HTMLSelectElement).value;
    if (val === 'low' || val === 'medium' || val === 'high') {
      game?.updateSettings({ matrixQuality: val });
    }
  };
}

(
  [
    'reduce-motion',
    'limit-sway',
    'disable-shake',
    'disable-bloom',
    'disable-flashes',
    'disable-aberration',
  ] as const
).forEach((name) => {
  qs<HTMLInputElement>(`#setting-${name}`).onchange = (event) => {
    const key = name.replace(/-([a-z])/g, (_, character) => character.toUpperCase()) as
      'reduceMotion' | 'limitSway' | 'disableShake' | 'disableBloom' | 'disableFlashes' | 'disableAberration';
    game?.updateSettings({ [key]: (event.target as HTMLInputElement).checked });
  };
});

window.addEventListener(
  'pagehide',
  () => {
    preview?.dispose();
    game?.dispose();
    networkClient.disconnect(true);
  },
  { once: true },
);

// Przewodnik festiwalowy i Mapa
const GUIDE_TABS = [
  'controls',
  'activities',
  'interactions',
  'items',
  'dialogue',
  'bingo',
  'passport',
] as const;

function switchGuideTabGlobal(tabId: string): void {
  const currentIndex = GUIDE_TABS.indexOf(tabId as any);
  const validIndex = currentIndex >= 0 ? currentIndex : 0;
  const activeTab = GUIDE_TABS[validIndex];

  document.querySelectorAll<HTMLButtonElement>('.guide-tab-btn').forEach((btn) => {
    const match = btn.dataset.tab === activeTab;
    btn.classList.toggle('active', match);
    btn.setAttribute('aria-selected', String(match));
  });

  document.querySelectorAll<HTMLElement>('.guide-panel').forEach((panel) => {
    const match = panel.id === `guide-panel-${activeTab}`;
    panel.hidden = !match;
    panel.classList.toggle('active', match);
  });

  const stepIndicator = document.querySelector<HTMLElement>('#guide-step-indicator');
  if (stepIndicator) {
    stepIndicator.textContent = `Krok ${validIndex + 1} z ${GUIDE_TABS.length}`;
  }

  const prevBtn = document.querySelector<HTMLButtonElement>('#guide-prev-btn');
  if (prevBtn) {
    prevBtn.disabled = validIndex === 0;
  }

  const nextBtn = document.querySelector<HTMLButtonElement>('#guide-next-btn');
  if (nextBtn) {
    nextBtn.textContent = validIndex === GUIDE_TABS.length - 1 ? 'Gotowe ✓' : 'Dalej →';
  }
}

function toggleGuideGlobal(open?: boolean): void {
  if (game) {
    game.toggleGuide(open);
  } else {
    const guideEl = document.querySelector<HTMLElement>('#festival-guide');
    if (!guideEl) return;
    const shouldOpen = open !== undefined ? open : guideEl.hidden;
    guideEl.hidden = !shouldOpen;
    if (shouldOpen) {
      switchGuideTabGlobal('controls');
    }
  }
}

// Inicjalizacja zakładek i nawigacji przewodnika na poziomie dokumentu
document.querySelectorAll<HTMLButtonElement>('.guide-tab-btn').forEach((btn) => {
  btn.onclick = () => {
    const tab = btn.dataset.tab;
    if (tab) switchGuideTabGlobal(tab);
  };
});

const guidePrevBtn = document.querySelector<HTMLButtonElement>('#guide-prev-btn');
if (guidePrevBtn) {
  guidePrevBtn.onclick = () => {
    const activeBtn = document.querySelector<HTMLButtonElement>('.guide-tab-btn.active');
    const currentTab = activeBtn?.dataset.tab;
    const currentIndex = GUIDE_TABS.indexOf(currentTab as any);
    if (currentIndex > 0) {
      switchGuideTabGlobal(GUIDE_TABS[currentIndex - 1]);
    }
  };
}

const guideNextBtn = document.querySelector<HTMLButtonElement>('#guide-next-btn');
if (guideNextBtn) {
  guideNextBtn.onclick = () => {
    const activeBtn = document.querySelector<HTMLButtonElement>('.guide-tab-btn.active');
    const currentTab = activeBtn?.dataset.tab;
    const currentIndex = GUIDE_TABS.indexOf(currentTab as any);
    if (currentIndex >= 0 && currentIndex < GUIDE_TABS.length - 1) {
      switchGuideTabGlobal(GUIDE_TABS[currentIndex + 1]);
    } else {
      toggleGuideGlobal(false);
    }
  };
}

let globalFestivalMap: FestivalMap | undefined;

function toggleMapGlobal(open?: boolean): void {
  if (game) {
    game.toggleMap(open);
  } else {
    const mapEl = document.querySelector<HTMLElement>('#festival-map');
    if (!mapEl) return;
    const shouldOpen = open !== undefined ? open : mapEl.hidden;
    mapEl.hidden = !shouldOpen;
    if (shouldOpen) {
      if (!globalFestivalMap) {
        const mapCanvas = document.querySelector<HTMLCanvasElement>('#festival-map-canvas');
        globalFestivalMap = new FestivalMap(mapCanvas);
        void globalFestivalMap
          .loadBlenderReference()
          .catch(() => console.warn('Nie udało się załadować rzutu mapy z Blendera.'));
      }
      globalFestivalMap.render({ x: 0, z: 0, yaw: 0 }, [], performance.now(), []);
    }
  }
}

const startGuideBtn = document.querySelector<HTMLButtonElement>('#start-guide-btn');
if (startGuideBtn) {
  startGuideBtn.onclick = () => toggleGuideGlobal(true);
}
const startMapBtn = document.querySelector<HTMLButtonElement>('#start-map-btn');
if (startMapBtn) {
  startMapBtn.onclick = () => toggleMapGlobal(true);
}
const guideCloseBtn = document.querySelector<HTMLButtonElement>('#guide-close');
if (guideCloseBtn) {
  guideCloseBtn.onclick = () => toggleGuideGlobal(false);
}
const guideOkBtn = document.querySelector<HTMLButtonElement>('#guide-ok-btn');
if (guideOkBtn) {
  guideOkBtn.onclick = () => toggleGuideGlobal(false);
}
const mapCloseBtn = document.querySelector<HTMLButtonElement>('#map-close');
if (mapCloseBtn) {
  mapCloseBtn.onclick = () => toggleMapGlobal(false);
}
const openGuideBtn = document.querySelector<HTMLButtonElement>('#open-guide-btn');
if (openGuideBtn) {
  openGuideBtn.onclick = () => toggleGuideGlobal(true);
}

// Globalny nasłuch klawiszy Escape / H / M na ekranie startowym oraz w UI
window.addEventListener('keydown', (event) => {
  const guideEl = document.querySelector<HTMLElement>('#festival-guide');
  const isGuideOpen = guideEl ? !guideEl.hidden : false;
  const mapEl = document.querySelector<HTMLElement>('#festival-map');
  const isMapOpen = mapEl ? !mapEl.hidden : false;
  const isInputFocused =
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement;

  if (event.key === 'Escape') {
    if (isGuideOpen) {
      toggleGuideGlobal(false);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (isMapOpen) {
      toggleMapGlobal(false);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  if ((event.key === 'h' || event.key === 'H' || event.key === 'F1') && !isInputFocused) {
    if (!game) {
      toggleGuideGlobal();
      event.preventDefault();
    }
  }

  if ((event.key === 'm' || event.key === 'M') && !isInputFocused) {
    if (!game) {
      toggleMapGlobal();
      event.preventDefault();
    }
  }
});

const openMapBtn = document.querySelector<HTMLButtonElement>('#open-map-btn');
if (openMapBtn) {
  openMapBtn.onclick = () => toggleMapGlobal(true);
}
const openInventoryBtn = document.querySelector<HTMLButtonElement>('#open-inventory-btn');
if (openInventoryBtn) {
  openInventoryBtn.onclick = () => game?.toggleInventory();
}
const hudGuideBtn = document.querySelector<HTMLButtonElement>('#hud-guide-btn');
if (hudGuideBtn) {
  hudGuideBtn.onclick = () => game?.toggleGuide();
}
const hudMapBtn = document.querySelector<HTMLButtonElement>('#hud-map-btn');
if (hudMapBtn) {
  hudMapBtn.onclick = () => toggleMapGlobal();
}
const hudInventoryBtn = document.querySelector<HTMLButtonElement>('#hud-inventory-btn');
if (hudInventoryBtn) {
  hudInventoryBtn.onclick = () => game?.toggleInventory();
}
const hudMenuBtn = document.querySelector<HTMLButtonElement>('#hud-menu-btn');
if (hudMenuBtn) {
  hudMenuBtn.onclick = () => game?.setPause(true);
}
const mobileGuideBtn = document.querySelector<HTMLButtonElement>('#mobile-guide');
if (mobileGuideBtn) {
  mobileGuideBtn.onclick = () => game?.toggleGuide();
}
const mobileMapBtn = document.querySelector<HTMLButtonElement>('#mobile-map');
if (mobileMapBtn) {
  mobileMapBtn.onclick = () => toggleMapGlobal();
}

// Przyciski powiększania mapy (+, -, 100%, Ty)
const mapZoomInBtn = document.querySelector<HTMLButtonElement>('#map-zoom-in');
if (mapZoomInBtn) {
  mapZoomInBtn.onclick = (e) => {
    e.stopPropagation();
    if (game?.festivalMap) game.festivalMap.zoomIn();
    else globalFestivalMap?.zoomIn();
  };
}
const mapZoomOutBtn = document.querySelector<HTMLButtonElement>('#map-zoom-out');
if (mapZoomOutBtn) {
  mapZoomOutBtn.onclick = (e) => {
    e.stopPropagation();
    if (game?.festivalMap) game.festivalMap.zoomOut();
    else globalFestivalMap?.zoomOut();
  };
}
const mapZoomResetBtn = document.querySelector<HTMLButtonElement>('#map-zoom-reset');
if (mapZoomResetBtn) {
  mapZoomResetBtn.onclick = (e) => {
    e.stopPropagation();
    if (game?.festivalMap) game.festivalMap.resetView();
    else globalFestivalMap?.resetView();
  };
}
const mapCenterMeBtn = document.querySelector<HTMLButtonElement>('#map-center-me');
if (mapCenterMeBtn) {
  mapCenterMeBtn.onclick = (e) => {
    e.stopPropagation();
    if (game && game.player && game.festivalMap) {
      game.festivalMap.centerOnPlayer(game.player.camera.position.x, game.player.camera.position.z);
    } else {
      globalFestivalMap?.centerOnPlayer(0, 0);
    }
  };
}

// Zamykanie mapy po kliknięciu w tło modala oraz blokowanie kliknięć w głąb
const festivalMapModal = document.querySelector<HTMLElement>('#festival-map');
if (festivalMapModal) {
  festivalMapModal.onclick = (e) => {
    if (e.target === festivalMapModal) {
      toggleMapGlobal(false);
    }
  };
}
const festivalMapContainer = document.querySelector<HTMLElement>('.festival-map-container');
if (festivalMapContainer) {
  festivalMapContainer.onclick = (e) => e.stopPropagation();
}
