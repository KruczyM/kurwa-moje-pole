# Bongo Rush — druga paczka muzyki i bezpieczny chwyt z boku

## Zachowanie

- Spadającą znajdźkę można podnieść ruchem poziomym na jej wysokości. Nadal nie wolno wejść w nią od dołu/góry, a spadająca na głowę znajdźka i skały nadal zabijają. Obowiązkowy przedmiot znika dokładnie raz, zwiększa licznik i zachowuje istniejące skutki zebrania.
- Malarskie menu i scena wybranego bohatera są niezależne od Standardowej/Artystycznej oprawy planszy. Loader, retry i cache pozostają wspólne.
- W Oprawa i muzyka są dwa niezależne wybory: Ścieżka dźwiękowa (Ścieżka 1 — Spokojna wyprawa / Ścieżka 2 — Przygoda i tajemnica) i Zestaw znajdziek. Muzyka znajduje się na górze panelu, przed podglądami grafiki. Wybór zapisuje się dopiero po Zastosuj, działa w obu oprawach i ma odsłuch utworu bieżącej planszy. Menu nadal gra pełny motyw jazzowy. Starszy zapis domyślnie wybiera Paczkę 1.

## Przypisanie 24 plansz

Dobór nastroju oparto na opisach zawartych w nazwach źródeł, charakterze zagadek i zmierzonej dynamice plików. To propozycja kuratorska; nie deklarujemy subiektywnego odsłuchu ani oceny atrakcyjności muzyki przez człowieka. Wszystkie 21 utworów wykorzystano, bez powtarzania na sąsiednich planszach.

| Nr  | Plansza                        | Utwór                                       | Uzasadnienie                                                                   |
| --- | ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Skalne pole                    | Adventure Boy · Armotonic                   | Przygodowe otwarcie kampanii.                                                  |
| 2   | Warstwy pod stropem            | Sneaky Mallet · zec53                       | Lekki motyw skradania przy planowaniu podpór.                                  |
| 3   | Trzy ujścia                    | Kitchen Fun · zec53                         | Sprężysty, komediowy motyw do kolejności ujść.                                 |
| 4   | Cztery pułapki                 | Cartoon Pizz and Sneaky Suspense · zec53    | Skradanie i napięcie podczas omijania pułapek.                                 |
| 5   | Lej z zatorami                 | Quirky Mischievous Piano and Mallet · zec53 | Figlarny motyw do przewidywania zatorów.                                       |
| 6   | Pierwsza kolonia               | Cabin — Video Game Theme · giri_is          | Kameralny motyw gry do pierwszego kontaktu z kolonią.                          |
| 7   | Serce mieszanego złoża         | Relaxing Guitar Melody · idoberg            | Spokojniejsza gitara do analizy mieszanego złoża.                              |
| 8   | Dwa skrzyżowania               | Whimsical Dramedy · zec53                   | Intryga i ostrożne przechodzenie skrzyżowań.                                   |
| 9   | Dwie hale pod lawiną           | Cinematic Landscape Piano · zec53           | Pianino równoważy gęstą, wymagającą analizy planszę.                           |
| 10  | Bogaty kafelek i strop         | Soft Background · SergeQuadrado             | Spokojne tło przed uruchomieniem bogatego kafelka.                             |
| 11  | Tory i patrole                 | Interstellar Electro Hip Hop · zec53        | Elektroniczny puls do torów i ruchomych patroli.                               |
| 12  | Teleport: zbiornik             | Space Ambient · zec53                       | Kosmiczna elektronika podkreśla teleportację.                                  |
| 13  | Pierścienie i zasuwy           | Game Music Loop 14 · XtremeFreddy           | Motyw gry do przechodzenia kolejnych pierścieni.                               |
| 14  | Zielona sieć                   | Game Music Loop 18 · XtremeFreddy           | Drugi motyw gry odróżnia sieć od pierścieni.                                   |
| 15  | Łup pod presją                 | Ghost Zoo · deejaycoxknot                   | Mroczniejszy puls 130 BPM wskazany w nazwie źródła do presji czasu i zagrożeń. |
| 16  | Trzy zbiorniki                 | Amber · GrumpyNora                          | Ciepły motyw Amber do stopniowego opróżniania zbiorników.                      |
| 17  | Dwa fronty                     | Loop Three · Marc Vittorini                 | Kontrastowy motyw Loop Three do dwóch frontów.                                 |
| 18  | Teleport: trzy komory          | Galactic Space Journey · ViraMiller         | Kosmiczna podróż podkreśla sieć trzech komór.                                  |
| 19  | Serce rumowiska                | Ambient Space · Universfield                | Przestrzenne tło do poszukiwania serca rumowiska.                              |
| 20  | Finał                          | Cinematic Trailer · DAUB Audio              | Trailerowy motyw wyróżnia finał i bossa.                                       |
| 21  | Dwa rezerwuary, dwa spusty     | Kitchen Fun · zec53                         | Powrót motywu ujść w rozszerzonym wyzwaniu z rezerwuarami.                     |
| 22  | Sześć wysp BHP                 | Cabin — Video Game Theme · giri_is          | Powrót motywu leśnej wyprawy w wyzwaniu wysp.                                  |
| 23  | Spirala z wyjściem bocznym     | Orion Nebula · Universfield                 | Orion Nebula wyróżnia długą, koncentryczną spiralę.                            |
| 24  | KURWA MOJE POLE — skalny finał | Adventure Boy · Armotonic                   | Przygodowa repryza zamyka kampanię skalnych liter.                             |

