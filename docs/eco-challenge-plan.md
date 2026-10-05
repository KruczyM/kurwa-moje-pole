# Eko-Zagroda — plan i kryteria

Rozwijamy istniejący CanCollector, nie tworzymy drugiej pętli gry ani loadera.

1. Naprawić mapę i interakcje. Eko-Zagroda: widoczne pojemniki i tablica przy obozie (X=0,Z=16); drugi punkt przy polu koncertowym. E otwiera panel: oddanie śmieci, solo, wyścig, wyniki, zamknięcie. Puszki muszą mieć warstwę interakcji, dane rodzaju i bliską strefę podnoszenia.
2. Śmieci są prywatne dla klienta. Rozmieścić je na przechodnim terenie obozów, obu pasaży i przed sceną. Odrzucać kolizje i granice. Lokalny respawn po zebraniu, bez tworzenia kolejnych obiektów przy każdym respawnie. Modele mieszają puszki, butelki i papier.
3. Solo: 180 sekund, świeża populacja, osobisty najlepszy wynik w localStorage. Punkt za obiekt; dotychczasowe oddawanie śmieci i odznaka pozostają.
4. Wyścig: utworzenie lobby, dołączenie przed startem, start przez gospodarza po wejściu co najmniej dwóch graczy. Wspólny seed, ta sama przechodnia pula miejsc i 180 sekund według zegara serwera. Każdy zbiera własne obiekty. Serwer pilnuje czasu, powtórzeń, kolejności respawnu i zasięgu wobec ostatniej pozycji gracza; nie przyjmuje dowolnej liczby punktów. Rozłączenie zwalnia udział i przekazuje gospodarza.
5. Tablica: bieżące wyniki pokoju, wynik końcowy oraz lokalny rekord solo. Menu responsywne, kursor zwolniony, brak domyślnego przewijania. Otwarte menu nie zatrzymuje zegara wyścigu.
6. Testy deterministyczne: seed, punktacja, respawn, koniec czasu, duplikaty, nieprawidłowe żądania, gospodarstwo lobby. Przeglądarka: rzeczywiste E, widoczny punkt, podnoszenie, solo i menu na małym ekranie; dwa klienty i pełny przebieg wyścigu, jeśli dostępny aktualny backend. Uczciwość w świecie klienta nie jest pełnym systemem anti-cheat.

Nie publikować ani nie mergować samodzielnie. Zachować lokalne zmiany pozostałych systemów.

## Dodatki: bonusy bez zwiększania kosztu renderowania

- W 48 slotach mieszczą się 4 zielone Eko-Sprinty i 4 pomarańczowe worki. Prywatne dla gracza, taki sam układ w wyścigu.
- Sprint daje +35% szybkości przez 12 sekund; kolejny odświeża czas, nie mnoży prędkości. Worek daje 3 punkty.
- Ostatnie 10 sekund każdego 30-sekundowego cyklu to Eko-Fala: podwójne punkty. HUD pokazuje falę i czas sprintu. Serwer sam wylicza punktację według czasu rundy, a HUD wyścigu używa jego wyniku.
- Bonusy wracają po 4 sekundach jak śmieci, w nowych pozycjach z tego samego seed. Zielony ośmiościan i pomarańczowy worek są lekkimi geometriami; na mapie oznaczenia S/3.
- Brak zwiększania populacji, dodatkowych źródeł światła, fizyki czy osobnej pętli animacji. Worki zastępują kosztowne tworzenie wielu śmieci naraz.
