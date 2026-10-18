# After: ostatnia noc — kompletny plan gry 2D

Data: 2026-10-11. Status: specyfikacja do implementacji, nie raport ukończenia.
Powiązany dokument: [Kurwa, moje combo!](festival-fighter-2d-plan.md).

## 1. Wizja i zasady pracy

Samodzielna przygodowa gra akcji 2D z widokiem z góry, solo lub w kooperacji 2–4 osób. Po ostatnim koncercie ekipa szuka znajomych, odzyskuje obozową flagę i próbuje dotrzeć do swojego obozu przed świtem. Festiwal jest jednocześnie znajomy, chaotyczny i surrealistyczny. Humor wynika z postaci, dialogów, przedmiotów i współpracy, nie tylko z losowych wulgaryzmów.

Gra uruchamiana z głównego menu, bez ładowania festiwalu 3D. Wykorzystuje te same 16 tożsamości bohaterów, ale własne zasady, mapy, grafikę i zapis. Nie jest nakładką na bieżącą sesję świata 3D.

- [ ] Przeczytać `AGENTS.md` i istniejący system przed zmianami.
- [ ] Własne Issue/zadanie, branch i worktree; brak bezpośrednich zmian `main`.
- [ ] Brak płatnych API, kluczy AI, automatycznego overage i runtime generatywnego dialogu.
- [ ] Brak samodzielnego push/PR/merge; oddać pakiet do niezależnego review.
- [ ] Zachować cudze zmiany; nowy zakres nie usprawiedliwia przepisywania festiwalu.
- [ ] Checkboxy odhaczać po testach i odbiorze, nie po utworzeniu pliku.
- [ ] Gameplay wymaga raportu przeglądarki albo `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

### Zakres produktu

Wydanie docelowe: kampania na około 60–90 minut jako cel projektowy do pomiaru w playtestach, sześć stref, 16 bohaterów, kooperacja 1–4, znajomości z NPC, alternatywne zakończenia i powtarzalne zdarzenia. Pierwszy przekrój: 10–15 minut, dwie postacie, jedna mała strefa, trzy zadania, jedna zagadka kooperacyjna działająca też solo i finał.

Nie obejmuje na start: MMO, wspólnego persistent świata, otwartego edytora map, proceduralnej fabuły AI, realistycznych receptur/dawkowania używek, zaawansowanych walk jak w bijatyce. Motywy imprezowe i surrealistyczne nie przekładają się na instrukcje realnego używania substancji. Dostępna wersja z ograniczonymi efektami wizualnymi i bez wymuszonego ich użycia.

## 2. Główna pętla rozgrywki

```text
Odkryj obszar → porozmawiaj / zauważ problem → wybierz zadanie
  → zbierz narzędzia i znajomych → rozwiąż zręcznościowo lub społecznie
  → zmień stan świata / relacje → otwórz kolejną drogę → wróć do obozu
```

Gracz w każdej chwili ma czytelny cel główny i najwyżej kilka zadań pobocznych. Nie potrzebuje znajomości wszystkich żartów ani dialogów, żeby ukończyć grę. Nieudana próba ma tworzyć komiczną komplikację, a nie 15 minut powtarzania drogi.

- [ ] Podstawowy ruch, interakcja, przedmiot, aktywna umiejętność i przywołanie celu.
- [ ] Łatwo czytelny dziennik, mapa, znacznik celu opcjonalny i powtórzenie ważnego dialogu.
- [ ] Wiele rozwiązań przynajmniej kluczowych zadań: narzędzie, rozmowa lub współpraca.
- [ ] Brak softlocków wynikających z wyboru konkretnej postaci, zużycia przedmiotu lub rozłączenia kolegi.

## 3. Architektura i wspólny host

Przed implementacją przeczytać `src/main.ts`, `src/game/Game.ts`, `AppStateMachine.ts`, `NetworkClient.ts`, protokół pokoju i katalog postaci. Obecna maszyna stanów opisuje festiwal; nie dopisywać do niej wszystkich stanów fabuły.

**Zależność SHARED-01:** wspólny `GameHost`, `GameRegistry`, profil, routing wejść, audio i magazyn zasobów opisano w planie bijatyki. Reużyć raz zatwierdzony kontrakt. After nie musi czekać na ukończenie bijatyki — jego czysta symulacja i dane mogą powstawać równolegle; integracja menu czeka na hosta.

```text
GameHost — istniejący renderer / pojedynczy RAF
  └── AfterModule
       ├── AfterSimulation: stan świata i reguły
       │    ├── Movement / Collision / Interaction
       │    ├── QuestEngine / DialogueEngine / RelationshipSystem
       │    ├── Inventory / Abilities / EventDirector
       │    └── NpcSystem / Companions / SaveState
       ├── AfterView: tilemap, sprite'y, kamera, efekty
       ├── AfterUI: dziennik, dialogi, mapa, ekwipunek
       ├── SessionAdapter: lokalna sesja albo serwer
       └── AssetScope / AudioScope / InputScope
