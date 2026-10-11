# After: Bongo Rush

## Co to jest

Oddzielna, offline’owa gra Canvas 2D. Celem jest odebranie dostawy, otwarcie wyjścia
i przejście 12 poziomów. Inspiracją są zasady gier typu Boulder Dash, nie ich kod,
grafiki ani gotowe układy poziomów. Finał jest fikcyjną, satyryczną scenką.

Istniejące After jest zachowane, również na gałęziach `feat/after-demo` i
`fix/after-joystick`. Obecna oprawa i zasady są na `feat/bongo-gameplay-polish`, w osobnym worktree;
adaptacje zagadek pozostają na `feat/bongo-reference-puzzles`;
wcześniejsze kompozycje pozostały na `feat/bongo-authored-vaults`;
wcześniejszy audyt biomów pozostał na `feat/bongo-biomes-puzzles`;
wcześniejsza rozbudowa jaskiń pozostała na `feat/bongo-expanded-caves`;
wcześniejsze wersje pozostały na `feat/bongo-rush` i `feat/bongo-bush`.
Nie usunięto wcześniejszych plików ani nie zmieniono lokalnych roboczych grafik Chlebaka.

## Uruchomienie

Wymagane Node.js 20+, zależności z `npm install` i grafiki pobrane przez Git LFS.

```powershell
git lfs install
git lfs pull
npm run dev:client
```

Otwórz `/bongo-rush.html` pod adresem wypisanym przez Vite. After pozostaje pod
`/after-demo.html`, a festiwal 3D pod `/`. Nie potrzeba drugiego serwera ani Socket.IO.

```powershell
npm run build
npm run preview
# /kurwa-moje-pole/bongo-rush.html
```

Samo uruchomienie buildu nie publikuje strony na GitHub Pages.

## Kampania

| Poziomy | Biom              | Dostawa                | Przeciwnicy                                     |
| ------- | ----------------- | ---------------------- | ----------------------------------------------- |
| 1–3     | Magazyn Amarena   | Różne smaki Amareny    | Czerwony patrol                                 |
| 4–6     | Zielone podziemia | Liście marihuany       | Niebieski patrol                                |
| 7–9     | Neonowy rave      | Różne cukierki ecstasy | Undercover                                      |
| 10–12   | Dymna grota       | Bonga                  | Mieszane patrole; satyryczny Owsiak tylko na 12 |

Plansze mają **59×34–109×44 pola**: 1–6 mają 9 głównych komór, 7–9: 12,
10–12: 16. Szerokość zależy od kompozycji skrzydła zagadki wyjściowej;
główna sieć jaskiń zachowuje poprzednie rozmiary 46×34–60×44.
Cele wynoszą odpowiednio 18, 24 i 32 przedmioty. Przedmiotów jest więcej niż cel,
więc można wybierać pomiędzy bezpieczniejszym objazdem a ryzykownym bocznym złożem.

Komory łączą się w obu osiach, mają odnogi, skróty i pętle. Występują skalne filary,
przegrody z prześwitami, niskie stropy, puste kieszenie, podparte żyły głazów
i otwierane przez kopanie komory patroli. Cztery biomy różnią się konstrukcją ścian:
cegła i stalowe klamry, splątane korzenie, neonowe metalowe kasety oraz duże tafle lodu.
Każdy biom ma także odrębną powierzchnię przekopywanej ziemi.
Głazy i przedmioty korzystają z istniejącej grawitacji — podkopanie podpory
może wywołać lawinę. Nie trzeba chodzić jedną narysowaną ścieżką.

Przed wyjściem jest obowiązkowa komora, której nie omija nadmiar przedmiotów.
Każdy poziom ma inną kompozycję sześciu modułów, nie dwanaście nowych mechanik fizyki:

