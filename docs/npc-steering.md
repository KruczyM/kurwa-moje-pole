# Steering i omijanie NPC

NpcManager prowadzi NPC po trasach A*, natomiast NpcSteering.ts odpowiada za krótkoterminowe korekty ruchu pomiędzy waypointami. Dzięki temu pełna trasa nie jest liczona ponownie przy każdym spotkaniu z postacią.

## Kolejność priorytetów

1. Granice pola i statyczne collidery sprawdzane przez NpcNavigationGrid.canStandAt().
2. Inni NPC oraz gracz, reprezentowani przez poziome pozycje, prędkości i promienie.
3. Kierunek bieżącego waypointu.

Steering sonduje kilka punktów na odcinku przed NPC. Jeśli kierunek jest zablokowany, sprawdza wachlarz kierunków po obu stronach i wybiera przechodni wariant najbliższy trasie. Następnie przewiduje położenie sąsiadów w krótkim horyzoncie czasu i dodaje separację. Przy spotkaniu czołowym obie postacie wybierają własną prawą stronę.

## Płynność

- maximumTurnRate ogranicza zmianę kąta na sekundę, zamiast natychmiast obracać model.
- speedScale łagodnie zmniejsza docelową prędkość przed innym agentem.
- Minimalna prędkość omijania pozostaje powyżej progu Idle, dlatego krótkie spotkanie nie przełącza szybko Walk/Idle.
- Steering korzysta ze wspólnego snapshotu pozycji z początku klatki, więc wynik nie zależy od kolejności aktualizowania NPC.

Najważniejsze parametry znajdują się w NPC_STEERING w pliku src/game/npc/NpcSteering.ts. Pełna zmiana trasy nadal należy do A*; steering wykonuje jedynie tanie, lokalne próby kierunku.
