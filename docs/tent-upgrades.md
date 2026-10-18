# Namioty — pierwsza iteracja ulepszeń

## Zmiany

- Dziewięć pochodnych GLB w `public/game-assets/world/tents/upgraded/`, podpiętych przez istniejący katalog i loader. Oryginały pozostają bez zmian.
- `large`: podłoga dopasowana do wnętrza pomiarem ścian, moskitiera w łukowym oknie, rzeczywisty otwór boczny z półprzezroczystym wypełnieniem, obszycie i zwinięta osłona.
- `big2`: podłoga z niską krawędzią i moskitiera w istniejącym oknie. Zachowane wejście boczne.
- Modele bez mikronormalnych i map szorstkości otrzymują matematyczne, okresowe mapy tkaniny. Zachowano oryginalne mapy detalu w pozostałych modelach i wszystkie atlasy koloru. Tkanina jest niemetaliczna i dwustronna.
- `main` korzysta z istniejących UV i `KHR_texture_transform`, zamiast zwiększać rozmiar o kolejne 8 MB UV.
- Maska trawy pod namiotami wykorzystuje istniejący sampler. Bez nowego renderera, loadera ani pętli.
- Rozmiar dziewięciu modeli: około 68,04 → 70,56 MB. Oryginały i pochodne na dysku są osobne; loader pobiera tylko pochodne.

To ulepszenie istniejących modeli, nie nowa biblioteka fotorealistycznych assetów. Oryginalne atlasy nadal mają miejscami rozmycia i nierówne szwy. Kolizje namiotów pozostają pełnymi bryłami — ta iteracja nie dodaje chodzenia po wnętrzach.

## Odtworzenie i podglądy

Z katalogu worktree, Blender 5.0:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python scripts/blender/upgrade-tents.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python scripts/blender/audit-tents.py -- --root public/game-assets/world/tents/upgraded --output reports/tent-audit/after
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python scripts/blender/audit-tents.py -- --root public/game-assets/world/tents/upgraded --output reports/tent-audit/details --models big2 large --views beauty front side rear interior
```

Generator opcjonalnie przyjmuje `-- --only big2 large`; nadpisuje tylko własne pochodne, nigdy oryginały. Raport źródeł SHA-256 i wielkości wyjść zapisuje w `reports/tent-audit/build.json` dla danego uruchomienia. Nie korzysta z chmury ani płatnych API.

Rendery pokazują źródłowe GLB w świetle studyjnym, nie rozgrywkę. `interior` ma dodatkowe światło inspekcyjne niewchodzące do assetu. Artefakty w `reports/` nie są wersjonowane.

## Trzy nowe prototypy — początek etapu 2

Ta sekcja opisuje pierwszą wersję trzech prototypów sprzed LOD. Aktualne rozmiary plików, czwarty namiot tunelowy oraz integracja poziomów szczegółowości: [tent-lod.md](tent-lod.md).

Oryginalne, niebrandowane modele oparte na rodzajach konstrukcji ze zdjęć użytkownika. Nie są skanami ani kopiami produktów 1:1. Jednostki źródłowe: metry; w grze skala jednolita, bez rozciągania osi.

| Obiekt | Model         | Trójkąty | Części / wywołania rysowania na przebieg |      GLB |
| ------ | ------------- | -------: | ---------------------------------------: | -------: |
| T16    | trekkingDome  |     9937 |                                        8 | 397520 B |
| T17    | baseShelter   |     3300 |                                        8 | 169412 B |
| T18    | domeVestibule |    12396 |                                       10 | 485640 B |

Elementy statyczne połączono według materiałów; podłogi zachowane osobno do testów. Wszystkie obrazy osadzone w GLB, materiały tkaniny mają kolor, normalne i szorstkość. Moskitiery używają wycinania alfa (MASK), aby nie wymagały sortowania półprzezroczystych ścian.

Pozycje: X=-11/0/11, Z=24, wejścia skierowane do starego obozu. T17 ma korektę osadzenia 15 mm ze względu na lokalny spadek terenu. Istniejące 15 namiotów nie zostało przesuniętych. Nowe namioty korzystają z dotychczasowych kolizji bryłowych, loadera i sprzątania zasobów.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/build-festival-tents.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/audit-tents.py -- --root public/game-assets/world/tents/festival --output reports/tent-audit/prototypes
```

Ograniczenia: proste fałdy i obszycia, brak zużycia, LOD i wariantów wyposażenia. Styk przedsionka z kopułą wymaga dalszej pracy estetycznej. Rendery wszystkich trzech modeli obejrzane po połączeniu części; wygląd i wydajność w grze niepotwierdzone. Przed rozmieszczeniem setek sztuk konieczne LOD oraz pomiary renderowania.

## Weryfikacja

- `npm test` po dodaniu czwartego prototypu i LOD: 303 testy jednostkowe, 23 testy orkiestratora, walidacja 176 assetów i 8 rigów — zaliczone.
- `npm run build` — zaliczone; wcześniejsze ostrzeżenie o dużym bundlu JS pozostaje.
- ESLint/Prettier dla zmienionych plików TypeScript/JSON — zaliczone.
- 29 nowych testów rzeczywistych GLB, układu i LOD: bounds, UV/mapy, tekstury koloru identyczne bajtowo z oryginałami, podłogi nad terenem, otwory okienne, maska trawy, budżet geometrii/plików, wejścia, rozdzielenie nowych obiektów, przełączanie LOD i współdzielenie zasobów. Zastąpione tylko dekodowanie obrazów wymagające przeglądarki.
- Obejrzano dziewięć modeli i dodatkowe ujęcia `big2`/`large`, w tym wnętrza.
- Lista dostępnych przeglądarek aplikacji jest pusta: **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**.

Ręczny odbiór: uruchomić `npm run dev` z `E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades`, sprawdzić T01/T09/T14 oraz resztę obozu, skalę, podłogi, okna, brak trawy i migotania, dzień/noc i wydajność. Główny katalog jest nadal na innym branchu.
