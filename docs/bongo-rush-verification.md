# Bongo Rush — raport lokalny

To raport początkowego wdrożenia. Najnowszy audyt biomów, zagadek i wyniki testów:
[bongo-design-audit.md](bongo-design-audit.md).
Wcześniejsza rozbudowa plansz i wyniki testów:
[bongo-expanded-verification.md](bongo-expanded-verification.md).
Aktualizacja Krzaka/Kobry, obecna lista 15
grywalnych postaci oraz nowsze wyniki: [bongo-bush-verification.md](bongo-bush-verification.md).

Data: 2026-10-11. Gałąź: `feat/bongo-rush`. Osobny worktree: `.ai/worktrees/bongo-rush`.

## Wynik

- `npm run ci:code`: PASS — kodowanie, formatowanie, lint, TypeScript, 6 testów narzędziowych
  oraz 1508 testów jednostkowych w 164 plikach.
- 34 nowe testy Bongo Rush: PASS. Obejmują pełne nagrania przejścia wszystkich 12 poziomów,
  fizykę, patrole, finał, sterowanie, zapis i wspólne kadrowanie sprite’ów.
- Dodatkowy test natychmiastowego ustawiania współdzielonej kamery: PASS.
- `npm run build`: PASS. Wygenerowane trzy wejścia: festiwal, After i Bongo Rush.
  Pozostaje istniejące ostrzeżenie Vite o dużym bundlu festiwalu 3D; Bongo nie pobiera tego bundla.

## Przeglądarka

`python scripts/verify-bongo-rush.py`:

- Chromium desktop: wszystkie 12 poziomów ukończone przez rzeczywiste wejście klawiatury,
  bez teleportacji i bez zmieniania pozycji w snapshotach.
- WebKit, profil iPhone 13: wybór 16 atlasów, wejście do gry, klawiatura, gałka,
  pauza/wznowienie, restart i ukończenie poziomu 1: PASS.
- Chromium, profil iPhone 13: analogiczne testy i dodatkowo natywny dotyk przez CDP: PASS.
- Zapis odblokowanych poziomów zachowany po przeładowaniu. Po kampanii dostępne wszystkie poziomy.
- Brak błędów JavaScript/HTTP oraz żądań GLB i Socket.IO.

`python scripts/verify-bongo-production.py`:

- Chromium desktop oraz WebKit/iPhone: skompilowana strona pod prefiksem Pages działa poprawnie.
- `?verify=1` nie udostępnia API diagnostycznego w produkcji.
- Obraz pauzy identyczny pomiędzy screenshotami, podczas gdy RAF nadal wykonuje klatki.
- Po wznowieniu fokus wraca na canvas, a klawiatura działa bez dodatkowego kliknięcia.
- Gałka, restart dotykowy i powrót z menu działają.
- Po obrocie do poziomu backing store canvasa dopasowuje proporcje do kontenera;
  nie ma poziomego przewijania strony. Plansza jest oddzielona od obszaru gałki i HUD.

`python scripts/verify-after-production.py <lokalny URL>`: PASS. Zachowane wejście do After,
gałka, pauza/wznowienie, kierunki atlasów i brak ciężkich żądań.

Surowe raporty JSON i screenshoty: ignorowany katalog `reports/bongo-rush/`.
Screenshots menu, planszy, czterech biomów, finału oraz mobilnego pionu/poziomu
zostały również obejrzane wizualnie.

## Własne code review

Sprawdzono kolejność aktualizacji ciał, brak wielokrotnych spadków w jednym kroku,
oddzielenie interpolacji od kolizji, zasady ponownego uruchamiania, sanitację zapisu,
obsługę asynchronicznego ładowania, pojedynczy RAF oraz sprzątanie po HMR/nawigacji.

Poprawki znalezione podczas review: usunięcie pustych marginesów atlasów bez zmiany
źródłowych grafik, natychmiastowe ustawienie kamery po restarcie/zmianie planszy,
obszar ekranu zarezerwowany na gałkę, ponowne odblokowanie audio przy wznowieniu
i zachowanie hosta przy powrocie przez bfcache.

To jest własne review wykonawcy, nie niezależny przegląd innego autora.

## Pozostały odbiór

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: fizyczny iPhone — ergonomia gałki,
czytelność postaci, dźwięk po zablokowaniu telefonu i rzeczywiste FPS. Emulacja
nie stanowi pomiaru wydajności urządzenia.

Przyda się również ocena trudności i atrakcyjności plansz przez gracza; testy potwierdzają
ich przechodniość, nie subiektywną jakość zabawy. Atlasy postaci są istniejącymi grafikami
After; powiększenie kadru nie zwiększa ich źródłowej rozdzielczości.

Nie wykonano push, PR ani merge. Publikacja wymaga odrębnej decyzji i niezależnego review,
zgodnie z AGENTS.md. Zachowano wcześniejsze gałęzie i lokalne zmiany w głównym worktree.
