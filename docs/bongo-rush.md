# After: Bongo Rush

## Co to jest

Oddzielna, offline’owa gra Canvas 2D. Celem jest odebranie dostawy, otwarcie wyjścia
i przejście 12 poziomów. Inspiracją są zasady gier typu Boulder Dash, nie ich kod,
grafiki ani gotowe układy poziomów. Finał jest fikcyjną, satyryczną scenką.

Istniejące After jest zachowane, również na gałęziach `feat/after-demo` i
`fix/after-joystick`. Nowa praca znajduje się na `feat/bongo-rush`, w osobnym worktree.
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
| 1–3     | Magazyn Amarena   | Różne smaki Amareny    | Czerwony patrol od poziomu 2                    |
| 4–6     | Zielone podziemia | Liście marihuany       | Niebieski patrol                                |
| 7–9     | Neonowy rave      | Różne cukierki ecstasy | Undercover                                      |
| 10–12   | Dymna grota       | Bonga                  | Mieszane patrole; satyryczny Owsiak tylko na 12 |

Każdy poziom ma własną definicję i udokumentowaną sekwencję przejścia. Różnią się
przebiegiem korytarzy, rozstawem pięter, liczbą przepychanych skał i komorami patroli.
Na ostatnim poziomie, oprócz pięciu bong, trzeba przepchnąć skałę na złote pole
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
- Nie ma zegara, limitu żyć ani walki. Zablokowaną planszę można zawsze zrestartować.

## Sterowanie i dostępność

WASD/strzałki poruszają, Escape przełącza pauzę, R restartuje bieżący poziom.
Escape nigdy nie przenosi automatycznie do głównego menu. Powrót do wyboru postaci
jest osobnym przyciskiem pauzy. Po wznowieniu canvas odzyskuje fokus.

Telefon ma gałkę z martwą strefą, własnością jednego palca i stabilizacją dominującej osi.
Nie ma ruchu na skos ani sprintu. Oderwanie palca, pauza, zmiana rozmiaru i utrata fokusu
zerują sterowanie. Przycisk pauzy jest u góry, restart ↻ na dole. Nakładki mają przyciski wyjścia.
Na małym ekranie kamera podąża za graczem, zamiast zmniejszać całą planszę do nieczytelnych kafelków.

Menu i wyniki są zwykłym HTML z opisanymi przyciskami i obsługą klawiatury.
Sama plansza nie zapewnia pełnej dostępności czytnikom ekranu.

## Gdzie zmieniać kod

Źródła TypeScript kompilują się do JavaScriptu przez Vite; nie edytuj plików JS w `dist/`.

| Plik w `src/games/bongo-rush/` | Rola                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `main.ts`                      | Host gry: menu, ładowanie, pojedyncza pętla, input, fokus, pauza i sprzątanie       |
| `types.ts`                     | Kierunki, typy planszy i ciał, czas kroku `STEP_SECONDS = 0.14`                     |
| `Simulation.ts`                | Kopanie, ruch, przepychanie, grawitacja, patrole, wygrana i przegrana               |
| `Levels.ts`                    | Cztery palety biomów, 12 szkiców plansz i sekwencje ich przejścia                   |
| `Renderer.ts`                  | Interpolacja, współdzielona kamera i animator, kafelki, przedmioty, patrole i finał |
| `SpriteBounds.ts`              | Wspólny obrys alfa klatek: czytelna wielkość i stabilne kadrowanie postaci          |
| `Input.ts`                     | Klawiatura i przełożenie istniejącej gałki After na cztery kierunki                 |
| `Audio.ts`                     | Własne dźwięki WebAudio, limity głosów, wyciszenie i odblokowanie audio na iOS      |
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

Postacie korzystają z istniejących atlasów `public/game-assets/2d/after/characters/<id>/`.
Ładowany jest wybrany atlas, atlas Kobry/Krzaka i bieżące tło. Znana inwersja kierunków eksportera
jest korygowana w loaderze nowej gry, bez modyfikowania źródłowych atlasów After.

Każdy biom ma własny krótki motyw zbierania. Kopanie, przepychanie, uderzenia,
otwarcie wyjścia, przegrana i zwycięstwo mają osobne efekty. Audio odblokowuje przycisk
rozpoczęcia gry, nie automatyczna próba przy ładowaniu strony. Nie używamy cudzych nagrań głosowych.

## Edycja plansz

### Krzak — rosnąca przeszkoda

`K` oznacza korzeń zakopany w ziemi, narysowany jako mała roślina z korzeniami.
Każda plansza ma go na pierwszym polu obok startu. Wejście na to pole odkopuje
Krzaka i uruchamia wzrost. Co 36 kroków symulacji (5,04 s aktywnej gry) wszystkie
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

Szkice w `Levels.ts` określają rzędy korytarzy, lewą/prawą granicę, liczbę sekcji
z pchaniem skał i komorami przeciwników. Generator tworzy stały układ, nie losuje poziomu.
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
# Po buildzie i uruchomieniu preview na porcie 5191:
npm run preview -- --host 127.0.0.1 --port 5191 --strictPort
python scripts/verify-bongo-production.py
```

Skrypt przeglądarkowy przechodzi kampanię klawiaturą przez rzeczywisty interfejs,
sprawdza wszystkie atlasy, pauzę bez zatrzymywania RAF, powrót fokusu, zapis i brak żądań GLB/Socket.IO.
Uruchamia również WebKit z profilem iPhone’a oraz Chromium z dotykiem. Raport i zdjęcia
zapisuje w ignorowanym `reports/bongo-rush/`. Diagnostyka `?verify=1` istnieje tylko w dev
i udostępnia odłączony snapshot, nie teleportację ani edycję postępu.

Emulacja nie potwierdza wydajności fizycznego iPhone’a. Test dotyku, ergonomii i FPS
na rzeczywistym urządzeniu pozostaje osobnym punktem odbioru. Nowa gra nie jest automatycznie publikowana.
