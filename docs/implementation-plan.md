# 🗺️ Praktyczny Plan Implementacji — „#KURWAMOJEPOLE"

> **Status dokumentu:** Oczyszczony i zaktualizowany na bazie bieżącego kodu i dyskusji projektowych (Październik 2026).
> Usunięto niepotrzebne/przekombinowane dodatki, dodano pomysły na unikalny klimat obozowy Pol'and'Rocka (Flanki, Jam session, okrzyki festiwalowe).
> Limit graczy: **16** (tyle ile postaci kanonicznych) · Świat: **Obóz + Pasaże + Duża Scena + Grzybek + Tłum festiwalowy**.

---

## 🎪 Rdzeń projektu: Festiwal, Imersja i Społeczność

| Parametr            | Stan w starym szkicu     | Nowy, zatwierdzony standard                                                                                                                                 |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postacie grywalne   | 8 postaci                | **16 postaci kanonicznych** (`CANONICAL_CHARACTERS` w `networkProtocol.ts`)                                                                                 |
| Max graczy w pokoju | 8                        | **16** (= `CANONICAL_CHARACTERS.length`)                                                                                                                    |
| Postacie w obozie   | 8 NPC                    | **16 postaci obozowych** (`characterAssets` w `NpcManager.ts`)                                                                                              |
| Tłum festiwalowy    | brak (tylko obóz)        | **90 modeli tłumu** (`FestivalCrowdLoader`, z rolami: tancerze pod sceną, namiot ASP, kolejki gastro, spacerowicze)                                         |
| Teren festiwalu     | Tylko 15 namiotów        | **Cały obszar**: Obóz, Pasaże Północ/Południe, Brama Główna, Duża Scena z FOH i wieżami delay, Grzybek Wodny, Pole słoneczników, Wioska Kryszny, Namiot ASP |
| Czat głosowy i AI   | Brak w pierwotnym planie | **Spatial Voice WebRTC** (głos 3D graczy) + **Rozmowy z NPC przez mikrofon** (STT + Gemini API + synteza mowy TTS)                                          |

---

## 🗑️ Co zostało USUNIĘTE z pierwotnego planu (jako zbędne lub przekombinowane):

1. **❌ Viewmodel przedmiotu w FPS (stare zadanie 2.4)**:
   - _Dlaczego usunięto:_ Budowanie osobnego renderingu rąk z pufaniem w pierwszej osobie pochłonęłoby 6–8 godzin, a w grze istnieje już dopracowana i klimatyczna sekwencja trzecioosobowa (`ItemUseSequence`), w której widać całą postać pijącą piwo lub palącą jointa.
2. **❌ Monolityczny globalny EventBus przepisujący cały projekt (stare zadanie 1.4)**:
   - _Dlaczego usunięto:_ Kod posiada już uporządkowany podział (`EventScope`, `AppStateMachine`, bezpośrednie subskrypcje). Wprowadzanie jednego wielkiego EventBusa do wszystkiego groziło duplikacją mechanizmów (Rule 4 w `AGENTS.md`). Zamiast tego stosujemy proste, lokalne zdarzenia tam, gdzie zachodzi realna potrzeba (np. głośnik obozowy → reakcja NPC).
3. **❌ Blokowanie palenia brakiem zapalniczki (stare zadanie 2.5)**:
   - _Dlaczego usunięto:_ Wymuszanie szukania zapalniczki na ziemi, żeby móc zapalić jointa, to sztuczny blocker i niepotrzebna frustracja. Palenie ma być relaksujące i natychmiast dostępne.
