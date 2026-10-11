# After: ostatnia noc — dialogi i relacje pilota

Data: 2026-10-11. Lokalny pakiet A-STORY zlecony w rozmowie, bez nowego Issue online.
Branch: `feat/after-dialogues`. Baza: `f641a83` (`feat/after-story`).
Worktree: `E:\kodowanie\gra\.ai\worktrees\after-dialogues`.
Plan: [After: ostatnia noc](after-last-night-2d-plan.md).
Poprzedni etap: [quest engine i finał](after-story-report.md).

## Dostarczone funkcjonalności

- Trzy polskie rozmowy: świadek, zagubiony znajomy i techniczny. Wskazówki, wybory odpowiedzi oraz pętle powtarzania tekstu z wyjściami.
- Rozmowa zaczyna się przez `AfterCampaign.interact()`, dopiero po istniejącej walidacji uczestnika, sekwencji, dystansu i widoczności.
- Ruch rozmawiającego zostaje wyzerowany; nowe wejścia ruchu i kolejne interakcje tej osoby są ignorowane do zamknięcia rozmowy. Pozostali uczestnicy nadal mogą się poruszać.
- `dialogue(slotId)` zwraca tekst, podpis rozmówcy i dostępne odpowiedzi. Nie ujawnia klientowi efektów ani następnych węzłów.
- `chooseDialogue(command)` sprawdza sesję, aktualną rozmowę, rewizję, świeżość sekwencji i warunki odpowiedzi ponownie przy zatwierdzeniu.
- `closeDialogue(slotId)` jest bezpiecznym API dla Escape/back: zamyka tylko rozmowę, nie otwiera pauzy i nie przyznaje nagród. Routing fizycznego klawisza będzie zadaniem hosta/UI.
- `repeatHint(slotId)` zwraca ostatni przeczytany tekst do dziennika — bez przycisków, tokenu rozmowy i ponownego wykonania efektów.
- Wspólne zaufanie NPC w przedziale od −3 do +3, jawne flagi fabularne oraz warunkowe odpowiedzi zależne od zaufania/questów/flag.
- Opcjonalne rozmowy nie blokują ukończenia pilota. Zamknięcie rozmowy ze znajomym bez wyboru nadal pozwala ukończyć jego odnalezienie.
- Finał zamyka również rozmowy pozostałych uczestników i uniemożliwia przyjęcie kolejnych odpowiedzi.

## Polityka decyzji i retry

Pierwsza zaakceptowana odpowiedź **z efektami** w danym węźle zapisuje wspólną decyzję `dialogueId/nodeId`. Ponowne przejście, retry lub sprzeczna odpowiedź innej osoby nie wykonują efektów drugi raz. Odpowiedź bez efektów oraz Escape nie zużywają decyzji. Wynik zatwierdzenia zawiera `effectsApplied`, aby przyszły interfejs nie sugerował ponownej zmiany zaufania.

W pilocie są to wyłącznie opcjonalne decyzje społeczne. Nie dodano głosowania krytycznych decyzji drużyny; ono pozostaje poza tym pakietem.

`sequence` odpowiedzi jest rosnąca dla slotu w osobnym kanale dialogowym. `conversationId` zmienia się przy ponownym otwarciu, a `revision` przy przejściu do kolejnego węzła, również w pętli. Stare odpowiedzi nie mogą zadziałać w nowej rozmowie.

To lokalny kontrakt, **nie uwierzytelnienie sieciowe**. Przyszły adapter serwera musi przypisać `slotId` do uwierzytelnionego połączenia; nie wolno ufać temu polu przesłanemu przez klienta.

## Pliki

| Plik w `src/games/after/`       | Odpowiedzialność                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `data/pilotDialogues.ts`        | Teksty, trzy grafy rozmów i rejestr społecznych flag pilota.                                   |
| `story/DialogueTypes.ts`        | Kontrakty treści, warunków, efektów, widoku, wskazówki i komendy odpowiedzi.                   |
| `story/DialogueEngine.ts`       | Właściciel rozmów, aktualnych rewizji, historii wskazówek i wspólnych decyzji.                 |
| `story/Relationships.ts`        | Mała ograniczona skala zaufania oraz izolowane snapshoty.                                      |
| `story/validateDialogues.ts`    | Referencje, legalne operacje, osiągalność węzłów i bezwarunkowe drogi wyjścia.                 |
| `story/DialogueEngine.test.ts`  | Grafy, retry, warunki, izolacja danych, wspólne decyzje i limity relacji.                      |
| `AfterCampaign.ts`              | Połączenie rozmów z istniejącym ruchem, pauzą, interakcją oraz finałem.                        |
| `AfterCampaign.test.ts`         | Test przebiegu kampanii, zatrzymania tylko właściciela rozmowy, pauzy i czyszczenia na finale. |
| `data/pilotMap.ts`              | Powtarzalne rozmowy ze świadkiem/znajomym i nowy punkt technicznego przy (14.5, 7.5).          |
| `simulation/AfterSimulation.ts` | Flaga pierwszej interakcji jest zapisywana także dla celów powtarzalnych, bez duplikatów.      |
| `simulation/WorldState.ts`      | Wersja contentu `pilot-2` i opis semantyki `once`.                                             |

