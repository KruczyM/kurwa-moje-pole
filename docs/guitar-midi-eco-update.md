# Pięć MIDI i bonusy Eko — 2026-10-05

## Gitara

Dodane pliki użytkownika: Zegarmistrz światła purpurowy, Czarny chleb i czarna kawa, Piła tango, Sen o Victorii, Czerwony jak cegła. Kopie źródeł mają stabilne nazwy w `public/game-assets/audio/guitar/`; konwerter: `scripts/import-guitar-midi.py`.

Import obsługuje zarówno MIDI typu 0 (kanały w jednej ścieżce), jak i wielościeżkowe. Cała mapa tempa jest zachowana. Wybrane partie: kanały numerowane od zera 3/0/8/0/7 odpowiednio. Przy akordzie wybierana jest najwyższa nuta, gęstość ograniczona do 4 nut/sekundę. To grywalne redukcje dostarczonych aranżacji, nie pełna tabulatura ani oryginalne nagrania audio. Dźwięki są syntezowane przez istniejący silnik gitary.

Wynik importu: 276 / 66 / 183 / 312 / 613 nut; pełne długości źródeł około 362 / 206 / 346 / 340 / 324 sekund. Licencja plików użytkownika nie została zweryfikowana; nie przypisano im domeny publicznej ani Creative Commons. Nie pobierano materiałów z zewnętrznych serwisów.

## Eko

4 bonusy szybkości +35% przez 12 sekund, 4 worki po 3 punkty, Eko-Fala ×2 przez ostatnie 10 sekund każdego cyklu 30-sekundowego. Wciąż 48 obiektów, używanych ponownie. Serwer liczy punkty samodzielnie; odrzucone podniesienia cofają właściwą liczbę punktów. Mapowe oznaczenia bonusów i HUD czasu sprintu/fali.

## QA

Przeglądarka Chromium: wszystkie 5 utworów wybrane i uruchomione z menu, wybór/wyjście przy 360×640 i 800×450; brak page errors. Eko: wejście przez E, start, podnoszenie, faktyczny mnożnik ruchu 1.35, fala ×2, oznaczenia worków, panel mobilny i wyjście; brak page errors. Raporty `reports/camp-guitar-ui/browser-report.json` oraz `reports/eco-challenge/browser-report.json`.

Testy deterministyczne obejmują nuty/lanes/kolejność, czas fali, niekumulowanie sprintu, punktację worka, rollback, punktację serwera. Typecheck/lint/build wykonane. Subiektywna ocena całych aranżacji i pełny wyścig dwóch renderowanych klientów: VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN.

Zmiany serwerowe wymagają ponownego uruchomienia backendu. Brak push/merge.
