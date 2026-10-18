# Wydanie interfejsu i muzyki Bongo Rush

Integracja siedmiu commitów `3d27842..67e20b2` na aktualnym `main` (`bcb64c1`).
Publikowane są bieżące źródła Bongo przez standardowe `tsc && vite build`.
Pakowanie historycznego snapshotu nie jest uruchamiane. Nie dołączono osobnego,
niewersjonowanego audytu ani zmian lokalnych innych gier.

Zakres obejmuje spójny interfejs Bongo bez oznaczenia AFTER, powroty do menu,
krzyżak z zachowaniem krótkich dotknięć, boczny odbiór spadających znajdziek,
drugą paczkę 21 utworów, niezależne wybory muzyki i znajdziek, zapis ustawień
sterowania, bezpieczne kadrowanie i czytelność natywnych list wyboru.
Przenikanie końca i początku muzyki trwa 0,8 s i korzysta z istniejącego
bufora/odtwarzacza oraz zegara audio. Pauza zachowuje pozycję.

Niezależny review źródeł i integracji: PASS. Potwierdzono identyczność patch-ID
siedmiu commitów, 210 testów review oraz SHA256 wszystkich 21 nowych MP3.
Serwer, bijatyka i menu festiwalu pozostają niezmienione. Współdzielona kamera
otrzymała opcjonalne marginesy, z zachowaniem wcześniejszego działania After
bez marginesów; objęto to testami regresyjnymi.

Walidacja lokalna: `ci:assets` i produkcyjny build czterech stron PASS.
`ci:code` PASS — 234 pliki, 2391 testów jednostkowych i 8 testów narzędzi.
Dwie pierwsze próby pełnego CI na Windows miały pojedynczy timeout 5 s
w istniejącym teście `CombatSpriteBank.test.ts:161`, odczytującym duże atlasy
bijatyki. Całe CI przeszło po ustawieniu `VITEST_MAX_WORKERS=2` dla tego
uruchomienia. Nie zmieniono testu, limitów ani konfiguracji repozytorium.
Przed scaleniem wymagane jest również zielone standardowe CI GitHuba.

`scripts/bongo-v6/verify-ui-release.py` sprawdza normalny build produkcyjny
bez diagnostyki: zapis/anulowanie ustawień, zachowanie postaci, krzyżak,
pauzę/wznowienie, powrót do menu i start poziomów 1/12/18/24. Obejmuje desktop,
WebKit/iPhone pion/poziom i mały ekran Chromium 320×480.
Raporty lokalne są w ignorowanym `reports/`.

Poprzednie raporty autora obejmują 40 kombinacji kadrowania i osiem przypadków
brzegowych Chromium/WebKit oraz techniczną granicę pętli wszystkich 38 utworów
obu paczek i menu. Nie są deklaracją odsłuchu muzycznego. Odsłuch przejść,
komfort i FPS na fizycznym telefonie pozostają `PENDING_HUMAN`.
