import './style.css';
import './ui-additions.css';
import './preview.css';
import { Game } from './game/Game';
import { CharacterPreview } from './game/ui/CharacterPreview';
import type { EffectId } from './game/effects/EffectManager';

let game: Game | undefined;
const names = ['Amper', 'Antena', 'Gruczoł', 'Klątwa', 'Krwiak', 'Pień', 'Pierścień', 'Zawór'];
const preview = new CharacterPreview(document.querySelector<HTMLElement>('#character-preview-layer')!);
let selected = names[0];

preview.show(selected);

const selection = document.querySelector<HTMLElement>('#character-select')!;
names.forEach((name) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.className = name === selected ? 'selected' : '';
  button.onclick = () => {
    selected = name;
    preview.show(name);
    selection.querySelectorAll('button').forEach((item) => {
      item.classList.toggle('selected', item.textContent === name);
    });
  };
  selection.append(button);
});

document.querySelector<HTMLButtonElement>('#play')!.onclick = () => {
  preview.dispose();
  localStorage.setItem('camp-player-character', selected);
  document.querySelector<HTMLElement>('#start')!.hidden = true;
  game = new Game();
  game.canvas.requestPointerLock();
  game.start();
};

document.querySelector<HTMLButtonElement>('#resume')!.onclick = () => game?.setPause(false);
document.querySelector<HTMLButtonElement>('#close-dialog')!.onclick = () => game?.closeDialog();
document.querySelector<HTMLButtonElement>('#inspect-close')!.onclick = () => game?.closeInspect();
document.querySelector<HTMLButtonElement>('#inspect-use')!.onclick = () => game?.acceptInspect();
document.querySelector<HTMLButtonElement>('#cancel-effect')!.onclick = () => game?.cancelEffect();
document.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((button) => {
  button.onclick = () => game?.useEffect(button.dataset.effect as EffectId);
});

document.querySelector<HTMLInputElement>('#setting-intensity')!.oninput = (event) => {
  game?.updateSettings({ intensity: Number((event.target as HTMLInputElement).value) / 100 });
};

(['reduce-motion', 'limit-sway', 'disable-shake', 'disable-bloom'] as const).forEach((name) => {
  document.querySelector<HTMLInputElement>(`#setting-${name}`)!.onchange = (event) => {
    const key = name.replace(/-([a-z])/g, (_, character) => character.toUpperCase()) as
      | 'reduceMotion'
      | 'limitSway'
      | 'disableShake'
      | 'disableBloom';
    game?.updateSettings({ [key]: (event.target as HTMLInputElement).checked });
  };
});
