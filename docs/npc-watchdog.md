# Watchdog utknięcia i ochrona przed zapętleniem decyzji NPC

Plik `NpcStuckWatchdog.ts` zabezpiecza agentów NPC przed trwałym zablokowaniem w terenie, oscylacjami waypointów oraz zapętleniami decyzyjnymi. Każdy NPC posiada dedykowaną instancję watchdoga, która stale mierzy postęp wzdłuż trasy i w razie potrzeby uruchamia procedurę stopniowanego odzyskiwania (*graded recovery*).

## Monitorowane zjawiska

1. **Brak postępu (`no_movement`)**
   - Podczas aktywnej podróży (`travelling === true`) mierzony jest dystans pokonany od ostatniej pozycji referencyjnej.
   - Jeśli agent przemieści się o mniej niż 0,25 m w ciągu 2,0 s (`noMovementLimitSeconds`), watchdog kwalifikuje to jako fizyczne utknięcie (np. napotkanie przeszkody, zablokowanie przez innego agenta).
   - W stanie zamierzonego `idle` licznik braku postępu jest zerowany i nie generuje fałszywych alarmów.

2. **Oscylacja waypointów (`waypoint_oscillation`)**
   - Rejestrowana jest historia punktów trasy i celów.
   - Jeśli agent naprzemiennie wybiera dwa bliskie sobie waypointy (A ↔ B) w oknie 3,5 s, watchdog przerywa oscylację i wymusza ponowne wyznaczenie trasy (`repath`) lub nowy cel.

3. **Lawina zmian stanu (`decision_loop`)**
   - Śledzona jest częstotliwość zmian stanów behawioralnych.
   - Zarejestrowanie 4 lub więcej przejść stanów w oknie 2,5 s świadczy o zapętleniu decyzji schedulera (tzw. flapping). Watchdog natychmiast wymusza wybór nowego, osiągalnego celu (`new_target`).

4. **Przekroczenie limitu czasu w stanie (`state_timeout`)**
   - Jeśli podróż w stanie `wander` lub `run-home` trwa dłużej niż 25,0 s bez dotarcia do celu, zadanie zostaje uznane za nieosiągalne i anulowane.

## Stopniowane odzyskiwanie (Graded Recovery)

Procedura odzyskiwania eskaluje w czterech poziomach:
- **Poziom 1: `steer_nudge`** — boczny impuls kierunkowy prostopadły do obecnego steeringu oraz wyczyszczenie blokady kolizyjnej, pozwalające ominąć lokalną przeszkodę;
- **Poziom 2: `repath`** — ponowne wyznaczenie ścieżki A* z bieżącej pozycji do tego samego celu;
- **Poziom 3: `new_target`** — porzucenie aktualnego celu i wylosowanie nowego osiągalnego punktu w innym sektorze mapy;
- **Poziom 4: `teleport`** — awaryjny fallback development: natychmiastowe przeniesienie agenta na bezpieczny, przejezdny punkt w strefie obozu wraz z zapisem pozycji i przyczyny w logach.

Po wykonaniu przez agenta trwałego, stabilnego ruchu o dystansie przekraczającym 1,5 m stopień eskalacji recovery wraca automatycznie do poziomu początkowego.

## Integralność animacji i telemetria

- Akcje naprawcze nie wywołują `animator.reset()`. Zmiana kierunku, przeliczenie trasy ani wybór nowego celu nie resetują aktywnego miksera i nie powodują rwania klatek ani T-pose.
- Każda interwencja emituje ustrukturyzowany wpis w logu podający: nazwę NPC, aktualną pozycję (x, y, z), stan, cel, powód oraz zastosowaną akcję.
- Instancja watchdoga udostępnia metryki (`timeWithoutProgress`, `repathCount`, `stateTransitionCount`, `recoveryCount`) wykorzystywane przez overlay diagnostyczny (#21).

