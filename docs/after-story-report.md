# After: ostatnia noc — zadania pilota i stan prac

Data: 2026-10-11. Zadanie lokalne z rozmowy, bez nowego Issue online.
Branch: `feat/after-story`. Baza: `781294a` (`feat/after-design-core`).
Worktree: `E:\kodowanie\gra\.ai\worktrees\after-story`.
Plan: [After: ostatnia noc](after-last-night-2d-plan.md).
Poprzedni pakiet: [A-DESIGN/A-CORE](after-design-core-report.md).

## Co działa w symulacji

1. Amper albo Chlebak porusza się po małej mapie, wybiera legalny cel i zatwierdza interakcję.
2. Odnalezienie flagi kończy pierwsze zadanie; świadek pozostaje opcjonalną wskazówką.
3. Odnalezienie znajomego kończy drugie zadanie; radio i ślady nie stanowią obowiązkowych blokad.
4. Podłączenie kabla odblokowuje zasilanie. Nie można zużyć jednorazowej interakcji zasilania przed wykonaniem warunku.
5. Dwa lokalne sloty mogą wykonać czynności zagadki osobno; postęp i nagroda są wspólne. Solo robi je kolejno.
6. Po wszystkich trzech zadaniach następuje faza przed świtem. Powrót do obozu kończy pilota i zatrzymuje ruch/interakcje.
7. Wcześniejszy powrót nie kończy gry i nie odbiera możliwości późniejszego finału.

To funkcjonalności bezrenderowej sesji, **nie gotowy ekran gry**. Nie jest to jeszcze odbiór całego A-STORY ani zagadki kooperacyjnej w produkcyjnym multiplayerze.

## Pliki

| Plik w `src/games/after/`       | Zadanie                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `AfterCampaign.ts`              | Jedna fasada sesji pilota: ruch, pauza, wybór bohatera, interakcje, postęp i finał.      |
| `story/Conditions.ts`           | Interpretacja zamkniętych warunków `flag`, `quest-complete`, `all`, `any`; bez eval/LLM. |
| `story/QuestEngine.ts`          | Warunki dostępności celów, ukończenia zadań, jednorazowe nagrody, snapshot dziennika.    |
| `story/QuestEngine.test.ts`     | Testy warunków, kolejności zależności, deduplikacji i izolacji danych.                   |
| `AfterCampaign.test.ts`         | Testy całej trasy pilota z legalnym ruchem i dwóch lokalnych slotów.                     |
| `simulation/Interaction.ts`     | Ten sam selektor dla promptu i zatwierdzania komendy; uwzględnia warunki fabuły.         |
| `simulation/AfterSimulation.ts` | Opcjonalna polityka interakcji oraz fabularne przejście do fazy przed świtem.            |
| `data/pilotStory.ts`            | Walidacja obejmuje również referencje warunku finału.                                    |

Świat i questy mają oddzielnych właścicieli stanu pod jedną fasadą kampanii. Nie ma globalnego stanu dla każdego zadania ani osobnej pętli. Zwykłe flagi interakcji należą do symulacji, ukończenia i nagrody do silnika zadań. UI otrzymuje kopie obu części przez `snapshot()`.

## Weryfikacja

- `npx --no-install vitest run src/games/after`: 24/24.
- `npm run test:unit`: 1440/1440, 156 plików.
- `npm run typecheck`: OK.
- `npx --no-install eslint src/games/after --max-warnings 0`: OK.
- `npm run build`: OK; istniejące ostrzeżenie o dużym chunku festiwalu.
- `git diff --check`: OK.

Testy integracyjne nie zmieniają prywatnych pozycji i nie teleportują postaci. Wyznaczają trasę po siatce, wykonują wejścia ruchu i korzystają z promptów oraz komend. Cały finał przechodzi solo każdą pilotową postacią. Test dwóch slotów nie zastępuje testu dwóch przeglądarek/sieci.

Osobny przebieg autorskiego code review sprawdził:

- zgodność warunków promptu i komendy;
- brak podwójnego ukończenia/nagrody po retry;
- brak softlocka po przedwczesnym powrocie lub użyciu zasilania;
- przeliczanie zależności do stabilnego stanu niezależnie od kolejności definicji;
- izolację definicji i snapshotów;
- brak dołączania uczestnika/odpauzowania po finale;
- brak zmian w istniejącej grze 3D i assetach Gemini.

Po przeglądzie dodano blokadę dołączania po finale i test, walidację finału oraz indeks kroków według targetId, aby selekcja interakcji nie tworzyła tablic dla wszystkich questów przy każdym wywołaniu.

## Następne funkcjonalności, w kolejności

1. **A-STORY, dialogi:** trzy rozmowy pilotowe, wybór odpowiedzi, powtórzenie wskazówki, bezpieczne zamknięcie i walidacja grafu/wyjść. Aktualnie `witness`, `radio` i `tracks` zapisują tylko interakcję, nie wyświetlają rozmowy.
2. **A-STORY, relacje:** zamknięte efekty danych, ograniczone zaufanie, deduplikacja decyzji. Bez runtime generowania tekstu.
3. **SHARED-01:** wspólny GameHost/registry, leniwe ładowanie, jeden RAF i renderer, niezależne wejście After bez GLB festiwalu. Uzgodnić z właścicielem bijatyki; nie tworzyć dwóch hostów.
4. **A-VERTICAL:** dołączyć zaakceptowane assety Gemini, tilemapę, animację sprite'ów, kamerę, HUD i dziennik. Potem checkpoint/zapis i obsługa telefonu.
5. Odbiór rzeczywistego gameplayu i czasu przekroju, dopiero następnie A-COOP oraz kolejne strefy.

Nie tworzono zastępczych sprite'ów i nie zmieniano generowanych grafik. Brak zmian na GitHub, push/PR/merge. Obie gałęzie pozostają lokalnie; `feat/after-story` zawiera również pierwszy commit rdzenia.

Status: autorskie code review wykonane, oczekuje niezależnego review.
`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` — brak podpiętej prezentacji, menu i raportu przeglądarkowego. Nie odhaczono pełnego A-STORY ani A-VERTICAL jako ukończonych.
