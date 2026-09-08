# Ułatwienia dostępu (Accessibility)

Dokumentacja systemu dostępności, redukcji ruchu, ochrony przed błyskami i nawigacji klawiaturą w grze _Kurwa, moje pole!_.

---

## 1. Zakres i cel wdrożenia (Issue #26)

Projekt vertical slice 3D zawiera intensywne efekty post-processingu i zniekształceń kamery symulujące substancje psychoaktywne. Zgodnie z wytycznymi dostępności (WCAG 2.2 / Game Accessibility Guidelines):

- Gracze z chorobą lokomocyjną lub epilepsją fotogenną muszą mieć możliwość bezpiecznego korzystania z gry bez narażenia na nudności, zawroty głowy czy ataki wywołane stroboskopem.
- Sterowanie i wszystkie okna modalne muszą być w pełni obsługiwane z klawiatury bez konieczności używania myszy.
- Preferencje systemowe (`prefers-reduced-motion`) muszą być respektowane automatycznie przy pierwszym uruchomieniu.

---

## 2. Dostępne ustawienia wizualne

Wszystkie opcje dostępne są w menu pauzy (`Esc` w trakcie gry) oraz synchronizowane w `localStorage` pod kluczem `camp-visual-settings`:

| Opcja w UI                        | Identyfikator                 | Zakres wartości                     | Wpływ na renderowanie i ruch                                                                                                                                     |
| :-------------------------------- | :---------------------------- | :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intensywność efektów**          | `#setting-intensity`          | `0%` – `100%`                       | Liniowy mnożnik `visualIntensity` wpływający na wszystkie shadery, saturację, FOV i audio.                                                                       |
| **Ogranicz ruch obrazu**          | `#setting-reduce-motion`      | `checkbox`                          | Wyłącza zniekształcenia `warp`, spływanie `melt`, mieszanie barw `mixing`, poświatę `afterimage`, kołysanie głowy `bob`, a także animacje obrotu w nakładce LSD. |
| **Ogranicz kołysanie**            | `#setting-limit-sway`         | `checkbox`                          | Zeruje przechyły kamery na boki (`sway: 0`) podczas działania efektów.                                                                                           |
| **Wyłącz drżenie**                | `#setting-disable-shake`      | `checkbox`                          | Zeruje gwałtowne drżenia kamery (`shake: 0`) np. przy efekcie stymulantów (Kreska).                                                                              |
| **Wyłącz bloom**                  | `#setting-disable-bloom`      | `checkbox`                          | Całkowicie wyłącza pass `UnrealBloomPass`, eliminując oślepiające poświaty.                                                                                      |
| **Wyłącz błyski**                 | `#setting-disable-flashes`    | `checkbox`                          | Zeruje oscylacje jasności i stroboskopowe impulsy (`pulse: 0`) w shaderze i bloomi-e.                                                                            |
| **Wyłącz aberrację chromatyczną** | `#setting-disable-aberration` | `checkbox`                          | Zeruje rozszczepienie kanałów RGB (`chroma: 0`), zapobiegając rozmyciu krawędzi i zmęczeniu wzroku.                                                              |
| **Jakość trawy**                  | `#setting-grass-quality`      | `low` / `medium` / `high` / `ultra` | Skalowanie geometrii instancjonowanej dla wydajności na słabszym sprzęcie.                                                                                       |

---

## 3. Respektowanie preferencji systemowych (`prefers-reduced-motion`)

Funkcja `detectSystemReducedMotion()` w `src/game/Game.ts`:

- Przy pierwszym wejściu gracza (brak zapisanego klucza w `localStorage`), gra odpytuje `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- Jeśli system operacyjny gracza ma włączoną redukcję ruchu:
  - `reduceMotion: true`
  - `limitSway: true`
  - `disableShake: true`
  - `disableFlashes: true`
  - `disableAberration: true`
- Jeśli gracz samodzielnie zmodyfikuje ustawienia w menu pauzy, jego ręczny wybór ma pierwszeństwo i zostaje trwale zapisany w `localStorage`.
- Zmiana ustawienia systemowego w trakcie gry jest dynamicznie wykrywana przez zdarzenie `change` na obiekcie `MediaQueryList` (o ile gracz nie zapisał jeszcze własnego profilu).

---

## 4. Ostrzeżenie przed pierwszym intensywnym efektem

Przed uruchomieniem mocnych efektów (`Grzyb`, `MDMA`, `LSD`, `Kreska`):

1. Gra sprawdza obecność flagi `camp-effect-warning` w `localStorage`.
2. Przy pierwszym użyciu wyświetla semantyczne okno modalne:
   `<section id="effect-warning" role="dialog" aria-modal="true" aria-labelledby="effect-warning-title">`
3. Gracz ma do wyboru:
   - **KONTYNUUJ** (`#warning-proceed`): Uruchamia sekwencję z aktualnymi ustawieniami.
   - **WŁĄCZ TRYB ŁAGODNY** (`#warning-safe-mode`): Włącza redukcję ruchu, wyłącza drżenie, bloom, błyski i aberrację oraz ogranicza intensywność do maksymalnie 50%.
   - **ANULUJ** (`#warning-cancel` / `Esc`): Bezpiecznie wraca do gry bez zużycia przedmiotu i bez blokowania rozgrywki.
   - Checkbox **Zapamiętaj wybór**: Po zaznaczeniu (`camp-effect-warning = '1'`) kolejne użycia intensywnych przedmiotów nie będą ponownie przerywane modalem.

---

## 5. Dostępność klawiatury i czytników ekranu

- **Hierarchia klawiszy**:
  - `Esc`: Zamyka dowolny modal w kolejności priorytetu (`effect-warning` -> `playing`, `inspecting` -> `playing`, `inventory` -> `playing`, `paused` -> `playing`).
  - `Tab`: Otwiera i zamyka ekwipunek; wewnątrz modali przenosi logiczny fokus po aktywnych kontrolkach.
  - `Enter` / `Spacja`: Aktywuje przyciski akcji.
- **Atrybuty ARIA**:
  - Wszystkie okna dialogowe mają atrybuty `role="dialog"`, `aria-modal="true"`, `aria-labelledby` oraz `aria-describedby`.
  - Pola formularzy posiadają powiązane etykiety `<label>` oraz wyraźne ramki `:focus-visible` zgodne z kontrastem WCAG AAA.