## Kontrola wszystkich plików

Źródło: dostarczony ZIP muza2. Skrypt import-music-pack-2.py weryfikuje 21 plików, dekoduje całość, wykonuje dwuprzebiegową normalizację do około −18 LUFS z limitem −2 dBTP i ponownie dekoduje wynik. Zachowano pełne długości, bez przycinania. Runtime: MP3 192 kb/s, stereo 44,1 kHz. Metadane, wartości pomiarów oraz SHA-256 źródeł i wyników są w soundtrack-v2.json. Oryginalne archiwum nie jest zmieniane.

| Utwór                               | Długość [s] | Źródłowe LUFS | Wynikowe LUFS | Szczyt wyniku [dBTP] |
| ----------------------------------- | ----------: | ------------: | ------------: | -------------------: |
| Adventure Boy                       |       21.37 |        -11.30 |        -18.07 |                -7.65 |
| Space Ambient                       |       16.04 |        -16.14 |        -18.00 |                -5.28 |
| Kitchen Fun                         |       21.86 |        -18.84 |        -17.96 |                -2.00 |
| Relaxing Guitar Melody              |       20.45 |        -15.00 |        -18.00 |                -6.63 |
| Ambient Space                       |       30.07 |        -24.07 |        -17.81 |                -5.27 |
| Loop Three                          |       30.75 |        -14.43 |        -17.91 |                -3.41 |
| Sneaky Mallet                       |       13.74 |        -16.47 |        -17.95 |                -6.21 |
| Cinematic Landscape Piano           |       28.60 |        -19.90 |        -17.95 |                -3.96 |
| Interstellar Electro Hip Hop        |       19.23 |        -16.16 |        -18.00 |                -2.00 |
| Whimsical Dramedy                   |       16.30 |        -22.24 |        -17.99 |                -2.00 |
| Ghost Zoo                           |       29.57 |        -19.58 |        -18.00 |                -3.44 |
| Quirky Mischievous Piano and Mallet |       24.03 |        -16.23 |        -17.97 |                -2.95 |
| Orion Nebula                        |       29.15 |        -18.27 |        -17.94 |                -8.63 |
| Game Music Loop 18                  |       30.26 |        -14.60 |        -17.94 |                -2.94 |
| Soft Background                     |       20.24 |        -10.39 |        -17.62 |                -6.62 |
| Amber                               |       29.57 |        -14.00 |        -18.02 |                -5.51 |
| Cinematic Trailer                   |       16.07 |        -14.76 |        -17.55 |                -3.07 |
| Galactic Space Journey              |       16.27 |        -17.60 |        -17.58 |                -4.40 |
| Cartoon Pizz and Sneaky Suspense    |       13.74 |        -23.08 |        -17.90 |                -2.00 |
| Cabin — Video Game Theme            |       24.14 |        -14.92 |        -17.87 |                -3.25 |
| Game Music Loop 14                  |       29.45 |        -13.66 |        -17.92 |                -5.54 |

## Weryfikacja

- 46 plików / 728 testów Bongo Rush PASS, w tym zwycięskie przejścia wszystkich 24 plansz i zapisane błędne decyzje. Osobne przypadki obejmują chwyt z obu stron, przedmiot obowiązkowy, pojedyncze naliczenie, wejście pionowe i uderzenie w głowę.
- Zapis fatalnej decyzji finału odświeżono: dotychczasowy przestał być fatalny po celowej zmianie reguły. Na pozostałych siedmiu planszach zmieniła się przyczyna przegranej; testy nadal wymagają rzeczywistej śmierci. Analogicznie historyczny lej v5 ma teraz test bezpiecznego chwytu bocznego. Mapy i fizyka skał pozostają bez zmian.
- Chromium: wybór, odsłuch Paczki 2 z istniejącym WebAudio, jeden aktywny bufor, zamknięcie bez zapisu, zapis/odtworzenie po reloadzie i niezmienione menu Standardowej oprawy PASS. Wszystkie 21 plików w całości zdekodowane również przez przeglądarkę.
- WebKit: nawigacja, ustawienia, zapis i zachowanie menu PASS. W tym środowisku brak AudioContext/OfflineAudioContext — odsłuch i dekodowanie WebAudio w WebKit nie są potwierdzone.
- Fizyczny telefon oraz subiektywny odsłuch całości: PENDING_HUMAN. Brak zmian na GitHub Pages; publikacja wymaga niezależnego review i orkiestratora.

Dodatkowa kontrola panelu: Chromium i WebKit PASS dla widoczności obu ścieżek od razu po otwarciu na 1280×800 i 390×844. Zmiana zestawu znajdziek zachowuje muzykę; zmiana muzyki zachowuje zestaw znajdziek. Przyciski Wróć/Zastosuj pozostają przy dolnej krawędzi przewijanego panelu. TypeScript i ESLint PASS.
