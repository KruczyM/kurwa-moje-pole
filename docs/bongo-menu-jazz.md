# Bongo Rush — jazz menu

Utwór: **Fun Indie Game Type Jazz Music — idoberg**, pełne 67.0563125 s. Plik przekazany przez użytkownika, skopiowany bez transkodowania ani przycinania.

SHA-256: `1b287a113a905d193e5925f41350dd33a349907b9d8d5bfa6c54bb7ca6a78b0b`.

Menu tytułowe, galeria postaci i wybór poziomów korzystają z jednej ciągłej pętli. Przycisk „Posłuchaj muzyki” uruchamia dźwięk po geście użytkownika. Rozpoczęcie gry wybiera dotychczasowy motyw planszy. Odsłuch w ustawieniach przywraca zapamiętaną pozycję muzyki menu. Wykorzystano istniejący AudioContext i RAF, jeden aktywny dekodowany bufor, maksymalnie dwa źródła podczas przejścia; limit długości menu 75 s, poziomów 50 s.

## Weryfikacja

- ci:code PASS: 2331 testów / 230 plików, formatowanie, lint, typy i testy narzędzi.
- Build produkcyjny PASS.
- Rzeczywisty Chromium: dekodowanie całych 67.0563125 s, sygnał audio RMS > 0.0001, ciągłość menu podczas wyboru poziomów, odsłuch/odtworzenie pozycji, start gry, pauza, wyciszenie i powrót do menu. Jeden bufor, bez błędów przeglądarki.
- Wersja produkcyjna: te same przejścia na rzeczywistym WebAudio, bez debugowego API.
- Niezależny review PASS: 18 testów audio/dostarczenia i osobna próba w przeglądarce, brak P1/P2.

## Propozycja kolejnego etapu — wygląd menu

Zaczarowane wejście do kopalni z małym gramofonem i wybraną postacią. Ciepłe lampy, delikatne świetliki, ruch liści oraz subtelne pulsowanie światła współgrają z jazzem. Scena odpowiada ostatnio odwiedzonemu biomowi.

Główna akcja to duże **Kontynuuj — poziom X**. Niżej pozostają wybór poziomu i oprawa, a portret bohatera pozwala wejść do galerii. Cztery ilustrowane karty biomów pokazują postęp oraz ich charakter: stare magazyny, ogród korzeni, kryształowe podziemia i cytadela.

Oba style zachowują ten sam czytelny układ: Standardowy korzysta z prostszych festiwalowych elementów, Artystyczny z malarskiej sceny, ozdobnego logo i magicznego światła. Animacje mają być spokojne, bez migających przycisków i zasłaniania tekstu. To propozycja, duży redesign nie został jeszcze wdrożony.