| Poziom | Kompozycja                                 |
| ------ | ------------------------------------------ |
| 1      | Przygotowanie wnęki                        |
| 2      | Pierwszy spust                             |
| 3      | Wnęka i szyb                               |
| 4      | Wspólna podpora dwóch skał                 |
| 5      | Szyb i wnęka                               |
| 6      | Korzenne obejście — zmiana strony pchania  |
| 7      | Kolejność ma znaczenie                     |
| 8      | Stos i osobny spust                        |
| 9      | Wnęka pod stosem                           |
| 10     | Spust przed manewrem                       |
| 11     | Zmiana strony i stos                       |
| 12     | Trzy zamki Tasiora: wnęka, kolejność, stos |

Podpowiedź zmienia się przy wejściu do kolejnego modułu. W zagadce kolejności najpierw
trzeba przygotować miejsce dla górnego głazu, a dopiero później odkopać dolną wnękę.
Zła kolejność może zaklinować parę skał; użyj R lub ↻. Nie ma jeszcze cofania ruchu
ani automatycznego wykrywania wszystkich blokad. Odizolowane komory pozwalają
zatrzymać się między poprawnymi ruchami; patrole i Kobra w głównej jaskini nadal działają.

Każdy poziom ma własny stały szkic, geologię i testowaną sekwencję przejścia.
Na ostatnim poziomie, oprócz 32 bong, trzeba przepchnąć skałę na złote pole
u wejścia do zagrody. Boss patroluje jej wnętrze; nie walczy się z nim ani nie przygniata.
Po zamknięciu zagrody dostępna jest nagroda i krótka scenka z Bongo Tasiora.

## Zasady

- Ruch ma cztery kierunki i jest jednakowy dla wszystkich 15 grywalnych postaci.
- Wejście na ziemię przekopuje ją, a na stojący przedmiot — zbiera go.
- Skałę można pchać tylko poziomo, pojedynczo, na puste pole bez ziemi i innych ciał.
- Luźne przedmioty spadają o jedno pole na krok; mogą zsunąć się na bok z zaokrąglonej podpory,
  a następnie spaść. Nie zapełniają wyjścia.
- Stojąca nad graczem skała jest podparta. Dopiero już spadający przedmiot przygniata gracza.
- Spadające skały eliminują patrole. Kontakt z patrolem oznacza przegraną.
- Czerwony patrol trzyma prawą ścianę, niebieski lewą. Undercover ściga w zasięgu sześciu pól,
  tylko przy widoczności w prostej linii; po jej utracie wraca do patrolowania.
- Patrole nie kopią ani nie przesuwają skał. Nowe przejście mogą przekroczyć dopiero
  w kolejnym kroku, zapewniając graczowi czas na reakcję.
- Każdy poziom ma limit czasu: minimum 180 sekund lub czterokrotność czasu zapisanej trasy,
  zaokrągloną w górę do 30 sekund. Pauza, pomoc i nieaktywna karta zatrzymują zegar.
  Ostatnie 30 sekund jest zaznaczone na czerwono. Koniec czasu oznacza przegraną, nie utratę postępu.
- Nie ma limitu prób ani walki. Zablokowaną planszę można zawsze zrestartować.

## Sterowanie i dostępność

WASD/strzałki poruszają, Escape przełącza pauzę, R restartuje bieżący poziom.
M lub przycisk **Mapa** przełącza minimapę z ziemią, skałami, przedmiotami,
wyjściem i jasnym punktem gracza. Mapa pokazuje cały układ, nie jest fog-of-war.
Escape nigdy nie przenosi automatycznie do głównego menu. Powrót do wyboru postaci
jest osobnym przyciskiem pauzy. Po wznowieniu canvas odzyskuje fokus.

Telefon ma gałkę z martwą strefą, własnością jednego palca i stabilizacją dominującej osi.
Nie ma ruchu na skos ani sprintu. Oderwanie palca, pauza, zmiana rozmiaru i utrata fokusu
zerują sterowanie. Przycisk pauzy jest u góry, restart ↻ na dole. Nakładki mają przyciski wyjścia.
Na małym ekranie kamera podąża za graczem, zamiast zmniejszać całą planszę do nieczytelnych kafelków.

