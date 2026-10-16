# Bongo Rush v6 — raport końcowy

Implementacja etapów A/B/C, odbiór przeglądarkowy całej kampanii, walidacja kodu i porównawczy pomiar wydajności są zakończone. Odbiór na fizycznym telefonie pozostaje jawnie do wykonania przez człowieka.

Branch `codex/bongo-rush-v6`, worktree `E:/kodowanie/gra/.ai/worktrees/bongo-rush-v6`, baza `c6284e5` zawierająca PR #125 i poprawkę fizyki teleportacji. Runtime wybiera kampanię v6. Zachowano lokalne zmiany głównego katalogu. Nie wykonano push, PR ani merge.

## Kampania i dowody

Gotowe są 20 poziomów głównych i cztery wyzwania, cztery dotychczasowe biomy oraz portale wyłącznie na 12/18. Jawne dane nie losują układu. Limit wynosi `ceil(0.85 × dostępny łup)`, obejmuje emisję bogatych kafelków i możliwy łup przeciwników poza bossem. Obowiązkowe znajdźki zachowują tożsamość podczas spadania. Pozostają wymagane eliminacje i zagroda bossa w finale.

- 24 świeże pełne replaye produkcyjnej symulacji kończą się `WON`, z kompletem obowiązkowych celów.
- 24 konkretne błędne decyzje kończą się rzeczywistą śmiercią, a nie samym niedokończeniem trasy.
- Cztery pełne alternatywy: 1, 9, 14, 19.
- Wszystkie pierwsze otwarcia kolonii na trasach referencyjnych następują przy 45–60% limitu. Kobra reaguje na fizyczne odsłonięcie sąsiedztwa, bez procentowego wyzwalacza.
- Odtworzono 449 zdarzeń, w których skała rzeczywiście spada, a gracz później przechodzi przez zwolnione pole.

Sześć siatek referencyjnych pozostaje wiernych co do pola. Poziom 9 ma jawną korektę A.8 trzynastu pól `#` → `.`, opisaną w [manifeście](../scripts/bongo-v6/reference-corrections.json). Oryginalne siatki zachowano. Korekta pozostawia 199 kamieni, 180 znajdziek, pięć obowiązkowych celów, obie hale odbiorcze i układ zbiorników.

Główna trasa 9: 726 wejść, 153/153, wszystkie cele; otwarcie Kobry w kroku 376 przy 71/153 (46,405%). Alternatywa: 736 wejść i takie samo pełne zwycięstwo. Ma wspólny prefiks 661 wejść, lecz odbiera przedmiot 304 po jego spadnięciu z `(38,12)` do `(38,13)`, po wycofaniu i ustaniu spadania. Następnie zbiera 235 przed 234, odwrotnie niż trasa główna. Nie jest trasą otwierającą rdzeń przed wschodem. Korekta nie stanowi dowodu niewykonalności oryginału ani globalnej minimalności zmian.

Dowody: [audyt symulacji](bongo-v6-simulation.json), [rozwiązania i kamienie milowe](bongo-v6-solutions.md), [historia konfliktu poziomu 9](bongo-v6-level-9-investigation.md). Sumy definicji obejmują końcowe `scenery`; historyczna suma z promocji etapu A została w raporcie review oznaczona jako historyczna. Sekundy symulacji nie są czasem gry człowieka.

## Ilustracje i runtime

Przygotowano 19 bezpośrednio ilustrowanych humanoidów: wszystkich 15 bohaterów, trzy warianty patrolu i bossa. Każdy ma 48 odrębnych klatek, cztery kierunki, cztery idle i osiem walk. Źródłowa komórka ma co najmniej 256×256; atlas runtime 1536×512, komórki 128×128, podparcie `(64,116)`, margines 6 px. Powstał także osobny czterokierunkowy wózek dla `S`. Niebieski patrol i undercover mają gotowe atlasy oraz obsługę runtime; nie występują w jawnych siatkach v6 ani w bazowych siatkach v5, więc gra ich nie ładuje.

Cztery kompletne biomy zawierają po 16 kafelków terenu, 16 rekwizytów oraz warstwy far/mid. Mury tworzą ciągłe obszary dwóch materiałów; ruchome głazy mają osobne sylwetki. Okna i rekwizyty są maskowane istniejącymi ścianami, bez zmiany kolizji. Poziom 9 pozostaje bez dekoracji blokujących hale. Fotograficzna twarz Kobry oraz tożsamość przedmiotów i dobór muzyki zostały zachowane.

Źródła, prompty, referencje, wcześniejsze warianty, prostokąty klatek, skale, pivots i SHA-256 są w [rejestrze assetów](../art-source/bongo-v6/registry.json). Eksporter jedynie wycina, jednolicie skaluje dany kierunek i wyrównuje podparcie; nie dorabia pozy ani nie rozciąga kończyn. Użyto wbudowanego generowania obrazów, bez zewnętrznych kluczy, kredytów i renderowania modeli 3D. Kontrole techniczne pikseli nie zastępują subiektywnej oceny podobieństwa czy proporcji głowy.

