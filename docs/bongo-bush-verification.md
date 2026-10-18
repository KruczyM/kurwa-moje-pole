# Bongo Rush — Krzak / Kobra

Data: 2026-10-11. Gałąź `feat/bongo-bush`, worktree `.ai/worktrees/bongo-bush`.
Zmiana oparta na `feat/bongo-rush`; bez push, PR i merge.

## Zakres

- Potwierdzenie użytkownika: Krzak to Kobra. Usunięto Kobrę z listy grywalnej,
  bez usuwania atlasu z After. Obecnie dostępnych jest 15 bohaterów.
- Stare zapisy wyboru Kobry lub nazwy Krzak wracają do Ampera, zachowując postęp.
- Zakopany kafelek `K`, aktywacja przy odkopaniu, fale co 5,04 s czasu symulacji.
- Jedna fala zajmuje sąsiednie wolne pola; nowe kopie nie rozrastają się w tej samej fali.
- Krzaki blokują ruch. Wzrost nie zastępuje ziemi, ścian, wyjścia ani ciał.
- Korzeń pozostaje aktywny, nawet gdy gracz stoi na jego polu; nie nadpisuje gracza.
- Pauza zatrzymuje wzrost, restart usuwa kopie i przywraca zakopany korzeń.
- Grafika Kobry na zielonym obrysie odróżnia zagrożenie od bohatera i zwykłej ziemi.
- Podpowiedź pokazuje czas do fali, zachowując instrukcję właściwą dla poziomu.

## Walidacja

- `npm run ci:code`: PASS — format, kodowanie, lint, TypeScript,
  **1521 testów jednostkowych w 165 plikach i 6 testów narzędziowych**.
- Bongo Rush: 47 testów, w tym 13 testów nowej mechaniki. Każda z 12 zapisanych
  tras przechodzi po wprowadzeniu Krzaka.
- `npm run build`: PASS. Istniejące ostrzeżenie o dużym bundlu festiwalu 3D pozostaje;
  Bongo nie pobiera tego bundla.
- `python scripts/verify-bongo-bush.py`: PASS, Chromium desktop i WebKit/iPhone 13.
  Rzeczywiste kliknięcia i klawiatura: brak Kobry w wyborze, odkopanie, odczekanie
  pierwszej fali, blokada wejścia w Krzaka, pauza z działającym RAF i zamrożonym
  stanem świata, wznowienie oraz restart. Brak błędów JavaScript.
- `python scripts/verify-bongo-production.py`: PASS, Chromium i WebKit/iPhone 13.
  Produkcyjny build pod prefiksem Pages, ruch, pauza, fokus, gałka, restart,
  obrót ekranu i brak debug API. Brak błędów JavaScript i HTTP.
- Zrzuty desktopu i symulowanego iPhone'a po rozroście zostały obejrzane.
- `python scripts/verify-bongo-rush.py`: PASS — Chromium desktop ukończył 12/12
  poziomów przez rzeczywiste wejście klawiatury. WebKit/iPhone 13 i Chromium/iPhone 13
  przeszły wybór 15 atlasów, poziom 1, pauzę, fokus, restart i obrót ekranu;
  Chromium dodatkowo natywny dotyk przez CDP. Brak błędów JavaScript/HTTP i żądań GLB.

Surowe raporty i zrzuty: `reports/bongo-bush/` i `reports/bongo-rush/` (ignorowane).
Pierwszą próbę pełnej kampanii przerwał HMR podczas dalszej edycji kodu na poziomie
12; nie była zaliczona jako PASS. Końcowa próba korzysta ze stabilnego kodu.

## Własne review i granice odbioru

Sprawdzono: brak drugiego timera/RAF, pojedynczy snapshot źródeł każdej fali,
wykorzystanie istniejących testów pustego pola dla kolizji, brak podmiany zajętych
pól, izolację restartu, zachowanie zapisów i cache atlasów oraz cleanup renderera.
Źródłowe grafiki i lokalne robocze pliki Chlebaka w głównym worktree pozostały nietknięte.
To własne review wykonawcy, nie niezależny przegląd drugiego autora.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: fizyczny iPhone, rzeczywiste FPS
i ocena trudności/tempa wzrostu. Emulacja nie potwierdza wydajności telefonu.
