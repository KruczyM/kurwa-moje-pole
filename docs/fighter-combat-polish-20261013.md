# Bijatyka — komplet ruchów, ultimate i nowe audio

Zmiany dotyczą wyłącznie bijatyki. Muzyka głównego menu festiwalu pozostaje bez zmian.

## Sterowanie i energia

- U / I: lekka i mocna pięść; J / K: lekkie i mocne kopnięcie.
- H lub S + I: podbródkowy z wybiciem. N lub S + K: podcięcie.
- S + U / J: niski prosty i niskie kopnięcie. W, potem pięść lub kopnięcie: atak w powietrzu.
- P / dotykowe SP: osobny cios specjalny za 30% energii.
- O / dotykowe ULT / numpad 6: ultimate za 100% energii.
- Na telefonie osobne przyciski ↑RP i ↓RK ułatwiają wybicie oraz podcięcie.
- Pomoc przedstawia wszystkie 12 ruchów wybranej postaci, ich koszty i czasy.

Trafienia ładują energię 1,6 razy szybciej, blok daje 65% bazowego przyrostu ruchu. Otrzymanie trafienia dodaje 6 punktów, blokowanie 3. Pudła nie dodają energii. Przykładowo siedem mocnych pięści Ampera napełnia pasek; pełny pasek świeci i wywołuje pojedynczy sygnał oraz napis gotowości.

## Ultimate

Aktywacja zatrzymuje obu zawodników i zegar rundy na dokładnie 48 kroków, czyli 800 ms. Freeze jest częścią autorytatywnego stanu i snapshotów. Przeciwnik nie może trafić w kroku aktywacji. Jednoczesne ultimate obu stron są przyjmowane razem, mają wspólny freeze i pokazują oba rekwizyty. Po wznowieniu atak nadal wymaga zasięgu i może zostać zablokowany lub przerwany.

Ultimate ma minimum 50 kroków zamachu i 42 powrotu. Wraz z freeze, aktywnymi klatkami i hitstop prezentacja trwa około 2,5–2,8 sekundy. Portret pozostaje przez całe zatrzymanie; kamera zbliża się, arena ciemnieje, pojawiają się smugi, rekwizyty, fala i cząsteczki trafienia. Blok i pudło nie wywołują potwierdzającego efektu uderzenia. Opcja ograniczenia efektów wyłącza drgania oraz zmniejsza liczbę cząsteczek i smug; respektuje początkowo preferencję ograniczonego ruchu urządzenia.

Gruczoł przywołuje powiększony biały WC Tron, z białym dachem, złotą ramą i podłokietnikami. Osiem rolek leci po zróżnicowanych łukach, rozwijając białe wstęgi papieru. Pozostali zawodnicy zachowują własne charakterystyczne rekwizyty, rozszerzone wspólną oprawą.

## Audio

Nowy zestaw `audio-v2` zawiera dwa autorskie instrumentalne utwory stereo: spokojniejszy motyw menu 104 BPM i walkę 136 BPM. Trzydzieści efektów obejmuje kontakt pięści i kopnięcia, mocne uderzenie, gardę, zamach, wybicie, lądowanie, sygnały interfejsu, KO i osobny efekt każdego z 16 ultimate. Zwykłe trafienia nie losują komicznych klaksonów, pisków ani dawnych kwestii głosowych.

Efekty ultimate odpowiadają rekwizytom: szkło Ampera, wir Korby, ciecz Kobry, laser Anteny, spłuczka i papier Gruczoła, przester Klątwy, metal Krwiaka, megafon Pnia, bas Pierścienia, mandala Zaworu, metal i torba Ambony, scratch Chlebaka, meteor Dziąsła, silnik Hemoroida, zapłony Jęczmienia oraz szum i pęknięcie Szerszenia. Są to oryginalne efekty syntezowane warstwowo, bez zewnętrznych nagrań, usług płatnych ani cudzych utworów.

Źródło odtwarzalne: `python scripts/fighter/build-arcade-audio.py` (wymaga NumPy). Produkcja używa gotowych plików WAV; generator nie jest potrzebny do uruchomienia gry. Audio uruchamia się po interakcji, cache'uje dekodowane bufory, ogranicza liczbę głosów, przechodzi płynnie między menu i walką oraz przycisza muzykę podczas ultimate. Trafienia są odtwarzane ze zdarzeń autorytatywnych, również przy wymianie ciosów. Ustawienia głośności muzyki, efektów i ograniczenia obrazu są dostępne w wyborze postaci i pauzie oraz zapamiętywane lokalnie. Ukryta karta wycisza audio, a opuszczenie strony sprząta źródła, graf i pobieranie.

## Walidacja i wdrożenie

`npm run ci:code`: PASS, 194 pliki testów / 1829 testów oraz 6 testów narzędzi, formatowanie, lint i typecheck. `npm run ci:assets`: PASS, 241 zasobów / 16 rigów / sektory mgły. `npm run build`: PASS, cztery strony i 32 pliki audio w `dist`. Walidacja animacji: PASS, 16 postaci / 272 klipy / 1632 klatki.

Testy obejmują 192 kombinacje postać/ruch, przypisanie animacji, koszt special, blokowanie ultimate, pełne 48 kroków freeze, odtwarzanie snapshotu, aktywny cios przeciwnika w chwili aktywacji, jednoczesne ultimate, szybszą energię, dwa klienty pokoi, cache i sprzątanie audio, przejścia muzyki oraz format, głośność i kompletność wszystkich 32 plików WAV. Niezależny review zgłosił błąd aktywacji freeze; po poprawce i dodaniu regresji końcowy przegląd nie wykazał dalszych problemów blokujących w sprawdzonym zakresie.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` oraz `AUDIO_PLAYBACK_VERIFICATION_PENDING_HUMAN`: wcześniej zablokowany podgląd nie był ponawiany inną metodą. Testy i kontrola plików nie potwierdzają wyglądu ani subiektywnej jakości odsłuchu. Pozostaje sprawdzenie komputera i telefonu, w tym czytelności dziewięciu przycisków dotykowych, animacji, głośności oraz muzyki.

**Backend wymaga aktualizacji i restartu.** Protokół bijatyki ma teraz wersję **2**, z nowym bitem sterowania i stanem freeze. Starszy backend zostaje odrzucony komunikatem o aktualizacji; tryby offline działają niezależnie. Po wdrożeniu aktualizować istniejący backend według `fighter-online-release.md`; `/health` ma zawierać `"fighterProtocol":2`. Pełne produkcyjne online pozostaje `PRODUCTION_ONLINE_VERIFICATION_PENDING_BACKEND_UPDATE` do aktualizacji i udanej próby dwóch urządzeń.
