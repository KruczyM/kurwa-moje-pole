# Bongo Rush — odniesienia do istniejących zagadek

Data przeglądu: 2026-10-11. Gałąź: `feat/bongo-reference-puzzles`.

## Sprawdzone źródła

- [Rocks’n’Diamonds: Levels & Artwork](https://www.artsoft.org/rocksndiamonds/levels/):
  katalog kolekcji Boulder Dash, Emerald Mine, Diamond Caves, Supaplex i Sokoban.
  Emerald Mine i Supaplex mają także nagrania rozwiązań dla wielu zestawów.
  To baza do dalszego oglądania przebiegów i porównywania projektów.
- [BoulderDash cave names & descriptions](https://www.elmerproductions.com/sp/peterb/namesDescs.html):
  fanowska transkrypcja krótkich opisów komór I i III, przypisywanych ulotkom gry.
  Źródło wtórne: pozwala wskazać konkretne przykłady, ale nie potwierdza nam
  pełnego układu ani wszystkich szczegółów fizyki.

Przejrzano katalog i opisy wzorców, nie rozegrano tysięcy plansz ani nie
przeanalizowano wszystkich nagrań. Nie pobrano ani nie skopiowano map, kodu,
grafik czy dźwięków. Dostępność archiwum nie oznacza zgody na jego redystrybucję.
Przy ewentualnym imporcie trzeba osobno sprawdzić licencję konkretnego zestawu.

## Co warto przenieść do naszej konstrukcji

| Odniesienie              | Zasada w źródle                                        | Zastosowanie w Bongo Rush                                                  |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Boulder Dash I, B: Rooms | Zbiory wymagają przestawiania skał                     | Obowiązkowa droga przez zagadkę, nie wyłącznie łatwe boczne złoża          |
| Boulder Dash I, K: Crowd | Manewrowanie wieloma głazami przy małej ilości miejsca | Przygotowanie wnęk i zmiana strony pchania; wdrożone poniżej               |
| Boulder Dash I, E/F      | Przedmiotów pilnują przeciwnicy                        | Kolejny etap: czytelne spotkanie z patrolem i droga odwrotu                |
| Boulder Dash I, G        | Ograniczanie wzrostu amoeby skałami                    | Możliwy odpowiednik kontroli Kobry, bez automatycznej zamiany jej w zbiory |
| Boulder Dash III, G/L    | Rozrost zagrożenia odcina trasę; trzeba go ograniczyć  | Przyszła sekcja z Kobrą i planowaniem powrotu                              |

To analogie projektowe, nie stwierdzenie identycznych reguł. U nas nie ma
magicznych ścian, eksplozji ani przemiany pokonanych patroli w przedmioty.
Sokoban nie ma naszej grawitacji, dlatego nie wolno bez sprawdzenia przenosić
jego labiryntów. Nagranie rozwiązania w obcym silniku nie dowodzi wykonalności u nas.

## Wprowadzona adaptacja: Zmiana strony

Nowy autorski moduł `EXIT_PUZZLES[5]` w `ExitPuzzles.ts` wykorzystuje ciasne
manewrowanie jako odniesienie do Crowd. Pierwszy głaz trzeba odsunąć w prawo,
odkopać lewą wnękę dla drugiego, następnie obejść go prawym ramieniem labiryntu
i popchnąć w lewo. Ruch w jednym kierunku nie wystarcza; przygotowanie obejścia
jest częścią rozwiązania. Nie jest to odtworzenie oryginalnej komory K.

Moduł zastępuje powtarzany podwójny spust na poziomie 6 (**Korzenne obejście**)
i jest połączony ze stosem na poziomie 11 (**Zmiana strony i stos**).
Pozostałe zakończenia, pozycje głównych komór, fizyka i sterowanie nie zmieniają się.

Testy sprawdzają rzeczywiste przepchnięcia w obu kierunkach, odrzucenie pchania
w nieodkopaną wnękę, brak drogi omijającej głazy, rozwiązanie z przerwami oraz
pełne trasy wszystkich 12 plansz.

## Wyniki weryfikacji

- `npm run ci:code`: PASS — 1567 testów jednostkowych w 169 plikach oraz
  6 narzędziowych; kodowanie, formatowanie, ESLint i TypeScript poprawne.
- `npm run build`: PASS; wcześniejsze ostrzeżenie o wielkości osobnego bundla 3D
  nie dotyczy wejścia Bongo Rush.
- Chromium: PASS — galeria wszystkich 12 plansz, minimapa, pełne trasy poziomów
  6 i 11 klawiaturą, wymagana liczba zbiorów, podpowiedzi, pauza z działającym RAF
  i zwycięstwo. Brak błędów JavaScript i HTTP. Bez teleportacji i przyspieszania czasu.
- Fixture zapisu odblokowuje wybór plansz do testu; nie jest jednym ciągłym
  przejściem kampanii. Zdjęcia i JSON: lokalne `reports/bongo-reference-puzzles/`.
- Samodzielny przegląd kodu: oba głazy mają stałe podparcie po przepchnięciu,
  korytarz łączący nie omija bram, szablony zachowują pojedynczy start i wyjście.
  Nie zmieniono mechanik ani RAF. Nie wykonano push, PR ani merge.
- Odbiór trudności i fizycznego telefonu:
  `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

## Powtórzenie testu przeglądarkowego

```powershell
npm run dev:client -- --host 127.0.0.1 --port 5196 --strictPort
# W drugim terminalu, z lokalnie zainstalowanym Python Playwright:
python scripts/verify-bongo-puzzles.py --port 5196 --levels 6 11 --output reports/bongo-reference-puzzles
```

## Dalsza kolejność

1. Zagadki patrolu przy zbiorach — bez niespodziewanego wroga pod graczem.
2. Ograniczona przestrzeń na spadające skały, z widoczną bezpieczną kieszenią.
3. Sekcja odcinana przez Kobrę: najpierw zaplanować dojście i powrót.
4. Dopiero później nowe mechaniki, np. przełączniki; nie dodawać ich tylko po to,
   by móc odtworzyć cudzą planszę.

Niezależny odbiór trudności i test fizycznego telefonu pozostają potrzebne.
Mocniejszy model nie jest niezbędny do tej adaptacji.
