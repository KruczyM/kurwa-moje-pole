# Specyfikacja Projektu Bijatyki 2D: „Kurwa Moje Pole - Festival Fighter”

> Dokument przygotowany do niezależnego **Code Review**, analizy architektonicznej oraz propozycji ulepszeń (np. dla ChatGPT / Senior Game Dev).

---

## 1. Przegląd Gry i Wizja Projektowa

- **Tytuł roboczy**: _Kurwa Moje Pole: Festival Fighter (Bijatyka 2D)_
- **Gatunek**: 2D Arcade Fighting Game / Retro Comic Brawler
- **Inspiracje mechaniczne**: Klasyczny _Tekken 3 / Tekken 5_ (system 4 przycisków, ciosy podbródkowe wybijające w powietrze / juggle, obrona dół/góra, target combos) połączony ze stylem _Street Fighter_ i komediowym slapstickiem _Smash Bros / Guilty Gear_.
- **Klimat / Lore**: Polski festiwal rockowy na polu namiotowym, przesiąknięty specyficznym, autoironicznym humorem festiwalowym, postaciami kempingowiczów i kultowymi tekstami.
- **Platforma docelowa**: Przeglądarka internetowa (Desktop PC + Responsywne urządzenia mobilne: smartfony i tablety).
- **Priorytety techniczne**:
  1. Zerowe opóźnienia sterowania (snappy input responsiveness, 60 FPS).
  2. Czysta separacja logiki symulacji (deterministyczny tick) od warstwy prezentacji (Canvas 2D / Audio / DOM).
  3. Lekkość – zero pobierania wielomegabajtowych assetów blokujących urządzenia mobilne (proceduralna synteza audio, wektorowe rekwizyty z możliwością podmiany na PNG).

---

## 2. Architektura Techniczna i Stos Technologiczny

- **Język i środowisko**: TypeScript (Strict mode), Vite, HTML5 Canvas 2D API, Web Audio API.
- **Testy jednostkowe**: Vitest (100% testów przechodzących, pełne pokrycie logiki symulacji i audio).
- **Zasada działania pętli gry**:
  - **Fixed Timestep (60 Hz / 16.66 ms)** dla fizyki i symulacji walki (Input Buffer, Kolizje, Stan walki).
  - **Variable Render Timestep (`requestAnimationFrame`)** z interpolacją klatek i płynnym lerpem kamery oraz efektów wizualnych.

### Główne moduły w kodzie (`src/games/fighter/`):

```
src/games/fighter/
├── simulation/                 # Czysta symulacja walki (niezależna od renderera)
│   ├── CombatTypes.ts          # Definicje typów, stanów, hitboxów, ramek i snapshotów
│   ├── FighterSimulation.ts    # Główna pętla walki, HP, rundy, fizyka, stany zawodników
│   ├── CombatResolver.ts       # Detekcja kolizji AABB, strefy trafień (High/Mid/Low), Juggle
│   ├── InputBuffer.ts          # Buforowanie wejścia (60 ticks), leniwe sprawdzanie sekwencji
│   └── Movement.ts             # Grawitacja, prędkości chodu, doskoki, pushboxy
├── presentation/               # Warstwa grafiki, dźwięku i kamery
│   ├── FighterView.ts          # Główny renderer Canvas 2D, postacie, tła, cząsteczki, komiksowe dymki
│   ├── SuperCinematicEngine.ts # 4-fazowy silnik kinematograficzny Super Ciosów (Freeze, Action, Impact, Recovery)
│   ├── SuperPropsRenderer.ts   # Wektorowy/rastrowy renderer 16 unikalnych rekwizytów postaci
│   ├── CameraRig2D.ts          # Śledzenie pozycji graczy, dynamiczny zoom i screen-shake
│   ├── FighterAudio.ts         # 100% proceduralna synteza dźwięku (Web Audio API: bonk, slap, boing, laser, bass)
│   └── FighterHud.ts           # Paski zdrowia, wskaźniki Super Meter, portrety, licznik czasu
├── data/                       # Konfiguracja zawodników, areny i ciosy
│   ├── fighters/roster.ts      # Rejestr 16 postaci, style walki, definicje Super Ciosów
│   ├── fighters/amper.ts       # Ramki ciosów Ampera, hitboxy, obrażenia
│   ├── fighters/korba.ts       # Ramki ciosów Korby, hitboxy, obrażenia
│   └── stages.ts               # Tła aren festiwalowych (Scena Główna, Grzybek, Sunset Camp, Kriszna)
├── ai/
│   └── BotController.ts        # AI bota P2: spacing, kontry, bloki, anty-air, wybicia
└── demo/
    ├── main.ts                 # Entrypoint demonstratora, mapowanie wejścia, modale, UI
    ├── demo.css                # Style HUD-u, wirtualnego gamepada mobilnego i okna wyboru postaci
    └── fighter-demo.html       # Szablon HTML gry
```