```

Preferować zwykłe typowane systemy i dane zamiast pełnego nowego frameworka ECS. Symulacja bez Three.js/DOM, prezentacja odczytuje stan i zdarzenia. Tylko `AfterView` zna sprite'y i obiekty sceny.

```text
src/games/after/
  AfterModule.ts
  simulation/{AfterSimulation,WorldState,Movement,Collision,Interaction}.ts
  simulation/{Inventory,Abilities,NpcSystem,Companions,EventDirector}.ts
  story/{QuestEngine,DialogueEngine,Relationships,Conditions,Effects}.ts
  data/{characters,maps,quests,dialogues,items,events}/
  presentation/{AfterView,TilemapView,SpriteAnimator,CameraRig,Effects}.ts
  ui/{AfterHud,Journal,DialoguePanel,InventoryPanel,MapPanel}.ts
  network/{AfterTransport,Prediction,protocol}.ts
  persistence/{SaveSchema,SaveMigration,SaveRepository}.ts
server/after/{AfterLobby,AfterSession,validation}.ts
scripts/after/{export-sprites,validate-map,validate-story}.*
public/game-assets/2d/after/{characters,tiles,maps,props,audio}/
```

Proponowane ścieżki, nie istniejące moduły. Nie tworzyć drugiego `NetworkClient`; potrzebne publiczne adaptery i rozdzielenie zdarzeń gry.

### Kontrakty danych

| Typ                  | Obowiązkowa zawartość                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `AfterWorldState`    | schema/content version, sessionId, seed, tick, faza nocy, encje, questy, relacje, flags, zdarzenia        |
| `PlayerState`        | stabilny slot uczestnika, canonical characterId, pozycja, kierunek, kondycja, ekwipunek, ability cooldown |
| `MapDefinition`      | ID, rozmiar, siatka, warstwy, kolizje, strefy, portale, punkty NPC, bezpieczne spawny                     |
| `QuestDefinition`    | ID, prerequisites, objective graph, warianty rozwiązań, efekty, fail-forward, nagrody                     |
| `DialogueDefinition` | węzły, warunki, odpowiedzi, efekty, wyjścia awaryjne, tekst/lokalizacja                                   |
| `ItemDefinition`     | ID, typ, stack limit, użycie, quest critical, transfer policy, presentation asset                         |
| `WorldEvent`         | unikalne ID, tick, typ, podmioty, payload, reguły powtórzenia                                             |
| `InteractionCommand` | sessionId, sequence, action, targetId, params; serwer sprawdza odległość i warunki                        |

DSL warunków i efektów jest zamkniętą listą operacji, np. `hasItem`, `questStage`, `relationAtLeast`, `giveItem`, `setFlag`. Nie uruchamiać `eval` ani JavaScriptu zawartego w JSON/dialogach.

## 4. Ruch, interakcje i fizyka

Widok z góry, osiem kierunków ruchu. Kierunek diagonalny nie przyspiesza postaci. Kolizja dotyczy stóp, a sortowanie sprite'ów bazuje na pozycji stóp, nie środku obrazka. Nie jest potrzebny pełny silnik fizyki 3D.

- [ ] CORE-01: stała symulacja 30 Hz; prezentacja/interpolacja do 60 FPS z pojedynczego RAF hosta.
- [ ] CORE-02: chód, sprint, kondycja, spowolnienie podczas noszenia i cooldown zdolności.
- [ ] CORE-03: collision grid, proste bryły obiektów, spatial hash; bez skanowania całej mapy co klatkę.
- [ ] CORE-04: przesuwanie wzdłuż przeszkód, drzwi i przejścia; brak blokady na dekoracyjnych linkach namiotu.
- [ ] CORE-05: wybór najbliższej ważnej interakcji, widoczny prompt, zasięg i priorytet.
- [ ] CORE-06: podnoszenie, odkładanie, używanie, przenoszenie i oddawanie przedmiotów.
- [ ] CORE-07: noszenie wspólnego obiektu przez dwóch graczy; lokalnie zastępstwo towarzyszem/alternatywną drogą.
- [ ] CORE-08: checkpoint i przywrócenie z bezpiecznej pozycji; upadek/wyczerpanie bez trwałego zablokowania kampanii.
- [ ] CORE-09: walidacja spawnów, portali i pozycji po zmianie kolizji; mechanizm odzyskania utkniętej postaci.
- [ ] CORE-10: pauza lokalna; menu online nie pauzuje świata, otwarcie menu zeruje kierunki ruchu gracza.

Skok nie jest wymagany do pierwszego przekroju. Jeśli dodany, stan wysokości wizualnej oddzielić od pozycji na mapie; nie pozwalać omijać krytycznych ścian przypadkiem.

## 5. Bohaterowie i współpraca

Wszystkie 16 ID z obecnego katalogu. Umiejętności są propozycją do zatwierdzenia. Każda musi mieć alternatywę w zadaniu: narzędzie, pomoc NPC lub dostępnego towarzysza. Nie wymagać konkretnego składu do przejścia fabuły.

| Gotowe | Postać    | Rola / umiejętność       | Przykładowe zastosowanie                     |
| ------ | --------- | ------------------------ | -------------------------------------------- |
| [ ]    | Amper     | uruchomienie urządzenia  | naprawa lampy lub generatora                 |
| [ ]    | Antena    | nasłuch                  | wskazanie kierunku sygnału radia             |
| [ ]    | Gruczoł   | siła                     | przesunięcie skrzyni i pomoc w transporcie   |
| [ ]    | Klątwa    | surrealistyczna intuicja | wykrycie zmyłki i fałszywego drogowskazu     |
| [ ]    | Krwiak    | szybka pomoc             | sprawniejsze podnoszenie wyczerpanego kolegi |
| [ ]    | Pień      | stabilizacja             | trzymanie pawilonu podczas podmuchu          |
| [ ]    | Pierścień | zręczność                | przejście krótkiej ciasnej trasy             |
| [ ]    | Zawór     | obsługa instalacji       | odblokowanie kurtyny wodnej                  |
| [ ]    | Ambona    | przemowa                 | uspokojenie kłócących się NPC                |
| [ ]    | Chlebak   | prowiant                 | dodatkowy slot jedzenia/poczęstunek          |
| [ ]    | Dziąsło   | rozmowa                  | dodatkowa opcja żartobliwego przekonania     |
| [ ]    | Hemoroid  | odpoczynek               | krótka strefa regeneracji drużyny            |
| [ ]    | Jęczmień  | porządkowanie            | odnajdywanie rzeczy w stercie sprzętu        |
| [ ]    | Kobra     | refleks                  | łatwiejsza krótka próba zręcznościowa        |
| [ ]    | Korba     | mechanika                | ręczne napędzenie urządzenia                 |
| [ ]    | Szerszeń  | mobilność                | krótki sprint z ograniczonym cooldownem      |

- [ ] Dwie postacie pilotowe: Amper i Chlebak; ostateczny wybór może się zmienić po ocenie zasobów.
- [ ] Solo: jeden gracz + prosty towarzysz, którego można przywołać do współpracy.
- [ ] Towarzysz nie blokuje drzwi, teleportuje się wyłącznie poza widokiem/na bezpieczny punkt, nie gubi przedmiotów krytycznych.
- [ ] W co-op brak obowiązkowego wspólnego ekranu; każdy ma lokalną kamerę, cel i ping drużyny.
- [ ] Zmiana bohatera w obozie/checkpoincie, nie w trakcie krytycznej animacji.
- [ ] Duplikaty bohaterów w co-op dozwolone z odróżniającym kolorem/znacznikiem; brak rezerwacji całej postaci w festiwalu.

## 6. Świat, strefy i fabuła

Mapa After jest świadomą adaptacją festiwalu, nie wiernym eksportem wszystkich metrów świata 3D. Zachować rozpoznawalne miejsca i układ orientacyjny, skrócić puste przejścia dla tempa. Nie zmieniać przy tej okazji mapy festiwalu 3D.

### Strefy

- [ ] ZONE-01: Obóz Kurwa Moje Pole — bezpieczny hub, instruktaż, wybór towarzysza, checkpoint.
- [ ] ZONE-02: Nocny pasaż — gastro, znajomi, handel zwykłymi przedmiotami i kolejki.
- [ ] ZONE-03: Morze namiotów — zagubiony znajomy, fałszywe tropy i flagi orientacyjne.
- [ ] ZONE-04: Zaplecze dużej sceny — przeszkody techniczne, głośna muzyka, zagadka z zasilaniem.
- [ ] ZONE-05: Okolice młyna i słoneczników — spokojniejsza eksploracja, scena widokowa i zadanie społeczne.
- [ ] ZONE-06: Burzowy powrót — zmieniony fragment znanej mapy, finał z ratowaniem obozu.

### Oś kampanii

1. **Ostatni numer:** ekipa wraca do obozu, brakuje flagi i jednej osoby.
2. **Trzy wersje tej samej historii:** świadkowie dają sprzeczne, ale użyteczne tropy.
3. **Przysługa za przysługę:** pomoc w gastro lub przy prądzie daje dostęp/informację.
4. **Nie ten obóz:** podobne flagi i namioty prowadzą do komicznego nieporozumienia.
5. **Zbiera się na burzę:** znajomy odnaleziony, trzeba zebrać ekipę i sprzęt.
6. **Powrót przed świtem:** finał zależny od pomocy ludziom i odzyskanych rzeczy.

Nie stosować ukrytego sztywnego czasu, który niespodziewanie przegrywa kampanię. Faza nocy przechodzi głównie wraz z fabułą; limit czasu tylko w jasno oznaczonych lokalnych próbach, z możliwością ponowienia.

### Zadania główne i poboczne

- [ ] QUEST-01: odzyskaj flagę — rozmowy, tropy, negocjacja albo przysługa.
- [ ] QUEST-02: znajdź znajomego — radio, charakterystyczny przedmiot, sprawdzenie obozów.
- [ ] QUEST-03: uruchom światło — kabel, źródło prądu i bezpieczna trasa połączenia jako zagadka, nie realna instrukcja elektryczna.
- [ ] QUEST-04: przenieś śpiącego kolegę — transport z humorem, bez utraty jego przedmiotów.
- [ ] QUEST-05: uratuj pawilon — współpraca podczas krótkich podmuchów.
- [ ] QUEST-06: finałowy powrót i zabezpieczenie obozu.
- [ ] SIDE-01: ładowarka, którą pożyczyło już pięć osób.
- [ ] SIDE-02: ostatni kebab — pomoc w stoisku zamiast obowiązkowej zapłaty.
- [ ] SIDE-03: znaleziony telefon — odnajdź właściciela po komicznych wskazówkach.
- [ ] SIDE-04: obóz z identyczną flagą — rozwiązanie nieporozumienia.
- [ ] SIDE-05: koncert na dwóch strunach — krótka próba rytmiczna, opcjonalna.
- [ ] SIDE-06: zaginiony lewy but — kilka absurdalnych tropów, jeden prawdziwy.

Każde zadanie ma tabelę: start, wymagania, kolejne cele, alternatywy, efekty, zapis, zachowanie po reconnect, niepowodzenie i odzyskanie. Nagrody: relacje, skróty, pamiątki i dialogi; nie tylko waluta.

## 7. Dialogi, znajomości i zakończenia

- [ ] STORY-01: silnik grafu dialogów z walidacją osiągalności i legalnych ID.
- [ ] STORY-02: warunki i efekty danych, bez runtime LLM i wykonywania dowolnego kodu.
- [ ] STORY-03: 8–12 charakterystycznych NPC jako cel docelowy; pierwszy przekrój trzech.
- [ ] STORY-04: relacje oparte na jawnych flagach i niewielkiej skali zaufania; ważne decyzje dają czytelną reakcję.
- [ ] STORY-05: znajomy pamięta pomoc, otwiera skrót, daje wskazówkę lub pojawia się w finale.
- [ ] STORY-06: quest NPC nie jest zabierany innym graczom przez prywatny dialog; efekty krytyczne zatwierdza sesja.
- [ ] STORY-07: w kooperacji właściciel rozmowy wybiera odpowiedź, inni mogą obserwować; ważne decyzje drużyny mają głosowanie z timeoutem i jasno opisanym remisem.
- [ ] STORY-08: można pominąć tekst, powtórzyć wskazówkę i wyjść bez utraty fabuły.
- [ ] STORY-09: trzy finały: pełna ekipa i uratowany obóz / powrót z komicznymi stratami / legendarny after i wspólne sprzątanie.

Motywy imprezy i używek: opcjonalne, fikcyjne sekwencje surrealistyczne oraz rozmowy o konsekwencjach. Nie premiować realnych dawek ani nie wymagać zażycia do ukończenia gry. Zniekształcenia nie mogą ukrywać kluczowych promptów, mapy i bezpiecznej drogi wyjścia. Suwak intensywności, reduced-motion i możliwość pominięcia sekwencji.

## 8. Dynamiczne zdarzenia i humor

`EventDirector` dobiera zdarzenia z seedem, kontekstem strefy, cooldownem i limitem aktywnych sytuacji. Nie uruchamia krytycznego podmuchu w trakcie ważnego dialogu i nie zalewa gracza ciągłymi przeszkadzajkami.

- [ ] EVENT-01: latający pawilon — krótki pościg i zbieranie części, bez trwałego zniszczenia krytycznego obozu.
- [ ] EVENT-02: zagubiony orszak — NPC idą za niewłaściwą flagą, można ich naprowadzić.
- [ ] EVENT-03: generator kaszle — światło przygasa, lokalna zagadka otwiera alternatywną trasę.
- [ ] EVENT-04: błotny skrót — szybsza droga, ale ubrudzenie wywołuje nowe komentarze.
- [ ] EVENT-05: wózek jedzie sam — zręcznościowy pościg z kontrolowanym restartem.
- [ ] EVENT-06: gadający toi-toi — opcjonalny absurdalny dialog, nie blokuje potrzebnych obiektów.
- [ ] EVENT-07: spontaniczna impreza — NPC tworzą małe pogo, można dołączyć lub obejść.
- [ ] EVENT-08: zaginiony przedmiot wraca w najmniej oczekiwanym miejscu.

Każde zdarzenie ma limit encji, czas życia, cleanup, test powtórzenia oraz warunek zakazujący softlocka. Najpierw dwa dobre zdarzenia, potem reszta.

## 9. Grafika, animacje i audio

Reużyć tożsamości i źródła modeli z bijatyki, ale nie jej boczne sprite'y. After potrzebuje własnego renderu z góry pod stałym kątem. Wspólne mogą być portrety, paleta, eksport/packing, metadane i część efektów.

- [ ] ART-A01: pilot kamery, czytelności i proporcji; cztery kierunki na start, osiem tylko jeśli zysk uzasadnia pamięć.
- [ ] ART-A02: Blender template dla postaci, stałe światło, pivot stóp, skala i alpha.
- [ ] ART-A03: klipy idle, walk, run, interact, carry, help-up, exhausted, sit, dance, ability dla pilota.
- [ ] ART-A04: osobne animacje przedmiotów noszonych i cienie; brak cienia w powietrzu niezwiązanego z postacią.
- [ ] ART-A05: zestaw modularnych tiles: trawa, wydeptana trawa, beton, błoto, namioty i płoty.
- [ ] ART-A06: obiekty: flagi, stoły, krzesła, kable, skrzynie, gastro, latarki, ładowarki i pamiątki.
- [ ] ART-A07: rozdzielone warstwy gruntu, przeszkód, dachów i foreground; dachy znikają/przygasają przy wejściu.
- [ ] ART-A08: generowane tła/ilustracje tylko jako kontrolowane zasoby; collision map tworzona osobno, nie odgadywana z obrazka w runtime.
- [ ] ART-A09: atlas, wariant mobile, walidacja pivotów i kontakt sheets wszystkich postaci.
- [ ] ART-A10: audyt barków, twarzy, brody i ubrań w każdej wymagającej animacji.
- [ ] AUDIO-A01: ambience stref, odległy koncert, gastro, wiatr, burza i obóz; proste 2D tłumienie po dystansie.
- [ ] AUDIO-A02: sygnały interakcji, sukcesu, pomocy i ostrzeżeń; sygnały wizualne równolegle.
- [ ] AUDIO-A03: licencje i źródła wszystkich plików; brak nieuzgodnionego pobierania muzyki z YouTube.

Zasoby generowane offline lub dostarczone przez użytkownika. Brak połączeń do AI w działającej grze i brak automatycznej instalacji/pobierania usług bez uzgodnienia. Pliki pośrednie i backupy poza wersjonowanym runtime.

## 10. NPC, nawigacja i interakcje społeczne

- [ ] NPC-A01: role sprzedawca, imprezowicz, zagubiony, patrol, znajomy, techniczny.
- [ ] NPC-A02: proste harmonogramy, waypointy i reakcje na zdarzenia; brak kosztownej symulacji poza aktywnymi strefami.
- [ ] NPC-A03: A* na siatce tylko po zmianie celu/przeszkody, kolejka i budżet obliczeń; lokalne unikanie kolizji.
- [ ] NPC-A04: dialog przerywa spacer NPC, a zakończenie przywraca legalne zadanie.
- [ ] NPC-A05: NPC nie blokują na stałe drzwi, gracza ani kluczowego przedmiotu; timeout i bezpieczne odsunięcie.
- [ ] NPC-A06: quest i losowy event mają jasny priorytet; EventDirector nie przejmuje ważnego NPC bez zgody systemu fabuły.
- [ ] NPC-A07: relacje, posiadane wskazówki i stan rozmowy zachowane po zmianie strefy i zapisie.

## 11. Kooperacja i autorytet serwera

After nie potrzebuje rollback bijatyki. Propozycja: serwer symuluje sesję 30 Hz, wysyła snapshoty startowo 10–15 Hz; klient przewiduje własny ruch, koryguje go i interpoluje innych. Parametry dostroić pomiarami.

- [ ] NET-A01: lobby 1–4, kod zaproszenia, sloty, postacie, ready i zgodność wersji zasobów.
- [ ] NET-A02: lokalny i serwerowy `SessionAdapter` o tym samym kontrakcie; offline działa bez serwera.
- [ ] NET-A03: input z sekwencją/tickiem; serwer sprawdza prędkość, dystans interakcji, cooldown i stan zadania.
- [ ] NET-A04: podnoszenie/oddawanie przedmiotu jako transakcja: jeden właściciel, ack i idempotency key.
- [ ] NET-A05: dziennik, świat i krytyczne przedmioty wspólne; kosmetyczne ustawienia lokalne.
- [ ] NET-A06: wybór dialogu i efekty zatwierdzane przez serwer; brak podwójnych nagród po retry.
- [ ] NET-A07: deduplikacja zdarzeń, wersje snapshotów i resync po luce/ukryciu karty.
- [ ] NET-A08: reconnect do stabilnego slotu, nie identyfikowanie postaci tylko po aktualnym socket ID.
- [ ] NET-A09: po rozłączeniu zwolnić blokady rozmowy/noszenia; quest przedmiot pozostaje dostępny drużynie.
- [ ] NET-A10: polityka join-in-progress: wejście przy najbliższym bezpiecznym checkpoincie, nigdy w środku zamkniętej sceny.
- [ ] NET-A11: host lobby nie jest autorytetem fizyki; jego wyjście nie zabija sesji pozostałych. Uprawnienie do zapisu/ustawień przechodzi według jawnej reguły.
- [ ] NET-A12: wygaszanie pustych sesji, zapis checkpointu, limity eventów i walidacja payloadów.

W solo otwarcie menu pauzuje lokalny świat. Online dialog/menu jednego użytkownika nie zatrzymuje wszystkich. W krytycznej wspólnej scenie można przenieść drużynę do bezpiecznej przestrzeni lub wyłączyć zagrożenia w małym obszarze — decyzja jawna dla graczy. Nie implementować ukrytej globalnej pauzy.

Współdzielenie zwykłych przedmiotów i posiadanie quest przedmiotów muszą być zdefiniowane w danych. Nie synchronizować wszystkiego przez bezpośrednie nadpisywanie obiektów klienta.

## 12. Zapis i odporność fabuły

- [ ] SAVE-A01: wersjonowany schemat: kampania, seed, checkpoint, quest flags, relacje, ekwipunek, skład i faza nocy.
- [ ] SAVE-A02: zapis atomowy/checkpoint; lokalnie IndexedDB lub istniejący adekwatny magazyn, nie wielki blob co klatkę.
- [ ] SAVE-A03: migracje, wykrycie uszkodzenia, ostatni dobry checkpoint i czytelny komunikat.
- [ ] SAVE-A04: server persistence za interfejsem repozytorium; ustalić miejsce i retencję przed wdrożeniem online, nie trzymać kampanii wyłącznie w pamięci procesu.
- [ ] SAVE-A05: nowa kampania, kontynuacja, potwierdzenie nadpisania i opcjonalny eksport/import lokalnego save.
- [ ] SAVE-A06: walidacja importu i limit rozmiaru; brak sekretów/socket tokenów w save i raportach.
- [ ] SAVE-A07: restart serwera w trakcie zadania odtwarza ostatni spójny checkpoint, bez podwójnych przedmiotów.
- [ ] SAVE-A08: nieodwracalne zużycie quest przedmiotu tylko razem z zatwierdzonym przejściem stanu.

Przy checkpointach zapisywać także drogę wyjścia z bieżącego zadania. Nie zapisywać do odtworzenia przypadkowego zawieszonego okna dialogowego lub starego połączenia sieciowego.

## 13. UI, dostępność i mobile

- [ ] UI-A01: gra dostępna bez wyboru festiwalu 3D; portrety zamiast modeli w menu.
- [ ] UI-A02: HUD celu, kondycji, przedmiotu i cooldownu, bez zasłaniania postaci.
- [ ] UI-A03: dziennik z zadaniami i ostatnimi wskazówkami, mapa strefy, ping drużyny.
- [ ] UI-A04: dialogi mieszczą się na małym ekranie, przyciski nie są pod overlayem, wszystkie scrollbary zgodne ze stylem.
- [ ] UI-A05: dotykowy joystick i trzy główne akcje, multi-touch, remap klawiatury i gamepad.
- [ ] UI-A06: safe-area, zmiana orientacji i focus; Escape/back zamyka najwyższy modal.
- [ ] UI-A07: tekst skalowalny, kontrast, tryb reduced-motion, intensywność efektów i osobne głośności.
- [ ] UI-A08: krótkie instrukcje kontekstowe; gracz zawsze wie, z czym wejdzie w interakcję.
- [ ] UI-A09: offline nie wymaga logowania ani odpowiedzi serwera.

## 14. Wydajność i streaming

Cele początkowe do weryfikacji, nie gwarancja:

- [ ] 60 FPS prezentacji na urządzeniu testowym, 30 Hz stabilnej symulacji; pomiar p50/p95 i długich klatek.
- [ ] Proponowany limit mobilny 128 MiB rozkodowanych tekstur aktywnej gry, atlasy max 2048×2048; dopasować po pilocie.
- [ ] Wczytywać bieżącą strefę i kontrolowany sąsiedni fragment; nie całą kampanię i wszystkie klipy 16 bohaterów.
- [ ] Rendering tylko widocznych chunków z marginesem; poza ekranem ograniczyć prezentację, ale zachować ważne questy i autorytatywne reguły.
- [ ] Limit aktywnych NPC startowo 20 na klienta w obszarze; pozostałe jako proste stany danych, bez animacji i pathfindingu co klatkę.
- [ ] Budżety pooli efektów, dźwięków i zdarzeń, brak nieograniczonego wzrostu cache.
- [ ] Po zmianie strefy zwolnić zasoby z uwzględnieniem współdzielonych atlasów i bitmap.
- [ ] Start After nie pobiera GLB, motion banku, world sectors ani filmów dużej sceny.
- [ ] 30 minut sesji i 20 przejść stref bez narastania pamięci/listenerów; raport na fizycznym iPhonie.

## 15. Testy i kryteria odbioru

### Jednostkowe i integracyjne

- [ ] Ruch diagonalny, kolizje, narożniki, portale i bezpieczne spawny.
- [ ] Deterministyczne zdarzenia dla seeda; serializacja/restore zachowuje logiczny stan.
- [ ] Każde zadanie ma ścieżkę ukończenia dla dowolnej dostępnej postaci i solo.
- [ ] Nieprawidłowe ID i cykle w danych fabuły zgłaszają walidatory; cykle dialogu muszą mieć wyjście.
- [ ] Zgubienie/transfer przedmiotu, retry, opuszczenie dialogu i reconnect nie blokują zadania.
- [ ] Równoczesna interakcja dwóch graczy daje jedną nagrodę i jednego właściciela przedmiotu.
- [ ] Rozłączenie podczas noszenia/głosowania/portalu uruchamia zdefiniowany fallback.
- [ ] Migracja zapisu, uszkodzony save, niezgodna wersja contentu i restart procesu serwera.
- [ ] Rate limits, walidacja odległości, brak dowolnego wykonania kodu z dialogu.

### Przeglądarki i użytkownicy

- [ ] Chromium i WebKit: nowa kampania, zapis, kontynuacja, finał, powrót do menu bez błędów.
- [ ] Dwie i cztery sesje klientów: wspólny quest, rozdzielenie drużyny, ponowne spotkanie, reconnect.
- [ ] Test RTT 80/150/250 ms, jitter i odcięcia transportu; ruch oraz transakcje nie duplikują stanu.
- [ ] Desktop, portrait 430×932 i landscape 932×430: wszystkie menu klikane bez force click.
- [ ] Wszystkie postacie i kierunki: twarze, barki, ubrania, pivot stóp, przenoszone rzeczy.
- [ ] Kampania ukończona bez dźwięku i z ograniczonymi efektami.
- [ ] Playtest nowych osób: czy rozumieją cel, śmieją się i nie szukają bez sensu drogi przez kilka minut.
- [ ] Fizyczny iPhone 15 Pro Max: wejście, zmiany stref, zapis, dłuższa sesja; brak dostępu oznacza pending.

## 16. Etapy i pakiety dla agentów

| Pakiet      | Zależności                        | Wynik / kryterium odbioru                                  |
| ----------- | --------------------------------- | ---------------------------------------------------------- |
| A-DESIGN    | zatwierdzenie wizji               | graf fabuły, trzy questy pilota, schemat danych            |
| A-CORE      | kontrakty danych                  | ruch, kolizje, interakcje i bezrenderowa symulacja         |
| A-ART-PILOT | standard sprite'ów                | dwie postacie, tiles i mała mapa bez wad animacji          |
| A-STORY     | A-DESIGN, A-CORE                  | dialogi, quest engine, relacje i walidator                 |
| A-VERTICAL  | SHARED-01, core, art, story       | 10–15 min solo, trzy zadania, jeden finał, zapis           |
| A-COOP      | stabilny przekrój, ADR transportu | 2–4 osoby, transakcje, reconnect i trwały checkpoint       |
| A-WORLD     | specyfikacja map                  | sześć stref, nawigacja i streaming                         |
| A-EVENTS    | core i quest ownership            | zdarzenia bez blokowania fabuły                            |
| A-ROSTER    | zatwierdzony pilot                | 16 postaci partiami, umiejętności i alternatywy solo       |
| A-CAMPAIGN  | world, story, coop                | pełna noc, questy poboczne i trzy zakończenia              |
| A-POLISH    | wszystkie powyższe                | UX, audio, mobile, balans i playtest                       |
| A-RELEASE   | niezależny review                 | raport regresji, testów, licencji i pozostałych ograniczeń |

- [ ] Bramka A: pojedynczy quest zabawny i zrozumiały na prostej mapie.
- [ ] Bramka B: przekrój solo bez softlocków, z zapisem i pełną obsługą telefonu.
- [ ] Bramka C: ten sam przekrój działa w kooperacji, także po rozłączeniu.
- [ ] Bramka D: pełna kampania, wszystkie postacie i alternatywy rozwiązań.
- [ ] Bramka E: stabilna dłuższa sesja mobile i niezależne review.

Dobry podział między agentów: pojedyncza strefa na ustalonym formacie, pakiet dialogów/questów, UI, walidator fabuły, eksport sprite'ów, zdarzenia, companion AI, testy reconnect. Jeden właściciel symulacji i jeden właściciel danych fabuły zatwierdzają kontrakty. Nie pozwalać, aby każdy quest miał własny globalny stan lub pętlę aktualizacji.

## 17. Szablon Issue / oddania pracy

```text
Pakiet / Issue / właściciel:
Zakres i lista checkboxów:
Zależności i zatwierdzone kontrakty:
Pliki do zmiany / pliki poza zakresem:
Kryteria odbioru (solo, co-op, mobile):
Testy deterministyczne:
Raport gameplay / urządzenia / wymiary:
Branch / commit:
Licencje / źródła zasobów:
Wpływ na zapis / migracje / sieć / pamięć:
Znane ograniczenia i pending:
Status: oczekuje niezależnego review, bez samodzielnego merge
```

## 18. Decyzje przed produkcją

- [ ] Zatwierdzić ton humoru, fabułę i zakres motywów imprezowych.
- [ ] Zatwierdzić pilot stylu graficznego i kąt kamery.
- [ ] Zatwierdzić trzy zadania przekroju i ich alternatywne rozwiązania solo.
- [ ] Ustalić właściciela wspólnego SHARED-01; nie implementować go drugi raz.
- [ ] Zatwierdzić strategię persistence serwera i przenoszenia prawa do kampanii.
- [ ] Po pilocie zmierzyć czas produkcji grafiki/questów i dopiero ustalić termin pełnej kampanii.

Pierwsze zadanie wykonawcze: A-DESIGN oraz bezrenderowy A-CORE, równolegle próbka ART-A01. Nie budować sześciu stref przed sprawdzeniem pierwszego zadania w grze.
