# Bijatyka — review i poprawa walki, 2026-10-11

## Integracja z gałęzią Gemini — 2026-10-12

Na wyraźną prośbę użytkownika wszystkie poprawki tego review przeniesiono na `feat/fighter-demo`, worktree `.ai/worktrees/fighter-demo`. To docelowa gałąź dalszej pracy nad bijatyką. Commity integracji: `2fa2740` i `a9bc570`.

Zachowano nowe tła, platformy i oświetlenie z `194d5d7` oraz najnowszą grafikę sceny i korektę poziomu podłoża z `f41ca99`. Konflikt `FighterView.ts` rozwiązano z zachowaniem obu zestawów funkcji: atlasy animacji mają oświetlenie otoczenia, a cienie pozostają na ziemi. Niezapisanych zmian Gemini nie usuwano — przed przeniesieniem poprawek zostały zapisane przez Gemini w `f41ca99`.

Walidacja bezpośrednio na `feat/fighter-demo`: TypeScript, 46 testów walki, produkcyjny build, Chromium 1366×768 oraz mobilny WebKit 932×430 i 430×932 — PASS, bez błędów strony i odpowiedzi HTTP >= 400. Fizyczny iPhone i końcowy balans nadal wymagają człowieka. Nie wykonano push ani integracji do `main`. Poniższe sekcje dokumentują wcześniejszy, izolowany etap review.

## Zakres i izolacja

Baza review: `feat/fighter-demo`, commit `ed0d9c6`.
Poprawki: branch `fix/fighter-animation-combat-review`, osobny worktree `.ai/worktrees/fighter-review`.
Nie zmieniono worktree Gemini, `main`, źródłowych modeli ani pobranych FBX. Brak push/merge i użycia API AI.

Źródło animacji użytkownika: `.ai/worktrees/fighting` (22 FBX). Runtime otrzymuje wyłącznie wyrenderowane PNG i manifesty. Blender 5.2.2 LTS, istniejący importer i zasady rest-relative retargetingu z `build-character-animation-library.py`.

## Znalezione problemy i poprawki

| Priorytet | Problem w bazie                                                                                                       | Wprowadzona poprawka                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P1        | Cinematic odejmował 220 HP niezależnie od hitboxów, dystansu i bloku, manipulował stanem zawodnika                    | Cinematic jest wyłącznie prezentacją, uruchamianą po potwierdzonym nieblokowanym trafieniu. Cała walka pozostaje w symulacji |
| P1        | `stateTicks` inicjalizowano wartością stun zamiast od zera; odzyskanie kontroli porównywało ją z cudzym/starym ruchem | Osobny licznik `stunTicks`, prawidłowe zatrzymanie podczas hitstop, wyczyszczenie przerwanego ataku                          |
| P1        | P1 rozliczany pierwszy mógł anulować aktywny cios P2 w tym samym ticku                                                | Oba trafienia oceniane na kopiach tego samego stanu; legalne trades i double KO                                              |
| P1        | Obrona możliwa podczas hitstun, ryzyko ponownej aktywacji starego hitboxu                                             | Ograniczenie stanów pozwalających blokować; hitbox wymaga aktywnego stanu `attack`                                           |
| P2        | Bardzo krótkie ciosy, cancel po pudle                                                                                 | Wspólne minimum startup/recovery na wszystkie 16 postaci; cancel serii dopiero po kontakcie                                  |
| P2        | Podcięcie odpychało w kierunku napastnika                                                                             | Impuls według kierunku atakującego, również dla bloku i zwykłego trafienia                                                   |
| P2        | Bez limitu odbić powietrznych                                                                                         | Limit trzech trafień juggle, ograniczenie odbicia pionowego, pewne lądowanie i knockdown                                     |
| P2        | Pushbox przy ścianie mógł wypchnąć zawodnika poza arenę                                                               | Clamp i przeniesienie pozostałego rozdzielenia na drugiego zawodnika                                                         |
| P2        | Po timeout nadal wykonywano aktualizację walki                                                                        | Wyjście przed ruchem i kolizjami po zakończeniu rundy; zegar oparty na tickach bieżącej rundy                                |
| P2        | Snapshot nie zawierał historii przycisków                                                                             | Zapis/restore input buffer, wyczyszczenie starych eventów                                                                    |
| P2        | Pojedynczy obraz ciosu pochodził z tańca i był rozciągany                                                             | Osobne wieloklatkowe atlasy rzeczywistych ciosów, reakcji, upadku, wstawania i gardy                                         |
| P2        | Sprite skakał/ucinał stopy przy różnicy wysokości źródłowych klipów                                                   | Stała kamera i skala, stały pivot, wyrównanie podłoża bez dopasowywania zoomu każdej klatki                                  |
| P2        | Pomoc sugerowała blok samym kucaniem i pozwalała wybrać tylko P1                                                      | Wspólna aktualna instrukcja i rzeczywisty wybór gracza/przeciwnika, także mirror match                                       |
| P2        | Mały ekran utrudniał dotarcie do przycisków pomocy/wyboru                                                             | Przewijane karty, custom scrollbary, sticky Zamknij, focus trap i powrót focusu na canvas                                    |
| P2        | Klawisze mogły pozostać wciśnięte po utracie focusu; aliasy wzajemnie się zwalniały                                   | Zbiór fizycznych klawiszy, reset przy blur/ukryciu/pauzie, osobne pointer ID i pointer capture                               |
| P2        | Wszystkie postacie dekodowane na starcie, natywny DPR bez limitu                                                      | Portrety w menu, atlasy tylko dwóch aktywnych postaci, zwalnianie innych, DPR maksymalnie 2                                  |
| P3        | Czas efektów zależał od liczby renderowanych klatek                                                                   | Aktualizacja VFX i atmosfery w istniejącym fixed tick, pauza zatrzymuje prezentację                                          |
| P3        | Cień podążał w powietrze razem z postacią                                                                             | Cień pozostaje na ziemi, sylwetka porusza się niezależnie                                                                    |

