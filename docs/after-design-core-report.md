# After: ostatnia noc — A-DESIGN / A-CORE

Data: 2026-10-11. Zadanie lokalne zlecone w rozmowie, bez przypisanego numeru GitHub Issue.
Plan: [pełna specyfikacja](after-last-night-2d-plan.md).
Branch: `feat/after-design-core`. Baza: `cb14703`.
Worktree: `E:\kodowanie\gra\.ai\worktrees\after-design-core`.

## Dostarczony zakres

- Symulacja bez DOM, Three.js, sieci i assetów. Host będzie wywoływać `advance(deltaSeconds)` z własnego, pojedynczego RAF.
- Stałe 30 Hz, współczynnik interpolacji, ograniczenie nadrabiania po ukryciu karty.
- Ruch ośmiokierunkowy, równa prędkość diagonalna, sprint, kondycja i spowolnienie noszenia.
- Kolizja stóp na siatce, podkroki zapobiegające przenikaniu, przesuwanie wzdłuż ścian.
- Interakcje: zasięg, widoczność przez siatkę, priorytet/dystans, deduplikacja komend i wspólnych jednorazowych zdarzeń.
- Pauza lokalna usuwa stare wejścia; snapshoty nie pozwalają prezentacji zmieniać sesji.
- Mała mapa pilota z czterema spawnami i ośmioma punktami interakcji.
- Trzy definicje zadań: odzyskanie flagi, odnalezienie znajomego, przywrócenie światła. Powrót do obozu po wszystkich zadaniach stanowi finał.
- Zamknięty format warunków, walidacja referencji oraz cykli zależności zadań.

Mapa jest adaptacją testową, nie eksportem układu 3D. Współrzędne są w metrach; siatka ma 24 × 18 pól po 1 m. Obecnie nie ma warstw graficznych ani portali. Linki namiotu nie tworzą kolizji.

## Pliki

| Plik w `src/games/after/`            | Odpowiedzialność                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `simulation/WorldState.ts`           | Wersje, typy świata, uczestników, mapy, wejść i zdarzeń. To minimalny kontrakt pierwszego pakietu, nie pełny schemat zapisu/sieci. |
| `simulation/AfterSimulation.ts`      | Jedyny właściciel stanu sesji, stałe kroki, ruch, pauza, komendy i snapshoty.                                                      |
| `simulation/Collision.ts`            | Siatka kolizji, ruch ze ślizganiem oraz walidacja mapy.                                                                            |
| `simulation/Interaction.ts`          | Przejście promienia przez komórki siatki i wybór legalnego celu.                                                                   |
| `data/pilotMap.ts`                   | Fabryka niezależnych kopii mapy pilota.                                                                                            |
| `data/pilotStory.ts`                 | Bohaterowie pilotowi Amper/Chlebak, trzy zadania, warunek finału i walidator danych.                                               |
| `simulation/AfterSimulation.test.ts` | Deterministyczne testy rdzenia i referencji fabuły.                                                                                |

## Testy i osobny przebieg code review

Wyniki lokalne:

- `npx --no-install vitest run src/games/after`: 15/15.
- `npm run test:unit`: 1431/1431, 154 pliki testowe.
- `npm run typecheck`: OK.
- `npx --no-install eslint src/games/after --max-warnings 0`: OK.
- `git diff --check`: OK.
- `npm run build`: OK; istniejące ostrzeżenie Vite o dużym głównym chunku.

Po implementacji przeprowadzono osobny przegląd granic danych, pauzy, lifecycle, kolizji, retry i zależności. Poprawiono migotanie sprintu przy wyczerpaniu (regeneracja do 25 przed ponownym sprintem), przepuszczanie interakcji przez narożniki (przejście komórek zamiast próbkowania) oraz nieograniczone/non-finite przemieszczenia. Dodano test narożników i końca promienia na granicy komórek.

Brak nowego RAF, rendererów, listenerów, pobierania GLB lub wywołań AI. Nie zmieniono assetów Gemini, festiwalu 3D, głównego menu ani cudzych worktrees. Kopię pełnego planu zachowano w tym branchu; źródłowy, nieśledzony dokument pozostał nietknięty.

## Ograniczenia i następna kolejność

1. A-STORY: wykonanie warunków/questów, dialogi i relacje. Definicje `requires` w tym pakiecie są danymi — rdzeń nie wykonuje jeszcze fabuły.
2. SHARED-01: jeden wspólny host, lazy-loading, routing wejść i lifecycle. Integracja z menu dopiero po uzgodnieniu kontraktu hosta.
3. A-VERTICAL: grafika Gemini, HUD, pierwszy grywalny przekrój i zapis.
4. Dopiero później A-COOP, kolejne strefy i zdarzenia.

Nie ukończono ekwipunku, wspólnego noszenia, checkpoint/save, portali, online ani całego A-CORE z listy docelowej. `recoverPlayer` jest zabezpieczeniem pozycji, nie pełnym systemem checkpointów. Seed jest przechowywany; losowy reżyser zdarzeń jeszcze nie istnieje. Walidatory przyjmują typowane dane lokalne, nie stanowią walidatora niezaufanych payloadów sieciowych.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: rdzeń nie jest jeszcze podpięty do prezentacji. Nie ma podstaw do deklaracji gotowego gameplayu ani 10–15 minut rozgrywki.

Status: autorski code review wykonany; oczekuje niezależnego review. Nie scalono, nie opublikowano, bez push/PR.
