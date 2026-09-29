# Przegląd wszystkich postaci — 28.09.2026

## Pierwsza partia napraw NPC — rekwizyty

Zainstalowano poprawione wagi `034_cosplay_festival_hero` (tabliczka) i `042_heavy_metal_banger` (rekwizyt w dłoni). Dodatki podążają sztywno za prawą dłonią zamiast częściowo za głową. Nie oznacza to zakończenia poprawek całych postaci: włosy i pozostałe obszary nadal wymagają kontroli.

Porównanie neutralnej pozy i rzeczywistego skinningu Three.js Idle: `reports/npc-prop-candidate-v2/grid.png`. Wersja `npc-prop-candidate` została odrzucona: pomijała wewnętrzną krawędź tabliczki. Test regresji obejmuje tę krawędź oraz zachowanie rekwizytów podczas Idle, Walk i Run. Kopie wejściowe: `reports/npc-prop-repair-20260928/originals`. Skrypt: `npx tsx scripts/repair-character-weights.ts --props` (kandydat), opcjonalnie `--install` (instalacja).

Status sprawdzenia w działającej grze: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Pozostałe pozycje poniższej listy nie są jeszcze naprawione.

## Zakres i ograniczenia

### Kolejna poprawka: głowa NPC 042

Walidacja tej partii: oba testy rekwizytów/głowy przechodzą również na zainstalowanych plikach. Pełny build obecnego worktree zablokowany przez błędy w `Game.ts` i `CampWorld.ts`: brak `toiToiDoors`/`showerTriggers` w `FestivalInfrastructureInstance` oraz niezgodny typ kolizji `Box3`. Nie zmieniano tych systemów w ramach tej partii.

Usunięto wpływ barków i ramion na krótką fryzurę `042_heavy_metal_banger`. Granica 1,78 m pozostawiała dolne loki rozciągnięte; odrzucono tę próbę. Finalny zmierzony zakres powyżej 1,70 m, w centralnej części modelu, zachowuje włosy przy głowie i nie obejmuje rekwizytu. Render neutralny/Idle po skinningu Three.js: `reports/npc-head-prop-candidate-v3/grid.png`. Drobne luźne fragmenty fryzury występują już w neutralnej siatce i nie zostały usunięte.