---

## 3. Mechanika Walki (Combat Design)

### 3.1. Układ Przycisków (Klasyczny Tekken Layout)

Gra wykorzystuje 4 główne przyciski ataku + blok + super cios:

- **LP (Light Punch / Lekka Pięść)** – szybki jab (startup 6-8 klatek), bezpieczny na bloku.
- **RP (Heavy Punch / Mocna Pięść)** – mocniejszy cios ręką (startup 10-12 klatek).
- **LK (Light Kick / Lekkie Kopnięcie)** – szybkie kopnięcie dolne/średnie.
- **RK (Heavy Kick / Mocne Kopnięcie)** – zasięgowe mocne kopnięcie o wysokim pushbacku.
- **BLK (Block / Garda)** – manualna garda stojąca lub kucająca.
- **SP (Special / Ultimate Move)** – aktywacja unikalnego Super Ciosu postaci.

### 3.2. Ciosy Kierunkowe i Obrona (High / Mid / Low)

- **Podbródkowy (Launcher / Dół + RP)**:
  - Cios wyprowadzany z pozycji niskiej.
  - Przy trafieniu nakłada stan `isAirJuggle = true` i nadaje przeciwnikowi pionową prędkość wznoszącą (`vy = -17.5`).
  - Przeciwnik wznosi się w powietrze, umożliwiając żonglerkę (juggle combo) kolejnymi ciosami w locie przed opadnięciem na ziemię.
- **Niskie Podcięcie (Sweep / Dół + RK)**:
  - Cios niski (`low`), omijający wysoką gardę.
  - Powoduje natychmiastowe powalenie na ziemię (`knockdown`).
  - Gracz leżący na ziemi może wykonać _Quick-Rise / Tech-Roll_ (wciskając dowolny przycisk ataku), aby skrócić czas bezbronności z 30 do 14 klatek.
- **System Wysokości Ataków**:
  - `High`: Blokowany na stojąco; można pod nim przejść kucając.
  - `Mid`: Trafia kucających graczy (wymaga gardy na stojąco).
  - `Low`: Trafia graczy stojących (wymaga gardy w kucki `Dół + BLK`).

### 3.3. Pasek Energii (Super Meter)

- Skala od 0% do 100%. Ładuje się dynamicznie przy zadawaniu ciosów oraz przyjmowaniu obrażeń.
- Po naładowaniu umożliwia odpalenie kinowego Ultimate Move.

---

## 4. Pełny Roster 16 Postaci i Ich Unikalne Super Ciosy

Każdy z 16 bohaterów posiada autorską animację Super Ciosu, opartą o system **SuperCinematicEngine** (faza zatrzymania czasu, baner postaci, animowany rekwizyt, potężny impact i specyficzne efekty dźwiękowe):

