# Ręczny workflow zadań

Wyjątek od ochrony istniejących worktree: ich porządkowanie na wyraźne zlecenie użytkownika jest dopuszczalne po audycie i zabezpieczeniu zmian. Status bieżącego porządkowania: [raport 2026-09-27](worktree-consolidation-20260927.md).

## Zasada

Użytkownik wybiera Issue i wykonawcę ręcznie. Nie ma automatycznego pobierania ai-ready, uruchamiania modeli, tworzenia PR ani scalania. Każde zadanie ma dedykowany branch i worktree. Istniejące worktrees w .ai/worktrees pozostają bez zmian.

1. Przeczytać AGENTS.md, Issue i aktualny kod. Sprawdzić zależności: zmiany w cudzym worktree nie są automatycznie dostępne na main.
2. Uzgodnić bazę; pracować wyłącznie w gałęzi zadania. Nie przenosić niezatwierdzonych zmian między worktrees.
3. Wykonać ograniczony zakres, testy, build i stosowny odbiór wizualny. Brak narzędzia przeglądarkowego oznacza VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN.
4. Zostawić zmiany na gałęzi; przekazać raport. Bez push, PR, merge, automerge, zamykania Issue jako odebranego i aktualizacji online.
5. Codex przeprowadza końcowe code review w osobnym przebiegu po implementacji. Review sprawdza także zakres, testy, bezpieczeństwo plików, lifecycle i dowody odbioru. Nie jest samozatwierdzeniem autora.
6. Poprawki wracają do tej samej gałęzi. Dopiero po review użytkownik podejmuje osobną decyzję o integracji i publikacji.

## Raport przekazania

- Numer Issue, branch, pełny worktree i bazowy commit.
- Zmienione pliki i podsumowanie zachowania; stan commitów lub niecommitowanych zmian.
- Komendy testowe, ich wyniki, materiały do odbioru wizualnego.
- Braki, ryzyka, zależności od assetów/innych gałęzi oraz instrukcja uruchomienia.
- Jawnie: „nie scalono, nie opublikowano, oczekuje code review”.

## Kolejność zadań dla Gemini

Najpierw #102 (referencje powiązane z hashami), potem #103 (niezmienne warianty). #104 (panel tylko do odczytu) może zacząć od aktualnych plików kolejki, ale musi uzgodnić format z #103. Następnie #105 (galeria odbioru) oraz #106 (paczka do rigowania). #107 (mapa 2D) dopiero na bazie udostępnionego, uzgodnionego layoutu. Numery dotyczą KruczyM/kurwa-moje-pole.

Dobór opiera się na ograniczonym zakresie i testowalnych wynikach, nie obietnicy jakości konkretnej wersji modelu. Nie delegować na początek riggingu, deformacji, retargetingu ani wiernego modelowania architektury. Kontrola anatomii i zgodności z fotografią pozostaje odbiorem człowieka.

Kolejka Hunyuan jest osobnym narzędziem lokalnej generacji, nie usuwanym orkiestratorem agentów. Jej pliki mogą pozostawać w innym branchu lokalnym: przed realizacją #102–#106 ustalić właściwą bazę, zamiast tworzyć drugi pipeline. Nie uruchamiać GPU, masowej generacji ani pobierania wag bez zlecenia.

## Co pozostaje po usunięciu orkiestratora

Zwykłe CI i deployment na GitHub, walidatory assetów/rigów, testy gry, audyt źródeł NPC i Blender pozostają. Polecenia ci:code, ci:assets i build działają samodzielnie. Polecenia ai:* oraz test:ai usunięto; test:tools uruchamia niezależne testy narzędzi. Usunięte źródła orkiestratora można odzyskać z historii Git. Lokalnych logów, modeli, wag i worktrees nie kasujemy.
