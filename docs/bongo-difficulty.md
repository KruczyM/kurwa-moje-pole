# Audyt trudności 16 plansz

To raport historyczny. Aktualną konstrukcję kampanii 1–12 i audyt wszystkich
patroli opisuje [Rytm kampanii](bongo-campaign-rhythm.md). Bonusowe układy 13–16
z tego raportu zostały zachowane.

Gałąź `feat/bongo-difficulty-pass`, osobny worktree `.ai/worktrees/bongo-difficulty`.
Nie zmieniono fizyki, prędkości postaci ani sztucznie nie skrócono czasu.
Poprzednie wersje zostały na swoich gałęziach. Nie publikowano zmian.

## Zmiany

**16 — napis:** dziewięć nowych złotych przedmiotów jest w U/W/R, J/E/M i P/L/E,
nie w trzech dolnych rzędach. Cztery kieszenie mają wejście z góry, trzy od dołu,
dwie z boku pod kamiennym stropem. Najpierw trzeba opróżnić górne i boczne wnęki,
a podczas podkopu dolnych kresek robić osobne wypady do wewnętrznych kieszeni.
Za głębokie wejście między kreski może uruchomić kamienie toczące się w poprzek odwrotu.
Litery nadal są prawdziwymi luźnymi kamieniami, nie nieruchomą dekoracją.

Samo pole napisu ma teraz 41 wymaganych przedmiotów zamiast 32; pełna plansza wymaga
42 statycznych łupów i łupu z przeciwnika. Złote znaczniki nadal działają niezależnie
od liczby zwykłych przedmiotów. Stara trasa trzema pasami nie kończy nawet samego pola
liter, również z testowo zawyżonym licznikiem. Referencyjna trasa pełnej planszy wzrosła
ze 194 do 322 ruchów, ale istotne są nowe wypady i odwroty, nie sama długość.

**15 — spirala:** sama długa droga i jedna spadająca brama były zbyt słabym finałem
łamigłówki. Za zwojami są teraz dwa łupy za zasuwami pchanymi w przeciwne strony
oraz osobna pułapka kolejności. Wymagają przygotowania kieszeni, obejścia i powrotu,
nie tylko trzymania kierunku. Trasa wykonuje 5 pchnięć i zbiera 7 wymaganych łupów.
Wyjście spirali prowadzi zewnętrznym tunelem poniżej mapy: łączenie modułów nie
przecina zwojów. Limit 7:30 pozostawia czas na planowanie.

## Przegląd każdej planszy

Pchnięcia i ryzykowne zbiory poniżej to zdarzenia na działającej trasie referencyjnej,
**nie udowodnione minimum wszystkich możliwych tras**. Decyzja projektowa nie jest
obiektywną oceną tego, jak trudna plansza będzie dla konkretnego gracza.

| Poziom | Przeszkoda wymagająca manewru                                | Decyzja                                                          |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1      | Podkop, bezpieczny odwrót, wnęka; 5 pchnięć                  | Zachować jako najłagodniejsze wprowadzenie, nie czysty spacer    |
| 2      | Dwie kieszenie i spust; 10 pchnięć                           | Zachować, dwa oddzielne zbiory                                   |
| 3      | Komin i obejście górą, wnęka/szyb; 7 pchnięć                 | Zachować, prosty bieg nie obsługuje zawału                       |
| 4      | Żyła zamykająca odwrót, wspólna podpora; 6 zbiorów spod skał | Zachować, wymaga kierunku zbierania                              |
| 5      | Przygotowanie kieszeni za zasuwą, podkop; 13 pchnięć         | Zachować, cel nieosiągalny bez obejścia                          |
| 6      | Przeciwne zasuwy, dwa łupy i Kobra; 11 pchnięć               | Zachować, zmiana strony nacisku                                  |
| 7      | Zawał i pułapka kolejności; 14 pchnięć                       | Zachować, niewłaściwa kolejność blokuje parę głazów              |
| 8      | Kieszenie, skarbiec i stos; 15 pchnięć                       | Zachować, więcej niż pojedynczy podkop                           |
| 9      | Żyła, komin, spusty, stos; 9 zbiorów spod skał               | Zachować, kilka osobnych mechanicznych problemów                 |
| 10     | Dwa łupy, przeciwne zasuwy, kolejność; 26 pchnięć            | Zachować, połączone przygotowanie i powrót                       |
| 11     | Skarbiec, żyła, zmiana strony, stos; 6 zbiorów spod skał     | Zachować, odwrót nie zawsze pozostaje otwarty                    |
| 12     | Zagroda bossa, komin i kompozycja zasuw; 24 pchnięcia        | Zachować, finał kampanii i obowiązkowa zagroda                   |
| 13     | Dwa rezerwuary, 2 ruchome cele, kieszenie i kolejność        | Zachować, zrzut wymaga fazy ruchu oraz odwrotu                   |
| 14     | 6 osobnych ruchomych celów, 36 zmian kierunku na trasie      | Zachować jako próbę rytmu; powtarzalność pułapek jest zamierzona |
| 15     | Wcześniej głównie długi korytarz                             | Wzmocniono przeciwnymi zasuwami i kolejnością                    |
| 16     | Wcześniej trzy niemal proste pasy zbierania                  | Wzmocniono 9 obowiązkowymi kieszeniami wewnątrz/bokiem liter     |