Istniejący animator wiąże chód z rzeczywistym prezentowanym dystansem: osiem klatek na cztery kafelki. Zmiana kierunku zachowuje fazę, postój przechodzi w idle 3 FPS, pauza zamraża postacie, Kobrę i otoczenie. Teleport, restart i zmiana poziomu resetują prezentację. Zachowano krok symulacji 0,2 s, istniejący renderer Canvas 2D, cache i pojedynczy RAF.

Ograniczono cache do aktywnego biomu i potrzebnych postaci. Galeria przechowuje miniatury i najwyżej jeden pełny aktywny podgląd, a podczas gry żadnego. Ładowanie kończy wszystkie rozpoczęte żądania przed sprzątaniem po błędzie, co pokrywa regresja z późno kończącym się obrazem. Promienie i pył mają limity, culling oraz wariant ograniczonego ruchu. Migracja `campaignRevision: 3` zachowuje odblokowania, bohatera i dźwięk, bez automatycznego ukończenia nowych plansz.

## Odbiór przeglądarkowy

| Konfiguracja     |  Rozmiar | Wejścia                             |     Wynik |
| ---------------- | -------: | ----------------------------------- | --------: |
| Chromium poziomo | 1280×800 | klawiatura DOM                      | 24/24 WON |
| Chromium pionowo |  390×844 | rzeczywisty wskaźnik przez joystick | 24/24 WON |
| WebKit pionowo   |  390×844 | klawiatura DOM, układ dotykowy      | 24/24 WON |
| WebKit poziomo   |  844×390 | rzeczywisty wskaźnik przez joystick | 24/24 WON |

Łącznie 96 pełnych zwycięstw, bez błędów JavaScript i odpowiedzi HTTP ≥400. Dla każdego przejścia sprawdzono pauzę z niezmienionym światem i obrazem canvasa, wznowienie, świeży restart oraz przełączanie minimapy. Zapisano 288 zrzutów: start, środkowa decyzja i etap końcowy każdej planszy w każdej konfiguracji.

W każdej konfiguracji poziom 12 przechodzi `main → vault-1 → main`, a 18 `main → vault-2 → vault-1 → main`. Powroty zachowują fizykę i stan łupu. Wszystkich 15 grywalnych bohaterów obejrzano w grze i przeprowadzono przez poziom 2 — 15/15 `WON`. Osobny test zmienił wszystkich 15 bohaterów i biomy na jednej stale otwartej stronie: po starcie pozostawały tylko aktywne zasoby, bez pełnych atlasów galerii. Największy odczyt aktywnych grafik, miniatur i cache w całej kampanii wyniósł **31,632 MiB**, poniżej budżetu 64 MiB.

Zwykły build produkcyjny pod `/kurwa-moje-pole/` przeszedł pełny poziom 2 wyłącznie przez DOM, bez błędów i brakujących plików. Nawet przy `?verify` nie udostępnia diagnostycznego snapshotu. Osobny zoptymalizowany build `--mode verification` z diagnostyką tylko do odczytu przeszedł poziomy 2/12/18/20 wraz z kontrolami pauzy/restartu. WebKit z joystickiem i `prefers-reduced-motion` przeszedł dodatkowo poziom 18.

[Trwały raport przeglądarkowy](bongo-v6-browser-report.json) zawiera wyniki, przejścia między komorami, pamięć, aktywne URL i sumy 288 zrzutów. [Wybrane obrazy QA](bongo-v6-qa/) obejmują roster w grze i przy 40/48/64/80 px, hale 9, patrol/wózek, portal po powrocie, rave i finał. Zrzut tronu pochodzi z dodatkowego rzeczywistego przejścia do `(16,12)` na poziomie 20 przy 1280×1000; panel pauzy ukryto wyłącznie dla inspekcji widoku. Surowe raporty i komplet zrzutów pozostają lokalnie w `reports/bongo-campaign-v6/`.

Kontrolowany zegar służył do odbioru zachowania; nie wykorzystano go do pomiaru wydajności. Układ dotykowy i zdarzenia wskaźnika nie są próbą na fizycznym telefonie.

## Wydajność — te same pełne trasy

| Poziom | Wejścia | Render mediana/p95, ms — przed → po | Odstęp klatek mediana/p95, ms — przed → po |
| ------ | ------: | ----------------------------------- | ------------------------------------------ |
| 1      |     232 | 1,10 / 1,60 → 1,30 / 1,80           | 18,30 / 22,60 → 16,60 / 18,00              |
| 9      |     726 | 1,10 / 1,70 → 1,50 / 2,10           | 18,60 / 22,40 → 16,70 / 18,10              |
| 16     |     353 | 1,10 / 1,80 → 1,40 / 2,00           | 19,00 / 23,00 → 16,60 / 18,00              |
| 18     |     154 | 1,10 / 1,50 → 1,10 / 1,60           | 18,50 / 22,40 → 16,60 / 18,00              |
| 20     |     102 | 1,00 / 1,50 → 1,10 / 1,60           | 18,40 / 22,20 → 16,60 / 18,00              |

