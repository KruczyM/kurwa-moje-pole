# Plan atrakcji i mini-gier — „#KURWAMOJEPOLE"

## Aktualizacja wykonawcza 2026-10-03 — przeczytaj najpierw

Rozszerzenia społeczne, tłum i koncerty: sekcje C–F poniżej. To dalszy plan, nie dodatkowy zakres pierwszego MVP młyna.

Ten dokument zastępuje wcześniejszą specyfikację. Plan nie oznacza wdrożenia. Cel: wierne otoczenie festiwalu, krótkie dobrowolne atrakcje, bez nowych modeli NPC i kosztownych usług.

### Wnioski z kodu i korekty kosztów

- `festivalWheel.ts` rzeczywiście obsługuje 24 gondole, kontr-obrót, cykl 120 s i jeden duży collider. Nie ma wsiadania.
- `PlayerController` ma już callback `getGroundHeight`, ale ruch sprawdza przez `canMove(x,z)`. Collider szprych umieszczony wysoko może nadal blokować przejście w poziomie — nie zakładać kolizji 3D.
- `SeatController` jest wzorcem cleanup/snapshotu, ale pokazuje siedzącego gracza z zewnątrz. Kamera w kabinie wymaga innego kadru, nie drugiego kontrolera gracza.
- `AppStateMachine` nie ma `riding`; pauza wraca obecnie do `playing`. Trzeba przechować stan źródłowy pauzy.
- `FlankiGame` i testy istnieją, lecz w sprawdzonym `Game.ts` nie ma integracji. Koszt B1 to **M**, nie S: wejście, HUD, reset, anulowanie i testy. „Zrealizowane” w `implementation-plan.md` nie jest dowodem działania.
- Fotografia B3 to **S**, nie XS: eksport canvasu i urządzenia mobilne wymagają testu w przeglądarce.
- Wszystkie koszty są względne: XS = moduł/UI, S = jedna mechanika, M = kilka systemów, L = sieć i integracja. Nie są obietnicą czasu agenta.

### Najtańszy sensowny pierwszy pakiet

**Priorytet: młyn + paszport + znacznik własnego obozu.** Następnie sprzątanie pola, Flanki i ognisko. Nie implementować wszystkich atrakcji równocześnie.

| ID | Nowa propozycja | Koszt | Zakres i kryteria odbioru |
| --- | --- | --- | --- |
| B8 | „Gdzie jest mój namiot?” | XS–S | Jeden marker na istniejącej `FestivalMap`, odległość i kierunek. Domyślnie główny obóz, opcjonalnie własny punkt. Bez teleportacji/pathfindingu. Testy skali mapy, zapisu, błędnego storage i dotyku. |
| B9 | Sprzątanie pola i zwrot puszek | S | Lokalna runda: 10 puszek w osiągalnych punktach, E/mobile zbiera, oddanie daje odznakę. Stałe/seedowane pozycje, instancing lub istniejący asset. Testy zasięgu, podwójnego zebrania, resetu i kolizji namiotów. Bez wspólnej ekonomii. |
| B10 | Festiwalowe bingo 3×3 | XS–S | Wspólny zapis z paszportem, nie drugi system. Zdarzenia: siadanie, odwiedzenie sceny, przejazd, ukończona mini-gra. Niewdrożone atrakcje nie mogą blokować kompletu. Testy idempotencji, zapisu i ukończenia. |
| B11 | Quiz patrolu | S | 5 pytań z lokalnego JSON, 3 odpowiedzi, wyjaśnienie. Bez AI podczas gry. Na start pytania o mapę gry; fakty o realnym festiwalu zatwierdza użytkownik. Testy oceny, losowania z seedem, resetu i anulowania. |

B2/B9/B10: nagrody lokalne i kosmetyczne. Bez globalnych rankingów, zmian nicków w sieci i przedmiotów wpływających na rozgrywkę. LocalStorage wersjonowany, walidacja ID, obsługa błędnego JSON i odmowy zapisu. Punkty brać ze stałych layoutu, nie powielać współrzędnych.

### Młyn: uproszczone MVP zamiast sześciu postojów indeksujących

**Jedna oznaczona kabina pasażerska**, pozostałe 23 są na razie wizualne. Gracz wsiada na dole, jedzie do góry, robi zdjęcie, wraca i wysiada. To świadome uproszczenie obsługi, nie deklaracja identycznego działania rzeczywistej atrakcji. Wszystkie kabiny i wielu pasażerów dopiero w A5.

