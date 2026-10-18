# Czytelne sektory mobilne i namiot ASP

Gałąź: `fix/mobile-sector-boundaries`, baza: `main` / `f98dac7`.

## Zachowanie

Siedem prostokątów bez nakładania pokrywa świat od −290 do 290 m. Obszary
mają wspólną definicję dla gry, mapy, NPC oraz eksportera. Lidl i karuzela
są osobnymi sektorami. Pas północny kończy się na Z −96, pierwszy pasaż
na −25, obóz na 64. Podziały pionowe to X 96, 110 i −105.

Pobliskie wspólne granice mają przerywane linie na ziemi (do 24 m).
Do 8 m od granicy interfejs podaje sąsiednie miejsce i odległość. Linie
nie są ścianą i nie mają kolizji. Istniejące potwierdzenie przejścia,
zwalnianie poprzedniego sektora, ponowienie i powrót po błędzie pozostają.
Po anulowaniu trzeba odejść ponad 2 m od odrzuconej granicy przed
ponownym pytaniem; inne przejścia nadal działają.

Mapa mobilna pokazuje granice i siedem nazw oraz wyróżnia załadowany
sektor. Podpisy skalują się do wyświetlanego rozmiaru mapy. Mniejsze
punkty pozostają dostępne w istniejącym przewodniku; na mapie mobilnej
priorytet mają orientacja, ASP i aktywności obozowe. Układ poziomy
zachowuje proporcje mapy i możliwość przewinięcia panelu.

## ASP

Zapisany layout Blendera nie zawierał namiotu ASP. Eksporter i generator
rzutu mapy dodają istniejący `small_stage.glb`, jeśli placementu brakuje,
bez zapisywania lub modyfikowania źródłowego pliku `.blend`. Namiot
znajduje się przy X −65, Z 97, w sektorze „Drugi pasaż i ASP”. Jego
rzeczywisty obrys wynosi około 51,75 × 38 m; cały leży wewnątrz sektora.
Wejście jest od zachodu. Mapa wiąże podpis „Namiot ASP” z rzeczywistą
geometrią, a nie tylko dawnymi współrzędnymi zastępczymi.

Mobilny eksport zawiera wszystkie 402 siatki namiotu, w tym dach.
Nie zmieniono geometrii 14 654 wcześniejszych siatek ani transformacji
wcześniejszych placementów. Świat nadal korzysta ze wspólnych tekstur,
cache i istniejącego streamera. Nowe oznaczenia korzystają z istniejącej
sceny i pętli gry; ich geometria, materiał i element interfejsu są
zwalniane przy zamknięciu gry. Protokół multiplayer nie zmienia się.

## Weryfikacja i przekazanie

- `ci:code`: PASS — 210 plików / 1977 testów oraz 6 testów narzędzi,
  lint, typy, formatowanie i kodowanie. Build produkcyjny: PASS.
- Testy deterministyczne: rozłączność i pokrycie, punkty na krawędziach,
  narożniki, rzeczywiste sąsiedztwo, odległości, obrys ASP, mapa,
  widoczność pobliskich linii i sprzątanie zasobów.
- Walidacja eksportu: 221 komórek desktopowych, 7 mobilnych miejsc /
  15 plików, 14 995 statycznych siatek; oryginalne tekstury, geometria
  i transformacje zachowane. Dodatkowa kontrola obecności geometrii ASP
  i zgodności jego rzeczywistego obrysu mapy z sektorem.
- Raport i zrzuty przeglądarki: `reports/mobile-sector-boundaries/`.
  Scenariusz: obóz → ASP, anulowanie i ponowne podejście, mapa w pionie
  390 × 844 i poziomie 844 × 390, błąd pobierania i ponowienie, powrót.
  Wynik: PASS, bez błędów JavaScript; raport obejmuje anulowanie,
  ponowienie po celowo przerwanym pobieraniu i powrót do obozu.
  Skrypt: `scripts/verify-mobile-sector-boundaries.py`; lokalny build
  produkcyjny na porcie 5297, serwer pokojów na porcie 3107.
- Przebudowa: istniejący `world:export`; Python użyty do sektorów musi
  mieć NumPy. W tej sesji użyto dostarczonego Pythona środowiska po
  eksporcie świata i mapy, ponieważ systemowy Python nie ma NumPy.

Test przeglądarkowy używa emulacji dotyku Chromium, nie fizycznego
telefonu. Pamięć, płynność i wygoda sterowania na fizycznym urządzeniu:
`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

Nie wykonano push, PR ani merge. Niezależny review i publikacja należą
do orkiestratora; praca jest przygotowana do lokalnego przeglądu.
