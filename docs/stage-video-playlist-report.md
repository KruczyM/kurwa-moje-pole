# Telebimy: lokalne koncerty i krótki podgląd widowni

Wdrożone na `feat/festival-next`:

- Kolejka wszystkich 10 lokalnych MP4 z `public/game-assets/videos/stage/`, w porządku ich manifestu. Po ostatnim utworze wraca pierwszy.
- Jeden element video i jedna VideoTexture współdzielona przez oba istniejące telebimy. Nie dodano renderera ani pętli RAF. Ładowany jest aktualny plik, nie cały zestaw 649 MB.
- Od 30. do 33. sekundy oraz analogicznie od 60. do 63. sekundy itd. wyświetlany jest podgląd widowni spod dużej sceny przez istniejący render target. Dźwięk i czas filmu nie zatrzymują się; powrót nie restartuje utworu.
- Dźwięk tego samego elementu video jest podłączony do istniejącego `SpatialStageAcoustics`: cichy i przytłumiony z daleka, z opóźnionym pogłosem, kierunkowym stereo i wygładzaniem parametrów. Pozycja źródła pochodzi z aktualnej sceny Blendera.
- Autoplay zablokowany przez przeglądarkę jest ponawiany przy klawiszu/kliknięciu; uszkodzony plik przechodzi do następnego z limitem prób. Listenerów, tekstur i zasobów audio nie pozostawia się po zamknięciu gry.

Walidacja: 23 testy, TypeScript i lint przeszły. `scripts/verify-stage-video.py` potwierdził dekodowanie 960×540, oba ekrany z tą samą teksturą, przełączenie na widownię i powrót, następny utwór po zakończeniu oraz podłączony przestrzenny tor audio. Brak błędów JS. Dowód: `reports/stage-video/browser-report.json`.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN: odsłuch, orientacja obrazu i długi przebieg całej kolejki na urządzeniu użytkownika. Każdy klient ma lokalny odtwarzacz; synchronizacja czasów koncertu pomiędzy klientami nie została dodana. Nie pobierano ani nie publikowano nagrań; wykorzystano pliki dostarczone przez użytkownika.