W trybie `--props` ochrona głowy jest wykonywana przed maską rekwizytów (kolejność zapobiega przypisaniu wysokiej tabliczki do głowy). Dodano kontrolę punktów fryzury podczas Idle/Walk/Run. Sprawdzono binarnie oba pliki: zmieniły się wyłącznie indeksy kości i wagi, geometria oraz tekstury są niezmienione. Pozostałe modele nadal wymagają dalszych indywidualnych poprawek. `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

Obejrzano 109 wpisów: 16 postaci głównych, 91 NPC oraz osobne pliki podglądu Ampera i Klątwy. Dla każdego porównano neutralną geometrię i klatkę Idle (0,4 s) po rzeczywistym skinningu Three.js z bankiem animacji. Siedem tablic, 218 ujęć górnej części ciała: `reports/all-models-review-20260928/page-0` … `page-6`. Ostre krawędzie dolnego przekroju na tablicach wynikają z celowego odcięcia nóg, nie z uszkodzenia modelu.

To przesiewowy przegląd wszystkich modeli, nie akceptacja wszystkich animacji. Twarzy zasłoniętych maską, hełmem, włosami albo kapturem nie można wiarygodnie ocenić z tego widoku. Brak wpisu wśród problemów poniżej oznacza brak oczywistej nowej usterki w sprawdzonym ujęciu, nie gwarancję jakości.

## Zmiany wykonane teraz

Hemoroid i Chlebak: wcześniejsza maska głębokości pomijała płaskie boczne powierzchnie głowy. Dopasowano osobny, zakrzywiony zakres żuchwy; obszar ochrony podnosi się w stronę boków, żeby nie wiązać barków z głową. Próbę poziomej, szerokiej granicy odrzucono, ponieważ podnosiła barki.

Zaktualizowano tylko ich dwa `npc-animations.glb`, z kopii sprzed poprawek. Nie zmieniano neutralnej siatki ani tekstur. Test obejmuje teraz również boki głowy, a nie wyłącznie wypukły przód twarzy. Obejrzano teksturowany Hemoroid Idle oraz Chlebak Idle/Run z boku. Finalne rendery: `reports/hemoroid-jaw-profile`, `reports/chlebak-jaw-profile`; wcześniejsze `full-face` to odrzucona próba o zbyt szerokim zakresie.

## Postacie główne

- Hemoroid, Chlebak: poprawione w tej iteracji; potrzebny odbiór w grze.
- Antena, Pień, Zawór: do dokładniejszej oceny szerokiego przejścia bark–tułów; Zawór dodatkowo ma frędzle wymagające własnych wag.
- Dziąsło: włosy i dodatki zasłaniają barki; konieczne widoki boczne i ruch głowy.
- Ambona: inna poza źródłowa; nie stosować automatycznej korekty T-pose.
- Amper, Gruczoł, Klątwa, Krwiak, Pierścień, Jęczmień, Kobra, Korba, Szerszeń: nie stwierdzono nowego dużego załamania twarzy w tablicy Idle; pozostaje odbiór całego ruchu. Osobne podglądy Ampera i Klątwy również obejrzano.

## NPC — wyniki wymagające dalszej pracy

Numery oznaczają prefiksy plików w `public/game-assets/npc_models`.

| Priorytet / obszar | Modele | Obserwacja i następny krok |
| --- | --- | --- |
| Wysoki: rekwizyty | 024, 034, 042, 078, 080 | Instrumenty, tablica lub inne dodatki zmieniają kształt przy opuszczaniu rąk. Oddzielić wagi rekwizytu od tułowia; nie naprawiać maską twarzy. |
| Wysoki: inna poza / kostium | 023, 027, 052, 070, 075 | Poza asymetryczna lub duże dodatki; potrzebne indywidualne wiązanie i sprawdzenie źródła. |
| Głowa / włosy / kapelusz przy barkach | 003, 004, 008, 011, 015, 021, 035, 036, 039, 046, 047, 055, 059, 060, 061, 064, 071, 073, 082 | Widoczna zmiana obrysu włosów, brody, ronda albo ich połączenia z barkiem. Sprawdzić boki głowy i przypisanie do Head zamiast Arm. |
| Brody i gęste włosy — widok zasłonięty | 001, 002, 005, 010, 014, 016, 020, 025, 028, 031, 032, 037, 043, 053, 054, 057, 068, 079, 083, 087, 089 | Twarz/barki częściowo ukryte. Potrzebne ujęcia boczne i izolacja wag; nie uznano za poprawne tylko na podstawie frontu. |
| Barki / rękawy do zbliżenia | 007, 018, 026, 033, 048, 050, 058, 065, 066 | Nietypowy obrys przy opuszczeniu ramion, grube rękawy lub kostium; sprawdzić pozę wiązania i położenie stawu przed zmianą wag. |
| Kostiumy zasłaniające anatomię | 019, 040, 062, 076, 081, 084, dino | Nie oceniać ludzką maską twarzy. Sprawdzić sztywność maski/hoodu/hełmu jako osobny przypadek. |

Pozostałe NPC obejrzane bez oczywistego dużego załamania w tej klatce: 006, 009, 012, 013, 017, 022, 029, 030, 038, 041, 044, 045, 049, 051, 056, 063, 067, 069, 072, 074, 077, 085, 086, 088, 090. Również dla nich potrzebne są testy całych animacji i widoki z kilku stron.

## Walidacja

176 testów ochrony twarzy, barków, szkieletu i Klątwy przeszło, w tym rozszerzony zakres boków twarzy Hemoroida/Chlebaka. Build przeszedł. Nie wykonano push ani merge.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN. Dalsze problemy z raportu pozostają do naprawy; przegląd nie oznacza ich automatycznego usunięcia.
