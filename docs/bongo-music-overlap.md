# Bongo Rush — nakładanie końca i początku muzyki

Każdy dekodowany utwór obu paczek oraz muzyka menu otrzymują 0,8 s przenikania końca z początkiem. Początek utworu jest odtwarzany w całości przy pierwszym uruchomieniu; kolejne obiegi pomijają fragment już odtworzony w nakładce. Komplementarne obwiednie kosinusowe nie zwiększają amplitudy ponad amplitudy mieszanych próbek. Dla krótkich plików nakładka jest ograniczona do 1/4 długości.

Przygotowanie odbywa się raz po dekodowaniu w istniejącym buforze. Istniejący AudioBufferSourceNode realizuje dokładne zapętlenie na zegarze audio, niezależnie od RAF. Bez nowych timerów, odtwarzaczy i buforów w cache. Pozycja pauzy i podglądu uwzględnia krótszy obieg pętli.

Walidacja: testy deterministyczne stereofonii, obwiedni, granicy, krótkich plików, wielu obiegów i wznowienia. Chromium: wszystkie 38 różnych plików z obu paczek i menu zostało zdekodowanych oraz wyrenderowanych przez granicę pętli w OfflineAudioContext; końcowa próbka odpowiada początkowi kontynuowanej frazy. Rzeczywisty host ArcadeAudio sprawdzony pod kątem odtwarzania, pauzy, wznowienia i zwolnienia zasobów. Raport: reports/bongo-music-overlap/report.json. Powtórzenie: python scripts/bongo-v6/verify-music-overlap.py (serwer lokalny :5241).

Odsłuch wszystkich przejść i ocena zgodności rytmu/harmonii pozostają do wykonania przez człowieka. Nakładanie usuwa twarde cięcie, ale nie komponuje nowych fraz ani nie dopasowuje automatycznie tempa utworów.
