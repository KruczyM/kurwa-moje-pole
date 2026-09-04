# Otwarte issue projektu

> Automatyczna migawka otwartych zadań z repozytorium
> [KruczyM/kurwa-moje-pole](https://github.com/KruczyM/kurwa-moje-pole).
> Stan na 2026-09-01. Źródłem prawdy pozostaje GitHub.

Liczba otwartych issue: **29**.

## Szybka lista

- [ ] [#8 — [Obóz] Wdrożyć duży namiot dla T10 i T15 oraz układ T01–T15 z konfiguracji](https://github.com/KruczyM/kurwa-moje-pole/issues/8)
- [ ] [#9 — [Świat] Dopracować zadaszenie Mad Dog, maszt, flagę i hierarchię obozu](https://github.com/KruczyM/kurwa-moje-pole/issues/9)
- [ ] [#10 — [Trawa] Wprowadzić gęstą aksamitną trawę z LOD i presetami jakości](https://github.com/KruczyM/kurwa-moje-pole/issues/10)
- [ ] [#11 — [Teren] Dopracować łagodne nierówności, materiał grass004 i horyzont](https://github.com/KruczyM/kurwa-moje-pole/issues/11)
- [x] [#12 — [Materiały] Audyt PBR i oświetlenia postaci, namiotów, flagi i rekwizytów](https://github.com/KruczyM/kurwa-moje-pole/issues/12)
- [ ] [#13 — [EPIC] Inteligentni NPC z płynną locomotion](https://github.com/KruczyM/kurwa-moje-pole/issues/13)
- [ ] [#15 — [Animacje NPC] Zastąpić restart klipów maszyną stanów i płynnym crossfade](https://github.com/KruczyM/kurwa-moje-pole/issues/15)
- [ ] [#16 — [Animacje NPC] Zsynchronizować fazę kroków, prędkość świata i time scale](https://github.com/KruczyM/kurwa-moje-pole/issues/16)
- [ ] [#17 — [Nawigacja NPC] Zbudować przechodnią siatkę pola i wyznaczanie pełnych tras](https://github.com/KruczyM/kurwa-moje-pole/issues/17)
- [ ] [#18 — [Steering NPC] Dodać przewidywanie przeszkód i łagodne omijanie agentów](https://github.com/KruczyM/kurwa-moje-pole/issues/18)
- [ ] [#19 — [Zachowanie NPC] Dodać scheduler stanów wander, idle, social i run-home](https://github.com/KruczyM/kurwa-moje-pole/issues/19)
- [ ] [#20 — [AI NPC] Dodać watchdog utknięcia i ochronę przed zapętleniem decyzji](https://github.com/KruczyM/kurwa-moje-pole/issues/20)
- [ ] [#21 — [Debug NPC] Dodać overlay diagnostyczny i test 30-minutowej sesji AI](https://github.com/KruczyM/kurwa-moje-pole/issues/21)
- [ ] [#22 — [Interakcje] Naprawić wykrywanie przedmiotów leżących na stole](https://github.com/KruczyM/kurwa-moje-pole/issues/22)
- [ ] [#23 — [Inspekcja] Dokończyć model preview, opisy i pełną obsługę E/Escape](https://github.com/KruczyM/kurwa-moje-pole/issues/23)
- [ ] [#24 — [Sekwencje użycia] Dodać kamerę trzecioosobową, animacje i rekwizyty](https://github.com/KruczyM/kurwa-moje-pole/issues/24)
- [ ] [#25 — [Efekty] Dopracować pięć odrębnych efektów i bezpieczne wygaszanie](https://github.com/KruczyM/kurwa-moje-pole/issues/25)
- [ ] [#26 — [Dostępność] Uzupełnić ustawienia reduced motion, błysków i intensywności](https://github.com/KruczyM/kurwa-moje-pole/issues/26)
- [ ] [#28 — [Audio] Dopracować głośnik i warstwę ambientu obozu](https://github.com/KruczyM/kurwa-moje-pole/issues/28)
- [ ] [#29 — [Multiplayer] Utworzyć serwer pokojów i autorytatywną rezerwację postaci](https://github.com/KruczyM/kurwa-moje-pole/issues/29)
- [ ] [#30 — [Multiplayer] Synchronizować ruch, obrót i animacje graczy](https://github.com/KruczyM/kurwa-moje-pole/issues/30)
- [ ] [#31 — [Multiplayer] Przekazywać postacie między NPC a graczami bez duplikatów](https://github.com/KruczyM/kurwa-moje-pole/issues/31)
- [ ] [#32 — [Voice chat] Dodać przestrzenny WebRTC z mute i zasięgiem 50 m](https://github.com/KruczyM/kurwa-moje-pole/issues/32)
- [ ] [#33 — [Sieć] Dodać wersjonowany protokół, walidację i testy reconnect](https://github.com/KruczyM/kurwa-moje-pole/issues/33)
- [ ] [#34 — [Performance] Ustalić i egzekwować budżety CPU, GPU, pamięci i assetów](https://github.com/KruczyM/kurwa-moje-pole/issues/34)
- [ ] [#35 — [QA] Dodać automatyczne smoke/E2E i pełną macierz odbiorową](https://github.com/KruczyM/kurwa-moje-pole/issues/35)
- [ ] [#36 — [Release] Przygotować deployment HTTPS/WSS, TURN i konfigurację środowisk](https://github.com/KruczyM/kurwa-moje-pole/issues/36)
- [ ] [#37 — [Release] Audyt licencji, Git LFS, dokumentacji i archiwum źródeł](https://github.com/KruczyM/kurwa-moje-pole/issues/37)
- [ ] [#43 — [Efekty] Dodać opcjonalną fazę Matrix z zielonym kodem](https://github.com/KruczyM/kurwa-moje-pole/issues/43)

## Podział według etapów

### Etap 2 — Świat i obóz

#### [#8 — [Obóz] Wdrożyć duży namiot dla T10 i T15 oraz układ T01–T15 z konfiguracji](https://github.com/KruczyM/kurwa-moje-pole/issues/8)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: assets`, `area: world`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Przygotować `art/dużynamiot.glb` jako asset runtime dla T10 i T15.
> - Przenieść pozycje, rotacje, skalę, model i collider wszystkich namiotów do `campLayout.ts`.
> - Zachować główny namiot/zadaszenie Mad Dog jako osobny obiekt.
> - Zweryfikować wąskie, ale przechodnie ścieżki.
>
> ## Kryteria odbioru
>
> - T10 i T15 korzystają z dużego namiotu.
> - Każdy namiot ma stabilne ID i jest konfigurowalny bez zmiany logiki sceny.
> - Układ odpowiada mapce i nie blokuje tras gracza/NPC.

</details>

#### [#9 — [Świat] Dopracować zadaszenie Mad Dog, maszt, flagę i hierarchię obozu](https://github.com/KruczyM/kurwa-moje-pole/issues/9)

- Status: **otwarte**
- Etykiety: `priority: medium`, `area: world`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Docelowa skala i otwarta przestrzeń pod głównym zadaszeniem.
> - Kolizje wyłącznie na masywnych słupach; linki bez kolizji.
> - Wysoki maszt i czytelna flaga w centrum.
> - Subtelna, wspólna reakcja tkanin i flagi na wiatr.
>   dodać także pod namiotem 8 siedzeń ułożonych w kółku wielkościowo muszą być takie żeby zmieścić postacie, muszą być interaktywne z możliwością siadania, będzie musiało ustawiać postać przed krzesłem i wywoływać aniamcje sit
>
> ## Kryteria odbioru
>
> - Mad Dog, maszt i flaga są trzema czytelnymi dominantami obozu.
> - Gracz i NPC mogą przejść pod zadaszeniem.
> - Brak migotania i przenikania colliderów.

</details>

#### [#10 — [Trawa] Wprowadzić gęstą aksamitną trawę z LOD i presetami jakości](https://github.com/KruczyM/kurwa-moje-pole/issues/10)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: world`, `performance`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Krótsze i wizualnie gęstsze źdźbła bez prześwitów oraz plam koloru.
> - Instancje GPU, bliski obszar wysokiej jakości i płynne dalsze LOD.
> - Presety low/medium/high/ultra i limit bezpieczny dla przeglądarki.
> - Ciągłość przy przesuwaniu obszaru dynamicznego wokół gracza.
>
> ## Kryteria odbioru
>
> - Nie widać ostrej granicy renderowanej trawy ani brązowego pasa ziemi.
> - Profil high utrzymuje uzgodniony FPS w 1080p.
> - Zmiana presetu nie wymaga przeładowania strony i nie powoduje zawieszenia.

</details>

#### [#11 — [Teren] Dopracować łagodne nierówności, materiał grass004 i horyzont](https://github.com/KruczyM/kurwa-moje-pole/issues/11)

- Status: **otwarte**
- Etykiety: `priority: medium`, `area: assets`, `area: world`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Niewielkie fale terenu zgodne z kolizją i wysokością postaci.
> - Materiał ziemi: albedo, normal i roughness bez ostrej brązowej powierzchni.
> - Spójne przejście ziemia–trawa–panorama oraz widoczne dalekie drzewa.
> - Usunąć efekt widocznej kopuły horyzontu.
>
> ## Kryteria odbioru
>
> - Brak skarp i pływających obiektów.
> - Drzewa na panoramie są czytelne, a krawędź tła niewidoczna.
> - Teren nie kontrastuje agresywnie z trawą.

</details>

#### [#12 — [Materiały] Audyt PBR i oświetlenia postaci, namiotów, flagi i rekwizytów](https://github.com/KruczyM/kurwa-moje-pole/issues/12)

- Status: **zamknięte**
- Etykiety: `priority: high`, `area: assets`, `area: world`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-09-04

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Poprawne sRGB dla Base Color i liniowe mapy danych.
> - Sensowne roughness/metalness dla skóry, tkanin, plastiku i metalu.
> - Jasne światło wypełniające pod Mad Dog.
> - Test ekspozycji/tone mappingu w scenie i preview.
>
> ## Kryteria odbioru
>
> - Żaden zatwierdzony model nie jest niemal czarny ani przepalony.
> - Twarze i ubrania pozostają czytelne w słońcu i cieniu.
> - Namioty i flaga zachowują właściwe kolory tekstur.

</details>

### Etap 3 — NPC i animacje

#### [#13 — [EPIC] Inteligentni NPC z płynną locomotion](https://github.com/KruczyM/kurwa-moje-pole/issues/13)

- Status: **otwarte**
- Etykiety: `epic`, `priority: critical`, `area: npc-ai`, `area: animation`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Wynik
>
> NPC korzystają z całego pola, omijają przeszkody i siebie, potrafią stać lub zachowywać się społecznie, nie wpadają w zapętlenia, a `Idle`/`Walk`/`Run` przechodzą płynnie bez skoków klatek i ślizgania stóp.
>
> ## Warunki zamknięcia epica
>
> - Wszystkie zadania etapu NPC i animacje są zamknięte.
> - Ośmiu NPC działa przez co najmniej 30 minut bez utknięcia i narastających błędów.
> - Zmiany klipów nie resetują animacji co kilka klatek.
> - Można włączyć diagnostykę stanu, celu, ścieżki i aktualnego klipu.

</details>

#### [#15 — [Animacje NPC] Zastąpić restart klipów maszyną stanów i płynnym crossfade](https://github.com/KruczyM/kurwa-moje-pole/issues/15)

- Status: **otwarte**
- Etykiety: `priority: critical`, `area: npc-ai`, `area: animation`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Problem
>
> Obecny NpcAnimator.play() wykonuje reset() przy każdej zmianie stanu. Częste Idle ↔ Walk po kolizjach uruchamiają animację od początku i wyglądają jak bug.
>
> ## Zakres
>
> - Jawne stany locomotion i osobna kolejka animacji jednorazowych.
> - Minimalny czas utrzymania stanu/histereza, aby nie przełączać co kilka klatek.
> - crossFadeTo/crossFadeFrom z warpingiem czasu i kontrolą wag.
> - reset() tylko przy rzeczywistym wejściu w nowy klip, nigdy w każdym update.
> - Zachować aktualną akcję, normalized time i diagnostykę przejścia.
>
> ## Kryteria odbioru
>
> - Idle ↔ Walk ↔ Run nie ma popów pozy, T-pose ani skoku do pierwszej klatki.
> - Kolizja nie wywołuje serii restartów.
> - Jednorazowa akcja wraca do locomotion po zdarzeniu finished.
>
> Epic: https://github.com/KruczyM/kurwa-moje-pole/issues/13

</details>

#### [#16 — [Animacje NPC] Zsynchronizować fazę kroków, prędkość świata i time scale](https://github.com/KruczyM/kurwa-moje-pole/issues/16)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: npc-ai`, `area: animation`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Problem
>
> setWalkTimeScale() jest obecnie nadpisywane przez późniejsze setEffectiveTimeScale(1), a prędkość przesuwania nie jest powiązana z długością kroku.
>
> ## Zakres
>
> - Zmierzyć prędkość referencyjną Walk/Run na cykl.
> - Dopasować prędkość transformacji NPC i timeScale bez foot slidingu.
> - Przy Walk→Run przenosić znormalizowaną fazę lewej/prawej stopy.
> - Zastosować łagodne przyspieszenie i hamowanie zamiast natychmiastowej zmiany.
>
> ## Kryteria odbioru
>
> - Stopy nie ślizgają się zauważalnie po podłożu.
> - Zmiana prędkości nie gubi rytmu kroków.
> - timeScale pozostaje aktywny po zmianie klipu.
>
> Epic: https://github.com/KruczyM/kurwa-moje-pole/issues/13

</details>

#### [#17 — [Nawigacja NPC] Zbudować przechodnią siatkę pola i wyznaczanie pełnych tras](https://github.com/KruczyM/kurwa-moje-pole/issues/17)

- Status: **otwarte**
- Etykiety: `priority: critical`, `area: npc-ai`, `area: world`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Problem
>
> Losowy cel oraz sprawdzanie tylko następnego punktu powodują odbijanie od colliderów i wybieranie celów bez osiągalnej drogi.
>
> ## Zakres
>
> - Utworzyć grid/navmesh z granic pola i uproszczonych colliderów.
> - Uwzględnić promień NPC oraz margines od namiotów, stołu, masztu i toi-toia.
> - Wyznaczać trasę A* lub równoważną do celu na całym polu.
> - Wygładzać waypointy, gdy istnieje line-of-sight.
> - Linki namiotowe nie są przeszkodą.
>
> ## Kryteria odbioru
>
> - NPC dociera do losowych punktów w każdym sektorze pola.
> - Nie wybiera celu wewnątrz przeszkody ani odciętej strefy.
> - Aktualizacja ścieżek mieści się w budżecie CPU.
>
> Epic: https://github.com/KruczyM/kurwa-moje-pole/issues/13

</details>

#### [#18 — [Steering NPC] Dodać przewidywanie przeszkód i łagodne omijanie agentów](https://github.com/KruczyM/kurwa-moje-pole/issues/18)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: npc-ai`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Separation od innych NPC i gracza.
> - Predykcyjne testy kierunku przed NPC zamiast reakcji dopiero po wejściu w collider.
> - Łagodne skręcanie, ograniczenie prędkości kątowej i ponowne wejście na trasę.
> - Priorytety: granica > stała przeszkoda > gracz/NPC > cel.
>
> ## Kryteria odbioru
>
> - NPC nie nakładają się, nie drżą twarzą w twarz i nie odbijają jak kule.
> - W wąskim przejściu potrafią zwolnić, minąć się lub wybrać nową trasę.
> - Omijanie nie powoduje szybkiego przełączania Walk/Idle.
>
> Epic: https://github.com/KruczyM/kurwa-moje-pole/issues/13

</details>

#### [#19 — [Zachowanie NPC] Dodać scheduler stanów wander, idle, social i run-home](https://github.com/KruczyM/kurwa-moje-pole/issues/19)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: npc-ai`, `area: animation`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Różne profile postaci i niezależne czasy zachowań.
> - Część NPC stoi dłużej; część wędruje po pełnym polu.
> - Krótkie punkty zainteresowania i spotkania społeczne bez grupowania wszystkich naraz.
> - run-home tylko przy granicy, z powrotem do walk/idle po wejściu do bezpiecznej strefy.
> - Cooldowny i pamięć ostatnich celów zapobiegające oscylacji.
>
> ## Kryteria odbioru
>
> - Po 10 minutach NPC odwiedzają różne sektory mapy.
> - Nie wszyscy wykonują tę samą akcję równocześnie.
> - Żaden agent nie biega bez końca do środka ani nie oscyluje przy granicy.
>
> Epic: https://github.com/KruczyM/kurwa-moje-pole/issues/13

</details>

#### [#20 — [AI NPC] Dodać watchdog utknięcia i ochronę przed zapętleniem decyzji](https://github.com/KruczyM/kurwa-moje-pole/issues/20)

- Status: **otwarte**
- Etykiety: `priority: critical`, `area: npc-ai`, `area: qa`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Mierzyć postęp wzdłuż ścieżki, czas w stanie i liczbę zmian celu.
> - Wykrywać brak ruchu, oscylację dwóch waypointów i lawinę zmian stanu.
> - Stopniowane odzyskiwanie: korekta steeringu, nowa ścieżka, nowy osiągalny cel.
> - Teleport wyłącznie jako awaryjny fallback development z logiem.
>
> ## Kryteria odbioru
>
> - Brak utknięcia dłuższego niż ustalony limit bez podjęcia naprawy.
> - Watchdog nie resetuje animacji przy każdej próbie.
> - Log podaje NPC, pozycję, stan, cel i przyczynę odzyskiwania.
>
> Epic: https://github.com/KruczyM/kurwa-moje-pole/issues/13

</details>

#### [#21 — [Debug NPC] Dodać overlay diagnostyczny i test 30-minutowej sesji AI](https://github.com/KruczyM/kurwa-moje-pole/issues/21)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: npc-ai`, `area: animation`, `area: qa`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Przełączany widok colliderów, navmesh/gridu, ścieżek i celów.
> - Etykieta nad NPC: stan, klip, normalized time, prędkość, czas bez postępu.
> - Automatyczne metryki: liczba repathów, przejść stanu, kolizji i recovery.
> - Test deterministyczny z seedem oraz 30-minutowy soak ośmiu NPC.
>
> ## Kryteria odbioru
>
> - Test wykrywa zapętlenie, restart klipu i utknięcie.
> - W sesji odbiorowej brak stale zablokowanych agentów i nadmiernych transitionów.
> - Overlay jest dostępny tylko w development.
>
> Epic: https://github.com/KruczyM/kurwa-moje-pole/issues/13

</details>

### Etap 4 — Interakcje, UI i efekty

#### [#22 — [Interakcje] Naprawić wykrywanie przedmiotów leżących na stole](https://github.com/KruczyM/kurwa-moje-pole/issues/22)

- Status: **otwarte**
- Etykiety: `priority: critical`, `area: interaction`, `area: qa`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-31

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Zweryfikować pozycje, skale, hitboxy i `interactionRoot` pięciu przedmiotów.
> - Raycast ma wybierać najbliższy widoczny przedmiot, nie stół lub obiekt za nim.
> - Dodać warstwę/layer interakcji i opcjonalny debug hitboxów.
> - Podpowiedź ma pojawiać się z poprawnej strony stołu w rozsądnym zasięgu.
>   -trzeba dodać możliwość zabierania itemów, bo finalnie będę chciał żeby użytkownicy zaczynali z pustym plecakiem i sobie go napełniali przy danych namiotach, stole itd itp więc wstępnie dodajmy, że wszsytkiego będzie po jednym, trzbe zrobić zmienną czy coś innego co będzie można później łatwo edytować, więc najpierw po jednym ale można zbierać więcej, dopiero jak już całą grę zrobimy to pomyślę o tym gdzie i jak pobierac nowe itemyu jak na razie beda na stole sobie leżeć
>
> ## Kryteria odbioru
>
> - Blant, kokaina, MDMA, grzyby i LSD można niezawodnie wybrać.
> - Każdy pokazuje właściwą nazwę; hitboxy nie blokują renderowania.
> - Test obejmuje różne kąty kamery i wysokości gracza.

</details>

#### [#23 — [Inspekcja] Dokończyć model preview, opisy i pełną obsługę E/Escape](https://github.com/KruczyM/kurwa-moje-pole/issues/23)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: ui`, `area: interaction`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Responsywna scena inspekcji z automatycznym dopasowaniem modelu.
> - Obrót przedmiotu, nazwa, pełny zatwierdzony opis i czytelne podpowiedzi.
> - `E` używa przedmiotu, `Escape` zamyka; brak podwójnych akcji.
> - Przywrócić Pointer Lock i stan sterowania po każdej ścieżce zamknięcia.
> - Poprawne zwalnianie renderera, modelu, materiałów i tekstur.
>
> ## Kryteria odbioru
>
> - Każdy z pięciu modeli jest widoczny w całości.
> - Wyjście działa klawiaturą i przyciskiem.
> - Wielokrotne otwieranie nie zwiększa liczby rendererów/RAF.

</details>

#### [#24 — [Sekwencje użycia] Dodać kamerę trzecioosobową, animacje i rekwizyty](https://github.com/KruczyM/kurwa-moje-pole/issues/24)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: animation`, `area: interaction`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Kamera bezkolizyjnie pokazuje całą postać.
> - Odtwarzana jest właściwa animacja jednorazowa i rekwizyt przypięty do dłoni.
> - Zablokować sprzeczne wejście użytkownika podczas sekwencji.
> - Po akcji wrócić dokładnie do kamery pierwszoosobowej i locomotion.
> - Zsynchronizować zdarzenie uruchomienia efektu z markerem animacji.
>
> ## Kryteria odbioru
>
> - Brak T-pose, teleportu, przenikania kamery i pozostawionych rekwizytów.
> - Wszystkie pięć przedmiotów ma kompletną sekwencję lub jawny fallback.
> - Przerwanie sekwencji nie zostawia zablokowanej gry.
>
> ## Zależności
>
> - Kanoniczny pipeline animacji i maszyna stanów animatora.

</details>

#### [#25 — [Efekty] Dopracować pięć odrębnych efektów i bezpieczne wygaszanie](https://github.com/KruczyM/kurwa-moje-pole/issues/25)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: interaction`, `area: effects`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-31

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Osobny język wizualny blanta, kokainy, MDMA, grzybów i LSD.
> - Płynne fade-in/active/fade-out.
> - Snapshot bazowych ustawień kamery, postprocessingu i audio.
> - Anulowanie bez pozostawionych uniformów, render targetów i timerów.
> - HUD czasu i fazy efektu.
>
> ## Kryteria odbioru
>
> - Efekty są rozróżnialne bez odczytywania etykiety.
> - Po każdym efekcie obraz, FOV, prędkość i audio wracają do normy.
> - Szybkie przełączanie/anulowanie nie psuje renderera.
>
> ## Doprecyzowanie: LSD w ekwipunku
>
> - LSD jest dostępne bezpośrednio w panelu ekwipunku.
> - Efekt łączy mocne nasycenie sceny z półprzezroczystą nakładką wizualną ponad obrazem gry.
> - Nakładka płynnie pojawia się i znika razem z fazami efektu, nie przechwytuje wejścia i respektuje reduced motion.
> - Grafiki nakładki są rejestrowane w centralnym katalogu assetów i śledzone przez Git LFS.
>
> ## Doprecyzowanie: wizja wireframe po grzybach
>
> - Krótkie, nieciągłe impulsy wireframe zamiast stałego trybu.
> - Siatka obejmuje NPC i obiekty świata, ale wyklucza ziemię, trawę i niewidzialne hitboxy.
> - Linie mają chwilowo przechodzić przez sylwetki i obiekty, tworząc wrażenie widzenia struktury świata.
> - Po impulsie, anulowaniu, pauzie lub dispose muszą wrócić dokładnie oryginalne materiały.
> - Reduced motion wyłącza impulsy wireframe.

</details>

#### [#26 — [Dostępność] Uzupełnić ustawienia reduced motion, błysków i intensywności](https://github.com/KruczyM/kurwa-moje-pole/issues/26)

- Status: **otwarte**
- Etykiety: `accessibility`, `priority: high`, `area: ui`, `area: effects`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Globalna intensywność efektów.
> - Wyłączenie shake, bloom, błysków i mocnej aberracji.
> - Ograniczenie sway/warp oraz respektowanie `prefers-reduced-motion`.
> - Ostrzeżenie przed pierwszym intensywnym efektem bez blokowania gry na stałe.
> - Zapamiętanie ustawień.
>
> ## Kryteria odbioru
>
> - Tryb ograniczony usuwa gwałtowne ruchy i błyski.
> - UI jest dostępne z klawiatury i opisane.
> - Ustawienia działają dla każdego efektu i po przeładowaniu.

</details>

#### [#28 — [Audio] Dopracować głośnik i warstwę ambientu obozu](https://github.com/KruczyM/kurwa-moje-pole/issues/28)

- Status: **otwarte**
- Etykiety: `priority: medium`, `area: interaction`, `area: audio`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Głośność zależna od odległości od głośnika.
> - Płynne włączanie/wyłączanie i zachowanie stanu.
> - Lekkie ambienty wiatru/obozu z niezależną regulacją.
> - Obsługa polityki autoplay i błędów dekodowania.
>
> ## Kryteria odbioru
>
> - Muzyka nie gra globalnie z pełną głośnością na całej mapie.
> - Brak podwójnych instancji audio po ponownym wejściu.
> - Gra działa także po odmowie/autoplay block.

</details>

#### [#43 — [Efekty] Dodać opcjonalną fazę Matrix z zielonym kodem](https://github.com/KruczyM/kurwa-moje-pole/issues/43)

- Status: **otwarte**
- Etykiety: `priority: medium`, `area: ui`, `area: effects`
- Przypisani: brak
- Utworzono: 2026-08-31
- Ostatnia aktualizacja: 2026-08-31

<details>
<summary>Pełna treść issue</summary>

> ## Pomysł
>
> Okresowa faza wizualna inspirowana cyfrowym kodem: zielone znaki spływają po ekranie, a wybrane fragmenty świata chwilowo przechodzą w siatkową, kodową reprezentację.
>
> ## Zakres
>
> - Osobna, półprzezroczysta warstwa zielonych glifów renderowana wydajnie na canvasie lub w shaderze.
> - Krótkie fazy zamiast ciągłego zasłaniania obrazu.
> - Możliwość połączenia z modułem wireframe bez modyfikowania oryginalnych materiałów.
> - Czytelny HUD i interakcje ponad efektem.
> - Preset jakości, limit liczby glifów i brak alokacji w każdej klatce.
> - Tryb reduced motion oraz możliwość całkowitego wyłączenia błysków i ruchomego kodu.
>
> ## Kryteria odbioru
>
> - Kod płynnie pojawia się i zanika bez pozostawienia materiałów lub canvasa po zakończeniu.
> - Efekt nie zasłania całkowicie świata ani tekstu interfejsu.
> - Utrzymuje założony budżet FPS i pamięci.
> - Działa jako konfigurowalna faza, bez kopiowania logiki efektu grzybów.
>
> Powiązane: #25 i moduł `MushroomWireframeEffect`.

</details>

### Etap 5 — Multiplayer i głos

#### [#29 — [Multiplayer] Utworzyć serwer pokojów i autorytatywną rezerwację postaci](https://github.com/KruczyM/kurwa-moje-pole/issues/29)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: ui`, `area: multiplayer`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-31

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Node.js/TypeScript/Socket.IO, pokoje maksymalnie 8 osób.
> - Atomowa rezerwacja jednej z ośmiu postaci.
> - Status wolna/rezerwowana/zajęta w czasie rzeczywistym.
> - Timeout rezerwacji, reconnect grace period i zwalnianie slotu.
>
> ## Kryteria odbioru
>
> - Dwie osoby nie mogą zająć tej samej postaci.
> - Rozłączenie i reconnect nie tworzą duplikatu.
> - Klient otrzymuje jednoznaczne błędy i aktualny stan pokoju.
>
> ## Nazwa gracza
>
> - Po wybraniu postaci gracz wybiera również własną nazwę wyświetlaną, niezależną od nazwy postaci.
> - Nazwa jest walidowana po stronie klienta i serwera oraz synchronizowana jako część tożsamości gracza w pokoju.
> - Pole ma określony krótki limit znaków. Zbyt długa nazwa ma zostać zablokowana podczas wpisywania albo bezpiecznie przycięta z wielokropkiem podczas wyświetlania.
> - Nazwa jest wyświetlana nad głową modelu gracza jako czytelna etykieta o ograniczonej szerokości i maksymalnym dystansie widoczności.
> - Nazwa jest traktowana wyłącznie jako zwykły tekst: bez HTML, znaków sterujących i możliwości wstrzyknięcia kodu.
>
> ## Dodatkowe kryteria odbioru dla nazwy
>
> - Nie można zatwierdzić nazwy pustej ani składającej się wyłącznie z białych znaków.
> - Serwer przechowuje nazwę razem z rezerwacją postaci i przywraca ją po poprawnym ponownym połączeniu.
> - Powtarzające się nazwy wyświetlane mogą być dozwolone, ale gracze pozostają rozróżniani przez unikalne identyfikatory wewnętrzne.
> - Etykieta nie zasłania postaci i znika poza ustalonym zasięgiem.
>
> Powiązane: Issue #30 wykorzysta zsynchronizowaną nazwę do wyświetlania etykiet nad pozostałymi graczami.

</details>

#### [#30 — [Multiplayer] Synchronizować ruch, obrót i animacje graczy](https://github.com/KruczyM/kurwa-moje-pole/issues/30)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: animation`, `area: multiplayer`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Walidowany protokół snapshotów i zdarzeń.
> - Interpolacja zdalnego ruchu i korekcja opóźnień.
> - Synchronizacja stanu locomotion, normalized time i akcji jednorazowych.
> - Limity częstotliwości wiadomości i sanity checks pozycji.
>
> ## Kryteria odbioru
>
> - Zdalni gracze poruszają się płynnie bez częstych teleportów.
> - Walk/Run są zgodne z prędkością i nie restartują się na każdy pakiet.
> - Błędny klient nie może wysłać NaN ani opuścić granic pola.

</details>

#### [#31 — [Multiplayer] Przekazywać postacie między NPC a graczami bez duplikatów](https://github.com/KruczyM/kurwa-moje-pole/issues/31)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: npc-ai`, `area: multiplayer`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Po zajęciu postaci odpowiadający NPC znika w kontrolowanym stanie.
> - Po trwałym wyjściu gracza NPC wraca w bezpiecznym punkcie.
> - Jedno źródło prawdy dla właściciela postaci.
> - Synchronizacja stanu NPC po dołączeniu nowego klienta.
>
> ## Kryteria odbioru
>
> - Liczba graczy + NPC zawsze wynosi osiem.
> - Nie istnieją dwa egzemplarze tej samej postaci.
> - Reconnect nie resetuje całej populacji i animacji NPC.

</details>

#### [#32 — [Voice chat] Dodać przestrzenny WebRTC z mute i zasięgiem 50 m](https://github.com/KruczyM/kurwa-moje-pole/issues/32)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: multiplayer`, `area: audio`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Jawna prośba o mikrofon po wyborze postaci.
> - Sygnalizacja WebRTC, STUN/TURN i obsługa reconnect.
> - Web Audio z tłumieniem przestrzennym do ciszy przy 50 m.
> - Mute, wskaźnik mikrofonu i pełne sprzątanie peer connections.
> - Brak nagrywania i przechowywania strumieni.
>
> ## Kryteria odbioru
>
> - Działa między różnymi sieciami i w co najmniej dwóch przeglądarkach.
> - Odmowa mikrofonu nie blokuje gry.
> - Rozłączenie usuwa audio bez pozostawionego dźwięku.

</details>

#### [#33 — [Sieć] Dodać wersjonowany protokół, walidację i testy reconnect](https://github.com/KruczyM/kurwa-moje-pole/issues/33)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: multiplayer`, `area: qa`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Wspólne typy wiadomości klient/serwer i numer wersji protokołu.
> - Walidacja payloadów i rate limiting.
> - Test utraty pakietów, wysokiego pingu, odświeżenia strony i utraty sieci.
> - Telemetria rozłączeń bez danych wrażliwych.
>
> ## Kryteria odbioru
>
> - Stary lub błędny klient dostaje czytelne odrzucenie.
> - Reconnect przywraca właściwą postać i stan bez duplikatu.
> - Serwer nie crashuje od niepoprawnego payloadu.

</details>

### Etap 6 — Optymalizacja i wydanie

#### [#34 — [Performance] Ustalić i egzekwować budżety CPU, GPU, pamięci i assetów](https://github.com/KruczyM/kurwa-moje-pole/issues/34)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: qa`, `performance`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Panel dev: FPS, frame time, draw calls, triangles, texture memory i liczba aktywnych mixerów.
> - Limit DPR i profile jakości.
> - LOD/instancing, kompresja GLB/tekstur i etapowe ładowanie.
> - Profilowanie 8 postaci, trawy, efektów i multiplayera.
>
> ## Kryteria odbioru
>
> - Cel 60 FPS w 1080p, bez stałych spadków poniżej 45 FPS na uzgodnionym sprzęcie.
> - Brak narastania pamięci w 30-minutowej sesji.
> - Każdy preset ma opisany budżet i fallback.

</details>

#### [#35 — [QA] Dodać automatyczne smoke/E2E i pełną macierz odbiorową](https://github.com/KruczyM/kurwa-moje-pole/issues/35)

- Status: **otwarte**
- Etykiety: `priority: critical`, `area: qa`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Start, wybór każdej postaci, wejście do gry, ruch, kolizja, NPC, interakcja i efekt.
> - Rozdzielczości 1280×720, 1920×1080 i szeroki ekran.
> - Chrome/Edge/Firefox oraz scenariusz dwóch klientów.
> - 30-minutowy soak pamięci, AI, audio i sieci.
>
> ## Kryteria odbioru
>
> - Test nie dopuszcza czarnego ekranu, 404 assetów ani błędu konsoli.
> - Raport zawiera screenshoty i wyniki wydajności.
> - Pełna lista Definition of Done ze specyfikacji jest zweryfikowana.

</details>

#### [#36 — [Release] Przygotować deployment HTTPS/WSS, TURN i konfigurację środowisk](https://github.com/KruczyM/kurwa-moje-pole/issues/36)

- Status: **otwarte**
- Etykiety: `priority: high`, `area: multiplayer`, `area: qa`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Powtarzalny build i deployment klienta/serwera.
> - Zmienne środowiskowe bez sekretów w repo.
> - HTTPS/WSS, serwer TURN i healthcheck.
> - Cache headers oraz poprawne ścieżki assetów/LFS.
> - Instrukcja rollbacku.
>
> ## Kryteria odbioru
>
> - Nowa instalacja działa według README.
> - Multiplayer i głos działają na publicznym adresie.
> - Nie ma sekretów, lokalnych ścieżek ani zależności od `art/`.

</details>

#### [#37 — [Release] Audyt licencji, Git LFS, dokumentacji i archiwum źródeł](https://github.com/KruczyM/kurwa-moje-pole/issues/37)

- Status: **otwarte**
- Etykiety: `documentation`, `priority: high`, `area: assets`, `area: qa`
- Przypisani: brak
- Utworzono: 2026-08-30
- Ostatnia aktualizacja: 2026-08-30

<details>
<summary>Pełna treść issue</summary>

> ## Zakres
>
> - Spis pochodzenia/licencji modeli, tekstur, muzyki i kodu vendored.
> - Weryfikacja, że wszystkie wymagane binaria są śledzone przez Git LFS.
> - README instalacji, struktury, Blender/Mixamo pipeline i rozwiązywania problemów.
> - Lista lokalnych źródeł w `art/`, które nie są częścią repo, z zasadą backupu.
>
> ## Kryteria odbioru
>
> - Czysty clone + `git lfs pull` wystarcza do uruchomienia projektu.
> - Żaden runtime asset nie zależy od ignorowanego katalogu.
> - Licencje pozwalają na planowaną dystrybucję.

</details>
