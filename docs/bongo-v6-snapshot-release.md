# Wydanie zaakceptowanego podglądu Bongo v6

Wydanie publikuje historyczny build v6 z gałęzi `preview/bongo-v6-after-characters`,
commit `428523d`, z wyłączonymi dekoracyjnymi komorami i bezpośrednim wyborem poziomu.
Zachowuje ilustrowane postacie, animację zależną od dystansu, 24 plansze,
grywalne komory teleportów oraz zasady odblokowania. Nie zawiera niedokończonych
trzech szat ani lokalnych zmian Audio/Music/main ze źródłowego worktree.

## Trwałe pakowanie

`npm run build` najpierw kompiluje aktualny festiwal i pozostałe gry przez Vite,
a następnie uruchamia `scripts/package-bongo-snapshot.mjs`.
Ten krok sprawdza SHA256 wszystkich 262 oryginalnych plików archiwum oraz
trzech zaakceptowanych plików pochodnych. Brak pliku, wskaźnik LFS zamiast
obrazu albo zmienione bajty przerywają wydanie.

Spakowany Bongo zajmuje prywatny katalog `dist/bongo-v6/`; nie nadpisuje
wspólnych grafik, modułów ani kodu innych gier. Root `dist/bongo-rush.html`
wskazuje względnie na moduł z hashem treści. Jedyna zmiana bundla podczas
pakowania to wyliczenie katalogu grafik względem adresu modułu. Importy,
preloady i CSS korzystają z prywatnego katalogu. Nawigacja do festiwalu
i After pozostaje na dotychczasowych względnych adresach.
`dist/bongo-v6/release-manifest.json` opisuje końcowy HTML i wszystkie
261 plików wydania. Kolejne uruchomienia standardowego builda zachowują v6.

Archiwum pozostaje bajtowo nienaruszone w `historical-preview/`.
Źródłowego etapu v6 nie zapisano w osobnym commicie: bieżące `src/games/bongo-rush`
pochodzą z v5 i nie opisują opublikowanej wersji. Serwer Vite w trybie dev nadal
uruchamia te źródła. Do sprawdzania wydania używaj `npm run build` i
`npm run preview`, a przed dalszym rozwijaniem mechanik odzyskaj źródła v6
lub jawnie odtwórz je w osobnym zadaniu. Nie usuwaj kroku pakowania,
gdyż przywróciłoby to v5 na Pages.

## Walidacja

Niezależny review archiwum i integracji: PASS. Oba pochodne bundle odtworzono
niezależnie z oryginału; dane rozgrywki pozostały identyczne. Kod i zasoby
pozostałych gier są niezmienione względem `f98dac7`.
Testy pakowania sprawdzają izolację plików festiwalu, powtarzalność wydania,
zgodność hashy i odrzucanie nieoczekiwanej stałej adresu.

`scripts/historical-preview/verify-release.py` sprawdza gotowe wydanie poprzez
rzeczywiste wejścia UI i klawiatury w Chromium oraz WebKit/iPhone w pionie
i poziomie. W każdym profilu poziomy 2, 18 i 20 kończą się WON;
poziom 18 przechodzi przez obie komory i wraca. Sprawdzono pauzę, restart,
powrót z wyniku i finału do wyboru poziomów, osobną zmianę postaci oraz
21 zablokowanych poziomów przy zapisie odblokowującym pierwsze trzy.
Diagnostyka jest dostępna wyłącznie z `?verify`; zwraca kopię świata,
a próba zmiany kopii nie modyfikuje symulacji. Bez parametru nie jest dostępna.
Nie dodano drugiej pętli renderowania, kontrolera ani loadera.

Starsze raporty pełnych 24 tras opisują historyczny odbiór v6, nie nowe
uruchomienie wszystkich plansz podczas tej integracji. Nowe raporty są
w ignorowanym `reports/bongo-v6-release/`. Fizyczny telefon, odsłuch
i subiektywna ocena pozostają `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
Emulowany WebKit nie jest potwierdzeniem FPS na fizycznym urządzeniu.
