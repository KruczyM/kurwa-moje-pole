# Integracja sceny Blendera — 2026-10-04

Gałąź: `feat/festival-next`. Bez push, PR ani merge.

## Wdrożenie

- Scenografia pochodzi z aktualnego `blender/festival-layout.blend` (1039
  unikalnych obiektów nadrzędnych eksportu), z wyposażeniem 12 obozów i flagami.
- Eksport GLB: 152481148 bajtów, około 145 MiB. Pierwsze wczytanie jest ciężkie;
  dalsza redukcja geometrii i tekstur pozostaje osobnym zadaniem.
- `AssetLoader` wykorzystuje ten sam cache i GLTFLoader. Nie dodano renderera
  ani nowej pętli renderowania. Osobne modele statycznego świata nie są już
  dodatkowo wczytywane przez `loadAll`.
- Usunięto zastąpione ścieżki budowania namiotów, krzeseł, flagi i scenografii
  z `CampWorld`; pozostały kontrolery rozgrywki, przedmioty i shader trawy.
- Kolizje i maska trawy korzystają z aktualnych granic eksportowanych modeli.
  Punkt startowy jest szukany poza przeszkodami przy aktualnym wcTronie.
- Barierki: 48 segmentów półokręgu; trzy przejścia mają interakcje Patrolu.
- Dodatki z cache BlenderKit nie eksportują metadanych konta/wtyczki.
- Eksport jest zapisywany atomowo i nie modyfikuje źródłowego `.blend`.

## Walidacja

- `npm run build`: przeszedł; pozostaje ostrzeżenie Vite o dużym bundlu JS.
- Testy świata, młyna i siedzenia: 23/23 przeszły, w tym 5 nowych testów integracji.
- `node scripts/validate-authored-world.mjs`: sprawdza strukturę GLB, unikalne
  identyfikatory, 24 gondole, 48 barierek, 12 flag i zgodność SHA źródła.
- Raport przeglądarki: `reports/festival-blender/runtime/browser-report.json`;
  zrzuty `stage.png` i `camp.png`. Sprawdzone: drożność trzech wejść, kolizje
  barierek, miejsca siedzące, ruch młyna, wolny spawn i błędy JavaScript.
- Wstępna scena miała około 4667 wywołań renderowania w badanym widoku;
  instancjonowanie i łączenie statycznej geometrii zmniejszyło je do około 1672.
  Nie jest to pomiar FPS ani gwarancja wydajności na telefonie.

## Ograniczenia i inne zmiany w katalogu

- Obecny `toitoi_row.glb` to pojedyncza siatka bez osobnych drzwi. Eksport nie
  może stworzyć z niej ruchomych skrzydeł. Binder wspiera modele z węzłami
  `ToiToi_Door_N`, ale na aktualnym zasobie liczba takich interakcji wynosi zero.
- Mapy/UI i dane preferowanych stref NPC nadal mają istniejące konfiguracje.
  Po dużych przesunięciach tych stref w Blenderze należy zaktualizować także
  ich położenie logiczne; nawigacja fizyczna już korzysta z nowych kolizji.
- Pliki Flanki i UI były równolegle zmieniane w tym samym katalogu. Poprawiono
  wyłącznie zakres zmiennej `currentThrower`, blokujący kompilację. Pełna próba
  testów miała błędy Flanki; po poprawce pozostały 4 błędy w scenariuszach tej
  minigry. Nie zmieniano zasad meczu ani testów, żeby ukryć te niezgodności.
- Historyczne fabryki i stałe układu pozostawiono, jeśli korzystają z nich
  snapshoty, narzędzia, testy lub systemy logiczne. Nie usuwano lokalnych prac
  użytkownika, innych worktree ani oryginalnych modeli źródłowych.

## Następne edycje

Zapisz scenę w Blenderze → `npm run world:export` → odśwież grę.
Nie uruchamiaj historycznego buildera z `--replace` na ręcznie zmienionym pliku.
