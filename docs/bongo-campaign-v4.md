# Bongo Rush — przebudowa kampanii v4

## Stan przekazania

Implementacja lokalna na `codex/bongo-campaign-expansion`, baza `985fee9` (opublikowany PR #123).
Worktree: `E:/kodowanie/gra/.ai/worktrees/bongo-campaign-expansion`.
Nie wykonano push, PR ani merge nowej partii. Niezależny review: **PENDING** — do wykonania przed publikacją przez orkiestratora.

## Zmiany

- Zachowano identyfikatory 1–16, 12 poziomów kampanii, 4 wyzwania, cztery biomy i zapis postępu v1.
- Pierwsza mapa ma dwie kieszenie z łupem i dwie zweryfikowane drogi do wyjścia. Zamiast długich galerii: zwarte komory, wysokie stosy, przeciwne zasuwy, pętle dwóch patroli, kilka niezależnych skrytek i kompaktowy finał z zagrodą bossa.
- Bogate kafelki są oznaczone złotą ramką, liczbą przedmiotów i literą K. Wydają jeden fizyczny przedmiot na tick, zatrzymują emisję przy zajętym ujściu i jednorazowo aktywują przypisane korzenie Kobry. Wzrost używa dotychczasowych fal symulacji; nie dodano drugiego zegara.
- Portale niebieskie prowadzą do opcjonalnych skarbców, złote do wymaganych. Komory zachowują stan, mają wspólny łup, rezerwowane lądowania i zabezpieczenie przed odbiciem. Nieaktywna komora jest zamrożona. Restart odtwarza wszystkie komory. Dwa wymagane skarbce można odwiedzać w obu kolejnościach.
- Grawitacja, tempo ruchu, pojedynczy RAF, cache obrazów i lifecycle listenerów pozostają wspólne z dotychczasową grą.
- Dolne sterowanie jest nakładką na mapie. Joystick jest centralny, ma bazę 112–124 px, większy obszar chwytu i przechwytywanie wskaźnika poza obrysem. Kamera rezerwuje miejsce na dłoń; dekoracyjne ściany wypełniają także marginesy małych komór pod panelem. Pomoc pokazuje pełną wskazówkę aktualnej komory.
- Cztery odrębne autorskie tematy WebAudio: 84/72/116/64 BPM, różne melodie, rytmy i harmonie. Menu jest spokojniejsze, pauza zatrzymuje głosy, brak zaległych nut po wznowieniu.

## Tekstury i interfejs danych

Wbudowany generator imagegen; bez kluczy i płatnych API. Źródła oraz pełny zestaw promptów: `source-assets/bongo-rush/materials-v4/`, plik `prompts.json`.

Gotowe grafiki: `public/game-assets/2d/bongo-rush/materials-v4/`. Każdy z czterech atlasów 1024×896 ma 50 regionów: osiem ścian, sześć gruntu, osiem akcentów, cztery trzykafelkowe pasma poziome, cztery pionowe i cztery narożniki. Manifesty dokumentują wybrane fragmenty nowych źródeł oraz zachowane pasmo v3. Pakowanie: `scripts/pack-bongo-materials-v4.py`.

Rozkład materiałów jest zakotwiczony w świecie, z podziałem na spójne obszary. Autor może wskazać motywy przez `decorations`; pierwsza plansza ma trzy stałe punkty orientacyjne. Pasma sprawdzają zajmowane pola i mogą leżeć przy krawędziach komór. Cache wypieczonych kafelków nadal ma limit 256.

`LevelDefinition` rozszerzono o `chambers`, `portals`, `lootSources`, `terrainTheme`, `decorations`, `replay` i `alternateReplays`. Nowe pełne rozwiązania należy odtwarzać z `replay` (obejmuje bezczynne ticki), nie z pomocniczego kierunkowego `solution`. Audyt i symulator CLI obsługują bezczynność, przejścia portalowe i łączny zegar. Stare testy builderów korzystają z `LEGACY_LEVELS`; nowa kampania ma osobne testy rzeczywistych rozwiązań.

## Walidacja

- `npm run ci:code`: PASS, 202 pliki testów / 1904 testy jednostkowe oraz 6 testów narzędzi.
- Po ostatnich zmianach audytu i renderowania: typy, lint oraz 317 testów Bongo PASS.
- `npm run ci:assets`: PASS. `npm run build -- --base=/kurwa-moje-pole/`: PASS.
- `scripts/audit-bongo-campaign.ts` i `scripts/simulate-bongo-campaign.ts`: wszystkie 16 rozwiązań i zadeklarowane alternatywy kończą się zwycięstwem.
- `scripts/verify-bongo-campaign-v4.py`: 16 zwycięstw Chromium + 16 WebKit, prawdziwe zdarzenia klawiatury i istniejący RAF, test pauzy, chwytu joysticka poza obrysem, cache ≤256; brak błędów JS i HTTP. Raport i zrzuty: `reports/bongo-campaign-v4/browser.json`.
- `scripts/verify-bongo-campaign-v4-production.py`: skompilowane ścieżki Pages, trzy profile (desktop, WebKit pion/poziom), cztery biomy, realne wejście do komory, pauza, pomoc, geometria nakładki i zgodność SHA256 czterech PNG. Raport: `reports/bongo-campaign-v4/production.json`. Diagnostyczne odstępy klatek nie są pomiarem fizycznego iPhone'a.

Odtwarzanie kontroli przeglądarki: uruchomić Vite na 5226, potem `tsx scripts/audit-bongo-campaign.ts v4` i Python ze skryptem `verify-bongo-campaign-v4.py`. Dla produkcji zbudować z bazą Pages, uruchomić preview na 5227 i skrypt produkcyjny. Skrypty przyjmują także URL jako argument.

Końcowa próba produkcyjna wykonywana kolejno (bez jednoczesnego uruchamiania trzech profili): Chromium mediana/p95 16,7/33,3 ms; WebKit pion 54/68 ms; WebKit poziom 71/133 ms. To krótkie próbki diagnostyczne z emulacji programowej, nie dowód osiągnięcia 60 FPS ani porównanie identycznej sceny z poprzednią wersją. Płynność WebKit wymaga odbioru na fizycznym urządzeniu przed deklarowaniem gotowości wydajnościowej.

## Odbiór przez człowieka

Pozostaje fizyczny telefon: wygoda joysticka, czytelność tekstur i zagrożeń, odsłuch muzyki oraz ocena atrakcyjności i trudności poziomów. WebKit emulowany na komputerze nie potwierdza FPS na iPhonie. Niezależny review pozostaje wymagany przed publikacją. Nie potrzebowano mocniejszego modelu do uzyskania zweryfikowanych rozwiązań map.
