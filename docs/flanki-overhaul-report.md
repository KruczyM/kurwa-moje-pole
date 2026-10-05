# Flanki — wdrożenie 2026-10-04

Gałąź: `feat/festival-next`. Bez push, PR i merge.

## Zmiany

- Wycelowanie łukiem poprzedza ładowanie siły przez LPM/Spację. Wybrana trajektoria jest blokowana, siła rośnie do stabilnego maksimum; zielony zakres ułatwia dobór siły, ale kierunek nadal ma znaczenie.
- Piłka korzysta z grawitacji 9,81 m/s², kroku 1/120 s, testu przebytego odcinka przeciw puszce oraz odbić z utratą energii i tarciem. Boty również rzucają rzeczywistą piłkę zamiast losowo przewracać puszkę.
- Lobby serwera pokoju przyjmuje do 4 ludzi przed startem, rozdziela ich po 2 na drużynę i uzupełnia wolne miejsca NPC. Tylko gospodarz rozpoczyna mecz. Po starcie nie można wejść do składu. Rozłączenie uczestnika anuluje mecz; po wygranej można utworzyć nowe lobby.
- Gospodarz jest jedynym autorem wyniku, fizyki i kolejki; gość przekazuje rzut, stan przytrzymania [E], ruch biegacza i żądanie postawienia puszki. Serwer sprawdza uczestnictwo, tożsamość gospodarza i identyfikator sesji. Stary ogólny protokół `hit_can`/`stand_can` usunięto.
- Skład botów korzysta z najbliższych istniejących NPC oraz ich animatorów, bez klockowych biegaczy i dodatkowych kopii postaci przy boisku.
- Klony mają własne miksery i szkielety; przy sprzątaniu nie są zwalniane współdzielone geometrie, materiały ani tekstury modeli postaci i puszki. Listenery sieciowe są odpinane.
- Powrót biegacza i STOP przesuwają pełną naprzemienną kolejkę także po trafieniu. [E] nie pomija powrotu biegacza.
- Wysoka trawa jest wyłączona na boisku we wspólnej masce bliskiej i dalekiej roślinności. HUD nie zasłania osi rzutu, punkty toru są okrągłe. Modal składów przechwytuje kliknięcia i ma przewijanie na małym ekranie.

## Walidacja

### Aktualizacja sterowania — 2026-10-04

- W lobby gospodarz wybiera stałego biegacza każdej drużyny spośród jej członków, również człowieka. Role są synchronizowane przez serwer i zamykane po starcie. Biegacz nie bierze udziału w kolejce rzutów.
- Rzucający pozostają nieruchomi przez cały mecz. Człowiek-biegacz porusza się tylko podczas obrony, w granicach boiska; [E] przy puszce stawia ją, ale STOP następuje dopiero po powrocie za własną linię. Host odrzuca podniesienie z daleka, teleporty i akcje niewłaściwego gracza.
- Picie nie jest automatyczne dla ludzi. Przytrzymanie [E] pije, puszczenie i STOP przerywają. NPC piją automatycznie. Usunięto losowe klawisze QTE z HUD i instrukcji. W sieci heartbeat picia wygasa po 0.5 s bez odświeżenia.
- Rzut: najpierw wybierz łuk, potem LPM/Spacja blokuje jego kierunek i ładuje siłę jednostajnie do stabilnego maksimum. Zielony zakres ±6 punktów procentowych jest wyliczany dla bieżącej trajektorii i dystansu; niewielka korekta kierunku działa tylko w odległości kątowej do 2°. Chwianie ręki jest kosmetyczne. Piłka nadal leci fizycznie, a nietrafiony kierunek daje pudło. Podgląd i faktyczny rzut korzystają z tej samej prędkości początkowej.
- Przy dojściu NPC wykorzystano istniejący steering. A* sprawdza także odcinki między komórkami, żeby nie kierować zawodników przez narożniki colliderów.
- Chromium: wybór człowieka i ponowny wybór NPC w dropdownie lobby, blokada WASD, brak samoczynnego picia, przytrzymanie/puszczenie [E], trafiony rzut klawiaturą, ręczne postawienie puszki i powrót za linię — wszystkie sprawdzenia przeszły, brak błędów JS. Raport: `reports/flanki-overhaul/browser-report.json`.
- Końcowa walidacja: 130 plików / 1319 testów przeszło, build przeszedł (pozostaje ostrzeżenie o wielkości bundle), ESLint zmienionych plików runtime przeszedł, osobne sprawdzenie typów serwera w trybie strict przeszło.
- Subiektywna ocena trudności po dłuższej grze, biegacz-gość na drugim pełnym kliencie i sterowanie telefonem: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

