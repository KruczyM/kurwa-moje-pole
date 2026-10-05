# Ambona, Pień, Zawór — korekta barków

Zmiany lokalne na `feat/festival-next`, bez publikacji i merge.

- Pień i Zawór mają szkielety inne niż 22-kościowe szkielety robocze. Poprzednia korekta celowo je pomijała. Nowy, jawnie wybrany tryb `--legacy-shoulders` zwęża rozstaw punktów obrotu ramion do 85% i podnosi je o 2% wysokości. Łokcie i dłonie zachowują pozycje neutralne. Wagi rękawów dopasowano do poprawionego łańcucha. Profil 75% / 4,5% odrzucono jako zbyt mocny.
- Ambona: model ma opuszczone ręce, mimo poziomo ustawionego łańcucha kości. Dodano do pliku metadane korekty pozy o 30 stopni, odczytywane przez istniejący bank animacji tylko dla oznaczonego assetu. Bez zmian siatki, tekstur i wag; nie zastosowano maski T-pose do tej postaci.

## Weryfikacja

Obejrzano neutralną pozę, Idle i Run po rzeczywistym skinningu Three.js:

- przed: `reports/three-shoulders-before/grid.png`;
- Pień/Zawór: `reports/legacy-shoulders-candidate-v2/grid.png`, `reports/legacy-run-candidate/grid.png`;
- Ambona: `reports/ambona-pose-candidate/grid.png`, `reports/ambona-run-candidate/grid.png`.

120 testów przechodzi, w tym brak zmian w legacy rig bez jawnego opt-in oraz niezmienione ścieżki głowy i nóg przy korekcie Ambony. Binarny audyt Pnia i Zawora potwierdza zachowanie geometrii, tekstur i klipów obrotu. To korekta barków, nie deklaracja naprawy wszystkich szczegółów strojów: frędzle Zawora oraz płaszcz Pnia nadal wymagają osobnej oceny podczas pełnego ruchu.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` — rendery offline nie zastępują odbioru w działającej grze.

Odtworzenie: `npx tsx scripts/repair-character-weights.ts --legacy-shoulders` i `--ambona-pose`; opcja `--install` instaluje wygenerowane pliki. Kopie wejściowe w odpowiadających katalogach `reports/*/originals` są zachowywane.
