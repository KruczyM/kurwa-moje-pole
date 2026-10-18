# Pol’and’Rock 2026 — etapy realizacji

## Bieżąca kolejka — 26.09.2026

Duża Scena i ASP są obecnie wykonywane przez Gemini. Nie modyfikować tych modeli ani ich builderów do czasu zgłoszenia zakończenia; dopiero wtedy osobny review.

Priorytet użytkownika: deformacje ramion/ubrań NPC. Wdrożono korektę wag oraz nową Klątwę w wyborze; szczegóły i ograniczenia w [raporcie animacji](festival-motion-bank.md). Odbiór wizualny w grze pozostaje otwarty.

Pozostała kolejka (starsze sekcje niżej są historią, nie stanem ukończenia):

1. Małe parasole gastronomiczne, osobny punkt zwrotu kaucji i punkty odpadów przy pasażu.
2. Strefy mBank, PZU, medyczna, TVP oraz balony Altercore; nie odgadywać nieczytelnych referencji.
3. Pole słoneczników zgodnie z relacją do alei ASP na mapie, po ustaleniu miejsca scen przez Gemini.
4. Odbiór trawy, szyldów i przejść w dzień/noc; pomiar FPS/pamięci tłumu i optymalizacja.
5. Dopracowanie siadania na ziemi oraz dopasowania pozy odpoczynku do proporcji poszczególnych rigów.
6. Dodatkowe animacje multiplayer i przekazywanie postaci NPC ↔ gracz (otwarte #30/#31).
7. Mapa z pozycją gracza i punktami orientacyjnymi (#107).
8. Przegląd aktualności błędów używania przedmiotów (#96/#97) oraz technicznych zadań release/QA (#34–#37). Nie traktować samego otwartego Issue jako dowodu, że poprawki jeszcze nie istnieją.

Świece, biżuteria i koty mają już dedykowane wyposażenie w builderze stoisk. 107 modeli ma riggi/animacje, a wybór gracza 16 pozycji — nie powtarzać dawnego zadania importu statycznych NPC.

## Bieżąca kolejność prac — 24.09.2026

Pracujemy na `feat/festival-next`. Poniższe starsze sekcje pozostają historią decyzji. Aktualny stan: świat 320 × 320 m, 207 namiotów na równych parcelach, sześć parceli wokół obozu, asfaltowy pasaż z 18 stoiskami, Lidlem i IQOS oraz dokładnie dwa namioty Red Bull. Front SiemaShopu korzysta z fotografii użytkownika; ma ograniczenia perspektywy i uciętego prawego krańca. Szczegóły: [materiały i rozmieszczenie](festival-materials-2026-09-24.md).

1. Dopracować wyposażenie istniejących stoisk według fotografii: świece, biżuteria i ręcznie szyte koty zamiast skopiowanych okularów/koszulek. Kwiatek Lasu zachowuje neutralną ekspozycję do potwierdzenia asortymentu.
2. Sprawdzić render pasażu i wygląd trawy w grze, czytelność szyldów oraz przejścia. Odbiór runtime nadal `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
3. Następne elementy z referencji: małe parasole przy gastronomii, punkt zwrotu kaucji i infrastruktura odpadów; potem namioty warsztatowe/ASP i strefy. Nie odtwarzać nieczytelnych logotypów jako rzekomo oryginalnych.
4. Integracja nowych NPC wymaga osobnego domknięcia riggingu i kontroli deformacji. Statyczne modele nie są gotowymi chodzącymi postaciami.

Aktualna prośba użytkownika wznawia prace nad modelami i wyglądem; historyczne wstrzymanie nowych modeli poniżej nie jest już bieżącym priorytetem.

Zakres użytkownika: Czaplinek–Broczyno 2026, mapa i fotografie przekazane w rozmowie.
Zdjęcia scen pochodzą z różnych edycji; nie traktujemy dekoracji z 2014/2021 jako dokumentacji 2026.
Istniejący prototyp na `feat/polandrock-czaplinek-festival` pozostaje osobno; jego układ wymaga weryfikacji względem mapy użytkownika.
Prace startują z `382488d`, zachowując naprawione animacje i rekwizyty postaci.

## Aktualizacja priorytetów — 23.09.2026

- Domknąć i przenieść gotowe poprawki na lokalny `main`, zgodnie z najnowszą prośbą użytkownika. Nie uruchamiać dalszych zadań Antigravity.
- SiemaShop: duża hala 24 × 18 m, kolorowy front, istniejące stoiska wzdłuż betonowej drogi, bez trawy pod stoiskami i Lidlem; głośnik nieruchomy, niezależny od NPC.
- **Do wykonania: prawdziwa tekstura frontu SiemaShopu z fotografii użytkownika.** Obecny wzór jest zastępczy, nie jest wycięty ze zdjęcia. Potrzebny możliwie frontalny oryginał (najlepiej co najmniej 2000 px szerokości) z widocznym całym banerem, bez zasłaniających go osób i elementów odtwarzacza. Przesłane miniatury pozwalają odtworzyć bryłę, ale drobny druk i grafika są zbyt rozmyte do ostrej tekstury dużej hali. Nie zastępować oryginalnej grafiki wygenerowaną imitacją bez oznaczenia.
- Nowe statyczne modele NPC nadal wymagają riggingu; nie przedstawiać ich jako gotowych chodzących postaci.

## Poprzedni priorytet — NPC; kolejne modele otoczenia wstrzymane

Domknięto iterację: niebieski sześciopodporowy Red Bull (cztery instancje), białe segmenty hal Festiwalowy Antykwariat, Punkt Informacyjny i Kodano Optyk. Wymiary i rozmieszczenie robocze. Mały parasol gastronomiczny nie jest jeszcze osobnym modelem. `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

Zgodnie z nową prośbą nie rozpoczynać następnego modelu otoczenia. Priorytet: NPC i płynność ruchu. Faktyczny katalog to `Hunyuan3D-2GP/output/characters_mv`: 91 folderów, 90 modeli teksturowanych, żaden bezpośrednio nie nadaje się do animacji (brak szkieletów i klipów). Najpierw rigging oraz kontrola deformacji i budżetu, następnie integracja przez istniejący loader. Nie zastępować animacji chodzenia przesuwaniem statycznej figurki.

## Rozszerzenie zakresu z nowych zdjęć — częściowo wdrożone, reszta wstrzymana

Pełna lista konstrukcji, szyldów, odczytów i numerów 31 załączników: [nowe referencje użytkownika](festival-user-reference-batch.md). Poniżej pełny zakres docelowy; wykonany podzbiór opisano powyżej.

- Przebudować duży Red Bull na **namiot gwiaździsty**, z około czterema instancjami według relacji użytkownika. Zachować osobny typ małego parasola przy gastronomii; nie mylić tych konstrukcji.
- Rozszerzyć pasaż o białe hale dwuspadowe/segmentowe zamiast samych pagód, wyposażenie i szyldy z listy referencyjnej: świece ręcznie malowane, Stacja Skierniewice, biżuteria naturalna, Kodano Optyk, książki z dedykacją **od autorów**, Kwiatek Lasu, Festiwalowy Antykwariat, szarawary, Zuch Olek, Militaria, Altercore, Sankowo, Vesper/In Rock, Lokaah, ŠIVA SHOP oraz Cruship (ostatnia nazwa do potwierdzenia). ŠIVA SHOP jest odrębny od istniejącego SiemaShop.
- Dodać punkt informacyjny, punkt medyczny z wysokim żółtym oznaczeniem, TVP, Strefę Działań Twórczych i Namiot Warsztatowy.
- Przy głównej drodze zaplanować powtarzalne punkty odpadów: kontenery, ogrodzenie i banery „Zaraz Będzie Czysto”. W rejonie pasażu halę napojów „PUSZKA”/Tyskie oraz **oddzielny punkt zwrotu kaucji**.
- Uzupełnić ASP o boczny widok dużej hali łukowej. Dodać strefę mBank z oznaczeniami i przestrzenną bramą „m”/schodami, strefę PZU oraz dwa duże czarne balony Altercore na uwięzi.
- Dodać pole słoneczników według wcześniejszej mapy: rejon Alei ASP przy Dużej Scenie; relację przestrzenną najpierw przeliczyć na docelowy układ, bez zgadywania współrzędnych w obecnym obozie testowym.
- IQOS pozostaje niezweryfikowanym modelem roboczym — użytkownik nie znalazł zdjęć wioski.

Kolejność: poprawne konstrukcje → szyldy i wyposażenie pasażu → infrastruktura drogi → ASP i strefy → rozmieszczenie/roślinność → testy i odbiór. Dokładne kryteria oraz niepewne nazwy zapisane w dokumencie referencji.

## 1. Obecne namioty — wdrożona pierwsza iteracja, odbiór w grze oczekuje

- Główna referencja dużego biało-beżowego namiotu: `docs/festival-2026-tent-references.md` (trzy zdjęcia użytkownika w rozmowie).
- Zmierzyć i obejrzeć wszystkie dziewięć źródłowych GLB.
- Sprawdzić podłogi i otwory w `big2` i `dużynamiot`; uzupełnić brakujące elementy bez zasłaniania wejść.
- Zachować istniejące kolory/UV i poprawić odpowiedź materiału: tkanina, mikronormalne i zróżnicowana szorstkość.
- Zachować oryginały; poprawione modele podpiąć przez istniejący katalog i loader.
- Sprawdzić skalę, osadzenie, kolizje, budżet geometrii i osadzone tekstury.
- Odbiór: deterministyczne testy GLB, rendery porównawcze i kontrola w grze.

Implementacja i ograniczenia: `docs/tent-upgrades.md`. Testy i build zaliczone. `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

## 2. Nowa biblioteka namiotów

Pierwsze cztery prototypy podpięte jako T16–T19 (ostatni: rodzinny tunelowy); dodano dwa poziomy LOD dla nowych modeli. Rendery sprawdzone. Sześć palet i 47 instancji dodano w etapie 3; nie wdrożono setek namiotów. Dalsze dopracowanie i odbiór w grze oczekują. Szczegóły: [tent-lod.md](tent-lod.md).

- Najpierw trzy wzorce z referencji: lekki kopułowy, wysoki przedsionek, kopułowy z przedsionkiem.
- Następnie tunelowe, rodzinne i samorozkładające; różnice konstrukcji, nie tylko kolorów.
- Szwy, stelaże, zamki, moskitiery, odciągi, śledzie, podłogi i warianty otwarcia.
- Warianty kolorów, zużycia i wyposażenia; uproszczenia na dystans oraz współdzielone zasoby.
- Odbiór: zaakceptowany wygląd trzech wzorców przed mnożeniem wariantów.

## 3. Teren 2026 i obozowiska

Wdrożono cztery robocze sektory i 47 dodatkowych namiotów, sześć palet oraz testy dojść. Nie jest to jeszcze układ geograficzny 2026. Szczegóły: [festival-camping.md](festival-camping.md).

- Układ z mapy użytkownika, aleje, pas lotniska, sektory i dojścia.
- Rozmieszczenie namiotów z deterministycznym ziarnem, wolnymi wejściami i drogami.
- Rozdzielić skalę rzeczywistą od ewentualnych skrótów gameplayowych; oznaczyć niepotwierdzone pozycje.
- Odbiór: drożne trasy gracza/NPC, brak kolizji namiotów i pomiary wydajności.

## 4. Duża Scena i ASP

- Ustalić referencje dekoracji 2026; starsze fotografie służą tylko jako referencje konstrukcyjne.
- Modele kratownic, dachów/namiotu ASP, podestów, ekranów, nagłośnienia i zaplecza.
- Nowe boczne ujęcie ASP: biała hala łukowa, rytm żeber i otwarte boki; połączyć z wcześniejszymi referencjami frontu, nie zastępować zwykłą pagodą.
- Materiały, banery, oświetlenie dzienne/nocne i uproszczenia dystansowe.
- Odbiór: porównania z referencjami z kilku ujęć; brak deklaracji dokładności 1:1 bez wymiarów.

## 5. Charakterystyczne miejsca

Dodano [pasaż handlowy](festival-market.md): sześć białych stoisk, trzy kategorie wyposażenia i dodatkowy wzorzec SiemaShop, asfaltową alejkę. Pełna lista wystawców niepotwierdzona. Testy obejmują dojście do lad; brak sprzedaży i obsługi NPC.

Dodano [scenę Pomorza Zachodniego, parasol Red Bull i roboczą strefę IQOS](festival-zones.md). Scena oparta na obejrzanych oficjalnych zdjęciach. Nowe załączniki pokazują potrzebę osobnego dużego namiotu gwiaździstego Red Bull; jego przebudowa jest zaplanowana, jeszcze niewykonana. IQOS nadal bez referencji wyglądu. Rozmieszczenie wyłącznie robocze, oddzielone od rekonstrukcji Dużej Sceny i ASP.

Pierwsze prototypy hali [Lidl Rock Shop](festival-rock-shop.md) i [młyna Allegro](festival-wheel.md) podłączone w roboczych miejscach, z colliderami i maskami trawy. Młyn ma animację delta-time oraz zatrzymanie przy ograniczeniu ruchu. Nie są jeszcze odwzorowaniem 1:1 ani docelowym układem mapy.

- Diabelski młyn Allegro: konstrukcja, gondole, animacja i iluminacja.
- Grzybek: konstrukcja, strugi, rozpryski, mokre podłoże i dźwięk.
- Pasaż: modułowe stoiska, zadaszenia, szyldy i wyposażenie.
- Lidl Rock Shop: hala, fasada, wejścia i otoczenie.
- Odbiór: rozpoznawalne obiekty, właściwe miejsca, kolizje oraz wydajność efektów.

## 6. Festiwalowi NPC

- Warianty obecnych rigowanych postaci z dodatkami i ubraniami, bez utraty animacji.
- Istniejące kontrolery ruchu, taniec, odpoczynek i interakcje z rekwizytami.
- Odbiór: brak przenikania, zacinania i wspólnej mutacji materiałów/animacji.

## 7. Integracja i odbiór

- Jedna pętla renderowania, aktualizacje delta-time, cache i sprzątanie zasobów.
- Testy, build, raport przeglądarki, pomiary FPS/pamięci i kontrola dzień/noc.
- Brak dostępnej przeglądarki oznacza `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`, a nie zaliczony odbiór wizualny.
- Bez płatnych API, push, PR i merge. Hunyuan3D tylko lokalnie, opcjonalnie.
