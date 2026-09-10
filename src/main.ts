import './style.css';
import './ui-additions.css';
import './preview.css';
import './lifecycle.css';
import { Game } from './game/Game';
import { CharacterPreview } from './game/ui/CharacterPreview';
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
let selected: CharacterName = names[0];

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

// UI Statusu sieci:
networkClient.onStatusChange((status) => {
  if (!networkBadge || !networkStatusText) return;
  networkBadge.className = `network-status-badge ${status}`;
  if (status === 'connected') {
    networkStatusText.textContent = 'Online (Pokój: główny obóz)';
  } else if (status === 'connecting') {
    networkStatusText.textContent = 'Łączenie z serwerem...';
  } else {
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
  const myId = networkClient.getMyPlayerId();
  for (const name of names) {
    const btn = characterButtons.get(name);
    if (!btn) continue;
    const slot = roomState.slots[name];
    if (!slot) continue;

    btn.classList.remove('occupied', 'reserving');
    const isMine =
      slot.playerId === myId || (slot.sessionToken && slot.sessionToken === networkClient.getSessionToken());

    if (slot.status === 'occupied' && !isMine) {
      btn.classList.add('occupied');
      btn.disabled = true;
      btn.title = `Zajęta przez: ${slot.nickname || 'innego gracza'}`;
    } else if (slot.status === 'reserving' && !isMine) {
      btn.classList.add('reserving');
      btn.disabled = false;
      btn.title = `Rezerwowana przez: ${slot.nickname || 'innego gracza'}`;
    } else {
      btn.disabled = false;
      btn.title = isMine ? 'Twoja postać' : '';
    }
  }
});

networkClient.onError((err) => {
  if (nicknameError) {
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
async function startGame() {
  if (state.current !== 'start' && state.current !== 'error') return;

  // Walidacja pseudonimu:
  const nickVal = validateAndSanitizeNickname(nicknameInput?.value ?? networkClient.getNickname());
  if (!nickVal.valid) {
    if (nicknameError) {
      nicknameError.textContent = nickVal.error ?? 'Wpisz poprawny pseudonim.';
      nicknameError.hidden = false;
    }
    nicknameInput?.focus();
    return;
  }

  networkClient.setNickname(nickVal.sanitized);

  if (networkClient.isOnline()) {
    networkClient.confirmCharacter(selected);
  }

  game?.dispose();
  game = undefined;
  preview?.dispose();
  preview = undefined;
  localStorage.setItem('camp-player-character', selected);
  state.transition('loading');
  try {
    const nextGame = new Game(state);
    game = nextGame;
    if (!isMobileInputDevice()) nextGame.canvas.requestPointerLock().catch?.(() => undefined);
    await nextGame.start();
  } catch (cause) {
    qs('#load-error').textContent = cause instanceof Error ? cause.message : String(cause);
    qs('#load-error').hidden = false;
    state.transition('error');
  }
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

qs<HTMLButtonElement>('#play').onclick = () => void startGame();
qs<HTMLButtonElement>('#retry-load').onclick = () => void startGame();
qs<HTMLButtonElement>('#back-to-start').onclick = backToStart;
qs<HTMLButtonElement>('#resume').onclick = () => game?.setPause(false);
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
  },
  { once: true },
);
