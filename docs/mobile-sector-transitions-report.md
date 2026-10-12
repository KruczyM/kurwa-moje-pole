# Mobilne przejścia sektorowe

Branch: `feat/mobile-sector-transitions`.

Status rozgrywki: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
Nie przeprowadzono testu w przeglądarce ani pomiaru pamięci/FPS na telefonie.

## Zachowanie

- Na urządzeniach wykrytych przez istniejący mechanizm mobilnego sterowania mapa ładuje jeden obszar 64 × 64 m. Obszar zawiera wszystkie wyeksportowane komórki 16 × 16 m przypisane do niego przez identyfikator siatki.
- Start ładuje cały obszar startowy. Zmiana zasięgu mgły nie uruchamia ładowania sąsiadów.
- Próba przekroczenia granicy zatrzymuje gracza po poprzedniej stronie i pokazuje pytanie „Przejść dalej?”. Anulowanie pozostawia poprzedni obszar i nie rozpoczyna pobierania.
- Potwierdzenie usuwa poprzednie modele mapy, zwalnia ich geometrie, materiały, tekstury i bufory instancji, a następnie ładuje kolejno wszystkie pliki nowego obszaru. W czasie ładowania działa modal z postępem; rozgrywka i renderowanie czekają w istniejącej pętli.
- Gracz przechodzi na drugą stronę dopiero po zakończeniu ładowania. Błąd zwalnia częściowo wczytany obszar i pozwala ponowić próbę albo ponownie załadować poprzedni obszar.
- Późne odpowiedzi po zamknięciu gry są zwalniane. Nie powstaje drugi renderer, loader ani pętla renderowania.
- Desktop zachowuje poprzednie zachowanie. Mobilny tryb sektorowy pozostaje aktywny także przy dawnym parametrze `fogTrial=0`.

## Zakres i ograniczenia

Sektory obejmują statyczną scenografię z istniejącego eksportu `fog-trial`. Wspólne zasoby rozgrywki, postacie, teren, scaffold kolizji oraz modele dynamiczne znajdujące się w `base.glb` (np. koło widokowe i drzwi) pozostają rezydentne. Nie jest to usunięcie absolutnie każdego modelu spoza aktywnego obszaru. Dodatkowy tłum pozostaje wyłączony w mobilnym trybie, zgodnie z dotychczasowym rozwiązaniem.

Przypisanie używa istniejącej siatki eksportu, a nie granic budynków. Duże obiekty mogą wystawać poza obszar, do którego należą. Rozmiar obszaru jest określony przez `MOBILE_AREA_CELLS` w `FogSectorStreamer.ts`; wybór 64 m wymaga jeszcze oceny na docelowych telefonach.

## Walidacja automatyczna

- TypeScript: PASS.
- ESLint: PASS.
- Pełny zestaw jednostkowy przed ostatnim testem sprzątania: 154 pliki, 1429 testów PASS.
- Po poprawce sprzątania instancji: 16 testów loadera sektorów i zasobów PASS.
- Produkcyjny build: PASS; istnieje ostrzeżenie Vite o wielkości bundla JavaScript.
- Kodowanie UTF-8, formatowanie zmienionych plików i `git diff --check`: PASS.

Testy pokrywają granice i ujemne współrzędne, ładowanie całego obszaru, brak prefetchu, kolejność usuwania i ładowania, powroty, błąd po częściowym pobraniu, ponowienie, puste obszary, blokadę równoległego pobierania, zamknięcie w trakcie pobierania i zwalnianie buforów instancji.

## Kontrola ręczna przed wdrożeniem

1. Uruchomić grę na telefonie. Sprawdzić start, joystick, rozglądanie i HUD.
2. Przekroczyć granicę wielokrotności 64 m w osiach X i Z, również dla współrzędnych ujemnych. Wybrać „Zostań tutaj”; sprawdzić pozycję i brak żądań GLB nowego obszaru.
3. Ponowić przejście i potwierdzić. Sprawdzić postęp, blokadę ruchu, kompletność modeli i powrót sterowania po ładowaniu.
4. Wrócić do poprzedniego obszaru, powtórzyć przejścia co najmniej dziesięć razy; porównać pamięć, liczbę geometrii/tekstur renderera i FPS.
5. Zablokować jeden plik sektora w narzędziach przeglądarki. Sprawdzić ponowienie oraz powrót z ponownym wczytaniem poprzedniego obszaru.
6. Sprawdzić przejazd kołem widokowym, teleporty, mapę, pauzę i multiplayer w pobliżu granic. Zamknąć grę w trakcie pobierania i ponownie ją uruchomić.

Nie wykonano push, PR ani merge.
