# Bongo Rush — muzyka dobrana do scenografii

Wykorzystano wszystkie 14 nagrań przekazanych przez użytkownika oraz dwie oryginalne kompozycje lokalne. Powtórzenia są zamierzone: ten sam motyw wraca w pokrewnych komnatach lub późniejszym wyzwaniu. Sąsiednie poziomy mają różne utwory. Oba style graficzne korzystają z tego samego doboru do lokacji.

| Poziom | Scenografia                 | Motyw                                                      | Powód                                                         |
| ------ | --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 1      | Skład starych stelaży       | Indie Guitar Loop — Farran EZ                              | Ciepłe, spokojne wejście do starej piwnicy.                   |
| 2      | Zasypana hala fermentacyjna | Warm Technology Chill Ambient — Zec53                      | Łagodny puls pracującego niegdyś magazynu.                    |
| 3      | Trzy odpływy                | Intrigued — Fronbondi Skegs                                | Przestrzeń, wilgoć i tajemnica starych kanałów.               |
| 4      | Zawalona hala skrzyń        | Lofi Ambient Bell Atmosphere — black_kumizhi               | Stłumione dzwonki pasują do zamkniętej hali.                  |
| 5      | Studnia dojrzewania         | Thoughtful Mysterious Ambient Piano — Zec53                | Spokojna, głębsza kulminacja pierwszego biomu.                |
| 6      | Pierwsza kolonia            | Android Forest — Armotonic                                 | Organiczny ambient wśród korzeni i kamienia.                  |
| 7      | Ogród splotów               | Ambient Clarity 1 — GrumpyNora                             | Jasność i oddech w zielonym ogrodzie.                         |
| 8      | Zasypana oranżeria          | Ambient Clarity 2 — GrumpyNora                             | Pokrewny, ale odmienny motyw dawnej oranżerii.                |
| 9      | Pozostałości zielnika       | **Szept zapomnianego zielnika — nowa kompozycja**          | Dłuższa, spokojna fraza do rozległej mapy.                    |
| 10     | Ostatnia grządka            | Android Forest — Armotonic                                 | Powrót motywu kolonii zamyka leśny rozdział.                  |
| 11     | Nieczynny rezonator         | Science Technology Ambient Techno 1 — Musinova             | Rytm i elektronika zapowiadają kryształowy biom.              |
| 12     | Komora przesyłu / Odbiornik | Ambient Loop — freesound_community                         | Jedna atmosfera spaja główną mapę i boczną komorę.            |
| 13     | Rozstrojony astrolab        | Lofi Ambient Bell Atmosphere — black_kumizhi               | Dzwonki wracają jako rezonans minerałów i starego mechanizmu. |
| 14     | Archiwum przewodów          | Science Technology Ambient Techno 2 — Musinova             | Inna odmiana elektronicznego motywu przewodów.                |
| 15     | Szyb akustyczny             | Glitch Ambient Atmosphere with Reverb Kick — black_kumizhi | Głębszy puls i pogłos pionowego szybu.                        |
| 16     | Trzy martwe kotły           | Melancholy Dark Ambient — Musinova                         | Przygaszony, cięższy początek cytadeli.                       |
| 17     | Dwie komory pieca           | Intrigued — Fronbondi Skegs                                | Tajemniczy pogłos nieczynnej konstrukcji.                     |
| 18     | Węzeł trzech komór          | Ambient Loop — freesound_community                         | Stały motyw nie przerywa się przy przejściu między komorami.  |
| 19     | Zasypana kuźnia             | Glitch Ambient Atmosphere with Reverb Kick — black_kumizhi | Rytm i niskie brzmienie podkreślają stare żelazo.             |
| 20     | Serce warowni               | Sunshine Rain — Brendon Moeller                            | Spokojny, płynący dub jako domknięcie głównej kampanii.       |
| 21     | Dwie kadzie odpływowe       | Indie Guitar Loop — Farran EZ                              | Rozpoznawalny powrót do piwnic Amarena.                       |
| 22     | Sześć zapomnianych grządek  | Szept zapomnianego zielnika — nowa kompozycja              | Rozwinięcie historii ogrodu z poziomu 9.                      |
| 23     | Spiralne archiwum rezonansu | Science Technology Ambient Techno 2 — Musinova             | Powrót motywu archiwum w większym wyzwaniu.                   |
| 24     | Fundament pod wygasłą wieżą | **Zegar pod wygasłą wieżą — nowa kompozycja**              | Niskie pulsy, miedziane dzwonki i oszczędna melodia finału.   |