## Nowe animacje

16 klipów na postać, po 6 klatek, 192×192, atlas 1152×192:

- `idle`: Fighting Idle.
- `jab`: Punching; `cross`: Cross Punch; `hook`: Hook; `elbow`: Illegal Elbow Punch.
- `kick`: Mma Kick; `heavy_kick`: Inside Crescent Kick; `uppercut`: Uppercut; `air_kick`: Drop Kick.
- `hit_head`: Head Hit; `hit_body`: Rib Hit.
- `fall`: Flying Back Death; `get_up`: Getting Up.
- `block`: jawnie oznaczona poza pochodna Fighting Idle z korektą przedramion — użytkownik nie dostarczył dedykowanego FBX gardy.
- `walk`, `crouch`: istniejące Walk i SneakWalk z biblioteki Ampera, retargetowane na resztę.

Nie wykorzystano automatycznie wszystkich 22 plików: niektóre stanowią warianty lub wielociosowe sekwencje wymagające osobnego opisu hitboxów. Nie przedstawiać jednego kontaktu jako wielokrotnego combo bez odpowiedniej symulacji. Manifest każdego eksportu zawiera hashe modelu i źródła klipu. Zasoby użytkownika z Mixamo; warunki dalszego rozpowszechniania należy sprawdzić przed publikacją.

Ruchy są mapowane do faz startup/contact/recovery. Atak nie zapętla klatki trafienia. Upadek zatrzymuje ostatnią klatkę, wstawanie wraca do pozycji stojącej. Zachowano stare sprite'y jako fallback podczas ładowania, nie jako domyślną animację po wczytaniu atlasów.

## Tempo rozgrywki

Minimum startup / recovery w tickach 60 Hz:

| Ruch          | Zamach      | Powrót      |
| ------------- | ----------- | ----------- |
| Prosty        | 9 / 150 ms  | 15 / 250 ms |
| Sierpowy      | 15 / 250 ms | 23 / 383 ms |
| Lekki kopniak | 12 / 200 ms | 18 / 300 ms |
| Mocny kopniak | 19 / 317 ms | 28 / 467 ms |
| Podbródkowy   | 17 / 283 ms | 27 / 450 ms |
| Podcięcie     | 20 / 333 ms | 30 / 500 ms |
| Ultimate      | 28 / 467 ms | 38 / 633 ms |

Do tego dochodzą aktywne ticki i hitstop. Trzymanie przycisku nie spamuje ciosami. Trafiona/zablokowana seria ma ograniczone okno cancel; pudło wymaga pełnego recovery. Quick rise po 24 tickach, zwykły knockdown po 42, następnie 36 ticków chronionego wstawania.

## Odtwarzalne komendy

Z katalogu worktree, z dostępnymi zależnościami Node projektu:

```powershell
npm run typecheck
npx vitest run src/games/fighter
python scripts/fighter/validate-combat-sprites.py
python scripts/verify-fighter-review.py
npm run build
```

Test przeglądarkowy obsługuje `GAME_QA_URL`, domyślnie `http://127.0.0.1:5236/fighter-demo.html`. Artefakty: `.ai/artifacts/fighter-review/`, ignorowane przez Git. Nie używa prywatnej ścieżki profilu Gemini ani force click.