Stary schemat sześciu postojów obraca grupę obsługiwanych kabin między cyklami i nie gwarantuje krótkiego oczekiwania na wysiadanie. Nie implementować go w MVP.

#### A0 — pomiar geometrii i kontrakt (S, nowe zadanie)

Własność: `docs/wheel-geometry-contract.md` i test geometrii. Bez GLB i `Game.ts`.

1. Odczytać istniejący model i testy. Spisać węzły podpór, podestu, kabiny, podłogę, punkt oka i wyjście w przestrzeni lokalnej/światowej. Punktu oka nie zgadywać z bounding boxa całej gondoli.
2. Wybrać kabinę na dole przy kącie zero albo jawny offset; kabina 0 obecnie zaczyna na górze.
3. Sprawdzić wnętrze i widoczność ścian. Jeżeli nie nadaje się do FPP, A4 staje się zależnością A3, a nie dodatkiem po oddaniu jazdy.
4. Najtańsze dojście: cel E przy wejściu na plac, poza obecnym colliderem, i fade do kabiny. Swobodne chodzenie po podeście jest poza MVP. Nie przebudowywać kolizji całego świata.

Odbiór: konkretne punkty, test 24 kabin i world transforms, osiągalne wejście/wyjście z uwzględnieniem promienia gracza. Test samego punktu w Box3 nie wystarczy.

#### A1 — nowy kontrakt harmonogramu (S)

Pliki: `world/wheelSchedule.ts`, test, `festivalWheel.ts` i jego test. Bez `Game.ts`.

- Cykl: dół 12 s → wjazd 36 s → góra 5 s → zjazd 36 s = 89 s. Stałe do strojenia. Pełny obrót, ta sama kabina wraca na dół.
- Czyste API: `sampleWheelSchedule(t): {angle, phase, stopped, secondsToPhaseEnd}`, fazy `bottom | ascending | top | descending`. Bez Three.js, Date.now i I/O. Niepoprawny/ujemny czas daje próbkę zera.
- Każda połowa obrotu używa `6u^5 - 15u^4 + 10u^3` — łagodna prędkość i przyspieszenie na końcach. Kąt modulo 2π, kierunek stały.
- `stopped` na górze NIE oznacza zgody na wysiadanie. Warunek wejścia/wyjścia to `phase === 'bottom'` i właściwa kabina.
- `update(dt)` i `setScheduleTime(t)` nie mogą oba dodawać czasu tej samej klatki. Zachować bazowe kwaterniony, kontr-obrót i współdzielone zasoby.
- Testy: granice faz, 3 cykle, brak skoku modulo 2π, stały horyzont, powrót tej samej kabiny, 30/60/144 FPS, duże dt, NaN/Infinity/ujemne dt, dispose.

#### A2 — kontroler pasażera, nie przebudowa colliderów (M)

Ta specyfikacja zastępuje dawną A2. Własność: `WheelRideController.ts`, testy i małe rozszerzenie istniejącego `PlayerController` z testami. Zależności A0/A1. Bez `Game.ts`.

- Jeden kontroler aktywności, bez własnego renderera/pętli. Stany idle/boarding/riding/exiting; start idempotentny.
- Kamera kopiuje pozycję kotwicy oka, nie obrót rotora. Horyzont poziomy, własny yaw/pitch, bez chodzenia i bobbingu.
- Tryb „rozglądanie bez ruchu” musi objąć mousemove, pointer lock/click i mobilne `lookBy`. Samo odblokowanie `lookBy` nie wystarczy dla myszy.
- Sprawdzić wsiadanie ponownie po fade: jeśli postój się skończył, anulować bez teleportacji. Fade nie zatrzymuje sam zegara atrakcji.
- E w ruchu kolejkuje wyjście na dolnym postoju, nie wyskakuje. Duże dt nie może zgubić przekroczenia okna postoju.
- Snapshot: yaw/pitch, fov, near i tryb sterowania. Po wyjściu pozycja na bezpiecznym gruncie, wyczyszczone klawisze/joystick, odtworzona macierz projekcji.
- `cancelToGround()` na błąd, wyjście do menu, rozłączenie i włączenie reduceMotion: fade, grunt, cleanup. Żadnego pozostawienia kamery wysoko ani spóźnionego callbacka po dispose.
- Testy pełnego przejazdu, pozycji oka, horyzontu, E/mobile, blokady ruchu, anulowania, 20 powtórzeń bez wycieku.

