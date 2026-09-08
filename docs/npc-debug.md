# Diagnostyczny overlay AI NPC i test sesji długoterminowej (Soak Test)

Pakiet diagnostyczny zaimplementowany w `NpcDebugOverlay.ts` oraz `NpcSoakSession.test.ts` umożliwia inspekcję stanu agentów NPC w czasie rzeczywistym oraz gwarantuje stabilność wieloagentowej symulacji AI podczas długich sesji gry.

## Aktywacja i uprawnienia

Overlay diagnostyczny jest domyślnie izolowany od wersji produkcyjnej, aby nie obciążać renderera ani interfejsu gracza:

- **Środowisko deweloperskie**: automatycznie aktywny przy uruchomieniu z Vite (`import.meta.env.DEV`).
- **Parametr URL**: aktywacja opcjonalna w dowolnym środowisku za pomocą query stringa `?debugNpc=1`.
- **Przełączanie widoczności**: naciśnięcie klawisza **F2** włącza lub wyłącza widoczność nakładki diagnostycznej.

## Warstwy diagnostyczne

Overlay składa się z warstw 3D w scenie Three.js oraz rzutowanych na ekran elementów interfejsu 2D:

1. **Collidery świata (`showColliders`)**
   - Wizualizacja geometrii przeszkód (`THREE.LineSegments`): okręgi przeszkód cylindrycznych oraz ramki prostopadłościennych brył kolizyjnych (namioty, budynki, głazy).
2. **Siatka nawigacyjna (`showGrid`)**
   - Punkty węzłowe oraz granice komórek przechodnich siatki nawigacji `NpcNavigationGrid`.
3. **Ścieżki tras waypointów (`showPaths`)**
   - Kolorowe łamane linie 3D reprezentujące aktualnie wyznaczone trasy A* agentów. Każdy z 8 NPC ma przypisany unikalny, rozpoznawalny kolor (cyan, magenta, żółty, zielony, pomarańczowy, jasnoniebieski, koralowy, fioletowy).
4. **Markery celów (`showTargets`)**
   - Pionowe słupki i okręgi wskazujące cel podróży danego agenta oraz dopuszczalny promień dotarcia (`arrivalThreshold`).
5. **Etykiety informacyjne 2D nad NPC (`showLabels`)**
   - Etykiety rzutowane w układzie współrzędnych kamery na pozycję głowy agenta.
   - Prezentują:
     - Imię NPC i aktualny stan behawioralny (`wander`, `idle`, `social`, `scared`, `run-home`),
     - Aktywny klip animacji i znormalizowany czas trwania klatki (`normTime`),
     - Prędkość poruszania się w m/s,
     - Czas bez postępu (`stuck time`).
6. **Panel telemetryczny HUD (`showMetrics`)**
   - Półprzezroczysty panel w lewym górnym rogu ekranu prezentujący zbiorcze statystyki:
     - Całkowitą liczbę przeliczeń tras (`repaths`),
     - Całkowitą liczbę zmian stanów behawioralnych (`state transitions`),
     - Całkowitą liczbę interwencji systemu naprawczego (`recoveries`),
     - Tabelaryczne zestawienie parametrów każdego agenta.

## Długoterminowy test sesji AI (30-minutowy Soak Test)

Plik `src/game/npc/NpcSoakSession.test.ts` implementuje symulację wirtualną odpowiadającą 30 minutom ciągłej rozgrywki:

- **Parametry symulacji**:
  - Czas trwania: 1800 sekund (30 minut).
  - Krok czasowy `dt`: 0,1 s (łącznie 18 000 kroków symulacji).
  - Agenci: kompletna populacja 8 NPC działających równolegle w zróżnicowanych rolach i stanach behawioralnych.
  - Środowisko: pełna siatka nawigacji z przeszkodami kolizyjnymi obozu.
- **Kryteria walidacji**:
  1. **Brak trwałego utknięcia**: żaden agent nie może utknąć na czas powyżej progu krytycznego (`timeWithoutProgress < 10 s`).
  2. **Brak zapętlenia decyzji (flapping)**: wskaźnik zmian stanów na minutę pozostaje w bezpiecznym zakresie (brak lawinowych przejść stanów w nieskończonych pętlach).
  3. **Równomierna eksploracja terenu**: każdy z 8 agentów w trakcie 30 minut dociera do co najmniej 3 różnych ćwiartek/sektorów mapy obozu.
  4. **Weryfikacja systemu detekcji**: test kontrolny ze sztucznie uwięzionym agentem potwierdza natychmiastowe wykrycie anomalii przez watchdog i odpalenie stopniowanego odzyskiwania.
- **Wydajność wykonania**:
  - Całość 30-minutowej symulacji (18 000 kroków dla 8 agentów) wykonuje się w środowisku testowym Vitest w około 1 sekundę dzięki headless symulacji bez narzutu renderowania grafiki.