| #   | Postać        | Tytuł / Styl                             | Nazwa Super Ciosu            | Dedykowana Animacja & Rekwizyt                                                                                          | Dźwięk Audio SFX                                                   |
| --- | ------------- | ---------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | **Amper**     | _Mistrz Przedłużacza_ (Zoning)           | **Lusterko Eleganta**        | Pojawia się złote owalne lusterko, Amper poprawia wąs, po czym ciska obracającym się lustrem we wroga.                  | Pękające szkło + patelnia (`playGlassShatter` + `playBonk`)        |
| 2   | **Korba**     | _Wirująca Królowa_ (Rushdown)            | **Helikopter z Warkoczy**    | Błyskawiczny obrót wokół osi, warkocze przekształcają się w wirujące śmigło zadające serię cięć.                        | Kreskówkowy świst śmigła (`playPropellerSpin`)                     |
| 3   | **Kobra**     | _Szybki Zawadiaka_ (Brawler)             | **Fontanna Sprawiedliwości** | Komiczny kreskówkowy łuk strumienia moczu pryskający prosto na przeciwnika.                                             | Dźwięk fontanny + gwizdek + mokry plaskacz (`playSlap`)            |
| 4   | **Antena**    | _Mistrzyni Dobrych Wibracji_ (Grappler)  | **Cukierkowa Promienistość** | Połknięcie cukierka, tęczowa pulsująca aura wokół dłoni i wystrzał wiązki lasera energii.                               | Kosmiczny wystrzał lasera sci-fi (`playLaserBeam`)                 |
| 5   | **Gruczoł**   | _Władca Białego Tronu_ (Tank)            | **Tron Toi-Toi**             | Nad postacią materializuje się biała kabina Toi-Toi, z której wylatuje grad rolek papieru toaletowego.                  | Spłuczka toaletowa (`playFlushToilet`) + komiczny bąk (`playFart`) |
| 6   | **Klątwa**    | _Królowa Krzyku Pola_ (All-Rounder)      | **Krzyk Pola**               | Przybranie bojowej postawy, z ust wylatuje trójwymiarowy neonowy napis „KURWA MOJE POLE”.                               | Megafonowy pisk (`playMegaphoneScreech`) + potężny grzmot          |
| 7   | **Krwiak**    | _Pankowy Rozbójnik_ (Pressure)           | **Młot Festiwalowy SUMMER**  | W dłoniach materializuje się ogromny neonowy szyld „SUMMER”, zamach znad głowy i zmiażdżenie rywala.                    | Metaliczny gong + patelnia (`playBonk`)                            |
| 8   | **Pień**      | _Drzewny Megafonista_ (Zoning)           | **Megafonowy Śmiech**        | Wyciąga metalowy tubowy megafon, histeryczny śmiech i koncentryczne fale soniczne uderzają we wroga.                    | Sprzężenie megafonu (`playMegaphoneScreech`) + gwizdek             |
| 9   | **Pierścień** | _Władca Basowych Fal_ (Heavyweight)      | **Bas JBL Dobrze Dobrze**    | Postawienie ogromnego głośnika JBL z pulsującymi membranami i falami basowymi do rytmu „dobrze dobrze”.                 | Klubowy drop basowy 808 (`playJBLBassDrop`)                        |
| 10  | **Zawór**     | _Psychodeliczny Wojownik_ (Mix-up)       | **Mandala Ninja**            | Zjedzenie czerwonego grzyba, psychodeliczna obracająca się kolorowa mandala w tle, peleryna i atak ninja z zaskoczenia. | Psychodeliczny rezonans + świst cięcia                             |
| 11  | **Ambona**    | _Złota Rączka Pola_ (Zoning/Trap)        | **Wyprawka Festiwalowa**     | Wyciągnięcie ogromnej torby płóciennej, rzut kluczem francuskim oraz płonącą kuchenką turystyczną.                      | Brzęk metalowego narzędzia + syczenie gazu + wybuch                |
| 12  | **Chlebak**   | _Królowa Festiwalowych Bitów_ (Rushdown) | **DJ Scratch Drop**          | Konsola DJ-ska z obracającym się winylem, ekspresyjny scratch i soniczna fala uderzeniowa.                              | Kreskówkowy scratch płyty winylowej (`playDJScratch`)              |
| 13  | **Dziąsło**   | _Podniebny Bombowiec_ (Divekick)         | **Meteor z Niebios**         | Wystrzał w przestworza ponad krawędź ekranu, rozgrzanie i uderzenie w rywala niczym płonący meteor.                     | Świst opadającej rakiety + tąpnięcie ziemi                         |
| 14  | **Hemoroid**  | _Kierowca Błotnego Szlaku_ (Brawler)     | **Terenówka 4x4**            | Ryk silnika, zza ekranu wjeżdża ubłocony zielony jeep 4x4, taranując przeciwnika.                                       | Warkot i ryk silnika terenowego (`playEngineRoar`)                 |
| 15  | **Jęczmień**  | _Festiwalowy Piroman_ (Pressure)         | **Ognisty Kartel**           | Szybkie wyciąganie zapalniczek jedna po drugiej z kieszeni, krzesanie iskier i deszcz płomieni.                         | Klikanie iskrowników (`playLighterFlicks`) + zapłon ognia          |
| 16  | **Szerszeń**  | _Mroczny Filozof Pola_ (Control)         | **Kamienna Hipokryzja**      | Mroczna aura, tajemnicze szepty w tle, z nieba spada monumentalny kamienny monolit z napisem „HIPOKRYZJA”.              | Mistyczne szepty (`playWhispers`) + miażdżący huk kamienia         |