## Automatyczne zabezpieczenia

- Każda plansza: odtworzenie prawdziwej symulacji musi dać WON, zawierać pchnięcie,
  ryzykowny zbiór lub eliminację oraz zmianę kierunku na przeciwny.
- Dodatkowa próba zachłanna szuka najbliższego łupu, omija widoczne ściany i przeciwników,
  ale nie przewiduje grawitacji ani nie przygotowuje wnęk. Nie ukończyła żadnej z 16 plansz.
  Jej porażka **nie dowodzi braku łatwiejszej trasy**, to tylko powtarzalny test prostego obejścia.
- Osobny test izoluje napis od reszty planszy i próbuje starej trasy trzema pasami.
  Chroni przed ukryciem łatwego napisu za trudną końcową pułapką.
- 32 odtworzenia ciągłe/z przerwami nadal sprawdzają przechodniość całej gry.
  Przerwy w bonusach są poza aktywnymi zagrożeniami; czekanie pod spadającym głazem
  nie ma być bezpieczne.

`DifficultyAudit.ts` zawiera liczenie manewrów i prostą próbę zachłanną, używane
wyłącznie w testach/narzędziu; nie wchodzi do pętli gry. `DifficultyAudit.test.ts`
pilnuje wszystkich 16 plansz, rozmieszczenia dziewięciu kieszeni i starego obejścia.
`ChallengeCaves.ts` zawiera zmienione układy i ich autorskie trasy.

```powershell
npx tsx scripts/audit-bongo-difficulty.ts
npx tsx scripts/simulate-bongo-campaign.ts
npm run test:unit -- src/games/bongo-rush
npm run ci:code
npm run build
# Vite na porcie 5204 + Python z Playwright:
python scripts/verify-bongo-challenges.py http://127.0.0.1:5204/bongo-rush.html 15,16
```

Raport liczbowy: `reports/bongo-difficulty/audit.json`; raport symulacji:
`reports/bongo-avalanche/simulation-report.json`. Są generowane i ignorowane przez Git.
Ocena balansu przez człowieka pozostaje potrzebna: znajomość rozwiązania mocno
obniża trudność. Nie obiecujemy, że każdy doświadczony gracz uzna wszystkie mapy za trudne.

## Wyniki lokalne — 2026-10-12

- `ci:code`: PASS, 174 pliki / 1697 testów jednostkowych i 6 testów narzędzi.
- Audyt mechanik i próba zachłanna: sprawdzono wszystkie 16 plansz.
- Symulacje: 32/32 WON, zero pominiętych wymaganych łupów.
- Build: PASS; pozostało istniejące ostrzeżenie o wielkości głównego bundla 3D.
- Pełne przejście trudniejszej 15 w Chromium: PASS, 7 łupów, brak błędów JS/HTTP.
- Pełne przejście trudniejszej 16 w Chromium: PASS, 43 łupy, 1 eliminacja,
  brak błędów JS/HTTP. Pierwsza próba zebrała wszystkie łupy z liter, ale spóźniła
  zrzut na kwadrat. W ponowieniu skrypt wysyła wejście DOM w obserwowanej klatce
  powrotu kwadratu, bez opóźnienia komunikacji między procesami. Nie zmieniono
  zegara, fizyki ani stanu przeciwników w celu zaliczenia testu.
- Obejrzano zrzut 16: litery zachowane, nowe przedmioty widoczne wewnątrz i w bocznych wnękach.
- Fizyczny telefon i subiektywna ocena balansu: PENDING_HUMAN. Nie powtarzano całej
  kampanii w przeglądarce — pozostałe plansze nie zmieniły układu, wszystkie mają testy symulacji.

Samodzielne review: bez nowego renderera/RAF, fizyka i sterowanie gry bez zmian;
połączenie spirali nie wycina skrótu przez zwoje, dodatkowe łupy są obowiązkowe,
stara trasa napisu nie otwiera wyjścia. Narzędzia audytu nie są importowane przez grę.
