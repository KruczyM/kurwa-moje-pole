import type { FighterDefinition } from '../simulation/CombatTypes';
import { combatMove } from '../simulation/combatTiming';

/** One guide shared by character selection and pause; never promises unimplemented moves. */
export function renderFighterHelp(host: HTMLElement, def: FighterDefinition): void {
  host.innerHTML = `
    <h3>Jak grać?</h3>
    <p><strong>Ruch:</strong> WASD lub strzałki. W / ↑: skok; S / ↓: kucanie.</p>
    <p><strong>Ciosy:</strong> U: prosty, I: sierpowy, J: lekkie kopnięcie, K: mocne kopnięcie.
    Alternatywnie numpad: 4 / 5 / 1 / 2. Na telefonie: LP / RP / LK / RK.</p>
    <p><strong>Garda:</strong> trzymaj L, spację lub BLK. Cofanie także blokuje.
    Na niski cios: dół + blok. Samo kucanie nie blokuje; unika wysokich ciosów, ale nie ciosów mid.</p>
    <p><strong>Ruchy kierunkowe:</strong> dół + I: podbródkowy; dół + K: podcięcie;
    dół + U/J: niski prosty/kopnięcie. Ciosy U/I/J/K działają również w powietrzu.</p>
    <p><strong>Tempo:</strong> cios najpierw ma zamach, potem okno trafienia i powrót.
    Kolejny przycisk nie pomija powrotu. Nie trzymaj ciosu — naciśnij ponownie po jego zakończeniu.</p>
    <p><strong>Seria:</strong> po trafionym lub zablokowanym prostym naciśnij I albo K na początku powrotu.
    Pudło nie pozwala skrócić recovery. Po powaleniu cios przyspiesza wstawanie; wstawanie jest chronione.</p>
    <p><strong>Super:</strong> O / SP / numpad 6 przy 100% energii. Nadal wymaga zasięgu i może być zablokowany.
    Pasek rośnie po trafieniach i blokach. Chwyty nie są dostępne.</p>
    <p><strong>Mecz:</strong> dwie wygrane rundy, 90 sekund na rundę. Escape: pauza/powrót.
    Wybierz tryb z botem, trening albo online ze znajomym. Online każdy wybiera swoją postać i potwierdza gotowość.
    Escape otwiera menu, ale walka online trwa dalej. Wyjście do wyboru postaci opuszcza pokój.
    W treningu przeciwnik jest nieruchomy.</p>
    <h4>Czas zamachu / powrotu — wybrana postać</h4>
    <div class="move-timing-list"></div>`;
  const list = host.querySelector('.move-timing-list')!;
  for (const id of ['light_punch', 'heavy_punch', 'light_kick', 'heavy_kick', 'uppercut', 'sweep']) {
    const source = def.moves[id];
    if (!source) continue;
    const move = combatMove(source);
    const line = document.createElement('p');
    line.textContent = `${move.name}: ${Math.round((move.startup / 60) * 1000)} ms zamachu + ${Math.round((move.recovery / 60) * 1000)} ms powrotu (bez czasu trafienia i hitstop).`;
    list.append(line);
  }
}