#### A3 — integracja (M, jeden właściciel plików wspólnych)

Własność: `Game.ts`, `CampWorld.ts`, `AppStateMachine.ts`, prompt/UI i testy. Zależności A0–A2 oraz A4, jeśli konieczne dla wnętrza.

- Stan `riding`; `playing → riding → playing`, `riding → paused → riding`. Zapamiętać źródło pauzy. Błąd/menu zawsze czyści aktywność.
- Statyczny hitbox wejścia i istniejąca warstwa interakcji; E i mobile to ta sama akcja. Zachować blokadę konstrukcji, bez swobodnego chodzenia po podeście w MVP.
- Kolejność klatki: harmonogram → kabina → kamera pasażera → render. Zwykły `player.update` nie może potem nadpisać pozycji.
- Offline pauza zamraża czas przejażdżki; powrót z ukrytej karty nie nadrabia całej nieobecności. Online ma inną politykę w A5.
- ReduceMotion przed jazdą blokuje wejście; zmiana podczas jazdy bezpiecznie kończy przejazd na ziemi. Nie zamraża pasażera na górze. Bez wymuszonego shake i bobbingu.
- Pierwsza wersja przejażdżki offline; w pokoju online wejście wyłączone do A5. Nie przedstawiać różnych lokalnych zegarów jako zsynchronizowanej atrakcji.
- FPP bez nowego lokalnego avatara: problemy rigów NPC nie powinny blokować przejażdżki.
- Odbiór w przeglądarce: pełna jazda z teksturami, wnętrze, wyjście, pauza, hidden tab, telefon, zmiana ustawień, restart.

#### A4/A5 — korekty do starszej specyfikacji

- A4: bez Antigravity Bridge. Najpierw pomiar A0; jeśli potrzebne, prosta podłoga/ławka/rama tylko dla kabiny MVP. Nie modyfikować materiałów cache, jawny właściciel geometrii, brak alokacji co klatkę. Near z pomiaru, przywrócenie po wyjściu. Nie tworzyć wnętrza ponownie przy każdej klatce.
- A5 ma koszt **L**, osobny etap. Serwer pokoju jest autorytetem przydziału miejsc i epoki. Żądania z request ID, walidacja fazy/zasięgu/slotu/rate limit, atomowy przydział i czyszczenie disconnect. Limit liczony wyłącznie lokalnie jest niewystarczający.
- Najpierw jedno miejsce w kabinie MVP, potem 4 miejsca i kolejne kabiny. Jawny kontrakt ride i wersja protokołu; klient nie może po prostu dopisać sobie ride w transformie.
- Synchronizacja z RTT i monotonicznym zegarem klienta. Pojedyncze `serverNow-Date.now()` nie usuwa opóźnienia. Snapshot dla późnego dołączenia, łagodne korekty, reconnect odzyskuje rezerwację albo bezpiecznie stawia na ziemi.
- Online pauza dotyczy UI, młyn jedzie dalej z serwerem i kamera pozostaje przy kabinie. Avatar zdalny używa kotwicy miejsca, nie podwójnej interpolacji; pozycja stóp różni się od oka.
- Testy 2 klientów: wyścig o miejsce, lag, late join, pauza, reconnect, fałszywe ID i zwalnianie slotu. Nie naprawiać wszystkich animacji siedzenia w tym zadaniu.

### Korekty mini-gier B1–B7

- B1: RNG bota wstrzykiwany do testów, przegląd API przed integracją. Obsłużyć hold/release/pointercancel na telefonie, Esc, reset w każdej fazie i cleanup. Nagroda to wynik/toast, NIE automatyczny efekt piwa z pominięciem `effect-warning`.
- B2: pieczątka młyna za zakończony przejazd, nie promień wokół obiektu. Publiczne `recordEvent(id)` do B9/B10, brak podwójnego storage. Awaria zapisu nie blokuje gry.
- B3: po renderze w tej samej klatce skopiować obraz do pomocniczego canvasu 2D, dopiero potem ramka i asynchroniczne `toBlob`. Bez drugiego WebGLRenderera i bez stałego preserveDrawingBuffer. Obsłużyć null blob, SecurityError, URL.revokeObjectURL, telefon. Komunikat „Przygotowano zdjęcie”, nie gwarancja zapisu na dysku. Brak flasha przy reduceMotion; bez uploadu. Obowiązkowy test prawdziwego PNG, mock nie wykrywa czarnego obrazu.
- B4: najpierw pasek timingowy i wynik, prosta geometria opcjonalna. Bez nowych animacji dłoni. Pauza i wyjście z siedzenia muszą przerwać rundę.
- B5: w MVP rzut do celu i 3 próby, nie fizyczny stos puszek. Wydzielać matematykę z Flanek tylko z testami zachowania. Kosmetyczny wynik zamiast ekonomii.
- B6: później, jawny dobrowolny tor. Maska braku trawy NIE jest maską błota: obejmuje też asfalt/podesty. Usunąć losową „10% wywrotkę”, która może zależeć od FPS; bez obowiązkowego przechyłu kamery.
- B7: później, jawny BPM, monotoniczny czas i opcjonalna kalibracja opóźnienia. Nie zmieniać globalnych świateł ani tłumu po lokalnym combo. Bez nowej muzyki bez praw do jej użycia.

