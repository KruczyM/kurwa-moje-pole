# Przegląd worktree — 2026-09-27

Aktywna gałąź: `feat/festival-next`, katalog `.ai/worktrees/festival-2026-tent-upgrades`.
Główny katalog `E:/kodowanie/gra` pozostaje: zawiera wspólne repozytorium Git, źródła Hunyuan i niezapisane zmiany. Nie należy go usuwać.

## Wyniki przeglądu

| Worktree | Decyzja o zmianach |
| --- | --- |
| issue-101-manual-workflow | Przeniesiono ręczny workflow, dokumentację, test i usunięcie starego orkiestratora. AGENTS.md pozostawiono bez zmian. |
| gra-issue-102, gra-issue-103 | Hashowanie i warianty Hunyuan są już w aktywnych plikach; nie nadpisywano ich starszymi wersjami. |
| issue-102-reference-review | Niedokończone lokalne zmiany zachowane w archiwum; wymagają integracji z aktualnym pipeline wariantów. |
| issue-24-use-animations, issue-96, issue-97 | Starsze implementacje animacji nie zastępują nowszego systemu. Lokalne zmiany issue-96 zabezpieczono osobno. |
| issue-29 | Historyczny multiplayer zachowany do osobnego review; nie uznano wszystkich zmian za zbędne. |
| issue-37 | Historyczny audyt zachowany do osobnego review; nie zastąpiono aktualnych walidatorów starym manifestem. |
| gra-issue-104 | Dashboard nie uwzględnia aktualnych katalogów wariantów; nie wdrożono jako gotowego narzędzia. |
| gra-issue-105 | Galeria udostępnia cały katalog repo przez HTTP; nie wdrożono. |
| gra-issue-106 | Walidacja stagingu nie odpowiada aktualnemu kontraktowi rigów; nie wdrożono. |
| gra-issue-107 | Brak osobnych commitów realizujących zadanie. |
| polandrock-festival | Pusty katalog. |

## Zabezpieczenie i usuwanie

Archiwum lokalne: `E:/kodowanie/gra/.ai/archive/worktrees-20260927/`.
Zawiera `history.bundle`, `removal-plan.json`, patche i kopie niezapisanych plików z sumami SHA-256. Utworzono lokalne gałęzie `archive/worktrees-20260927/*`; oryginalnych gałęzi nie usunięto. Zweryfikowano 559 obiektów we wspólnym magazynie LFS. Bundle nie zawiera ich danych — magazynu `.git/lfs` nie wolno usuwać.

13 dodatkowych worktree zajmuje około 9 GiB. Próba ich usunięcia została zablokowana przez środowisko wykonawcze: **katalogi nadal istnieją i miejsce nie zostało odzyskane**. Przed ręcznym usunięciem należy zatrzymać pracę agentów w tych katalogach oraz ponownie porównać HEAD, status i hashe z `removal-plan.json`. Używać mechanizmu `git worktree remove`, nie usuwać wspólnego `.git`. Archiwum pozwala odzyskać zapisane zmiany; zależności i dist można odtworzyć.

## Plan publikacji bez dodatkowych kosztów

1. Osobny commit porządkowania kodu i dokumentacji, bez modeli.
2. Po review osobne, logiczne partie ukończonych assetów: postacie główne, NPC, otoczenie. Nie publikować pośrednich wersji tych samych GLB.
3. Każdą partię testować i sprawdzać kompletność obiektów LFS przed publikacją; nie używać pomijania uploadu LFS.
4. Wyczerpanego limitu LFS nie omija podział na partie. Poczekać na reset odpowiedniego limitu; nie włączać płatnych przekroczeń. Nie potwierdzono rodzaju limitu ani daty resetu na koncie.

Nie wykonano push, PR ani merge. Pozostałe lokalne zmiany gry i modeli nie są automatycznie uznane za zatwierdzone przez ten audyt.