Eksport pełnego zestawu:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python scripts/fighter/render-combat-sprites.py -- --source E:/kodowanie/gra/.ai/worktrees/fighting --models E:/kodowanie/gra/public/game-assets/characters --output public/game-assets/2d/fighter/combat --characters amper korba klatwa chlebak kobra zawor szerszen dziaslo hemoroid jeczmien ambona antena gruczol krwiak pien pierscien --samples 6 --size 192
```

Eksporter nie modyfikuje GLB/FBX. Pośredni `__frame.png` usuwany po zapisaniu atlasu; nie commitować pliku pozostawionego po przerwanym renderze. `--clips` pozwala aktualizować wybrane sekwencje, zachowując manifest. Nie zmieniać wymiarów częściowego eksportu bez pełnej regeneracji.

## Walidacja

- [x] 36 testów bijatyki: zamach, recovery, chip, stun, launcher, limit juggle, wstawanie, trades/double KO, ściany, timeout, snapshot, zasięg super i mapowanie klatek.
- [x] TypeScript bez błędów po zmianach.
- [x] ESLint dla zmienianych modułów runtime/symulacji.
- [x] Chromium 1366×768: menu, cios z zamachem, trafienie, pomoc/pauza, aliasy gardy, Escape, ponowny wybór.
- [x] WebKit mobile 932×430 i 430×932, DPR 3 emulowany: te same operacje, brak page errors/404.
- [x] W testach tylko atlasy dwóch zawodników; brak żądań GLB/FBX.
- [x] Końcowy walidator całego zestawu po ostatnim eksporcie: 16 postaci, 256 atlasów; wymiary, alpha, brak uciętych klatek, zmienne pozy — PASS.
- [x] Końcowy TypeScript, 36 testów walki i produkcyjny build; ponowny raport Chromium i dwóch mobilnych WebKit po eksporcie — PASS, bez page errors i 404.
- [ ] Fizyczny iPhone 15 Pro Max i dłuższy playtest tempa walki.

Pełne `vitest run` w tym sparse worktree nie jest zielone: 877 passed, 561 failed, 18 skipped; 27 plików testów failed. Worktree celowo nie zawiera m.in. zasobów świata 3D i grafik After wymaganych przez liczne testy assetowe. Nie oznacza to pełnej walidacji regresji festiwalu; nie odhaczać globalnego CI na tej podstawie. Nie zmieniano tych testów ani nie ukrywano ich błędów.

Atlasy zajmują 27,5 MiB na dysku. Rozkodowanie wszystkich postaci naraz wymagałoby około 216 MiB, dlatego runtime zachowuje tylko dwie wybrane postacie (około 27 MiB samych pikseli atlasów). Emulacja potwierdziła 34 żądania: dwa manifesty i 32 atlasy, bez ładowania modeli 3D.

## Dalsze zadania / granice review

- [ ] Niezależne review przed integracją z gałęzią Gemini; nie nadpisywać jej ewentualnych kolejnych commitów.
- [ ] Fizyczny mobile oraz subiektywny odbiór wszystkich sylwetek, szczególnie modeli mających wcześniej wadliwe wagi.
- [ ] Jeśli potrzebna płynniejsza prezentacja: eksport 8–12 klatek po pomiarze pamięci, bez zmiany symulacji.
- [ ] Osobne klipy crouch attack/jump/landing i dedykowany FBX gardy, jeśli użytkownik je dostarczy.
- [ ] Przyszłe buforowanie komend, pełne chwyty i zróżnicowany balans — osobne zadania, nie obietnice obecnego helpera.
- [ ] Bot nadal ma prostą losową strategię; brak online/rollback. Nie przedstawiać prototypu jako kompletnego produktu z planu.
- [ ] Wspólny host i menu wszystkich gier z SHARED-01 pozostają osobną integracją. Zachowano istniejący canvas/RAF tego demo; nie dodano drugiej pętli.

Status wymagający człowieka: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` dla fizycznego urządzenia i końcowego balansu. Emulacja WebKit nie jest symulacją pamięci, temperatury ani GPU iPhone'a.

Rozszerzony ESLint całego katalogu bijatyki zgłasza 4 wcześniejsze problemy z nieużywanymi zmiennymi w niezmienianych `roster.ts` i `FighterAudio.test.ts`. Dwa problemy w `BotController.ts` usunięto w kontynuacji. Lint wszystkich zmienionych plików przechodzi; nie deklarować zielonego lint całego projektu.

## Kontynuacja: boty i blokada postawy

- [x] Jednoklatkowe naciśnięcia ciosów i zwalnianie przycisków przed kolejną decyzją bota; brak kolejkowania podczas recovery, hitstop i reakcji.
- [x] Podejście na średnim dystansie zamiast marnowania super z pustym paskiem; bliższy dystans wyboru zwykłego ciosu.
- [x] Garda stojąca/nisko zależna od ataku, kopnięcie w powietrzu, zatrzymanie po KO.
- [x] Trzy poziomy trudności w menu, zachowane przy ponownym wyborze i rewanżu.
- [x] Wstrzykiwane RNG umożliwia deterministyczne testy AI, w tym pełny pojedynek botów kończący rundę bez niepoprawnych pozycji.
- [x] Naciśnięcie DOWN podczas stojącego hitstun albo ataku nie pozwala magicznie uniknąć wysokiego ciosu.
- [x] Łącznie 46 testów bijatyki, TypeScript i lint zmienianych plików — PASS.
- [x] Ponowny build oraz Chromium i mobilny WebKit w obu orientacjach — PASS; sprawdzono też realne trafienie bota i zachowanie wybranego poziomu w menu.

Pozostają wcześniejsze ograniczenia pełnego CI sparse worktree, fizycznego iPhone'a i subiektywnego balansu. Nie wykonywano push ani merge.