### Przydział zadań i bezpieczna równoległość

To sugestie według trudności, nie gwarancje skuteczności modelu:

| Pakiet | Proponowany agent | Granice pracy |
| --- | --- | --- |
| A0/A1 | Gemini Pro | Geometria i czysta matematyka; bez Game.ts. |
| B2, B8, B10, B11 | Gemini Flash; Pro do integracji | Jeden mały moduł i testy, najpierw zadanie próbne. |
| B1, B4, B9 | Gemini Pro lub Sonnet | Logika aktywności i testy; nie globalna przebudowa gry. |
| A2/A3/A5 | Jeden agent Pro/Sonnet + końcowe review Codexa | Kamera, stany i sieć są najbardziej ryzykowne. |
| Fixtures i dokumentacja | Flash / GPT-OSS | Bez rigowania i zmian protokołu. |

Nie potrzeba najdroższego modelu do pierwszego quizu czy paszportu. Ocenić jakość jednego małego Issue przed przekazaniem większej partii.

1. Baza to **zatwierdzony commit SHA**, nie tylko nazwa gałęzi. Worktree zawiera niezacommitowane zmiany; nie przenosić ich automatycznie do zadań.
2. Każdy agent: osobne Issue/branch/worktree, przydzielona lista plików. Bez push/PR/merge. Po zakończeniu zatrzymuje się do review Codexa.
3. Równolegle: A0/A1, B2 jako izolowany moduł, B8. Po A0 można osobno wykonać wnętrze A4. A2 po zatwierdzonym A1.
4. **Jeden integrator** dotyka `Game.ts`, `CampWorld.ts`, głównego UI i wspólnych stanów. Integracje A3/B1/B2 wykonywać kolejno na bazie zawierającej zaakceptowane zależności. Agent nie scala cudzych branchy sam.
5. Wszystkie runtime testować w przeglądarce albo oznaczyć `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Build nie oznacza wizualnego odbioru.

### Polecenie do skopiowania do Gemini

```text
Zadanie: <ID z aktualizacji 2026-10-03 w docs/attractions-plan.md>.
Issue: <numer>. Baza: <zatwierdzony SHA>.
Branch/worktree: <przydzielone>. Dozwolone pliki: <lista>.
Zależności już dostępne: <lista zatwierdzonych modułów>.

Przeczytaj AGENTS.md i aktualny plan. Najpierw sprawdź istniejące API.
Nie twórz drugiego renderera, loadera, pętli ani kontrolera gracza.
Zaimplementuj tylko przydzielony moduł i jego testy akceptacyjne.
Nie edytuj Game.ts, chyba że jesteś integratorem tego zadania.
Nie zmieniaj modeli NPC/GLB, wag ani innych lokalnych zmian.
Bez kluczy API, płatnych kredytów i automatycznego overage.
Bez push, PR i merge. Po zadaniu zatrzymaj się do code review Codexa.

