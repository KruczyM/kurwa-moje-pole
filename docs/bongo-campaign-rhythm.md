# Rytm kampanii i audyt przeciwników

Gałąź `codex/bongo-campaign-rhythm`, worktree `.ai/worktrees/bongo-rhythm`.
Zastępuje układy 1–12 opisane w starszych raportach trudności. Nie zmienia
`Simulation`, prędkości, grawitacji, sterowania ani reguł patroli. Numery, biomy,
wersja zapisu i finał na 12 pozostają bez zmian.

## Audyt przed zmianą

Odtworzono rzeczywiste zwycięskie wejścia wszystkich 16 map. Zwykłe patrole
kampanii odwiedzały tylko dwa pola i nie wpływały na rozwiązanie. Długie wspólne
dojścia przez ziemię zacierały różnice pomiędzy zagadkami. Trasa 12 miała 773 ruchy,
z czego duża część poprzedzała właściwy finał. Nie traktujemy tej długości jako
dowodu trudności. Surowe wyniki lokalne: `reports/bongo-rhythm/before.json`.

## Nowe układy i funkcje przeciwników

Eksploracja ma pięć opcjonalnych złóż z różnymi problemami grawitacyjnymi, szósty
sektor z patrolem i pułapką oraz połączone galerie powrotne. Sektory mają sześć
różnych rozmieszczeń. Limit pozwala wybierać złoża; złote obowiązkowe znaczniki nie
wymuszają czyszczenia każdej komory. Decyzje obejmują wybór złoża, kierunek dojścia,
przygotowanie odwrotu i zamianę drugiego złoża na łup ze zrzutu. To kompozycja
sprawdzonych modułów, nie dwanaście całkowicie nowych mechanik.

Patrolowany obieg ma 16 pól, podkop od boku, wejście przez ziemię i drugie wyjście
do galerii. Odwiedziny w sektorze są opcjonalne: istnieją zarówno pełne zwycięstwa
bez zabijania, jak i zwycięstwa z rzeczywistą eliminacją i odebranym przedmiotem.
Zagadki mają osobny opcjonalny obieg przy wejściu: przejście przez niego skraca
dojście o osiem ruchów. Bezpieczna górna droga jest dłuższa, ale oba warianty
łączą się przed pierwszą zagadką. Sprawdzono pełne zwycięstwa przez skrót przy
różnych fazach wejścia; nie jest to tylko dodatkowy przedmiot bez zastosowania.
Patrol nie wchodzi samoczynnie do miejsca analizy. Zamknięcie ziemią jest świadomie otwieraną granicą zagrożenia,
nie dekoracyjną dwupolową kieszenią. Na 11 są dwa niezależne obszary patroli.

| Poziom | Problem wcześniej → zmiana                                                              | Funkcja przeciwnika                                                       | Zweryfikowane wejścia                         |
| ------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| 1      | Wspólna trasa wydobywcza → wybór prostego podkopu, dwóch kieszeni lub strzeżonego złoża | Czerwony chroni skrót i boczny łup                                        | Obejście 177 ruchów / eliminacja 141          |
| 2      | Długie dojście → zwarta brama z przygotowaniem wnęki                                    | Czerwony kontroluje krótsze dojście                                       | 109 ruchów, 2 pchnięcia                       |
| 3      | Czyszczenie kolejnych komór → komin, boczny odwrót i różne skupiska                     | Czerwony kontroluje dolną galerię złoża                                   | Obejście 217 / eliminacja 405                 |
| 4      | Nadmiar galerii → jednokierunkowa żyła, Kobra na łączniku, spust                        | Niebieski na skrócie, poza wnękami analizy                                | 51 ruchów, 6 zbiorów spod skał                |
| 5      | Jedna kolejność → pętle złóż i opcjonalne zarastające skrzyżowanie                      | Niebieski obchodzi filar przy skrócie                                     | Obejście 261 / eliminacja 431                 |
| 6      | Długi wstęp → dwa boczne zbiory, Kobra, przeciwne zasuwy                                | Niebieski pilnuje skrótu                                                  | 111 ruchów, 2 pchnięcia                       |
| 7      | Wspólna kopalnia → rozdzielone złoża i osłonięty sektor                                 | Undercover ma krótkie linie wzroku i filar                                | Obejście 357 / eliminacja 527                 |
| 8      | Kopanie przed zagadką → przeciwne zasuwy i kolejność górnego głazu                      | Undercover na skrócie poza głównymi wnękami                               | 141 ruchów, 5 pchnięć                         |
| 9      | Powtarzalny objazd → komin z obejściem, żyła lub pułapka                                | Undercover na strzeżonej galerii                                          | Obejście 193 / eliminacja 297                 |
| 10     | Długi wstęp → zawał, przeciwne zasuwy i zachowanie przejścia                            | Undercover chroni krótsze dojście                                         | 172 ruchy, 5 pchnięć                          |
| 11     | Długi objazd → wybór kilku złóż i niezależnych obiegów                                  | Czerwony przy głównej pułapce, niebieski przy rezerwowym złożu            | Obejście 365 / eliminacja 505                 |
| 12     | 773 ruchy → krótki ciąg przygotowania skał i pułapka                                    | Patrol skrótu; boss w zagrodzie 8 pól                                     | 185 ruchów, 7 pchnięć, boss uwięziony         |
| 13     | Brak usterki rozmieszczenia → zachowano rezerwuary                                      | Dwa cele świadomie otwieranych zrzutów; mała zagroda jest częścią pułapki | 139 ruchów, 2 eliminacje i 2 odebrane łupy    |
| 14     | Brak usterki rozmieszczenia → zachowano sześć wysp                                      | Sześć osobnych celów zrzutu, nie losowy tłok                              | 146 ruchów, 6 eliminacji i 6 odebranych łupów |
| 15     | Brak patroli; spiralna zagadka bez niepotrzebnego pościgu                               | Celowo brak przeciwnika                                                   | 758 ruchów, 5 pchnięć                         |
| 16     | Zachowano napis, obowiązkowy cel i dodatkowy obieg                                      | Cel zrzutu oraz osobny strażnik obwodu 16 pól                             | 322 ruchy, 1 eliminacja i odebrany łup        |