- `npm run test:unit`: **130 plików / 1308 testów — wszystkie przeszły**.
- `npm run build`: przeszedł; pozostaje ostrzeżenie Vite o dużym bundle.
- ESLint zmienionych plików runtime: przeszedł.
- `python scripts/verify-flanki-overhaul.py`: prawdziwy świat hosta w Chromium i drugi klient Socket.IO z instancją Flanek, bez drugiego ciężkiego świata WebGL. Normalne kliknięcie przycisku Start, wspólny skład 2 ludzi, widoczna ręka, modele NPC, otrzymanie tury przez gościa, przyjęcie jego rzutu przez hosta, anulowanie po rozłączeniu, brak błędów JavaScript. Pomiar wysokości i podeszew jest zapisany w raporcie.
- Artefakty: `reports/flanki-overhaul/browser-report.json`, `lobby.png`, `aiming.png`, `pitch.png`.

Sprawdzenie dłuższego meczu przez dwóch ludzi z pełnym światem na obu urządzeniach oraz ergonomii telefonu: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Nie jest to deklaracja sprawdzenia każdego trybu gry.

## Uruchomienie

## Weryfikacja pełnej sceny i dalsze poprawki — 2026-10-04

- Usunięto utknięcie przy dojściu na boisko: na sprawdzonym odcinku A* NPC idzie do waypointu, zamiast omijać przeszkodę leżącą dopiero za zakrętem. Dodano deterministyczny test krótkiego odcinka przed ścianą.
- Wznowienie sesji zamyka poprzedni socket; integracyjny test sprawdza, że pozostał wyłącznie nowy właściciel postaci. Puste pokoje mają 5 s zwłoki przed usunięciem, aby nie usuwać świeżo utworzonego pokoju w trakcie dołączania. Mapa sprzątania jest czyszczona przy stop serwera.
- Poszerzono i zwiększono próbkowanie podeszw (maks. 64 wierzchołki na siatkę). Normalizacja nadal nie zmienia wspólnych assetów ani wag.
- Otwarcie menu/helpera/mapy anuluje lokalne ładowanie rzutu i trzymanie picia. Helper/mapa blokują lokalny ruch i inicjowanie rzutu; wspólna symulacja nadal działa.
- 94 testy w 9 plikach przeszły. `scripts/verify-flanki-lobby.py`: oba ludzkie role biegaczy, sterowanie tylko wejściem gracza i sprzątanie rozłączenia przeszły w dwóch klientach, bez błędów JS.
- `scripts/verify-flanki-formation.py`: pełna scena Chromium, pięć wypożyczonych istniejących NPC faktycznie doszło na stanowiska; błąd obrotu do puszki 0. Animacja rzutu była aktywna. Przez rzeczywisty RemotePlayersManager odtworzono snapshot czterech załadowanych modeli (Amper, Krwiak, Kobra, Chlebak) w Run: maksymalny błąd podeszew 0.0143 m. Rzeczywista pętla Game kontynuowała lot piłki pod helperem i lokalnym paused podczas połączenia online. Brak błędów JS.
- Raport i obejrzany zrzut: `reports/flanki-overhaul/formation-world.json`, `formation-world.png`. Ten test używa kontrolowanych snapshotów i kamery; nie zastępuje długiego meczu dwóch pełnych światów, testów wszystkich 16 awatarów i ergonomii sterowania: te nadal `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

## Rozłączenia, zdalne modele, role i lokalna pauza — 2026-10-04

- Pagehide zwalnia własną postać i rozłącza klienta. Serwer usuwa transformację od razu po disconnect, wysyła snapshot nawet pustego świata, a następnie usuwa puste pokoje. Awaryjna utrata transportu korzysta z heartbeat Socket.IO i 5 s ochrony reconnect; zamknięcie strony nie powinno wymagać czekania na ten okres. RemotePlayersManager sprząta modele także po utracie własnego połączenia.
- RemotePlayersManager korzysta z istniejącej fabryki aktorów: skala/offset pozostają poza animowaną hierarchią, a próbki podeszw utrzymują model na ziemi podczas klipów. Obrót wizualny uwzględnia różnicę -Z kamery i +Z modeli, bez zmiany kontraktu yaw sieci.
- Snapshot gospodarza przenosi identyfikatory biegaczy obu drużyn. Gość synchronizuje role przed zastosowaniem tury/stanu; ludzki biegacz nie dostaje modelu NPC ani automatycznego biegu.
- Lokalny helper/menu w stanie paused podczas połączenia online nadal aktualizuje istniejącą symulację świata, Flanki, NPC i zdalne modele. Nie tworzy drugiego renderera/RAF; ścieżki nie wykonują podwójnego kroku. Lokalny gracz nie steruje ani nie pije przez menu; offline paused nadal zamraża świat.
- 71 testów w 8 plikach przeszło; build przeszedł. Test animowanej pozycji root sprawdza brak unoszenia podeszw; test obu ludzkich biegaczy sprawdza brak botowego sterowania; polityka pauzy ma test deterministyczny.
- `scripts/verify-flanki-lobby.py` przeszedł w dwóch kontekstach Chromium: zachowane ludzkie role po starcie, brak automatycznego biegu, gość otrzymuje sterowanie, rozłączenie usuwa gracza i lobby, postać natychmiast dostępna. Raport `reports/flanki-overhaul/lobby-regressions.json`, brak błędów JS.
- Wygląd Krzaka/innych modeli w pełnym świecie WebGL i rzeczywiste otwieranie helpera przez gospodarza: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Test przeglądarkowy obejmuje protokół i roster, nie pełną scenę.

## Regresje lobby, celności i widoczności — 2026-10-04

- Rozrzut botów zmniejszono z domyślnych 90 do około 34 cm; kolizja nadal jest fizyczna. Test 20 deterministycznych rzutów z bocznego stanowiska wymaga co najmniej 14 trafień, ale nie samych trafień.
- Wyłączono odrzucanie przez frustum wyłącznie dla skinned meshes uczestników: zbuforowana kula Idle może odrzucać model Run, mimo widocznego cienia. Wypożyczone modele odzyskują poprzednie ustawienia po zwolnieniu; propsy pozostają odrzucane normalnie.
- Każda operacja lobby ma potwierdzenie lub limit oczekiwania. Serwer odpowiada także na niepotwierdzoną postać, brak pokoju i limit żądań. Komunikaty UNAUTHORIZED są teraz widoczne w grze, nie tylko ignorowane przez menu początkowe.
- Rezerwacja własnej postaci jest potwierdzana przed dołączeniem. Dropdown czeka na wynik, a potem odświeża listę rzucających, nazwę biegacza i role; obaj klienci otrzymują nowy skład.
- `python scripts/verify-flanki-lobby.py`: dwa odrębne konteksty Chromium i prawdziwe NetworkClient/UIManager/FlankiGame. Dołączenie bez ręcznego confirm, zmiana NPC→człowiek, aktualizacja obu menu, blokada zmian u gościa i wejście do meczu po starcie gospodarza przeszły, bez błędów JS. Raport: `reports/flanki-overhaul/lobby-regressions.json`.
- 49 testów w 5 plikach przeszło. Pełny świat WebGL i wygląd biegnącego modelu nadal: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

## Ustawianie i rzuty NPC — 2026-10-04

- NPC po dojściu do stanowiska obracają się przodem do puszki, zerują prędkość i przechodzą w Idle. Zablokowane podejście jest ponownie planowane po 0.8 s bez postępu.
- Rzucający stoją dokładnie na kredowych liniach; przy starcie utrwalane są stanowiska. W trakcie meczu pozycja i obrót są utrzymywane, z wyjątkiem biegacza wykonującego zadanie.
- Dodano proceduralny rzut prawą ręką na istniejącym szkielecie (brak gotowego klipu Throw w paczce). Rozmach poprzedza rzut NPC; wykończenie wraca do bazowej animacji. Nakładka nie zmienia wag, kości barków ani twarzy. Stan rzutu jest przesyłany gościom; zakończenie meczu przywraca kości i zwalnia nakładki.
- 48 testów w 3 plikach przeszło; build i ESLint runtime przeszły. Testy obejmują obrót po dojściu, stałe stanowiska, animowanie ręki bez wpływu na twarz/barki i sprzątanie bez dryfu.
- Próby Chromium nie uruchomiły pełnego świata w limicie czasu, więc nie potwierdzają dojścia istniejących NPC ani wyglądu rzutu. `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Skrypt: `scripts/verify-flanki-formation.py`.

