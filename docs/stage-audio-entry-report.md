# Wyciszenie sceny przed wejściem

Scena ma głośność 0 w stanach `start`, `loading` i `error`. Dopiero przejście do świata przywraca zapisaną głośność otoczenia i aktualizuje akustykę dla pozycji gracza. Zmiana ustawień w menu/ładowaniu nie omija wyciszenia. Telebimy mogą dalej odtwarzać wideo; nie zmieniono czasu playlisty ani ustawień zapisanych przez użytkownika. Menu wewnątrz świata nie zatrzymuje koncertu.

Weryfikacja: 29 testów polityki stanów, maszyny stanów i akustyki PASS; typecheck PASS. Chromium: podczas ładowania głośność i master gain wynosiły 0; po wejściu głośność wróciła do ustawionych 0.35. Wideo dekodowane, przełączanie utworów i ujęć działa, brak page errors. Szczegóły: `reports/stage-video/browser-report.json`. Brak push/merge.