Menu i wyniki są zwykłym HTML z opisanymi przyciskami i obsługą klawiatury.
Sama plansza nie zapewnia pełnej dostępności czytnikom ekranu.
Przycisk „?” wyjaśnia cel, ruch, przepychanie, niebezpieczeństwa, Kobrę i finał.
Otwiera pomoc z zatrzymaną grą. Zamknięcie pomocy pozostawia pauzę — wznów osobnym przyciskiem.

## Gdzie zmieniać kod

Źródła TypeScript kompilują się do JavaScriptu przez Vite; nie edytuj plików JS w `dist/`.

| Plik w `src/games/bongo-rush/` | Rola                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `main.ts`                      | Host gry: menu, ładowanie, pojedyncza pętla, input, fokus, pauza i sprzątanie       |
| `types.ts`                     | Kierunki, typy planszy i ciał, czas kroku `STEP_SECONDS = 0.14`                     |
| `Simulation.ts`                | Kopanie, ruch, przepychanie, grawitacja, patrole, wygrana i przegrana               |
| `Levels.ts`                    | Cztery palety biomów, 12 szkiców plansz i sekwencje ich przejścia                   |
| `CaveBuilder.ts`               | Stałe sieci komór, skróty, geologia, podparte złoża i zapis wejścia do testów       |
| `CaveVisuals.ts`               | Cztery różne konstrukcje ścian i powierzchnie ziemi, rysowane w cache Canvas        |
| `ExitPuzzles.ts`               | Jednowejściowe komory zagadek, podpowiedzi i sekwencje rzeczywistych ruchów         |
| `VaultComposer.ts`             | Łączenie modułów w szczelne skrzydła, trasy łączników i pozycje podpowiedzi etapów  |
| `Renderer.ts`                  | Interpolacja, współdzielona kamera i animator, kafelki, przedmioty, patrole i finał |
| `SpriteBounds.ts`              | Wspólny obrys alfa klatek: czytelna wielkość i stabilne kadrowanie postaci          |
| `Input.ts`                     | Klawiatura i przełożenie istniejącej gałki After na cztery kierunki                 |
| `Audio.ts`                     | Własne dźwięki WebAudio, limity głosów, wyciszenie i odblokowanie audio na iOS      |
| `Music.ts`                     | Cztery autorskie pentatoniczne motywy ambientu, bez zewnętrznych nagrań             |
| `AmarenaArt.ts`                | Butelki wiśniowe, brzoskwiniowe i jabłkowe według zdjęć użytkownika                 |
| `Progress.ts`                  | Lista 15 grywalnych postaci, nazwy i bezpieczny zapis postępu w localStorage        |
| `game.css`                     | Responsywny układ, przyciski, nakładki i gałka                                      |
| `*.test.ts`                    | Deterministyczne testy fizyki, wszystkich plansz, sterowania i zapisu               |

`src/games/shared/ImageCache.ts` udostępnia jeden cache obrazów dla obu gier 2D.
`AnimationLoop`, `EventScope`, `CameraRig`, `SpriteAnimator` i gałka są ponownie wykorzystane,
nie zastąpione kolejnymi równoległymi kontrolerami. Pauza nie zatrzymuje RAF — tylko symulację.

## Grafiki i dźwięki

`public/game-assets/2d/bongo-rush/` zawiera cztery oryginalne tła SVG: magazyn,
korzenie, rave i szkło. Kafelki i rekwizyty są rysowane kodem Canvas, a obrazy kafelków
buforowane. Nie wymagają zewnętrznych generatorów ani kluczy API.

Postacie korzystają z osobnych atlasów `public/game-assets/2d/bongo-rush/characters/<id>/`.
15 bohaterów i Kobra wyrenderowane są z `npc-animations.glb`, z jedną klatką Idle i czterema Walk
w każdym z czterech kierunków. Kamera obejmuje sferę zawierającą ocenione wierzchołki wszystkich
poz, z 12% marginesem. Packer sprawdza niepustą alfę i minimum 2 piksele marginesu każdej klatki.
Nie zmieniono atlasów After ani lokalnych zmian Chlebaka. Kierunki są jawne w metadanych.

