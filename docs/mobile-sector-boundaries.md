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

- `ci:code`: PASS — 211 plików / 1982 testów oraz 6 testów narzędzi,
  lint, typy, formatowanie i kodowanie. Build produkcyjny: PASS.
- Testy deterministyczne: rozłączność i pokrycie, punkty na krawędziach,
  narożniki, rzeczywiste sąsiedztwo, odległości, obrys ASP, mapa,
  widoczność pobliskich linii i sprzątanie zasobów.
- Walidacja eksportu: 221 komórek desktopowych, 7 mobilnych miejsc /
  15 plików, 14 993 statycznych siatek; oryginalne tekstury, geometria
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

## Telebimy na telefonach

Eksporter sprawdza teraz zarówno `runtimeNode`, jak i `runtimePlacement`.
Wcześniej powierzchnie ekranów były zastępowane niewidocznymi proxy, do których
odtwarzacz przypisywał film. Oba prawdziwe ekrany pozostają teraz w bazowym
świecie, a walidator sprawdza, że nie są proxy ani statyczną kopią w sektorze.

Obraz startuje wyciszony i inline, niezależnie od odblokowania Web Audio.
Gest dotykowy lub klawiatura uruchamiają istniejący przestrzenny tor audio.
Wywołanie `video.play()` nie czeka na `AudioContext.resume()`, aby zachować gest
użytkownika. Odrzucona próba z dźwiękiem ponawia odtwarzanie wyciszonego obrazu.
Zasady przeglądarki opisuje [WebKit](https://webkit.org/blog/6784/new-video-policies-for-ios/).

Wideo jest dołączane do DOM przed pierwszym odtwarzaniem, z niewidoczną,
wyciętą powierzchnią 960 × 540 bez obsługi dotyku. WebKit z odłączonym wideo
przesuwał zegar, ale zwracał czarne klatki. Powierzchnia nie może mieć rozmiaru
1 × 1, ponieważ ten silnik potrafi wtedy zwracać jednokolorową miniaturę.
Przy zamknięciu gry element jest usuwany razem z pozostałymi zasobami.

Pięć testów odtwarzacza sprawdza niezależność obrazu od audio, nierozwiązane
resume, ponowienie oraz sprzątanie zasobów. Scenariusz przeglądarkowy
`scripts/verify-mobile-stage-video.py` sprawdza rzeczywiste dekodowane klatki,
postęp czasu, współdzieloną teksturę i aktywność obu ekranów. Wyniki oraz zrzuty
trafiają do `reports/mobile-stage-video/`.

Na testowym WebKit dla Windows nie jest dostępne Web Audio API. Obraz jest
sprawdzany również w takim środowisku; odblokowanie audio jest dodatkowo
sprawdzane w Chromium. Dźwięk i wydajność fizycznego telefonu wymagają
potwierdzenia na urządzeniu.

Wynik końcowy: Chromium i WebKit PASS — rzeczywiste klatki filmu, postęp czasu,
dwie aktywne powierzchnie i jedna współdzielona tekstura, bez błędów JavaScript.
Chromium potwierdził również odblokowanie przestrzennego audio po dotknięciu.
`ci:code`: 211 plików / 1982 testów PASS; build i walidacja eksportu PASS.
