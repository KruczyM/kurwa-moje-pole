# Eko-Zagroda — wdrożenie

## Przyczyna

Istniał CanCollector i lokalny 90-sekundowy rush, ale punkt recyklingu był niewidoczny, jego pozycja nie zgadzała się z mapą, a puszki i zagrody nie miały kompletnych danych/warstw interakcji. Nie było lobby ani wspólnej punktacji.

## Obecne działanie

- Widoczna tablica i trzy pojemniki przy obozie (0,16), dodatkowy punkt terenowy. E otwiera panel i zwalnia kursor; Esc lub przycisk zamyka panel.
- Solo: 180 sekund, 48 prywatnych obiektów (puszki, butelki, papier), punkt za podniesienie, lokalny rekord.
- Losowanie korzysta z bezkolizyjnej puli obu pasaży, obozów i terenu przed sceną. Zebrane obiekty wracają po czterech sekundach w kolejnych pozycjach; geometria i materiały są używane ponownie.
- Wyścig: gospodarz tworzy lobby, inni wybierają „Dołącz”, gospodarz uruchamia przy co najmniej dwóch graczach. Każdy ma identyczny seed i własne obiekty, więc nie podbiera ich rywalom.
- Tablica wyników pokoju aktualizuje się z serwera, pokazuje wyniki końcowe do utworzenia kolejnego lobby. To nie trwały ranking wszystkich historycznych meczów.
- Serwer sprawdza termin rundy, członkostwo, pozycję, generację respawnu i duplikaty. Rozłączenie/zwolnienie postaci usuwa udział i przekazuje gospodarza. Czas biegnie także przy otwartym menu.

## Weryfikacja

- Testy jednostkowe istniejącego kolektora/UI i nowych mechanizmów: 40/40.
- Rzeczywiste Socket.IO: stworzenie lobby, dołączenie, start, dwa prywatne podniesienia, odrzucenie duplikatu, przekazanie gospodarza; wraz z regresją RoomServer 7/7.
- Osobny strict typecheck serwera: PASS. Typecheck klienta, lint, build: PASS (istniejące ostrzeżenie o dużym bundlu).
- Przeglądarka Chromium: rzeczywisty klawisz E otwiera panel; start solo, 48 obiektów, wszystkie na przechodnim terenie, podniesienie przez E daje 1 punkt. Pula: 198 miejsc. Panel 360×640 mieści się w ekranie, przewija i zamyka przyciskiem. Brak page errors. Raport i zrzut: `reports/eco-challenge/`.
- Pełny 180-sekundowy wyścig dwóch osób w renderowanym świecie: VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN. Sam transport i reguły wyścigu przetestowane automatycznie.
- Pełna suita: 1353/1356 testów przechodzi. Trzy błędy w nietkniętym `FestivalCrowd.test.ts` dotyczą wcześniejszego rozmieszczenia NPC (oczekiwanie ≥72 spacerujących, pierwszy NPC jako spacerujący oraz stare role ASP/kolejki/odpoczynek). Aktualny układ z 20 tancerzami pozostawia 71 spacerujących. Nie zmieniano tych testów ani NPC w zadaniu Eko.

Po aktualizacji trzeba zrestartować backend; stary działający proces nie obsługuje nowych zdarzeń `eco:*`. Nie wykonano push/merge ani zmian w konfiguracji kluczy.