Patrolowy w czerwonej koszulce i Owsiak są wypaleni z nowych, lokalnie wygenerowanych
teksturowanych modeli GLB. Mają cztery statyczne widoki, **jeszcze bez rigu i animacji kończyn**.
Zachowanie patrolowania i zagrody bossa jest istniejącą mechaniką, nie nową walką z bossem.
GLB pozostają w `source-assets/bongo-rush/models/`; przeglądarka pobiera tylko lekkie PNG.
Źródła referencji, generowanie i ograniczenia: [bongo-art-polish.md](bongo-art-polish.md).

Każdy biom ma własny krótki motyw zbierania. Kopanie, przepychanie, uderzenia,
otwarcie wyjścia, przegrana i zwycięstwo mają osobne efekty. Audio odblokowuje przycisk
rozpoczęcia gry, nie automatyczna próba przy ładowaniu strony. Nie używamy cudzych nagrań głosowych.
Dodatkowo gra cichy autorski ambient: wolny bas i dzwonkowe motywy inne dla każdego biomu.
Planowanie nut odbywa się w istniejącym RAF, bez dodatkowych timerów. Wyciszenie i pauza
zatrzymują również zaplanowane nuty; kontekst audio pozostaje ten sam. Przycisk Dźwięk steruje całością.

## Edycja plansz

### Krzak — rosnąca przeszkoda

`K` oznacza korzeń zakopany w ziemi, narysowany jako mała roślina z korzeniami.
Nie ma korzenia na pierwszym polu obok startu. Korzenie w bocznych komorach są opcjonalnym ryzykiem.
Na poziomach 3, 6, 9 i 12 jeden korzeń leży w jedynym wejściu do zagadki wyjściowej:
trzeba go odkopać, więc dalszy odwrót jest ograniczony wzrostem. Nie wymaga się powrotu przez
zarośnięty korzeń na poprawnej trasie. Wejście na korzeń uruchamia wzrost.
Co 36 kroków symulacji (5,04 s aktywnej gry) wszystkie
aktywne korzenie i dorosłe krzaki zajmują sąsiednie wolne pola w czterech kierunkach.
Nowe krzaki rozrastają się dopiero w następnej fali, bez natychmiastowego zalania planszy.

Wzrost nie zastępuje ziemi, ścian, wyjścia, przedmiotów, patroli ani pola zajętego
przez gracza. Korzeń na polu gracza pozostaje źródłem i zarasta również swoje pole
po jego opuszczeniu. Dorosły krzak blokuje ruch gracza, patroli i skał; nie można go
przekopać. Długie zwlekanie może bezpowrotnie zablokować trasę — użyj R lub ↻,
aby zacząć od nowa. Pauza zatrzymuje zegar wzrostu. Wszystkie 12 zapisanych tras
pozostają wykonalne. Osiągnięcie wyjścia kończy poziom przed kolejną falą.

Tempo zmienia się w `src/games/bongo-rush/types.ts`: `BUSH_GROWTH_SECONDS`.
Reguła jest w `Simulation.growBushes()`, grafika Canvas w `Renderer.bush()`.
`Bush.test.ts` sprawdza aktywację, terminy fal, przeszkody, blokowanie i restart.
Nie powstał drugi timer ani dodatkowy RAF.

Krzak to **Kobra**, zgodnie z potwierdzeniem użytkownika. Kobra nie jest już
grywalna; stary zapis wyboru `kobra` lub `krzak` przełącza na Ampera, bez utraty
odblokowanych poziomów. Dorosłe krzaki wykorzystują istniejący atlas Kobry
na zielonym obrysie, a zakopany korzeń ma symbol rośliny.
Zmiana jest na gałęzi `feat/bongo-bush` i nie usuwa źródłowych grafik Kobry z After.

