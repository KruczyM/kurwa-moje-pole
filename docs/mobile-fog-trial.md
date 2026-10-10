# Wariant próbny: mgła 15 m i sektorowy świat

Gałąź: `feat/mobile-fog-trial`, worktree: `.ai/worktrees/mobile-rollback`.
Zmiany zawierają również wcześniejsze cofnięcie pogarszającej wygląd optymalizacji.
Nie zmieniają `main` ani wersji online.

## Uruchomienie

W tym worktree uruchom `npm run dev`. Na telefonie wariant włącza się automatycznie
po wybraniu postaci. Na komputerze dopisz `?fogTrial=1` do adresu gry.
`?fogTrial=0` przywraca zwykły, pełny świat po odświeżeniu strony.
Z istniejącym query string użyj `&fogTrial=1` zamiast `?`.

## Co zmieniono

- Mgła zaczyna się na 9 m, na 15 m jest pełna; kamera kończy rysowanie na 15 m.
  Tło pasuje do koloru mgły, bez pobierania niewidocznej cubemapy i panoramy.
- 207 sektorów, nominalna komórka 16 m. Odległość jest liczona od granicy sektora,
  a nie jego środka, więc duże obiekty nie znikają za wcześnie.
- Jedno ładowanie sektora naraz: doczytywanie do 18 m, wyświetlanie do 15 m,
  usuwanie powyżej 26 m. Mały bufor ogranicza ciągłe pobieranie na granicy sektorów.
  Przy starcie wczytywane są sektory do 17 m przed wpuszczeniem gracza do świata.
- Usuwane są wpisy cache GLTF, geometrie, materiały, tekstury GPU i nieużywane
  ImageBitmap. Wspólne materiały/tekstury mają liczniki referencji, aby zwolnienie
  jednego sektora nie niszczyło sąsiada. Efekty wireframe też oddają usuwane modele.
- Oryginalne geometrie, obrazy i transformacje zachowane. Bez obniżania rozdzielczości
  tekstur, deformowania proporcji modeli lub zastępowania ich klockami.
- Mały plik bazowy (~10,1 MB zamiast pełnego ~197 MB) utrzymuje układ mapy,
  dokładne lokalne obwiednie kolizji oraz istniejące kontrolery interakcji.
  Koło Allegro, drzwi ToiToi i telebimy zachowują oryginalną geometrię w pamięci.
  Niewidoczne bryły pomocnicze nie są rysowane ani batchowane.
- Animacje odległych NPC/graczy są pomijane istniejącym mechanizmem widoczności.
  Symulacja sieciowa i kolizje nadal działają, także poza widocznością.
- W tej próbie pozostaje 16 głównych NPC; dodatkowe 91 modeli tłumu nie jest pobierane.
  Oryginalne modele tych 16 postaci nadal pozostają w pamięci.
- Wyłączone są dodatkowe ujęcia kamery na telebimach i ich klon lokalnej postaci.
  Filmy i przestrzenny dźwięk sceny pozostają; odtwarzacz startuje po wejściu do gry.
  Desktop bez włączonej próby zachowuje dotychczasowe działanie.
- Bez nowego renderera, nowej pętli RAF ani nowego kontrolera ruchu.

## Eksport i utrzymanie

`npm run world:export` odbudowuje sektory po eksporcie Blendera. Samodzielnie:
`npm run world:fog` (Python z NumPy). Oryginalny GLB pozostaje nietknięty.
Pliki `public/game-assets/world/festival/fog-trial/` są zasobami runtime i muszą
trafić do wdrożenia razem z kodem. Zmiana świata wymaga ponownej generacji.
Przy wdrożeniu zmień `VITE_ASSET_VERSION` i unieważnij cache zasobów świata/obrazów
na serwerze; obrazy sektorów są zewnętrznymi plikami o stałych nazwach.

`npm run check:fog` (także w `ci:assets`) kontroluje SHA oryginału, kompletność
14 593 statycznych meshy, brak duplikatów, zachowanie transformacji/metadanych,
dokładne obwiednie proxy i identyczność bajtów geometrii oraz obrazów.
Generator celowo nie usuwa starych plików przy kolejnej generacji.

## Weryfikacja i ograniczenia

Testy deterministyczne obejmują odległości, jeden równoległy request, usuwanie sektorów,
odpowiedzi po dispose, błędy pobierania bez nieskończonego retry, współdzielenie i
zwalnianie tekstur, zachowanie kolizji/proxy, brak dodatkowego renderu telebimów
oraz sprzątanie materiałów efektów.

`python scripts/verify-fog-trial.py` sprawdza Chromium i WebKit w emulacji iPhone 13:
wejście do gry, mgłę/far plane, brak pobrania pełnego świata, ukrycie proxy,
przeniesienie pod scenę i rzeczywistą ewikcję dawnych sektorów, otwarcie menu,
błędy JavaScript. Wymaga klienta na 5184 i serwera na 3104. Raporty i obrazy:
`reports/fog-trial/`. Zrzuty obozu sprawdzono wizualnie.

W obu silnikach gra weszła do świata bez błędów JavaScript i usuwała stare sektory.
Walidacja końcowa: `ci:code` (1393 testy jednostkowe i 6 narzędziowych),
`ci:assets`, produkcyjny build oraz `git diff --check` przeszły.
W jednym pomiarze WebKit było ~1,26 mln trójkątów/87 draw calls w obozie i
~48 tys./23 pod sceną. To pomiary komputera, nie wyniki wydajności iPhone'a.
Szacunek tekstur świata w obozie wynosił nadal ~340 MiB, bez postaci, buforów
renderowania i dodatkowych kopii CPU! Sektorowanie nie usuwa kosztu szczegółowych
obiektów, które naprawdę znajdują się w najbliższym otoczeniu.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN — fizyczny iPhone.**
Brak gwarancji stałych FPS i braku ubicia Safari. Emulacja nie odwzorowuje limitu
pamięci, temperatury ani GPU telefonu. Potrzebny test minimum 10–15 minut chodzenia,
powrotów do obozu, multiplayera, minigier i ponownego wejścia z menu. Jeśli nadal
zawiesza się przy starcie/w gęstym obozie, kolejnym krokiem są tekstury GPU KTX2
oraz doczytywanie modeli postaci na żądanie, nie samo dalsze zagęszczanie mgły.