Nowe kompozycje mają po 48 sekund. Powstały lokalnie z własnych fraz, miękkich padów, basowego pulsu i dzwonków z kołowym pogłosem; nie kopiują melodii dostarczonych nagrań. Pliki źródłowe WAV są zachowane obok raportu.

## Przygotowanie i działanie

- Źródła użytkownika pozostały w Downloads. `source-audit.json` zapisuje ich nazwy, autorów, SHA-256, użyte fragmenty i parametry wersji do gry. Nie przypisujemy im wymyślonej licencji.
- Nagrania zostały wyrównane do około −20 LUFS i zapisane jako stereo MP3 160 kb/s. Długie nagrania mają 40-sekundowe fragmenty; żaden bufor nie przekracza 48 sekund. Krótkie pętle zachowują długość; 8-milisekundowe wyciszenia końców ograniczają trzaski bez skracania rytmu.
- W grze muzyka jest cichsza w menu, a ważniejsze efekty chwilowo ją przyciszają. Dotychczasowy przycisk Dźwięk wycisza całość.
- Istniejący `ArcadeAudio` odtwarza nagrania w tym samym AudioContext co efekty. Nie powstała druga pętla RAF ani scheduler. Jeden aktywny bufor, maksymalnie dwa źródła w trakcie przejścia.
- Pauza, wyciszenie, odsłuch i ukrycie strony zatrzymują dźwięk. Powrót kontynuuje zapisane miejsce. Zmiana komory nie zmienia utworu. Zmiana stylu grafiki zachowuje przypisanie muzyki do planszy.
- Nieudane pobranie uruchamia dotychczasowy syntezator. Kolejna próba następuje po świadomej interakcji, a nie przy każdej klatce. Spóźniona odpowiedź po zmianie planszy lub zamknięciu gry nie może wznowić odtwarzania.
- W panelu „Oprawa i muzyka” znajduje się tytuł i autor motywu wybranego poziomu.

## Sprawdzenie

`unit-tests.json`: 672 zaliczonych testów w 43 plikach, w tym pobieranie, błędy, ponawianie, pauza, zapis pozycji, wyciszenie, wyścigi odpowiedzi i sprzątanie zasobów.

`browser-chromium/report.json`: wszystkie 16 nagrań dekoduje się w prawdziwym WebAudio, daje niezerowy sygnał na analizatorze i poprawnie zapętla bufor. Sprawdzono pauzę, odsłuch, zmianę grafiki, wyciszenie, ukrycie strony oraz powrót do syntezatora po celowo przerwanym pobieraniu i udane ponowienie.

`browser-webkit/report.json`: **AUDIO_ENGINE_UNAVAILABLE_ON_HOST**. Zainstalowany Windowsowy Playwright WebKit nie udostępnia `AudioContext` ani `OfflineAudioContext`. Nie uznajemy tego za zaliczony test dźwięku na Safari. Odsłuch na fizycznym telefonie pozostaje do oceny użytkownika. Poprzednie raporty WebKit dotyczą grafiki i sterowania.

Niezależne review kodu nie znalazło problemów P1/P2 i dodatkowo zaliczyło 23 testy audio, scenografii i cache. Raport przeglądarki podaje rzeczywistą pamięć po dekodowaniu w AudioContext, a nie szacunek oparty na częstotliwości pliku źródłowego.

## Publikacja

Pełny build tej gałęzi nie może zastąpić całej obecnej strony: nowszy `main` zawiera niezależne zmiany Fightera i głównej gry. Wydanie Bongo należy nałożyć na ostatni opublikowany artefakt `main`, aktualizując jedynie wejście Bongo i jego zasoby. Repozytorium ma środowisko Pages ograniczone do `main`; odstępstwo od tej polityki lub integracja przez opiekuna wymagają osobnej decyzji. Nie zmieniono samodzielnie reguł środowiska.