`CAVE_SKETCHES` w `Levels.ts` określa liczbę kolumn i rzędów komór (`columns`, `rows`),
porządek referencyjnego przejścia (`route`: `rows` lub `columns`), gęstość głazów
(`geology`) i liczbę komór patroli (`patrols`). `CaveBuilder.ts` tworzy stały układ,
nie losuje poziomu przy restarcie. `grain()` daje powtarzalne rozmieszczenie geologii.
Trasa w `solution` służy do testowania, nie jest widoczna ani wymagana od gracza.
Każda komora ma dwie referencyjne dostawy; cel jest wyliczany z ich liczby.
Można również przekazać bezpośrednią definicję `LevelDefinition` z prostokątnym ASCII:

| Symbol        | Znaczenie                               |
| ------------- | --------------------------------------- |
| `#`           | Niezniszczalna ściana                   |
| `.`           | Ziemia do przekopania                   |
| spacja        | Puste powietrze                         |
| `P`           | Jedyny start gracza                     |
| `E`           | Jedyne wyjście                          |
| `R`           | Skała                                   |
| `O`           | Przedmiot bieżącego biomu               |
| `C`, `B`, `U` | Czerwony, niebieski patrol i undercover |
| `J`           | Boss finałowy                           |
| `K`           | Zakopany Krzak, aktywowany odkopaniem   |

`quota` określa wymaganą liczbę przedmiotów. `solution` to kierunki przekazywane
do prawdziwej symulacji, bez teleportacji. Po każdej zmianie planszy zaktualizuj nagranie
i uruchom testy. Różny wygląd przedmiotów jest kosmetyczny, nie zmienia ich wartości.

## Testowanie

```powershell
npm run test:unit -- src/games/bongo-rush
npm run ci:code
npm run build
# W drugim terminalu, z zainstalowanym lokalnie Python Playwright:
npm run dev:client -- --host 127.0.0.1 --port 5190 --strictPort
python scripts/verify-bongo-rush.py
python scripts/verify-bongo-expanded.py
# Dla obecnych kompozycji zagadek uruchom Vite na 5194, następnie:
npm run dev:client -- --host 127.0.0.1 --port 5194 --strictPort
python scripts/verify-bongo-puzzles.py
# Bieżąca wersja oprawy, pomocy, czasu i korzeni:
npm run dev:client -- --host 127.0.0.1 --port 5198 --strictPort
python scripts/verify-bongo-polish.py
python scripts/verify-bongo-puzzles.py --port 5198 --levels 3 6 9 12 --output reports/bongo-polish-vaults
python scripts/verify-bongo-bush.py
# Po buildzie i uruchomieniu preview na porcie 5191:
npm run preview -- --host 127.0.0.1 --port 5191 --strictPort
python scripts/verify-bongo-production.py
```

Skrypt przeglądarkowy przechodzi pierwszy poziom klawiaturą przez rzeczywisty interfejs,
sprawdza wszystkie atlasy, pauzę bez zatrzymywania RAF, powrót fokusu, zapis i brak żądań GLB/Socket.IO.
Uruchamia również WebKit z profilem iPhone’a oraz Chromium z dotykiem. Raport i zdjęcia
zapisuje w ignorowanym `reports/bongo-rush/`. Diagnostyka `?verify=1` istnieje tylko w dev
i udostępnia odłączony snapshot, nie teleportację ani edycję postępu.

Emulacja nie potwierdza wydajności fizycznego iPhone’a. Test dotyku, ergonomii i FPS
na rzeczywistym urządzeniu pozostaje osobnym punktem odbioru. Nowa gra nie jest automatycznie publikowana.

Obecna ocena trudności, zakres sprawdzenia i plan dalszej pracy:
[odniesienia do istniejących gier](bongo-puzzle-references.md),
[kompozycje komór](bongo-vaults-verification.md).
Wcześniejszy [audyt biomów i zagadek](bongo-design-audit.md).
Wcześniejszy raport: [rozbudowane jaskinie](bongo-expanded-verification.md).
