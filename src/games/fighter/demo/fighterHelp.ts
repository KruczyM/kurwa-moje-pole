import type { FighterDefinition } from '../simulation/CombatTypes';

/** One guide shared by character selection and pause; never promises unimplemented moves. */
export function renderFighterHelp(host: HTMLElement, def: FighterDefinition): void {
  host.innerHTML = `
    <h3>Opanuj swoje combo</h3>
    <p><strong>Ruch:</strong> WASD lub strzałki. W / ↑: skok; S / ↓: kucanie.</p>
    <p><strong>Ciosy:</strong> U / LP: lewy prosty · I / PS: prawy sierpowy · J / LK: lewy kopniak · K / PZ: mocny kopniak. Alternatywnie retro: Z / X / C / V lub numpad: 4 / 5 / 1 / 2.</p>
    <p><strong>Podbródkowy:</strong> H / PB lub dół + I (PS) — wybicie w powietrze. <strong>Podcięcie:</strong> N / PC lub dół + K (PZ) — powalenie.</p>
    <p><strong>Niskie i powietrzne:</strong> dół + U/J: niski prosty/kopnięcie. U/I/J/K w skoku: atak w powietrzu.</p>
    <p><strong>Garda:</strong> trzymaj L, spację, Shift lub BLOK. Cofanie także blokuje. Na niski cios: dół + blok. Samo kucanie nie blokuje.</p>
    <p><strong>Seria:</strong> po trafionym lub zablokowanym prostym (LP) naciśnij PS (I) albo PZ (K). Po powaleniu cios przyspiesza wstawanie.</p>
    <p><strong>Ultimate:</strong> O / ULT / G / numpad 6 — 100% energii. Pasek rośnie po trafieniach i blokach. Samo uderzenie ulti nie nabija energii z powrotem. Ultimate dosięga całej areny i może być zablokowany.</p>
    <p><strong>Mecz:</strong> dwie wygrane rundy, 90 sekund na rundę. Escape: menu. W treningu przeciwnik jest nieruchomy i nieśmiertelny, ultimate ma pełną energię, a czas nie kończy pojedynku.</p>
    <p><strong>Lokalny Versus (Hotseat 2P):</strong> Gracz 1: WASD (ruch) + F (LP), G (PS), V (LK), B (PZ), T (ULT), C (BLOK). Gracz 2: Strzałki (ruch) + I / Numpad 4 (LP), O / Numpad 5 (PS), K / Numpad 1 (LK), L / Numpad 2 (PZ), [ / Numpad + (ULT), Enter / Numpad 0 (BLOK).</p>
    <p><strong>Online:</strong> wybierasz swoją postać i potwierdzasz gotowość. Po otwarciu menu walka online trwa dalej. Powrót do wyboru postaci opuszcza pokój.</p>`;
  const signature = document.createElement('p');
  signature.className = 'fighter-signature';
  signature.textContent = `${def.name} · CS: ${def.moves.special?.name ?? 'Cios specjalny'} · ULT: ${def.moves.ultimate?.name ?? 'Super cios'}`;
  host.append(signature);
}
