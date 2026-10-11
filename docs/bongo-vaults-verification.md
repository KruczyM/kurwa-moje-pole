# Bongo Rush — indywidualne kompozycje komór

Data: 2026-10-11. Gałąź: `feat/bongo-authored-vaults`.
Worktree: `.ai/worktrees/bongo-vaults`.

## Zakres

Zamiast trzech zakończeń powtarzanych po kilka razy kampania ma 12 różnych
kompozycji pięciu modułów. Nowe elementy to wspólna podpora stosu oraz zagadka
przestawienia górnego głazu przed odkopaniem dolnej wnęki. Finał łączy wnękę,
manewr kolejności i stos. Nie są to 12 niezależnych nowych mechanik.

`VaultComposer.ts` łączy moduły szczelnymi korytarzami, zapisuje rzeczywiste ruchy
łączników i pozycje etapowych podpowiedzi. Niskie wyjścia prowadzi pod komorą,
nie przez wnękę przyjmującą głaz. `CaveBuilder.ts` dobiera szerokość mapy do
kompozycji (59×34–109×44), bez zmiany głównej sieci jaskiń i zagrody bossa.
`main.ts` pokazuje podpowiedź bieżącego modułu zamiast wszystkich naraz.

Nie zmieniono fizyki, RAF, sterowania, rendererów, cache ani assetów After.
Nie korzystano z generatorów, płatnych API ani zewnętrznych wzorów poziomów.

## Weryfikacja

- Wszystkie 12 pełnych tras nadal przechodzi rzeczywistą symulację, z wymaganą
  liczbą przedmiotów, Kobrą, patrolami i zamknięciem zagrody finałowej.
- Każda kompozycja ma inny układ ASCII, jeden start, jedno wyjście i szczelną
  granicę poza jednym wejściem. Tworzenie kompozycji jest deterministyczne
  i nie modyfikuje szablonów.
- Żaden moduł po połączeniu nie ma drogi do następnego wejścia/wyjścia przez
  samo kopanie, bez poruszenia skał. Sprawdza to przeszukiwanie grafu pól.
- Testy pięciu szablonów odczekują 30 pustych ticków przed każdym poprawnym
  ruchem, a testy wszystkich 12 kompozycji — cztery. Planowanie w komorze
  jest bezpieczne; nie oznacza to bezpieczeństwa przy aktywnym patrolu lub Kobrze.
- Test błędnej kolejności potwierdza zaklinowanie dwóch skał, a nowa próba
  z poprawną kolejnością kończy się sukcesem. Restart jest rozwiązaniem tej
  celowej pułapki; nie dodano cofania ani ogólnego detektora blokad.
- `npm run ci:code`: PASS — 1563 testy jednostkowe w 169 plikach i 6 narzędziowych.
- `npm run build`: PASS. Wcześniejsze ostrzeżenie o rozmiarze osobnego bundla
  gry 3D pozostaje; Bongo Rush go nie ładuje.
- `python scripts/verify-bongo-puzzles.py`: PASS. Galeria otworzyła wszystkie
  12 plansz i sprawdziła minimapę. Pełne trasy 1, 4 i 12 ukończono rzeczywistymi
  zdarzeniami klawiatury w Chromium, a 7 w WebKit z profilem iPhone 13.
  Test obejmuje wymagane zbiory, podpowiedź przy komorze, pauzę z działającym RAF,
  wznowienie i finał. Nie teleportuje ani nie przyspiesza symulacji. Zapis fixture
  odblokowuje wybór poziomów; nie jest dowodem odblokowania ich w jednym zapisie.
- Brak błędów JavaScript i HTTP w pełnych przebiegach. Zrzuty i JSON są lokalnie
  w ignorowanym `reports/bongo-authored-vaults/`. Obejrzano zrzuty komory mobilnej
  i finału. WebKit z klawiaturą nie jest testem dotykowej ergonomii ani fizycznego iPhone’a.

Samodzielne code review obejmuje szczelność łączników, ustawienie wyjść,
zachowanie zagrody finałowej, brak zmian fizyki i ponownego tworzenia kontrolerów.
Nie wykonano push, PR ani merge. Przegląd własny nie zastępuje niezależnego review.

## Następne kroki

1. Próby gracza: czy zagadka kolejności jest czytelna, a pętle przygotowania wnęk
   nie trwają zbyt długo. Istnienie rozwiązania nie dowodzi dobrego balansu.
2. Podpowiedzi na żądanie w dwóch stopniach, zamiast automatycznie zdradzanej
   instrukcji przy trudniejszych komorach.
3. Ręcznie zaprojektowane spotkania z patrolami i lawiny na bocznych trasach;
   obecna rozbudowa dotyczy zakończeń, nie przebudowy całej głównej jaskini.
4. Odbiór dotyku, ergonomii i wydajności na fizycznym iPhonie/Androidzie.

Status odbioru fizycznego urządzenia i balansu:
`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
Na ten zakres mocniejszy model nie jest konieczny. Najbardziej wartościowe będą
próby gracza i niezależna ocena trudności, których większy model nie zastępuje.