Oddaj: zmienione pliki, opis działania, dokładne polecenia i wyniki testów,
build i lint, istniejące błędy bazy, raport przeglądarki albo
VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN, ograniczenia i punkty integracji.
Jeśli Issue wymaga integracji, sam działający moduł nie kończy zadania.
```

Przed pracą wykonać testy bazowe. Na koniec testy zadania, `npm test -- --run`, `npm run build` i lint zmienionych plików. Błędy istniejące wcześniej raportować, nie naprawiać poza zakresem. Ten dokument to plan; w tej aktualizacji nie wdrażano atrakcji ani nie delegowano automatycznie pracy.

## C. Znajomości z NPC i rozmowy, które mają znaczenie

### C1 — pamięć relacji (S; dobry pierwszy task dla Gemini)

Rozszerzyć istniejący `npc/NpcAiAgent.ts`, nie dodawać płatnego LLM. Osobny moduł `NpcRelationships` przechowuje po stabilnym ID: znajomość, zaufanie, poznane tematy, wykonane przysługi i ostatnie ważne wydarzenie. MVP tylko 6–8 wybranych NPC, reszta ma obecne krótkie dialogi. Nie pisać od razu historii dla 107 postaci.

- Poziomy: obcy → kojarzy cię → znajomy → zaufany. Różne zainteresowania i granice NPC, nie wszyscy reagują tak samo.
- Krótka rozmowa, pomoc lub wspólna aktywność zmieniają relację. Powtarzanie jednego tekstu nie farmi punktów: cooldown i idempotentne zdarzenia.
- NPC pamięta np. znalezioną zgubę, wspólne Flanki, obietnicę spotkania. Nie przechowywać bez potrzeby całego dowolnego tekstu użytkownika.
- Wersjonowany lokalny zapis i możliwość resetu; w MVP relacja jest indywidualna dla gracza. Wyraźnie oddzielić ją od wspólnego stanu świata.
- Odbiór: test progów, limitów, cooldownów, resetu, uszkodzonego zapisu i braku duplikatów nagród. Brak zmian w rigach/modelach.

### C2 — rozgałęzione rozmowy i przysługi (S–M)

Węzły dialogu w danych: `id`, tekst, odpowiedzi, warunki, skutki i fallback. Skutki wykonuje zweryfikowany kod, nigdy tekst wypowiedzi NPC ani dowolny skrypt z JSON. Istniejące swobodne odpowiedzi mogą zostać, ale ważne decyzje są wybieralnymi opcjami, dostępnymi również na telefonie.

Przykładowy przebieg: rozmowa o ulubionej scenie → pomoc w znalezieniu flagi → zaproszenie pod scenę → wspólne ognisko. Odmowa pomocy nie blokuje reszty gry. Przysługi mają krótkie zakończenie, nie wielogodzinny grind.

Testy: każdy węzeł osiągalny albo jawnie warunkowy, brak ślepych zakończeń, poprawne referencje, jedna nagroda na zadanie, bezpieczne wyjście z dialogu. Przykładową historię przygotować dla jednego NPC przed kopiowaniem schematu.

### C3 — fikcyjne używki jako opcjonalny element fabuły (M, po C1/C2)

Docelowo odpowiednia rozmowa i relacja mogą odblokować ofertę przedmiotu od **fikcyjnego dorosłego NPC w grze**. To scenariusz rozgrywki, nie poradnik zdobywania substancji w rzeczywistości: bez prawdziwych kontaktów, adresów, cen rynkowych, sposobów zakupu, dawkowania i instrukcji użycia. Nie przypisywać handlu realnym osobom, Pokojowemu Patrolowi, WOŚP ani organizatorom festiwalu. Wyraźnie oddzielić fikcję od odwzorowywanej imprezy.

- NPC może odmówić lub zaproponować zwykły napój; gracz zawsze może odmówić bez kary. Znajomość nie oznacza automatycznej zgody.
- Pozyskanie przedmiotu nie uruchamia efektu. Korzystać z istniejącego ekwipunku, `itemUse` i `effect-warning`; osobne potwierdzenie oraz możliwość wyłączenia efektów wizualnych.
- Nie nagradzać eskalowania używania; oferować równie ciekawe ścieżki bez używek. Do weryfikacji przez użytkownika: ton dialogów, oznaczenia treści i wymagania platformy publikacji.
- Lokalny prototyp bez ekonomii i handlu między graczami. Jeżeli przedmioty staną się współdzielone, transakcje i limity przenieść na serwer z ochroną przed duplikacją; osobne Issue.
- Testy: warunki relacji, odmowa, ponowne kliknięcie, pełny ekwipunek, cooldown, brak samoczynnego efektu, reset zapisu i anulowanie rozmowy.

### C4 — znajomy towarzysz (M, później)

„Chodźmy pod scenę” / „Spotkajmy się przy ognisku”. Jeden towarzysz w MVP; korzysta z istniejącej nawigacji, ma dystans komfortu i może przerwać spacer. Bez teleportowania na oczach gracza i bez blokowania go w wejściu. Najpierw umówione spotkania w punktach, potem ciągłe podążanie. Testy utraty ścieżki, rezygnacji, opuszczenia sesji i konfliktu z dialogiem.

## D. Żywy tłum pod Dużą Sceną — poprawa istniejącego ruchu

W `NpcManager.ts` istnieją role `stage_dancer`, `asp_listener`, `food_queue`, `chiller`, `walker`; jest też hardkodowany obszar dla tancerzy. Rozbudować ten system oraz `NpcNavigationGrid`, nie tworzyć drugiego „silnika NPC”. Deformacje wag i jakość nawigacji to oddzielne zadania.

### D1 — strefy aktywności i rozkład tłumu (S)

Wyprowadzić granice z `festivalStages`/layoutu, usunąć duplikowanie współrzędnych. Wyznaczyć widownię, przejścia, obszar niedostępny za sceną i punkty wejścia/wyjścia. Konfigurowalny profil koncertowy: orientacyjnie 50–60% dostępnego tłumu pod Dużą Sceną, 20–25% pasaż, reszta obozy/ASP; wartości do strojenia po pomiarach, nie dodatkowe setki modeli.

Wybór celu ważony z seedowanym RNG, limity pojemności stref i czas pobytu. Nie zmieniać celu co klatkę. Widzowie wybierają rozproszone miejsca i patrzą w stronę sceny, a nie zbiegają się w jeden punkt. Nie zabierać jednocześnie wszystkich z głównego obozu.

Testy: rozkład w granicach tolerancji dla ustalonego seeda, punkty osiągalne i poza colliderami, limity stref, brak miejsc na scenie i w przejściach. Oddać moduł polityki i testy; integracja `NpcManager` przez jednego właściciela.

### D2 — płynność, omijanie i budżet CPU (M)

- Zachować ruch delta time i `NpcAnimator`. Hamowanie przy celu, płynny obrót, minimalny czas decyzji i histereza przejść walk/idle/run.
- Prosta separacja sąsiadów przez spatial hash, nie porównanie każdej pary w każdej klatce. Limit przyspieszenia; separacja nie może wypychać przez ściany.
- Replanowanie ścieżek rozłożone na klatki, watchdog utknięcia z cooldownem, bez ciągłego losowania celu. Grupy 2–4 osób dopiero po stabilnym pojedynczym ruchu.
- Aktualizacje myślenia rzadsze dla dalekich NPC, ale zachować czas animacji przy powrocie do bliskiego LOD. Nie rozmnażać modeli dla pozornego tłumu.
- Testy 30/60/144 FPS, przejście przez wąskie gardło, brak oscylacji celu, zablokowana ścieżka i odtwarzalny seed. Profil CPU/FPS przed i po na tej samej trasie i ustawieniach; liczba agentów/path queries w raporcie.

### D3 — reakcja na koncert (S–M)

Jeden wspólny sygnał `ConcertState` steruje porą napływu, spokojnym staniem, oklaskami i odpływem. Losowe przesunięcia czasu, żeby cały tłum nie klaskał identycznie. Tylko sprawdzone animacje; dla wadliwych modeli bezpieczne idle zamiast naprawiania rigów w tym Issue. Brak fizycznego przepychania/pogo w MVP.

## E. Duża Scena: legalne nagrania i dźwięk przestrzenny

### E0 — źródła i prawa: bramka przed pobraniem (zadanie organizacyjne)

Sprawdzono oficjalne źródła 2026-10-03. Nie potwierdzono otwartej licencji pozwalającej pobrać koncerty KręciołaTV i redystrybuować ich audio w tej grze. Publiczny film ani możliwość osadzenia nie są taką zgodą. Nie pobierać/wyodrębniać ścieżek YouTube jako etapu technicznego.

- Kontakt do materiałów KręciołaTV jest w [oficjalnym kontakcie WOŚP](https://newsroom.wosp.org.pl/35374-skontaktuj-sie-z-nami). Użytkownik powinien uzyskać zgodę/licencję dla konkretnych nagrań i wskazanie pozostałych uprawnionych; agent może przygotować projekt wiadomości, lecz nie wysyła jej sam.
- Ustalić zakres: kopia audio, hosting/CDN, odtwarzanie w przeglądarkowej grze i synchronizacja z obrazem gry, filtry/pogłos, dostęp publiczny, monetyzacja, terytorium, czas i podpisy. Zgoda producenta nagrania może nie obejmować wszystkich praw do muzyki/wykonania — zakres powinien potwierdzić uprawniony lub prawnik.
- Preferować pliki lub legalny stream dostarczony bezpośrednio przez uprawnionego. Dla każdego utworu manifest: ID, tytuł, autor/wykonawca, źródło, licencja/zgoda, wymagany podpis, dozwolone użycie i termin. Prywatnych dokumentów zgody nie publikować w repo.
- [Warunki YouTube](https://www.youtube.com/static?template=terms) oraz [polityka API YouTube](https://developers.google.com/youtube/terms/developer-policies) ograniczają pobieranie i rozdzielanie audio od obrazu. Osadzony oficjalny odtwarzacz to ewentualna osobna funkcja, nie zamiennik pliku do filtrowania Web Audio ani ukryte „radio YouTube”. Nie omijać CORS, reklam ani zabezpieczeń.
- Do czasu zgody rozwijać system na własnym krótkim nagraniu/testowym sygnale lub materiale z wyraźnie zgodną licencją. Tryb „bez muzyki licencjonowanej” dla nagrywania/streamowania rozgrywki.

Nie pobrano żadnych nagrań i nie wysłano zapytania o zgodę w ramach tworzenia tego planu.

### E1 — jeden transport koncertu (M)

Punkty integracji: `audio/SpeakerAudio.ts`, `CampAmbientAudio.ts`, `GameAudio.test.ts`, `Game.ts`. Obecny SpeakerAudio steruje głośnością HTMLAudio w zależności od dystansu; sam nie daje docelowego filtra i pogłosu. Rozszerzyć warstwę audio ze wspólnym właścicielem AudioContext/listenera, nie tworzyć kontekstu na każdy głośnik i NPC.

- `ConcertState`: trackId, startedAt, offset, playing; źródło lokalne offline, autorytet serwera online. Wszyscy słyszą ten sam fragment; klient późno dołączający zaczyna od właściwego offsetu, nie od początku.
- MVP: nagrania VOD z zatwierdzonej playlisty. Prawdziwy stream live/HLS dopiero osobno — różne bufory/opóźnienia utrudniają synchronizację.
- Duże pliki strumieniować przez HTMLMediaElement/MediaElementAudioSourceNode; nie dekodować całego godzinnego koncertu do AudioBuffer. Jeden MediaElementSource na element. Krótką odpowiedź impulsową pogłosu można trzymać w buforze.
- CORS musi być poprawnie ustawiony u dostawcy przed utworzeniem źródła. Obsłużyć gesture/autoplay, błąd sieci, brak pliku, buffering, mute, zmianę utworu i dispose. Bez obietnicy autoplay po samym wejściu na stronę.
- Hosting mediów oddzielny od Git LFS: manifest w repo, zatwierdzone pliki na hostingu zapewniającym zakresy bajtów/cache i budżet transferu. Płatny hosting lub CDN wymaga wyboru użytkownika, nie zakładać darmowego nieograniczonego transferu.
- Testy zegara, dołączenia w środku, dryfu, pause/resume offline vs online i błędnego źródła. Test przeglądarki obowiązkowy dla CORS i autoplay.

### E2 — blisko koncert, daleko przytłumione echo (M, po E1)

**Jedno źródło aktualnego utworu, dwie gałęzie obróbki, nie dwa niezależne odtwarzacze:**

`source → dry gain / filtr → kierunkowy panner → master`

`source → filtr → krótki delay/pogłos → wet gain → master`

- Pod sceną wyraźny dźwięk bez nadmiernego pogłosu. Z dystansem maleje głośność i pasmo wysokich częstotliwości; daleko zostaje cichy, przytłumiony pogłos TEGO SAMEGO nagrania. Nie osobna zapętlona próbka „tłumu”. Na otwartym polu domyślnie subtelne odbicia, nie pogłos katedry.
- Dry i wet mają własne tłumienie; wet również dochodzi do zera poza zasięgiem. Nigdy coraz głośniejszy pogłos wraz z odległością. Płynne rampy parametrów bez trzasków przy granicy stref.
- Przykładowe strefy do strojenia po pomiarze mapy: bliska widownia, środek pola, dalekie obozy, cisza. Promienie w konfiguracji sceny, nie w wielu klasach; uwzględnić wysokość gracza na młynie.
- Tania kierunkowość przód/tył sceny, opcjonalne uproszczone zasłanianie kilkoma testami na sekundę. Nie raycastować każdej próbki audio i nie dodawać symulacji akustycznej całej mapy.
- Głośniki obozu i scena mają odrębne suwaki; dialog łagodnie przycisza muzykę. Preferencje audio nie mogą rozjeżdżać wspólnego zegara koncertu. Nie zmieniać playbackRate licencjonowanego koncertu przez efekty postaci w pierwszej wersji.
- Testy czystej funkcji odległość→gain/cutoff: monotoniczne tłumienie, ciągłość, NaN, mute i limit wzmocnienia. Ręczny odsłuch: scena→pasaż→obóz→młyn oraz dwa klienty. Dodać limiter/bezpieczny master, zero nagłego skoku głośności.

### E3 — spójne widowisko (S–M)

Tablica „teraz gra”, lokalny rozkład koncertów, delikatne światła do jawnej siatki beatów lub wcześniej przygotowanych markerów. Ten sam ConcertState dla audio, tłumu i UI; reduceMotion/reduced flashes niezależnie od dźwięku. Nie obiecywać automatycznego rozpoznawania rytmu dowolnego koncertu. Ekran sceniczny z filmem dopiero po sprawdzeniu praw, wydajności i synchronizacji.

## F. Dalsze kreatywne atrakcje i podział na małe Issue

| ID | Pomysł | Tanie MVP / zależności |
| --- | --- | --- |
| F1 | Tablica ogłoszeń obozu | Lokalnie generowane wiadomości: zguba, wspólne Flanki, spotkanie. 3 wpisy z danych, bez treści graczy i moderacji na start. S. |
| F2 | Biuro rzeczy znalezionych | Znajdź kapelusz/flagę, rozpoznaj właściciela po dialogu. Jeden rekwizyt i historia, C2. S. |
| F3 | Wymiana naszywek | Kosmetyczny album 8 ikon za różne aktywności, bez losowych płatnych paczek. B2. XS–S. |
| F4 | Festiwalowa poczta | NPC prosi o dostarczenie kartki innemu obozowi; odpowiedź i zmiana relacji. Stałe lokalizacje, C1/C2. S. |
| F5 | Znajomy pokazuje skrót | Po przysłudze odblokowuje wskazówkę/marker na mapie, nie nowy teren. B8/C1. XS. |
| F6 | Wspólne zdjęcie | Znajomy czeka w ustalonym punkcie, gracz robi pocztówkę. B3/C1; bez pozy z niezweryfikowanego rigu. M. |
| F7 | Obóz żyje porą dnia | Rano kawa i cisza, wieczorem ognisko, przed koncertem część osób wychodzi. Reguły czasu i istniejące rekwizyty, D1. S–M. |
| F8 | Pomoc sąsiadom w deszczu | Opcjonalny krótki quest zabezpieczenia plandeki, bez fizyki tkaniny i kar za odmowę. C2 i istniejąca pogoda. S. |
| F9 | Festiwalowy dziennik wspomnień | Po aktywności krótki wpis i opcjonalna własna pocztówka; lokalny zapis z limitem danych, B2/B3. S. |
| F10 | Fala oklasków | Po zakończeniu utworu reakcje grup z opóźnieniami, nie idealnie zgodny ruch wszystkich. D3/E3, sprawdzone klipy. S. |
| F11 | Poranny spacer fotograficzny | Trzy wskazane kadry: słoneczniki, obóz, panorama z młyna; odznaka bez analizy obrazu AI. B2/B3. S. |

### Kolejność i delegowanie rozszerzeń

1. **Flash / GPT-OSS:** dane jednego dialogu C2, quiz, teksty tablicy F1, walidator grafu dialogów, fixtures. Nie przekazywać im samodzielnej przebudowy ruchu.
2. **Gemini Pro / Sonnet:** C1, izolowany moduł D1, testy E2 na syntetycznym źródle, F2 po C2. Jedno Issue = jeden sprawdzalny moduł.
3. **Jeden integrator z review Codexa:** D2, kamera/tłum, E1 i integracja z siecią. Nie równolegle edytować NpcManager, Game.ts i audio przez kilka agentów.
4. Priorytet po pierwszym pakiecie atrakcji: D1 (więcej ludzi przy scenie) → D2 (ruch) oraz niezależnie C1→C2. E0 może trwać w tle organizacyjnie; E1/E2 rozwijać na legalnym materiale testowym. C3 dopiero po stabilnym dialogu i ekwipunku.
5. Nie uruchamiać płatnych API, nie pobierać cudzych koncertów „na próbę”, nie wysyłać wiadomości o licencje bez polecenia. Każde zadanie osobny branch/worktree, bez merge; końcowe review pozostaje u Codexa.

---