4. **❌ Przeładowana sekwencja toalety ToiletSequence (stare zadanie 2.6)**:
   - _Dlaczego usunięto:_ Toi-toi już teraz działa w grze (jest 2-sekundowy timer, fade ekranu i kultowe kwestie Dude'a z Postal 2). Dorabianie rozbudowanego menu tekstowego nie wnosiło nowej wartości.

---

## 💡 Nowe pomysły włączone do planu (z dyskusji o ulepszeniu życia obozowego):

1. **🍻 Kultowa gra w Flanki (Bierball) na polance obozowej** (Zadanie 3.3).
2. **🎸 Ogniskowy Jam Session z gitarą przy namiotach** (Zadanie 3.4).
3. **📢 Festiwalowy krajobraz audio i okrzyki obozowe** (_„Zaraz będzie ciemno! — ZAMKNIJ SIĘ!”_, _„Siemanko!”_, odgłos otwieranej puszki) (Zadanie 2.2).
4. **🎙️ Wizualny wskaźnik mówiącego gracza nad nametagiem w WebRTC** (Zadanie 4.3).

---

## 📊 Tablica Statusu Zadań

| Faza       | Zadanie                                                                 |       Status        |   Priorytet   |
| ---------- | ----------------------------------------------------------------------- | :-----------------: | :-----------: |
| **Faza 1** | 1.1 Refaktor `Game.ts` (UIManager, ItemInspectController)               | ✅ **ZREALIZOWANE** |       —       |
|            | 1.2 Bezpieczeństwo XSS i silnik dialogowy AI z głosem                   | ✅ **ZREALIZOWANE** |       —       |
|            | 1.3 Fix podwójnego obrotu graczy sieciowych (`RemotePlayersManager.ts`) | ✅ **ZREALIZOWANE** | `d6cb1ca`     |
|            | 1.4 Cache raycastera w `InteractionManager.ts`                          | ✅ **ZREALIZOWANE** | `d6cb1ca`     |
|            | 1.5 Limit graczy w pokoju = 16 (`Room.ts`, `roomServer.ts`)             | ✅ **ZREALIZOWANE** | `d6cb1ca`     |
|            | 1.6 Bypass EffectComposer gdy brak efektu                               | ✅ **ZREALIZOWANE** |       —       |
|            | 1.7 Object pooling dla `ItemUseSequence` & `SeatController`             | ✅ **ZREALIZOWANE** | `d6cb1ca`     |
| **Faza 2** | 2.1 NPC tańczą przy głośniku obozowym i siadają na krzesłach            | ✅ **ZREALIZOWANE** |       —       |
|            | 2.2 Dźwięki kontekstowe SFX + Festiwalowe okrzyki obozowe               | ✅ **ZREALIZOWANE** |       —       |
|            | 2.3 Audio-reactive bas dla mocnych tripów (MDMA, LSD)                   | ✅ **ZREALIZOWANE** |       —       |
|            | 2.4 Użytkowy ekwipunek: Woda (antidotum) i Okulary przeciwsłoneczne     | ✅ **ZREALIZOWANE** | `d6cb1ca`     |
|            | 2.5 Współdzielenie używek (poczęstuj piwem / jointem)                   | ✅ **ZREALIZOWANE** |       —       |
| **Faza 3** | 3.1 Płynny cykl dobowy zintegrowany ze skyboxem i Dużą Sceną            | ✅ **ZREALIZOWANE** |       —       |
|            | 3.2 Oświetlenie nocne: Fairy lights nad namiotami i latarka gracza      | ✅ **ZREALIZOWANE** |       —       |
|            | 3.3 Mini-gra w Flanki (Bierball) w centrum obozu                        | ✅ **ZREALIZOWANE** |       —       |
|            | 3.4 Ogniskowy Jam Session z gitarą przy namiotach                       | ✅ **ZREALIZOWANE** |       —       |
|            | 3.5 Pełna mapa festiwalowa 2D (klawisz M)                               | ✅ **ZREALIZOWANE** |       —       |
|            | 3.6 Festiwalowa pogoda: Deszcz, błoto i zjeżdżalnia błotna              | ✅ **ZREALIZOWANE** |       —       |
| **Faza 4** | 4.1 Dynamiczny swap NPC ↔ Gracz (dla 16 postaci w obozie)               | ✅ **ZREALIZOWANE** |       —       |
|            | 4.2 Synchronizacja animacji akcji w sieci (`action:trigger`)            | ✅ **ZREALIZOWANE** |       —       |
|            | 4.3 Wskaźnik mówiącego gracza nad nametagiem w WebRTC                   | ✅ **ZREALIZOWANE** | `d6cb1ca`     |
|            | 4.4 Rate-limiting na serwerze Socket.io                                 | ✅ **ZREALIZOWANE** |       —       |
|            | 4.5 Reconnect ze stanem i tokenem sesyjnym                              | ✅ **ZREALIZOWANE** |       —       |
|            | 4.6 Deployment HTTPS/WSS i konfiguracja TURN                            | 🟢 **DO ZROBIENIA** |   PRODUKCJA   |

---

## Szczegółowy opis zadań do realizacji

---

### FAZA 1: Stabilizacja techniczna i Quick-Bugfixy

#### 1.3 Naprawa podwójnego obrotu graczy sieciowych

- **Plik:** `src/game/network/RemotePlayersManager.ts` (linie 223–224)
- **Problem:** W metodzie `update` obrót gracza jest ustawiany dwukrotnie w sąsiednich linijkach:
  ```ts
  entity.root.rotation.set(0, entity.currentYaw, 0, 'YXZ');
  entity.root.rotation.set(0, entity.currentYaw + Math.PI, 0, 'YXZ'); // <- błąd: odwraca i powoduje migotanie
  ```
- **Rozwiązanie:** Usunięcie drugiej, błędnej linii.
- **Czas:** ~10 min.

#### 1.4 Cache raycastera w `InteractionManager.ts`

- **Plik:** `src/game/interactions/InteractionManager.ts`
- **Problem:** Metoda `update()` alokuje w każdej klatce `new THREE.Vector2()`, a `facesCamera()` tworzy 3 wektory i kwaternion. Przy 60 FPS oznacza to setki niepotrzebnych alokacji na sekundę i ścinki GC.
- **Rozwiązanie:** Przepisanie na statyczne instancje wielokrotnego użytku (`_screenCenter`, `_normal`, `_quaternion`, `_target`, `_camPos`).
- **Czas:** ~20 min.

#### 1.5 Limit graczy w pokoju = 16

- **Pliki:** `src/game/network/networkProtocol.ts`, `server/Room.ts`, `server/roomServer.ts`
- **Rozwiązanie:**
  - W `networkProtocol.ts`: `export const MAX_PLAYERS_PER_ROOM = CANONICAL_CHARACTERS.length; // 16`
  - W `Room.ts`: getter `isFull` sprawdzający liczbę zajętych/rezerwowanych slotów.
  - W `roomServer.ts`: emitowanie błędu `ROOM_FULL` przy próbie wejścia 17. gracza bez aktywnego tokena reconnectu.
- **Czas:** ~30 min.

#### 1.7 Object pooling dla sekwencji użycia i krzeseł

- **Pliki:** `src/game/interactions/ItemUseSequence.ts`, `src/game/interactions/SeatController.ts`, `src/game/Game.ts`
- **Problem:** Każde napicie się piwa lub usiąście na krześle klonuje pełny SkinnedMesh (50 kości, drawcalle, GPU).
- **Rozwiązanie:** Prealokacja jednego aktora sekwencji w `Game.ts`, sterowanie widocznością (`actor.visible = true/false`) i czyszczenie miksera animacji po zakończeniu.
- **Czas:** ~2h.

---

### FAZA 2: Życie obozu, soczystość i dźwięki

#### 2.1 NPC tańczą przy głośniku obozowym i siadają na krzesłach

- **Pliki:** `src/game/npc/NpcManager.ts`, `src/game/npc/NpcBehaviorScheduler.ts`
- **Kontekst:**
  - Głośnik obozowy posiada punkt `Static_Camp_Speaker` przy `(-1.45, 0.65)`.
  - W `scripts/test_chair_sitting.ts` wyliczono już prawidłowe parametry siadania (obrót o 180°, dopasowanie kości bioder do wysokości Y=0.50m).
- **Logika:**
  - Gdy muzyka z głośnika obozowego gra (`speakerAudio.isPlaying`), 1–3 NPC w promieniu 8m podchodzi pod plandekę i tańczy.
  - Okresowo wolne NPC obozowe podchodzą do krzeseł kempingowych wokół stołu i siadają (`SittingIdle` / `SittingLaughing`).
  - Gdy gracz podchodzi lub chce usiąść, bot wstaje i ustępuje miejsca.
- **Czas:** ~3–4h.

#### 2.2 Dźwięki kontekstowe SFX + Festiwalowe okrzyki

- **Pliki:** `src/game/interactions/itemUseSequenceConfig.ts`, `src/game/interactions/ItemUseSequence.ts`, `src/game/audio/VoiceReactionManager.ts`
- **Zawartość:**
  - SFX używek: klik i syk otwieranej puszki piwa (_pssst!_), pstryknięcie zapalniczki, siorbnięcie/wciągnięcie, przełknięcie pigułki.
  - Okrzyki obozowe: losowo co pewien czas z różnych stron obozu i festiwalu rozbrzmiewa kultowe:
    - _„Zaraz będzie ciemno! — ZAMKNIJ SIĘ!”_
    - _„Pooole! Kurwa, moje pole!”_
    - _„Siemankooo!”_
- **Czas:** ~2h.

#### 2.3 Audio-reactive bas dla tripów MDMA & LSD

- **Pliki:** `src/game/effects/EffectManager.ts`, `src/game/audio/SpeakerAudio.ts`
- **Działanie:** Podpięcie `AnalyserNode` (pasmo basu 0–120 Hz) pod wyjście audio. W fazie aktywnej mocnych psychodelików (MDMA, LSD) siła blooma i aberracji pulsuje w rytm stopy i basu. Respektuje ustawienie `reduceMotion`.
- **Czas:** ~2h.

#### 2.4 Użytkowy ekwipunek: Woda i Okulary

- **Pliki:** `src/game/inventory/ConsumableInventory.ts`, `src/game/interactions/itemConfig.ts`
- **Przedmioty:**
  - 💧 **Woda**: Wypicie butelki wody natychmiast skraca trwający trip o 40% (idealne antidotum, gdy obraz zbyt mocno pływa).
  - 🕶️ **Okulary przeciwsłoneczne**: Założenie okularów przyciemnia ekspozycję i redukuje oślepiający bloom o 50% na 60 sekund.
- **Czas:** ~2h.

#### 2.5 Współdzielenie używek (Pass the blunt / Share a beer)

- **Pliki:** `src/game/interactions/InteractionManager.ts`, `src/game/network/networkProtocol.ts`
- **Działanie:** Gdy stoisz blisko innego gracza lub NPC i masz w ręku/ekwipunku piwo lub jointa, pojawia się prompt `E — Poczęstuj [Imię]`. Postać obdarowana odwraca się, dziękuje (audio/tekst) i odpala animację.
- **Czas:** ~2h.

---

### FAZA 3: Prawdziwy klimat festiwalowy i aktywności

#### 3.1 Płynny cykl dobowy

- **Pliki:** `src/game/world/DayNightCycle.ts`, integracja z `src/game/world/HorizonSkybox.ts`, `src/game/Game.ts`
- **Działanie:**
  - Cykl trwa 15 minut czasu rzeczywistego (z klawiszem dev `P` do szybkiego testowania).
  - Płynnie przełącza cubemapy w `TimeOfDaySkybox` (`day` → `evening` → `night`).
  - Steruje kątem i barwą słońca (`DirectionalLight`), światłem rozproszonym oraz mgłą.
  - W nocy lasery i ruchome głowy na Dużej Scenie (`FestivalStageEffects`) stają się jaskrawe i przecinają niebo.
- **Czas:** ~4h.

#### 3.2 Oświetlenie nocne: Fairy lights i latarka gracza

- **Pliki:** `src/game/world/FestivalLights.ts`, `src/game/player/PlayerController.ts`
- **Działanie:**
  - Łańcuchy kolorowych lampek solarnych/LED rozwieszone na masztach między namiotami w obozie zapalają się automatycznie po zmroku.
  - Klawisz `L` włącza latarkę czołową gracza (stożek `SpotLight`), co pozwala na eksplorację ciemnych alejek festiwalu.
- **Czas:** ~2–3h.

#### 3.3 Mini-gra w Flanki (Bierball) w obozie

- **Pliki:** `src/game/interactions/FlankiGame.ts`
- **Koncepcja:**
  - Na wolnej przestrzeni obozu ustawiona puszka na środku i dwie linie rzutów.
  - Gracz może podejść, podnieść kamyk/piłkę i wycelować w puszkę.
  - Trafienie przewraca puszkę: NPC z przeciwnej drużyny biegnie ją postawić, a gracz i jego drużyna piją piwo z puszki, dopóki puszka nie stanie na nogi!
  - Najbardziej pol'and'rockowa mini-gra w historii gier wideo.
- **Czas:** ~4–5h.

#### 3.4 Ogniskowy Jam Session przy namiotach

- **Pliki:** `src/game/npc/NpcJamSession.ts`
- **Działanie:**
  - Wieczorem postać z gitarą (np. `078_girl_with_guitar` lub `012_acoustic_songster`) siada przy stoliku lub ognisku i zaczyna brzdąkać na gitarze akustycznej.
  - Pobliskie boty schodzą się, siadają wokół i bujają się w rytm muzyki.
  - Gracz może dołączyć i usiąść w kręgu.
- **Czas:** ~3h.

#### 3.5 Pełna mapa festiwalowa 2D (klawisz M)

- **Plik:** `src/game/ui/FestivalMap.ts`
- **Działanie:**
  - Klawisz `M` wyświetla czytelną, stylizowaną mapę 2D całego festiwalu:
    - Obóz „Kurwa Moje Pole” z zaznaczoną flagą i namiotami.
    - Pasaże gastro (frytki, burgery, makarun, rollbary Lecha).
    - Brama Główna (wejście południowe).
    - Duża Scena z FOH i 6 przejściami w barierkach.
    - Grzybek Wodny, wóz strażacki OSP, pole słoneczników i strefa ASP.
  - Pulsująca kropka wskazuje pozycję i kierunek patrzenia gracza, a małe punkty pokazują innych graczy online.
- **Czas:** ~3h.

#### 3.6 Festiwalowa pogoda: Deszcz, błoto i zjeżdżalnia błotna

- **Pliki:** `src/game/world/FestivalWeather.ts`, `src/game/rendering/pbrMaterials.ts`
- **Działanie:**
  - Dynamiczny lub przełączany klawiszem dev `K` deszcz festiwalowy (cząsteczki deszczu, przyciemnienie nieba, dźwięk kropel na namiotach).
  - Nawierzchnia alejek staje się błotnista (zwiększony roughness/specular i kałuże).
  - Pod Dużą Sceną boty w kostiumach/kąpielówkach zbiegają się na kultową zjeżdżalnię błotną (mud slide) z chlapiącym błotem.
- **Czas:** ~3h.

---

### FAZA 4: Dopracowany Multiplayer

#### 4.1 Dynamiczny swap NPC ↔ Gracz (dla 16 postaci)

- **Pliki:** `src/game/npc/NpcManager.ts`, `src/game/Game.ts`
- **Działanie:**
  - W obozie startowo przebywa 16 postaci kanonicznych.
  - Gdy gracz dołącza do pokoju z wybraną postacią (np. `Kobra`), `NpcManager` natychmiast ukrywa bota Kobry (`hideNpc('Kobra')`).
  - Gracz widzi w sieci żywych ludzi zamiast zduplikowanych botów.
  - Po opuszczeniu gry i upływie 30s grace periodu, bot Kobry ponownie pojawia się w obozie.
- **Czas:** ~2h.

#### 4.2 Synchronizacja animacji akcji w sieci (`action:trigger`)

- **Pliki:** `src/game/network/networkProtocol.ts`, `server/roomServer.ts`, `src/game/network/RemotePlayersManager.ts`
- **Działanie:** Przesyłanie zdarzeń one-shot przez Socket.io: picie piwa, palenie, taniec, siadanie na krześle. Inni gracze widzą pełne animacje swoich znajomych.
- **Czas:** ~3h.

#### 4.3 Wskaźnik mówiącego gracza w WebRTC

- **Pliki:** `src/game/ui/PlayerNametag.ts`, `src/game/audio/SpatialVoiceManager.ts`
- **Działanie:** Detekcja Voice Activity (VAD / poziom RMS mikrofonu). Gdy zdalny gracz mówi przez mikrofon, nad jego nametagiem pojawia się zielona, pulsująca ikonka głośnika/fali dźwiękowej.
- **Czas:** ~1.5h.

#### 4.4 Rate-limiting i ochrona serwera

- **Plik:** `server/RateLimiter.ts`
- **Działanie:** Token bucket ograniczający pakiety ruchu (max 30/s) i akcji (max 5/s), chroniący serwer przed floodingiem.
- **Czas:** ~1.5h.

#### 4.6 Wdrożenie produkcyjne HTTPS/WSS i konfiguracja TURN

- **Pliki:** `server/roomServer.ts`, `.env.example`
- **Działanie:** Obsługa certyfikatów SSL/TLS (niezbędna dla działania mikrofonu poza localhostem) oraz wpisanie zewnętrznych serwerów STUN/TURN dla graczy zza restrykcyjnego firewallu.
- **Czas:** ~2h.

---

## 🚀 Zalecana kolejność realizacji (Roadmapa najbliższych kroków)

```
KROK 1: Szybkie poprawki techniczne (Priorytet zerowy, ~1h)
  ├── 1.3 Fix podwójnego obrotu graczy sieciowych (RemotePlayersManager.ts)
  ├── 1.4 Cache raycastera w InteractionManager.ts
  └── 1.5 Limit 16 graczy w pokoju (Room.ts, roomServer.ts)

KROK 2: Dźwięki i życie obozu (~3h)
  ├── 2.2 Dźwięki puszki piwa, zapalniczki + okrzyki "Zaraz będzie ciemno!"
  ├── 2.1 Reakcja botów na głośnik w obozie i siadanie na krzesłach
  └── 4.3 Wskaźnik mówienia w WebRTC nad nametagiem gracza

KROK 3: Multiplayer i swap postaci (~3h)
  ├── 4.1 Dynamiczny swap NPC ↔ Gracz dla 16 postaci w obozie
  └── 4.2 Synchronizacja animacji akcji w sieci (picie, palenie, taniec)

KROK 4: Świat festiwalu i noc (~5h)
  ├── 3.5 Stylizowana mapa 2D festiwalu (klawisz M)
  ├── 3.1 Płynny cykl dzień/noc sterujący TimeOfDaySkybox i Dużą Sceną
  └── 3.2 Fairy lights nad namiotami i latarka gracza (klawisz L)

KROK 5: Festiwalowe perełki (~5h)
  ├── 3.3 Mini-gra w Flanki na polanie
  └── 3.4 Jam Session z gitarą przy namiotach
```
