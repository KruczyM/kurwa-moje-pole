# Nawigacja NPC po obozie

## Grid świata

`NpcNavigationGrid` jest budowany raz po utworzeniu wszystkich colliderów `CampWorld`. Obejmuje cały kwadrat trawy i próbkuje teren co 0,75 m. Predykat świata otrzymuje promień 0,50 m, dlatego siatka uwzględnia kapsułę NPC oraz bezpieczny margines od:

- brył namiotów, ale nie ich linek i odciągów;
- stołu i krzeseł;
- masztu flagi;
- kabiny toi-toia.

Stałe `NPC_NAVIGATION_CELL_SIZE` i `NPC_NAVIGATION_RADIUS` znajdują się w `src/game/npc/NpcNavigationGrid.ts`.

## Wyznaczanie tras

1. Cel jest losowany wyłącznie ze zbioru przechodnich komórek, opcjonalnie w centralnej strefie powrotu.
2. A* porusza się w ośmiu kierunkach i blokuje przejścia po przekątnej pomiędzy dwoma zajętymi narożnikami.
3. Cel w colliderze zostaje przeniesiony do najbliższej przechodniej komórki.
4. Jeśli strefa jest odcięta, wyszukiwanie zwraca brak trasy, a NPC wybiera inny cel.
5. Gotowa trasa jest wygładzana przez testy line-of-sight wykonywane z pełnym promieniem NPC.

`NpcManager` wyznacza trasę przy wyborze celu lub po zmianie statycznych warunków. A* nie działa w każdej klatce. Kolizja z innym, ruchomym NPC tylko chwilowo wstrzymuje agenta; za płynne omijanie agentów odpowiada osobny etap steeringu.

## Diagnostyka wydajności

Grid udostępnia:

- `buildDurationMs` — koszt jednorazowego zbudowania siatki;
- `walkableCellCount` — liczbę dostępnych komórek;
- `lastSearch.durationMs` — koszt ostatniego A*;
- `lastSearch.expandedNodes` — liczbę rozwiniętych węzłów;
- liczbę waypointów przed i po wygładzeniu.

Testy pilnują, żeby wyszukiwanie nie rozwijało całej siatki i mieściło się w budżecie 100 ms nawet w środowisku testowym.