`once` oznacza teraz wyłącznie zużycie celu. Każdy cel zapisuje jedną flagę pierwszej interakcji. Dzięki temu rozmowę można otworzyć ponownie bez utraty postępu questa. Wcześniejszy powrót do obozu nadal nie kończy gry: finał jest sprawdzany dopiero przy kolejnej faktycznej interakcji powrotu po zadaniach.

## Testy i autorski code review

- Testy After: **39**, obejmujące ruch, questy, rozmowy i integrację kampanii.
- `npm run test:unit`: **1455/1455**, 157 plików testowych.
- `npm run build`: OK; istniejące ostrzeżenie Vite o dużym chunku festiwalu.
- `npm run typecheck`: OK.
- `npx --no-install eslint src/games/after --max-warnings 0`: OK.
- `git diff --check`: OK.

W osobnym przebiegu po implementacji przejrzano granice stanu, pauzę, ruch, wybory, retry, grafy, cleanup i zakres. Poprawki z review:

1. Wskazówka dziennika nie zawiera już komend/wyborów z zakończonej rozmowy.
2. Walidator odrzuca również nieznane typy operacji, nawet jeżeli ich ID jest poprawne; test zabezpiecza tę regułę.
3. Komentarz kontraktu nie myli lokalnego slotu z uwierzytelnieniem sieciowym.
4. Test finału sprawdza aktywną rozmowę drugiego uczestnika i jej zamknięcie.
5. Granice zaufania walidatora korzystają z tych samych stałych co system relacji.

Walidator jest przeznaczony dla typowanych treści lokalnych. Nie jest kompletnym parserem niezaufanego JSON/save ani dowodem semantycznej osiągalności każdej warunkowej opcji. Sprawdza osiągalność grafu oraz bezwarunkową drogę wyjścia z każdego węzła.

Nie utworzono RAF, renderera, kontrolera wejść, listenerów DOM, zapytań sieciowych ani połączeń AI. Stan rozmów mieści się w sesji; maksymalnie czterech uczestników dopuszcza fasada kampanii. Nie ma blokady NPC zabierającej rozmówcę pozostałym — mogą rozmawiać równocześnie, a wspólne efekty są deduplikowane.

## Integracja i następna kolejność

1. **SHARED-01**: wspólny GameHost/registry i lazy-loading. Jeden właściciel hosta; nie tworzyć alternatywnej pętli dla After. Sprawdzić aktualną gałąź bijatyki przed rozpoczęciem.
2. **A-VERTICAL**: istniejące assety Gemini, tilemapa, sprite animator, kamera, dialog panel, HUD i dziennik. Używać zwykłego tekstu (`textContent`), nigdy HTML z treści dialogów.
3. Checkpoint/zapis z zachowaniem `social.flags`, `relations` i `appliedDecisions`; aktywnej rozmowy nie odtwarzać jako zablokowanego modala.
4. Przeglądarkowy odbiór solo/mobile, potem kooperacja sieciowa i głosowania krytycznych decyzji.

Podczas pracy wykryto gotową osobną gałąź Gemini `feat/after-art-assets` (odczytany HEAD `97e9555`). Nie kopiowano jej plików, nie cherry-pickowano i nie scalano; jej assety i testy nie wchodzą w podane 1455 testów tej gałęzi.

Uruchomienie testów z tego worktree: `npx --no-install vitest run src/games/after`.
Gra pozostaje bez podpiętej prezentacji — nie ma jeszcze widocznego panelu dialogów w przeglądarce.

Status: autorskie code review wykonane, **oczekuje niezależnego review**. Nie scalono, nie opublikowano; bez push/PR/merge.
`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` — silnik i dane przetestowane lokalnie, pełny gameplay/UI oraz cały A-STORY/A-VERTICAL nie są odebrane.