| Poziom | Aktywne obrazy — przed → po | Obrazy MiB — przed → po | Wszystkie canvasy MiB — przed → po | Cache kafelków MiB — przed → po |
| ------ | --------------------------- | ----------------------- | ---------------------------------- | ------------------------------- |
| 1      | 26 → 6                      | 82,50 → 14,34           | 5,35 → 6,82                        | 0,97 → 2,50                     |
| 9      | 26 → 7                      | 82,50 → 20,33           | 5,16 → 5,74                        | 0,78 → 1,36                     |
| 16     | 24 → 8                      | 73,00 → 23,33           | 5,27 → 6,88                        | 0,89 → 2,50                     |
| 18     | 24 → 7                      | 73,00 → 20,33           | 5,11 → 5,81                        | 0,73 → 1,44                     |
| 20     | 24 → 8                      | 73,00 → 23,33           | 4,96 → 5,68                        | 0,58 → 1,30                     |

Cache kafelków policzono jako liczbę faktycznie utrzymywanych canvasów × 64×64×4 bajty w obu rendererach. Pełne canvasy uwzględniają także minimapę, miniatury, podgląd i widoczny framebuffer; nie należy dodawać do nich drugi raz cache kafelków. V6 osobno raportuje również całość własnego cache renderera.

Nowa oprawa zwiększa medianę kosztu renderowania o 0,0–0,4 ms, przy niższych odstępach klatek i znacznie mniejszej liczbie utrzymywanych obrazów. Wszystkie dziesięć przejść pomiarowych kończy się zwycięstwem, bez błędów. Pierwszą próbę pomiaru po zmianach odrzucono z powodu zerowego licznika renderera; poprawiono wybór dokładnego URL aktywnego modułu Vite i powtórzono cały pomiar.

Punkt odniesienia: baza `c6284e5`, z przeniesionymi wyłącznie danymi, wyborem v6 i symulacją dla identycznych tras; stary renderer, galeria i grafiki. Oba pomiary wykorzystują Chromium headless 1280×800 na tej samej maszynie, rzeczywisty zegar oraz wszystkie kanoniczne wejścia 1/9/16/18/20. Każde wejście i końcowe zwycięstwo są sprawdzane. Nie porównuje się startów v5 z pełnymi trasami v6.

[Raport porównawczy](bongo-v6-performance.json) zapisuje medianę/p95 renderowania i odstępów klatek, liczbę oraz rozmiar obrazów i cache. Oszacowanie obrazów/canvasów po GC nie obejmuje alokacji GPU; całkowite canvasy obejmują też widoczny framebuffer. Pomiary lokalne headless nie stanowią gwarancji FPS na urządzeniu użytkownika.

## Walidacja i review

- **2195/2195 testów jednostkowych, 217 plików** przy `--maxWorkers=2`; 6/6 testów narzędzi.
- TypeScript projektu oraz osobnego projektu narzędzi: PASS.
- ESLint całego projektu z `--max-warnings 0`: PASS.
- Pełny `npm run format:check`: PASS. UTF-8: 841 wersjonowanych plików oraz osobno 268 nowych plików tekstowych (w tym Python i prompty), bez mojibake.
- Walidacja assetów: 241 OK, bez ostrzeżeń, blokad i błędów; istniejące riggi: 16 OK.
- `validate-art.py --complete`: 19 humanoidów, cztery biomy i wózek; komplet klatek, SHA, marginesy, podparcie i przezroczystość: PASS.
- `npm run build`: PASS. Bongo 166,08 kB, gzip 44,74 kB. Istniejące ostrzeżenie o rozmiarze głównego bundla festiwalu 3D pozostaje poza zakresem tej zmiany.

Pełne gęste replaye poziomu 9 przekraczały domyślny limit 5 s na obciążonych workerach. Trzy zestawy odtwarzające całe plansze mają lokalny limit 30 s; wszystkie asercje pozostały zachowane. Końcowy pełny zestaw przeszedł w 116,74 s. Nie skracano tras i nie wyłączano testów.

[Niezależny review](bongo-v6-independent-review.md) potwierdza kampanię, dowody, kontrakt assetów i poprawkę wyścigu ładowania. W zaakceptowanym zakresie nie pozostał konkretny blokujący błąd. [Instrukcja odtworzenia](../scripts/bongo-v6/README.md) opisuje walidację, eksport i rozróżnia końcowe dane od historycznych eksperymentów.

## Przekazanie i zakres człowieka

Komplet zmian znajduje się wyłącznie w branchu/worktree zadania. Orkiestrator może wykonać integrację i publikację po zapoznaniu się z raportami; agent implementujący nie wykonał push, PR ani merge.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** dotyczy wyłącznie próby na fizycznym telefonie oraz oceny wygody dotyku, odczuwanej płynności, czytelności twarzy, atrakcyjności zagadek i docelowego czasu 3–6 minut. Tych ocen nie wykonano i nie zastępują ich build, replay ani emulacja. Implementacja oraz opisane wyżej automatyczne i przeglądarkowe kontrole zostały wykonane.
