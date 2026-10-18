# Raport z weryfikacji: Scrollowanie menu głównego na desktopie i usunięcie przycisku „Losuj”

## 1. Zakres wprowadzonych zmian

1. **Obsługa scrollowania menu startowego na desktopie (`src/style.css`, `src/preview.css`)**:
   - Kontener `#start` otrzymał reguły `overflow-y: auto; overflow-x: hidden; height: 100%; max-height: 100%; box-sizing: border-box; justify-content: flex-start;`.
   - Zastosowano responsywny padding `clamp(32px, 5vh, 60px) clamp(32px, 6vw, 96px)` z bezpiecznym marginesem dolnym `clamp(48px, 8vh, 80px)`.
   - Elementy potomne `#start > *` otrzymały `flex-shrink: 0`, co zapobiega zniekształcaniu formularza i siatki postaci.
   - Dodano festiwalowo ostylizowany pasek przewijania (`scrollbar-width: thin; scrollbar-color: rgba(255, 215, 0, 0.4) rgba(10, 10, 16, 0.6);`).
   - Warstwa podglądu postaci 3D (`.character-preview-layer`) na desktopie otrzymała `position: fixed; inset: 0; pointer-events: none;`, dzięki czemu model 3D pozostaje stabilnie wykadrowany po prawej stronie ekranu podczas przewijania menu po lewej.

2. **Usunięcie przycisku „Losuj” i powiązanego kodu (`index.html`, `src/main.ts`, `src/ui-additions.css`)**:
   - Usunięto element `<button id="random-nickname-btn">` z formularza w `index.html`.
   - Usunięto zmienną `randomNickBtn`, tablicę `FESTIVAL_NICKNAMES` oraz listener kliknięcia z `src/main.ts`.
   - Usunięto nieużywane klasy `.btn-random-nick` i `.btn-random-nick:hover` z `src/ui-additions.css`.
   - Pole wpisywania nicku `#player-nickname` ma teraz pełną szerokość z czytelnym licznikiem znaków `0/18` po prawej stronie.

## 2. Wyniki testów automatycznych i weryfikacji runtime

- **Playwright E2E (`scripts/verify-desktop-menu-scroll.py`)**:
  - `randomNicknameBtnRemoved`: `PASS` (0 instancji w drzewie DOM).
  - `nicknameInput`: `PASS` (wpisano „CyberKrzak”, licznik znaków zaktualizowany na „10/18”).
  - `desktopScrolling (1280x720)`: `PASS` (`clientHeight: 720px`, `scrollHeight: 1030px`, `overflowY: 'auto'`).
  - `scrollInteraction`: `PASS` (`scrollTop` przewinięty do 310px, przyciski „WEJDŹ NA POLE” i salon gier 2D w pełni widoczne i klikalne).
  - `mobileCheck (390x844)`: `PASS` (brak regresji w widoku mobilnym).
- **Zestaw CI (`npm run ci:code`)**:
  - `check:encoding`: `PASS` (847 plików).
  - `format:check`: `PASS` (Prettier).
  - `lint`: `PASS` (0 błędów, 0 ostrzeżeń).
  - `typecheck`: `PASS` (`tsc --noEmit`).
  - `test:tools`: `PASS` (6 testów).
  - `test:unit`: `PASS` (209 plików testowych, 1971 testów).
- **Produkcyjny build (`npm run build`)**: Zbudowano w 12.38s bez błędów.