## Zapis składu i rzeczywiste rzuty — 2026-10-04

- Menu nie nadpisuje wyboru biegacza przed odpowiedzią serwera. Serwer potwierdza zmianę; klient zgłasza odrzucenie lub brak potwierdzenia (np. stary proces serwera wymagający restartu).
- Ręka i trajektoria chwieją się w pierwszym etapie. Przytrzymanie LPM/Spacji zamraża kierunek, następnie ładuje siłę; puszczenie rzuca. Usunięto automatyczne prostowanie kierunku i przyciąganie siły do idealnej wartości.
- Gracze mają osobne miejsca na linii. Nie są przenoszeni na jej środek przy kolejnej turze. Host sprawdza otrzymane miejsce rzutu względem stanowiska gracza.
- Poprawiono cele ustawienia NPC i rekrutowanie ich również przy aktualizacji lobby dołączającego klienta. Menu zawiera instrukcję dołączania drugiego człowieka; scrollbar ma kolorystykę gry.
- 53 testy w 6 plikach przeszły, w tym minimalna siła z odbiciami nie przewracająca puszki i osobne miejsce rzutu. Build przeszedł (istniejące ostrzeżenie wielkości bundle).
- Próba aktualnej weryfikacji Chromium zatrzymała się na wejściu E: dialog nie otworzył się w limicie 30 s, bez błędów JS. Wcześniejsze artefakty nie potwierdzają tych nowych zmian. Status: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

