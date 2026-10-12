# Bongo Rush — grafika biomów AI

Grafiki zostały wygenerowane wbudowanym narzędziem `image_gen` na podstawie własnych
promptów. Referencje użytkownika określały klimat materiałów, nie były kopiowane.
Nie wykorzystano znaków wodnych, stockowych kafelków ani kluczy API.
Skill `imagegen` pomógł określić układ atlasów, rozdzielić strukturę muru od kruchego
gruntu i zachować komplet dokładnych promptów.

## Cztery zestawy

| Biom              | Nieprzekopywalne mury                          | Grunt do kopania                        | Atlas                                                                         |
| ----------------- | ---------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Magazyn Amarena   | Stara cegła, zaprawa, miedziane klamry         | Ciepła glina, żwir, bursztynowe odłamki | [amarena-v1.png](../public/game-assets/2d/bongo-rush/tiles-ai/amarena-v1.png) |
| Zielone podziemia | Omszałe kamienie oplecione korzeniami          | Próchnica, liście, drobne korzenie      | [roots-v1.png](../public/game-assets/2d/bongo-rush/tiles-ai/roots-v1.png)     |
| Neonowy rave      | Pancerne płyty, przewody, akcenty cyan/magenta | Fioletowy gruz i drobne fragmenty kabli | [rave-v1.png](../public/game-assets/2d/bongo-rush/tiles-ai/rave-v1.png)       |
| Dymna grota       | Niebieski lód, szron, szkliście pęknięte bryły | Ciemny łupek i lodowy żwir              | [glass-v1.png](../public/game-assets/2d/bongo-rush/tiles-ai/glass-v1.png)     |

Każdy atlas ma układ 2×2: górny rząd to dwa warianty muru, dolny — dwa warianty
gruntu. Pełne prompty i nazwy plików znajdują się w
[bongo-biome-texture-prompts.json](bongo-biome-texture-prompts.json).
Grafiki są nieprzezroczyste, bez napisów i w widoku na wprost. Generator otrzymał
zalecenie powtarzalnych krawędzi; nie oznacza to gwarancji matematycznie bezszwowego
łączenia wszystkich wariantów. Zrzuty plansz pozwalają ocenić powtarzalność.

## Integracja i pliki

- `src/games/bongo-rush/BiomeTiles.ts` określa atlasy, współrzędne ich ćwiartek,
  stabilny wybór wariantu i wypiekanie kafelka do 64×64 px. Grunt ma delikatną
  ciemną nakładkę, aby nie konkurował z przedmiotami i postaciami.
- `Renderer.ts` korzysta z istniejącego cache kafelków. Zachowuje jedną pętlę
  renderowania; stary rysunek proceduralny pozostaje fallbackiem renderera.
- `main.ts` ładuje tylko atlas wybranego biomu przez istniejący `ImageCache`.
  Powrót do biomu nie pobiera ponownie grafiki. Błąd pobrania jest zgłaszany w UI.
- `BiomeTiles.test.ts` sprawdza prawdziwe nagłówki PNG, poprawne wycinanie,
  stabilność wariantów i polecenia rysowania.
- `scripts/verify-bongo-textures.py` sprawdza wszystkie biomy w Chromium i WebKit
  iPhone 13, faktyczne użycie obrazów w Canvas, cache, pauzę, RAF i odzyskanie focusu.

Źródłowe PNG mają łącznie około 13,5 MB. Są ładowane na żądanie; nie wszystkie
na start nowej gry. Nie dodano nowych shaderów ani obliczeń symulacji.
W przyszłości można przygotować lżejszą dystrybucyjną wersję atlasów po porównaniu
jakości na fizycznym telefonie. Pliki PNG są przechowywane przez Git LFS.

## Weryfikacja lokalna

- `npm run ci:code`: PASS — 175 plików testowych, 1704 testy jednostkowe,
  dodatkowo 6 testów narzędzi, lint, TypeScript, format i kodowanie.
- `npm run build`: PASS. Pozostaje dotychczasowe ostrzeżenie o dużym bundlu gry 3D.
- `scripts/verify-bongo-textures.py`: PASS — desktop Chromium i emulacja iPhone 13
  WebKit; po jednym pobraniu każdego atlasu, cztery potwierdzone źródła Canvas,
  bez błędów JavaScript i HTTP. Pauza nie zatrzymuje RAF ani nie wypieka kafelków
  ponownie; wznowienie przywraca focus.
- Obejrzano zrzuty wszystkich czterech biomów na desktopie i widok mobilny.
  Ściany różnią się strukturą od gruntu, przedmioty pozostają na ciemnych polach.
- `scripts/verify-bongo-production.py`: PASS — produkcyjny build z prefiksem
  `/kurwa-moje-pole/`, Chromium i WebKit iPhone 13; bez błędów HTTP/JS,
  stabilny obraz pauzy, działające wznowienie i brak produkcyjnego API debug.
- Raport i zrzuty lokalne: `reports/bongo-textures/` (nie są assetami gry).
- Fizyczny iPhone, dłuższa sesja i subiektywna ocena komfortu: **PENDING_HUMAN**.
  Emulacja WebKit nie dowodzi wydajności na konkretnym urządzeniu.

## Muzyka — następny etap, jeszcze niewdrożony

1. Magazyn: ciepły dub/lo-fi, miękki bas, stłumiona perkusja, subtelne pogłosy
   piwnicy, około 75–85 BPM.
2. Korzenie: organiczny downtempo, drewniana perkusja, szelesty, odległe drony,
   około 65–80 BPM.
3. Rave: minimal/acid z pulsującym syntezatorem, około 105–115 BPM, bez agresywnego
   prowadzenia odwracającego uwagę od zagadek.
4. Grota: przestrzenny dark ambient, szklane dzwonki, powolny bas i lodowe trzaski;
   swobodny rytm albo około 55–65 BPM.

Do realizacji: oryginalne lub odpowiednio licencjonowane zapętlone utwory, płynne
przejścia między biomami, pierwszeństwo odgłosów zagrożeń i zbierania, wyciszanie
oraz uruchamianie audio po geście użytkownika na telefonie. Nie dodawać drugiego
systemu audio — rozwinąć istniejący `Audio.ts`.
