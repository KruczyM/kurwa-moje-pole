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

/** Zwraca wymagany element interfejsu i zachowuje jego typ TypeScript. */
const qs = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const names = ['Amper', 'Antena', 'Gruczoł', 'Klątwa', 'Krwiak', 'Pień', 'Pierścień', 'Zawór'];
const state = new AppStateMachine();
let game: Game | undefined;
let preview: CharacterPreview | undefined;
let selected = names[0];

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
  game?.dispose();
  game = undefined;
  preview?.dispose();
  preview = undefined;
  localStorage.setItem('camp-player-character', selected);
  state.transition('loading');
  try {
    const nextGame = new Game(state);
    game = nextGame;
    nextGame.canvas.requestPointerLock().catch?.(() => undefined);
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

const selection = qs('#character-select');
names.forEach((name) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.className = name === selected ? 'selected' : '';
  button.onclick = () => {
    selected = name;
    void preview?.show(name);
    selection
      .querySelectorAll('button')
      .forEach((item) => item.classList.toggle('selected', item.textContent === name));
  };
  selection.append(button);
});

qs<HTMLButtonElement>('#play').onclick = () => void startGame();
qs<HTMLButtonElement>('#retry-load').onclick = () => void startGame();
qs<HTMLButtonElement>('#back-to-start').onclick = backToStart;
qs<HTMLButtonElement>('#resume').onclick = () => game?.setPause(false);
qs<HTMLButtonElement>('#exit-to-start').onclick = backToStart;
qs<HTMLButtonElement>('#close-dialog').onclick = () => game?.closeDialog();
qs<HTMLButtonElement>('#inspect-close').onclick = () => game?.closeInspect();
qs<HTMLButtonElement>('#inspect-use').onclick = () => game?.acceptInspect();
qs<HTMLButtonElement>('#cancel-effect').onclick = () => game?.cancelEffect();
document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((button) => {
  button.onclick = () => game?.useEffect(button.dataset.effect as EffectId);
});

qs<HTMLInputElement>('#setting-intensity').oninput = (event) => {
  game?.updateSettings({ intensity: Number((event.target as HTMLInputElement).value) / 100 });
};

(['reduce-motion', 'limit-sway', 'disable-shake', 'disable-bloom'] as const).forEach((name) => {
  qs<HTMLInputElement>(`#setting-${name}`).onchange = (event) => {
    const key = name.replace(/-([a-z])/g, (_, character) => character.toUpperCase()) as
      'reduceMotion' | 'limitSway' | 'disableShake' | 'disableBloom';
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