## Poprawka wejścia i uczestników — 2026-10-04

- [E] odświeża cel interakcji. Flanki i stacja Allegro mają jawne strefy wejścia również bez trafienia celownikiem w niewidoczny hitbox.
- Najbliżsi dostępni NPC w promieniu 60 m są wypożyczani z istniejącego tłumu, bez klonowania i zmiany rodzica. Po aktywacji podchodzą po trasach nawigacji; Start czeka na ustawienie zawodników. Pozostali NPC omijają aktywne boisko. Zamknięcie lobby, zakończenie meczu i rozłączenie zwalniają uczestników.
- Starszy serwer bez protokołu Flanek otwiera tryb z botami zamiast ignorować żądanie lobby.
- Allegro ma dostępny punkt wejścia poza colliderem; ten sam punkt służy do wysiadania. [E] kolejkowane podczas ruchu czeka na dolny postój. Oddalenie się anuluje kolejkę. Blokada ruchu nie jest nadpisywana przez Flanki.
- Testy: 130 plików / 1311 testów przeszło; build przeszedł. Raport Chromium: rzeczywisty klawisz [E], 4 istniejących NPC przy 2 ludziach, zwolnienie uczestników, wejście do kabiny, wzrost wysokości oka 4.1→19.1 m, powrót na ziemię, brak błędów JS. Artefakt `reports/flanki-overhaul/browser-report.json`.
- Długi mecz dwóch pełnych klientów, wszystkie warianty tras tłumu i ergonomia mobilna: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

### Restart serwera

Po zmianie kodu serwera zatrzymaj poprzednie `npm run dev` (Ctrl+C) i uruchom je ponownie. Podejdź do boiska, naciśnij [E], poczekaj na znajomych i rozpocznij mecz przyciskiem gospodarza. Drugi gracz musi być w tym samym pokoju/na tym samym serwerze.

Zaktualizowano wskazany istniejący plan:
`C:/Users/krucz/.gemini/antigravity/brain/0f469478-5ced-4cb0-85a6-506fc5188eb0/flanki_overhaul_plan.md`.
