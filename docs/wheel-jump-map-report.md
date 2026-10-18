# Młyn, skok i usunięcie znacznika — 2026-10-05

## Mapa

Usunięto rysowanie „Mojego namiotu”, linię prowadzącą, pulsowanie i opis celu w dolnym HUD. Pozycja gracza oraz podpis głównego obozu pozostają. Nie kasowano danych localStorage użytkownika; stare API znacznika pozostaje kompatybilne, ale nie rysuje go na mapie.

## Młyn Allegro

Przyczyna blokady: E podczas obrotu ustawiał `boardingRequested`, pozostawiając stan kontrolera `idle`. Game aktualizował kontroler wyłącznie, gdy `!isIdle()`, więc kolejka nie mogła zostać obsłużona przy następnym dolnym postoju. Kontroler otrzymuje teraz delta time także w idle, z ustawieniem reduceMotion.

Punkt wejścia znajduje się od strony pasażu, poza rzeczywistym colliderem młyna: X=116, Z≈−51,738. Zielony pierścień oznacza stację, a strefa interakcji ma promień 3 m. E zgłasza wejście; jeśli koło jedzie, należy pozostać przy stacji do dolnego postoju (pełny cykl 89 sekund). Odejście ponad 5 m anuluje kolejkę. Ograniczenie ruchu nadal świadomie blokuje przejażdżkę i pokazuje komunikat — nie wyłączano ustawienia użytkownika automatycznie.

## Skok

Spacja w swobodnej grze inicjuje skok (prędkość pionowa 6,2 m/s, grawitacja 18 m/s², wysokość około 1,07 m). Współrzędne poziome nadal aktualizuje ten sam PlayerController, więc Shift+W+Spacja zachowuje bieg. Nie ma podwójnego skoku ani autorepeat, skok jest blokowany w modalach, podczas jazdy i aktywnych flankach. Spacja we flankach zachowuje rzucanie; tryb free camera zachowuje lot.

Wykorzystano już załadowany klip Mixamo `Jump`: zdarzenie sieciowe `jump` uruchamia go na zdalnych modelach, lokalny avatar TV również go odtwarza. W FPS sam gracz widzi pionowy ruch kamery. Running jump korzysta z tego samego klipu, z zachowaniem poziomej prędkości biegu; nie dodano drugiego, nieistniejącego klipu. Zdalna wysokość jest honorowana przez krótkie okno po zdarzeniu jump, potem wraca wcześniejsze osadzanie na terenie, aby nie przywrócić błędu stale unoszących się postaci. Nie dodano nowego renderer/RAF.

## Weryfikacja

59 testów w 6 plikach — PASS. Typecheck i ESLint zmienionych plików — PASS; build — PASS (znane ostrzeżenie rozmiaru bundla).

`scripts/verify-wheel-jump.py`: rzeczywista interakcja młyna, obsługa E w Game, wejście zgłoszone w trakcie obrotu i osiągnięty stan riding po dolnym postoju przez działającą pętlę gry. Stacja jest dostępna dla kolizji. Skok testowany z jednoczesnym biegiem: Y≈2,475 m przy wysokości oczu 1,9 m, Z zmienia się do 14,581 z 15; klip `Jump`, potwierdzone lądowanie. Brak błędów JS. Artefakty: `reports/wheel-jump/browser-report.json`, `cabin.png`, `map.png`. Screenshoty kabiny i mapy obejrzano.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: pełny przejazd oraz obserwacja skoku/animacji przez drugiego zalogowanego gracza. Testy sieciowego avatara sprawdzają wysokość po jump i powrót do terenu, ale nie zastępują oceny całej animacji każdego modelu.

Bez push/merge.
