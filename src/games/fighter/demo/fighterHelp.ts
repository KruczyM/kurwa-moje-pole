import type { FighterDefinition } from '../simulation/CombatTypes';

/** One guide shared by character selection and pause; never promises unimplemented moves. */
export function renderFighterHelp(host: HTMLElement, def: FighterDefinition): void {
  host.innerHTML = `
    <h3>Opanuj swoje combo</h3>
    <p><strong>Ruch:</strong> WASD lub strzałki. W / ↑: skok; S / ↓: kucanie.</p>
    <p><strong>Ciosy:</strong> U / LP: prosty · I / RP: sierpowy · J / LK: lekkie kopnięcie · K / RK: mocne kopnięcie. Alternatywnie numpad: 4 / 5 / 1 / 2.</p>
    <p><strong>Podbródkowy:</strong> H / ↑RP lub dół + I — wybicie w powietrze. <strong>Podcięcie:</strong> N / ↓RK lub dół + K — powalenie.</p>
    <p><strong>Niskie i powietrzne:</strong> dół + U/J: niski prosty/kopnięcie. U/I/J/K w skoku: atak w powietrzu.</p>
    <p><strong>Garda:</strong> trzymaj L, spację lub BLK. Cofanie także blokuje. Na niski cios: dół + blok. Samo kucanie nie blokuje.</p>
    <p><strong>Seria:</strong> po trafionym lub zablokowanym prostym naciśnij I albo K. Po powaleniu cios przyspiesza wstawanie.</p>
    <p><strong>Special:</strong> P / SP — 30% energii. <strong>Ultimate:</strong> O / ULT / numpad 6 — 100%. Pasek rośnie po trafieniach i blokach. Ultimate dosięga całej areny i może być zablokowany.</p>
    <p><strong>Mecz:</strong> dwie wygrane rundy, 90 sekund na rundę. Escape: menu. W treningu przeciwnik jest nieruchomy i nieśmiertelny, ultimate ma pełną energię, a czas nie kończy pojedynku.</p>
    <p><strong>Online:</strong> wybierasz swoją postać i potwierdzasz gotowość. Po otwarciu menu walka online trwa dalej. Powrót do wyboru postaci opuszcza pokój.</p>`;
  const signature = document.createElement('p');
  signature.className = 'fighter-signature';
  signature.textContent = `${def.name} · Special: ${def.moves.special?.name ?? 'Cios specjalny'} · Ultimate: ${def.moves.ultimate?.name ?? 'Super cios'}`;
  host.append(signature);
}
