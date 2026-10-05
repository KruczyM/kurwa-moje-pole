# Plan i wdrożenie: głośnik i gitara przy ognisku

## Diagnoza

Osobny `speakerAnchor` nie znajdował się w korzeniach raycastu. Mały model przy ziemi był dodatkowo trudny do wskazania. HUD gitary dziedziczył `pointer-events: none`, nie zwalniał pointer lock i miał stały rozmiar bez ograniczenia wysokości. Dotychczasowe utwory były generowanymi ćwiczeniami, a czas gry kończył się przed ostatnimi nutami.

## Wdrożone etapy

1. Włączyć głośnik do istniejącego menedżera interakcji, dodać niewidoczny hitbox i zasięg obsługi 1,8 m. Zachować istniejący `camp-track.mp4` i przestrzenne odtwarzanie; sprawdzić uruchomienie rzeczywistym E, nie tylko bezpośrednim `play()`.
2. Zwolnić kursor podczas wyboru gitary bez wywoływania pauzy. Zablokować chodzenie w minigrze. Używać dostępnych klawiaturowo przycisków utworów. Jawnie obsłużyć `hidden`, kliknięcia i przewijanie; dopasować HUD do szerokości oraz wysokości ekranu.
3. Pobrać zapis MIDI i LilyPond z legalnego źródła, zachować źródła i licencje. Importować pełne ścieżki melodii do deterministycznych map nut. Każda wysokość ma stały tor; czas zakończenia obejmuje ostatnią nutę. Gitara syntetyzuje prawdziwe wysokości zamiast losowych akordów.
4. Nie przedstawiać starych, wygenerowanych progresji jako rzeczywistych nagrań Dżemu, Kultu itp. Zostają jako jawnie opisane ćwiczenia akordów, ze starymi identyfikatorami dla kompatybilności.
5. Testy: kompletny przebieg obu MIDI, stałe przypisanie torów, dotychczasowe ocenianie trafień, interakcje. Przeglądarka: E przy głośniku, audio faktycznie postępuje, kliknięcie wyboru utworu i wyjścia, mały ekran 360×640 i niski ekran 800×450. Subiektywne brzmienie i ergonomia wymagają dalszej oceny gracza.

## Raport walidacji

Test przeglądarkowy `scripts/verify-camp-guitar-ui.py` przeszedł: rzeczywisty klawisz E uruchamia istniejący `camp-track.mp4`, czas odtwarzania postępuje; E przy gitarze otwiera wybór. W rozdzielczościach 360×640 i 800×450 HUD mieści się w widoku, utwór da się kliknąć, a przycisk wyjścia zamyka grę. Bez błędów JavaScript. Wyniki i zrzuty: `reports/camp-guitar-ui/`. Źródłowe MIDI dały 67 i 115 zdarzeń na najwyższym jednoczesnym głosie; zachowane są także oryginalne pliki do dalszych aranżacji.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN: odsłuch brzmienia oraz ocena trudności przez gracza. Ten audyt nie obejmuje wszystkich przycisków pozostałych minigier ani wszystkich rozdzielczości. Pełny przegląd reszty gry pozostaje osobnym zadaniem.

## Repertuar i atrybucja

### Docelowy repertuar wskazany przez użytkownika

- Dżem — Łzy
- Dżem — Złoty paw
- Tadeusz Woźniak — Zegarmistrz światła purpurowy
- Pidżama Porno — Piła tango
- Strachy na Lachy — Czarny chleb i czarna kawa

Status: oczekuje na źródłowe MIDI/nuty/tabulatury, które można wykorzystać. Użytkownik potwierdził dwa utwory Dżemu i zaoferował dostarczenie plików. Nie zastępować ich losowymi ćwiczeniami, nie twierdzić, że posiadamy już pełne mapy nut. Po dostarczeniu materiałów opracować osobne, poprawne ścieżki rytmu i wysokości; zweryfikować z odsłuchem. Obecne dwa utwory Mutopii służą jako działający repertuar testowy, nie jako realizacja tej listy.

- **Oda do radości**, L. van Beethoven; zapis Peter Chubb; Public Domain. Źródło: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528. Pliki: `public/game-assets/audio/guitar/ode.mid`, `ode.ly`. Gra używa górnego głosu, bez wokalu ani cudzego nagrania.
- **Amazing Grace**, tradycyjny; opracowanie i skład Breizh Partitions (2012); CC BY-SA 3.0 Unported: https://creativecommons.org/licenses/by-sa/3.0/. Źródło: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1832. Pliki: `amazing.mid`, `amazing.ly`. Zmiana: przekształcenie ścieżki MIDI w cztery tory i własną syntezę gitary. Pochodna mapa tego utworu w `guitarMidiCharts.json` pozostaje na CC BY-SA 3.0; nie oznacza to relicencjonowania niezależnego silnika gry.

Importer: `python scripts/import-guitar-midi.py` (pakiet `mido`). Oryginalne źródła zawierają informacje licencyjne. Bez pobierania nieautoryzowanych nagrań ani korzystania z płatnych API. Popularne współczesne utwory można dodać po otrzymaniu odpowiednich praw do zapisu/aranżacji i nagrania.