---

## 5. Dźwięk i Slapstickowy Komizm (Web Audio API)

Wszystkie odgłosy generowane są w 100% proceduralnie w [`FighterAudio.ts`](file:///E:/kodowanie/gra/.ai/worktrees/fighter-demo/src/games/fighter/presentation/FighterAudio.ts) bez zewnętrznych plików `.wav`/`.mp3`:

- **Patelnia (Bonk)**: rezonans pasmowy na 1200 Hz z metalicznym wybrzmieniem.
- **Mokry plaskacz (Slap)**: szum biały filtrowany pasmowo (1700 Hz) z ostrym atakiem 15 ms.
- **Kreskówkowa sprężyna (Boing)**: oscylator sinusoidalny z modulacją częstotliwości FM (28 Hz) i wznoszącym świstem.
- **Komiczny bąk (Fart)**: zmodulowany trójkątny oscylator basowy z chropowatym tremolo (38 Hz).
- **Klakson klauna (Honk)**: dwutonowy klakson (280 Hz + 350 Hz).
- **Pisk gumowej kaczki (Squeak)**: podwójny świergot o częstotliwości 1800-2400 Hz.
- **Komiczne dymki wizualne (Popups)**: pojawianie się gwiazd wybuchu z napisami: _BONK!_, _PLASK!_, _BOING!_, _PRRR!_, _BĘC!_, _AŁA!_, _ŁUP!_, _PISK!_.

---

## 6. Pytania i Obszary do Analizy dla Recenzenta (Code Review Topics)

1. **Balans Frame Data i Czucie Walki (Game Feel)**:
   - Czy obecne okna startup (8-14 klatek), active (3-5 klatek) i recovery (14-22 klatek) zapewniają dobrą dynamikę i czytelność?
   - Jak najlepiej zaprojektować system skalowania obrażeń w combo (damage scaling), aby juggle combos nie zabijały gracza w jednej sekwencji?
2. **Architektura Animacji Super Ciosów (Procedural 2D Canvas vs Video Cutscene Overlay)**:
   - Jak ocenić kompromis między obecnym silnikiem rekwizytów 2D (0 ms lagu, 0 MB transferu) a pełnoekranowymi wstawkami wideo MP4/WebM?
   - Jak najlepiej zaprojektować hybrydowy odtwarzacz wideo z atrybutem `playsinline` dla urządzeń iOS Safari?
3. **Optymalizacja Mobilna i Sterowanie Dotykowe (Touch UX)**:
   - Czy obsługa zdarzeń `pointerdown`/`pointerup` z maskami bitowymi (`touchMask`) jest optymalna pod kątem zapobiegania opóźnieniom na ekranach 120 Hz (Promotion / AMOLED)?
   - Jak rozwiązać problem przypadkowego zaznaczania tekstu / gestów powrotu na iOS i Androidzie?
4. **Gotowość pod Multiplayer i Netcode**:
   - Stan gry jest już serializowalny przez `getSnapshot()` / `loadSnapshot()`. Jakie kroki są potrzebne, aby wdrożyć deterministyczny Rollback Netcode (np. GGPO / WebRTC DataChannels)?
5. **AI Bota**:
   - Jak ulepszyć zachowanie bota (`BotController.ts`), aby stosował adaptacyjny zoning, uczył się nawyków gracza (np. nadużywania skoków) i wykonywał optymalne punish-combos po zablokowaniu ciosów o długim recovery?
