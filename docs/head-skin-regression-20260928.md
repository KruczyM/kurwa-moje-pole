# Regresja twarzy po korekcie barków

## Przyczyna i zakres

Rozszerzenie obszaru korekty obojczyka objęło dolną część twarzy. Część żuchwy zaczęła podążać za tułowiem zamiast za głową. Wcześniejsze testy normalizacji wag i barków nie chroniły kształtu twarzy.

Dodano końcowy etap `repairDraftHeadSkin` do istniejącego narzędzia offline. Uwzględnia wysokość względem kości Head, szerokość oraz głębokość: sama wysokość wybierała także powierzchnię barku, więc taką próbę odrzucono. Rdzeń twarzy i górna część głowy otrzymują sztywny wpływ Head, z przejściem na obrzeżach. To nie jest nowa pętla ani korekta wykonywana co klatkę.

Przebudowano 57 plików z istniejącej jawnej listy `shoulderRepairAssets`, zawsze z niezmiennych kopii. Nie zmieniano pozostałych 41 NPC ani autorskich rigów Mixamo. Nie oznacza to, że wszystkie postacie gry są już wizualnie zaakceptowane.

## Weryfikacja

- 57 nowych testów sprawdza brak wpływów obcych kości w rdzeniu twarzy oraz zgodność położenia próbkowanych punktów ze sztywnym ruchem Head w Idle/Walk/Run, w trzech chwilach każdego klipu.
- Łącznie 176 testów ochrony twarzy, szkieletu, ramion i Klątwy przeszło.
- Weryfikator wszystkich 57 GLB potwierdził zachowanie geometrii, obrazów i rotacji klipów.
- Obejrzano zbiorczy render aktualnych kandydatów w Three.js: `reports/head-depth-review/grid.png`.
- Szczegółowe rendery teksturowane: `reports/korba-face-depth`, `reports/chlebak-face-depth`, `reports/szerszen-face-depth-final`. Warianty z szerszą maską w pozostałych folderach są odrzuconymi próbami, nie plikami gry.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN — test wybranych punktów i rendery klatek nie stanowią pełnego odbioru każdego modelu we wszystkich animacjach. Potrzebna jest dalsza ocena włosów, rekwizytów i ubrań pozostałych NPC. Bez push/merge.