Ruchy powyżej opisują jedną sprawdzoną trasę, nie minimum ani ocenę zabawy.
Patrole eksploracyjne można ominąć bez otwierania ich galerii; nie twierdzimy,
że konieczny jest kontakt z każdym przeciwnikiem na każdej możliwej trasie.

## Kod i odtwarzanie

- `CaveBuilder`: oddzielne kompozycje eksploracyjne i zwarte zagadki.
- `PatrolEncounter`: sektor obiegu, boczny zrzut i zapis wejść w oknie patrolu.
- `LevelDefinition.style`: opcjonalne `exploration | puzzle`; małe fixture'y bez
  tego pola pozostają kompatybilne. Menu oznacza KOP / ZAG / WYZW.
- `DifficultyAudit.auditPatrols`: pomiar odwiedzonych pól, najbliższego podejścia,
  eliminacji i faktycznie zebranych przedmiotów po przeciwniku. Audyt nie jest
  importowany przez grę i nie wstrzykuje stanu.
- `CampaignRhythm.test`: 6 par pełnych rozwiązań, obiegi, bezpieczne oczekiwanie,
  różne fazy podejścia do pułapki. Istniejące testy zasuw pilnują złej kolejności,
  Kobra i finał mają osobne regresje. `Progress.test` obejmuje stare zapisy.

```powershell
npx tsx scripts/audit-bongo-campaign.ts after
npx vitest run src/games/bongo-rush
npm run ci:code
npm run build
npx vite --host 127.0.0.1 --port 5210 --strictPort
python scripts/verify-bongo-rhythm.py
```

Raport i trasy dla przeglądarki są generowane do ignorowanego `reports/bongo-rhythm`.
Weryfikacja przeglądarkowa wysyła klawisze przez normalne listenery i istniejący
RAF, kontrolując jedynie zegar testowej przeglądarki. Diagnostyczny snapshot jest
tylko do odczytu, dostępny wyłącznie w DEV z `?verify=1`.

Ocena monotonii i balansu przez człowieka oraz fizyczny iPhone:
`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Automaty nie zastępują tej oceny.

## Wyniki walidacji

- `ci:code`: PASS, 193 pliki i 1824 testy jednostkowe; format, lint, typy oraz
  6 testów narzędziowych również PASS.
- `ci:assets`: PASS, 16 poprawnych rigów, brak błędów; sektory bez regresji.
- Build: PASS. Pozostało istniejące ostrzeżenie o wielkości bundla 3D.
- Odtworzenie wszystkich 16 zwycięskich tras: PASS. Dodatkowo sześć pełnych
  wariantów eliminacji: po jednej eliminacji i faktycznie odebranym łupie.
- Skróty wszystkich sześciu zagadek: znalezione poprawne okna wejścia w realnej
  symulacji; nie omijają wymaganych przedmiotów ani finału.
- Chromium i WebKit iPhone: poziomy 1, 2, 4, 5, 7, 8, 10, 11, 12 ukończone przez
  wejścia klawiatury, łącznie 18 zwycięstw. Pauza zatrzymuje tick, nie RAF.
  Raport: `reports/bongo-rhythm/browser.json`; zrzuty w tym samym katalogu.
- UI w DEV i produkcyjnym preview pod `/kurwa-moje-pole/`: PASS — galeria,
  cztery biomy, dotyk/gałka, focus, powroty, reduced motion i cache; brak błędów
  JS/HTTP. Raporty: `reports/bongo-living/report.json` i `production.json`.
- Zegar testu pełnych przejść przyspiesza czas przeglądarki, zachowując normalne
  callbacki RAF i niezmieniony krok symulacji. Nie jest pomiarem FPS fizycznego
  telefonu. Pomiary równolegle obciążonych headless przeglądarek nie dowodzą 60 FPS.

Samodzielny przegląd wykrył i poprawił nadpisany opis dostępności przycisków
oraz nieużyteczny opcjonalny łup patroli zagadkowych — zastąpiono go skrótem.
Nie zmieniono kodu symulacji, wejść, zapisów, renderera ani pętli RAF.
Niezależny review zakresu `ca822ce..821bc11` zakończono bez blockerów publikacji.
Reviewer osobno uruchomił `ci:code`: 193 pliki, 1830 testów jednostkowych i 6
narzędziowych, encoding/format/lint/typecheck oraz `git diff --check` PASS.
Obejmuje to również późniejsze zmiany miksu Bongo i pożegnania głosowego gry 3D.
Raporty przeglądarkowe były wyciszone: nie stanowią odsłuchu tych zmian audio.
Odsłuch, fizyczny iPhone i subiektywny balans pozostają `PENDING_HUMAN`.
Publikację przez PR zatwierdził użytkownik; stan wdrożenia będzie sprawdzony po merge.
