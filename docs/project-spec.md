# Specyfikacja projektu gry 3D „#KURWAMOJEPOLE”

Wersja dokumentu: 1.1
Status: docelowa specyfikacja funkcjonalna i techniczna
Platforma: przeglądarki desktopowe

## 1. Opis projektu

„#KURWAMOJEPOLE” to przeglądarkowa gra 3D odtwarzająca niewielki, prywatny obóz festiwalowy inspirowany rzeczywistym obozem z Pol'and'Rock Festival w Polsce. Najważniejsza jest rozpoznawalność miejsca, jego uczestników i atmosfery: ciasno ustawione namioty, wąskie przejścia, duże centralne zadaszenie Mad Dog, wysoki maszt z flagą, toi-toi w rogu i ludzie poruszający się po całym polu.

Gra nie ma odtwarzać całego festiwalu. Nie należy dodawać sceny koncertowej, baru, stoisk handlowych, kuchni, grilla, ogniska, magazynu ani płotu. Świat ma być mały, gęsty i osobisty.

Docelowo w jednej sesji może uczestniczyć do ośmiu graczy. Każdy wybiera jedną z ośmiu unikalnych postaci. Postacie niewybrane przez graczy funkcjonują jako NPC. Postać zajęta przez gracza znika z puli wyboru i nie może jednocześnie istnieć jako NPC.

Główna pętla rozgrywki:

1. Wejście do pokoju gry.
2. Wybór wolnej postaci i obejrzenie jej obracanego modelu.
3. Udzielenie lub odmowa dostępu do mikrofonu.
4. Pojawienie się przy wejściu do obozu.
5. Eksploracja obozu, rozmowy przestrzenne z innymi graczami i obserwowanie NPC.
6. Inspekcja przedmiotów i czytanie ich opisów.
7. Używanie przedmiotów oraz oglądanie pełnych sekwencji animacji postaci.
8. Doświadczanie przypisanych efektów wizualnych i kamerowych.

## 2. Zakres świata gry

### 2.1. Teren

- Namioty muszą być ustawione nieregularnie, podobnie do ręcznego szkicu, a nie w idealnych rzędach.
- Pomiędzy namiotami stojącymi blisko siebie mają pozostać wąskie, ale przechodnie ścieżki. Minimalne światło przejścia powinno wynosić około 1–1,2 m.

### 2.2. Centralne zadaszenie Mad Dog

- Mad Dog jest największym i najważniejszym obiektem obozu.
- Obecnie załadowany model należy znacznie powiększyć. Docelowy rozmiar roboczy to co najmniej około 8 × 6 m.
- Zadaszenie ma być czarne, otwarte ze wszystkich stron, z lekko zwisającym materiałem.
- Pod zadaszeniem wszyscy głównie siedzą, chronią się przed słońcem i rozmawiają.
- Cała przestrzeń pod nim musi być dostępna dla gracza i NPC.
- Kolizję mają tylko słupy i inne rzeczywiście masywne elementy. Materiał nad głową nie blokuje przejścia.
- Linki, odciągi i śledzie mogą być widoczne, ale same linki nie mogą mieć kolizji.
- Pod zadaszeniem potrzebne jest dodatkowe miękkie światło wypełniające, aby postacie nie były niemal czarne.

### 2.3. Flaga

- Flaga `#kurwamojepole` znajduje się na środku obozu, a nie przy wejściu.
- Maszt ma być wysoki, wyraźnie wyższy od namiotów i zadaszenia.
- Flaga ma znajdować się wysoko i być widoczna z większości obozu.
- Maszt ma kolizję, materiał flagi nie ma kolizji.
- Flaga powinna delikatnie poruszać się na wietrze.

### 2.4. Toi-toi

- Jeden toi-toi znajduje się w rogu mapy.
- Zatwierdzonym zasobem runtime jest `public/game-assets/world/toilet.glb` (wcTron). Należy sprawdzić materiały
  i dopisać do manifestu assetów.
- Ma być obiektem stałym z kolizją.
- Podejście do wejścia musi pozostać dostępne.
- Toi-toi może mieć interakcję oraz osobną sekwencję animacji wejścia/wyjścia, jeśli zostanie przewidziana w zestawie animacji.

### 2.5. Plan obozu i identyfikatory

Do projektu dołączona jest robocza mapa `camp-layout-provisional.svg`. Jest to uporządkowana interpretacja szkicu, a nie ostateczny pomiar geodezyjny. Wszystkie namioty otrzymują stabilne identyfikatory `T01`–`T15`, aby można było później przypisać im właścicieli, opisy i właściwe modele bez zmieniania kodu.

| ID  | Położenie robocze            | Charakter miejsca                          | Model / właściciel do uzupełnienia     |
| --- | ---------------------------- | ------------------------------------------ | -------------------------------------- |
| T01 | północny zachód              | duży, podłużny namiot ze szkicu „Namiot 1” | —                                      |
| T02 | północ, lewa część           | mały namiot                                | —                                      |
| T03 | północ, środek               | mały namiot                                | —                                      |
| T04 | północny wschód              | mały namiot                                | —                                      |
| T05 | skrajny północny wschód      | nieregularny namiot                        | —                                      |
| T06 | na wschód od Mad Dog         | średni namiot                              | —                                      |
| T07 | zachodnia część obozu        | pionowo ustawiony namiot                   | —                                      |
| T08 | zachód, poniżej T07          | mały namiot                                | —                                      |
| T09 | południowy zachód od Mad Dog | smukły namiot                              | —                                      |
| T10 | południe, lewa część         | duży namiot                                | `art/dużynamiot.glb` → wariant runtime |
| T11 | południe, środek             | duży namiot                                | —                                      |
| T12 | południowy wschód            | podłużny namiot                            | —                                      |
| T13 | dolny prawy sektor           | mały namiot                                | —                                      |
| T14 | dolny lewy sektor            | średni namiot                              | —                                      |
| T15 | dolny środkowy sektor        | duży namiot                                | `art/dużynamiot.glb` → wariant runtime |

Pozycje, rotacje, skale i użyte modele nie mogą być zapisane bezpośrednio w kodzie sceny. Powinny znajdować się w jednym pliku konfiguracyjnym, np. `campLayout.ts`, z polami:

```ts
type CampObjectConfig = {
  id: string;
  label: string;
  modelPath: string;
  position: [number, number, number];
  rotationY: number;
  scale: number | [number, number, number];
  collider: 'box' | 'capsule' | 'cylinder' | 'none';
  description?: string;
};
```

## 3. Styl wizualny, materiały i oświetlenie

### 3.1. Kierunek artystyczny

- Postacie zachowują styl masywnych, zabawkowych figurek z klockową estetyką, ale nie muszą kopiować chronionych elementów konkretnej marki.
- Środowisko ma być stylizowane, ale czytelne i oparte na naturalnych kolorach.
- Modele nie mogą wyglądać na niemal czarne, przepalone, neonowe ani pokryte przypadkowym połyskiem.
- Kolory ubrań, skóry, namiotów, trawy i przedmiotów muszą być jasne, naturalne i zbliżone do materiałów referencyjnych.

### 3.2. Materiały PBR

- Standardowym materiałem jest `MeshStandardMaterial`.
- `MeshPhysicalMaterial` należy stosować tylko tam, gdzie jest uzasadniony, np. szkło okularów, przezroczyste tworzywo lub wybrane elementy lakierowane.
- `MeshBasicMaterial` nie powinien być używany jako materiał postaci i środowiska, poza elementami UI/debug.
- Tekstury kolorów muszą używać `SRGBColorSpace`.
- Materiały tkanin powinny mieć wysoką chropowatość i bardzo niską metaliczność.
- Skóra i matowe tworzywo powinny mieć umiarkowaną chropowatość bez plastikowego, mokrego połysku.
- Metaliczność należy stosować wyłącznie do prawdziwych elementów metalowych.
- Importowane materiały trzeba normalizować tylko wtedy, gdy są wyraźnie błędne; nie należy ślepo zastępować poprawnych tekstur jednolitym kolorem.

### 3.3. Kolor i światło

- Renderer używa poprawnego zarządzania kolorem, `SRGBColorSpace` i kontrolowanego tone mappingu, np. `ACESFilmicToneMapping`.
- Scena ma zawierać jasne światło dzienne, kierunkowe światło słoneczne oraz miękkie światło nieba/otoczenia.
- Cienie powinny być miękkie i stabilne.
- W cieniu Mad Dog postacie nadal muszą mieć widoczne twarze, ubrania i naturalne kolory.
- Preview modeli ma używać własnego neutralnego zestawu świateł studyjnych, aby model nie był ciemniejszy niż w grze.

## 4. Postacie

### 4.1. Lista ośmiu postaci

1. amper
2. antena
3. gruczoł
4. klątwa
5. krwiak
6. pień / peposz
7. pierścień
8. zawór

Każda postać ma trzy rozdzielone, kanoniczne artefakty:

```text
public/game-assets/characters/<id>/preview.glb
public/game-assets/characters/<id>/npc-animations.glb
source-assets/characters/<id>/t-pose.glb
```

`preview.glb` jest materiałowo poprawnym modelem do menu i podglądów;
`npc-animations.glb` jest paczką używaną przez grę i zawiera rig oraz klipy;
`t-pose.glb` to stabilne źródło do dalszego rigowania. Nie wolno zastępować
jednego z nich innym plikiem tylko dlatego, że ma podobną nazwę. Zmiana wymaga
walidacji zgodności szkieletu, wag i materiałów.

Każdy model powinien:

- mieć naturalne i jasne materiały;
- zachować charakterystyczne ubrania, włosy, zarost i akcesoria;
- mieć poprawny wspólny rig 18 kości albo zgodny wspólny interfejs animacji;
- mieścić się docelowo w rozsądnym budżecie około 15 tys. trójkątów;
- nie mieć rozciągniętych trójkątów, rozrywających się rąk ani błędnych wag;
- mieć spójny punkt bazowy przy stopach, skalę i kierunek przodu.

Duży głośnik JBL postaci pierścień jest odpinanym akcesorium, a nie częścią skinningu całej postaci.

### 4.2. Wymagane animacje

Minimalny komplet:

- `Idle`;
- `Walk`;
- `Run`;
- picie piwa;
- palenie papierosa;
- palenie marihuany/jointa;
- palenie blanta;
- przyjęcie tabletki, np. LSD/MDMA;
- jedzenie grzybów;
- wciąganie kreski;
- opcjonalnie wejście/wyjście z toi-toia.

Istniejące klipy `Idle` i `Walk` należy zachować, ale sam ruch nóg nie wystarcza. Chód musi obejmować naturalną pracę bioder, tułowia, barków i rąk, bez przesuwania stóp po podłożu i bez rozrywania siatki.

### 4.3. Wybór postaci

- Po wejściu do pokoju gracz widzi wszystkie osiem postaci i ich stan: `wolna`, `zajęta` albo `rezerwowana`.
- Kliknięcie postaci nie wybiera jej natychmiast. Najpierw pod listą pojawia się zintegrowany preview modelu.
- Preview nie może otwierać nowego okna ani nowej karty.
- Model ma być renderowany bez własnego nieprzezroczystego tła; tłem pozostaje ekran wyboru.
- Preview musi znajdować się nad interfejsem, np. w warstwie o `z-index: 999`, ale nadal być jego integralną częścią.
- Model można obracać przeciąganiem myszą. Można też przywrócić domyślne ustawienie kamery.
- Pod modelem widoczne są nazwa i krótki opis postaci.
- Preview można zamknąć przyciskiem oraz klawiszem `Escape`.
- Dopiero przycisk „Wybierz postać” wysyła do serwera atomową próbę rezerwacji.
- Jeśli dwie osoby wybiorą tę samą postać niemal jednocześnie, dokładnie jedna otrzymuje sukces.
- Po udanym wyborze postać przestaje być dostępna dla innych użytkowników.

## 5. Sterowanie i kamera

- Kamera podstawowa: pierwszoosobowa.
- `W` / `ArrowUp`: ruch do przodu zgodnie z kierunkiem patrzenia/postaci, a nie osiami sceny.
- `S` / `ArrowDown`: ruch do tyłu.
- `A` i `D`: ruch w lewo/prawo względem kierunku gracza.
- Mysz: obrót kamery z Pointer Lock.
- `Shift`: szybszy ruch gracza.
- `E`: interakcja z obiektem wskazywanym celownikiem.
- `Escape`: wyjście z inspekcji albo zwolnienie kursora i otwarcie pauzy.
- `Tab`: prosty ekwipunek, jeśli pozostaje częścią aktualnej wersji.
- Celownik jest widoczny podczas normalnej eksploracji.
- Ruch po skosie musi być normalizowany, aby nie był szybszy.

### 5.1. Kamera sekwencji interakcji

Przy użyciu substancji lub wykonaniu czynności:

1. Sterowanie ruchem gracza zostaje chwilowo zablokowane.
2. Kamera płynnie wychodzi z pierwszej osoby.
3. Odsuwa się do bezpiecznego ujęcia, w którym widać całą postać.
4. Uruchamia się właściwa animacja i ewentualny przedmiot jest przypinany do dłoni.
5. Zdarzenie animacji jest wysyłane do innych graczy.
6. Po zakończeniu kamera płynnie wraca do pierwszej osoby.
7. Dopiero wtedy rozpoczyna się pełny efekt wizualny danej substancji.

Pozycja kamery filmowej musi być sprawdzana raycastem, aby nie znaleźć się w namiocie, pod ziemią ani po drugiej stronie ściany. Sekwencja ma działać identycznie dla lokalnego gracza, a inni gracze mają widzieć animację jego modelu z zewnątrz.

## 6. Kolizje

Gracz i NPC nie mogą przenikać przez:

- bryły namiotów;
- słupy Mad Dog;
- toi-toi;
- maszt flagi;
- inne postacie;
- większe przedmioty obozowe.

Przechodzić można przez:

- linki i odciągi namiotów;
- materiał flagi;
- dekoracyjne drobne elementy;
- przestrzeń pod zadaszeniem Mad Dog.

Kolizje nie powinny być tworzone z pełnej, szczegółowej geometrii GLB. Każdy obiekt ma prosty collider proxy: box, capsule albo cylinder. Linki namiotowe są w osobnej warstwie bez collidera. Gracz i NPC używają kapsuł.

System musi obsługiwać:

- przesunięcie obiektu poza collider po wykryciu nakładania;
- ślizganie wzdłuż przeszkody zamiast całkowitego zatrzymania;
- brak drgań przy narożnikach;
- przejście każdą zaplanowaną ścieżką;
- granicę kwadratu trawy jako collider świata.

## 7. NPC i zachowanie postaci

- Postacie niewybrane przez graczy są tworzone jako NPC.
- Postać wybrana przez gracza nie może równocześnie istnieć jako NPC.
- Po rozłączeniu gracza jego slot zostaje zwolniony, a odpowiadający NPC może zostać ponownie utworzony w bezpiecznym punkcie.
- NPC poruszają się po całym kwadracie trawy, a nie tylko wokół jednego małego punktu.
- NPC losują osiągalne cele i korzystają z `Idle`, `Walk` oraz `Run`.
- Podczas zwykłego przemieszczania chodzą.
- Gdy dotrą do strefy przy granicy mapy, przestają wybierać cel na zewnątrz, obracają się do wnętrza i biegną w kierunku centralnej strefy obozu.
- Po powrocie do bezpiecznej strefy znów przechodzą do chodu.
- NPC odbijają się/omijają namioty, słupy, toi-toi, graczy i innych NPC.
- Linki namiotowe nie są przeszkodami.
- Jeśli NPC przez określony czas nie zmienia pozycji, kontroler uznaje go za zablokowanego, wybiera nowy cel i wykonuje bezpieczną korektę pozycji.
- Animator wybiera `Idle`, `Walk` lub `Run` na podstawie rzeczywistej prędkości.

Za tę logikę odpowiada jeden `NpcNavigationController`, a nie osobne przypadkowe timery przypisane do każdej postaci.

## 8. Interakcje i inspekcja przedmiotów

### 8.1. Wykrywanie interakcji

- Interakcja wykorzystuje raycast z celownika oraz maksymalny dystans.
- Gdy obiekt jest dostępny, pojawia się kontekstowa podpowiedź, np. `E — obejrzyj`, `E — użyj`, `E — wypij piwo`.
- Jeżeli nic nie jest dostępne, podpowiedź znika.
- Jednocześnie aktywny może być tylko jeden cel interakcji.

### 8.2. Preview przedmiotu

- Inspekcja jest integralną warstwą aktualnego widoku, a nie osobnym oknem przeglądarki.
- Scena gry pozostaje widoczna jako tło; preview modelu nie ma własnego nieprzezroczystego tła.
- Przedmiot można obracać przeciąganiem myszą.
- Opcjonalnie można przybliżać i oddalać w kontrolowanym zakresie.
- Obok modelu wyświetlane są nazwa i pełny opis przedmiotu z konfiguracji.
- Widoczne są podpowiedzi: `przeciągnij — obrót`, `E — użyj` i `Esc — zamknij`.
- `Escape` zawsze zamyka inspekcję.
- Dostępny jest również widoczny przycisk zamknięcia.
- Po zamknięciu przywracany jest Pointer Lock i poprzedni stan sterowania.
- Podczas inspekcji gracz nie porusza się po świecie.

Komponent `ModelPreview` powinien być współdzielony przez inspekcję przedmiotów i wybór postaci.

## 9. Substancje, animacje i efekty

Gra obsługuje co najmniej:

- piwo;
- papierosa;
- marihuanę/jointa;
- blanta;
- LSD;
- MDMA/tabletkę;
- kokainę/kreskę;
- grzyby halucynogenne.

Każda czynność składa się z trzech osobnych elementów:

1. interaktywnego przedmiotu i opisu;
2. trzecioosobowej sekwencji animacji całej postaci;
3. efektu wizualnego i kamerowego uruchamianego po animacji.

Efekty są zarządzane centralnie przez `SubstanceEffectManager` i przechodzą przez stany `fadeIn`, `active`, `fadeOut`, `inactive`. Po zakończeniu wszystkie parametry kamery i postprocessingu muszą wrócić dokładnie do stanu bazowego.

| Efekt     | Charakter obrazu                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Piwo      | kołysanie, delikatne podwójne widzenie, okresowe rozmycie, ciemniejsza winieta                        |
| Papieros  | krótki dym i kaszlnięcie/wydech; bez mocnego zniekształcania przestrzeni                              |
| Marihuana | ciepłe kolory, łagodny bloom, spokojne „oddychanie” FOV i delikatne smużenie                          |
| Blant     | silniejszy i bardziej senny efekt konopny, ciężkie powieki, większy afterimage i wolniejsze kołysanie |
| LSD       | geometryczne/neonowe zniekształcenia, hue shift, pulsująca aberracja i smugi                          |
| MDMA      | ciepłe nasycenie, miękki różowo-fioletowy bloom, łagodny puls i rozświetlenie ludzi                   |
| Kokaina   | zimniejszy, ostry i kontrastowy obraz, widzenie tunelowe, szybki puls i minimalne drgania             |
| Grzyby    | organiczne falowanie, „oddychanie” otoczenia, ciepłe kolory i miękkie smugi                           |

Efekty nie mogą całkowicie uniemożliwiać poruszania się. HUD i podpowiedzi pozostają czytelne. Muszą istnieć ustawienia ograniczenia ruchu kamery i wyłączenia błysków.

## 10. Tryb online

### 10.1. Model sesji

- Jedna sesja/pokój obsługuje maksymalnie osiem osób, bo istnieje osiem unikalnych postaci.
- Serwer jest źródłem prawdy dla dostępności postaci.
- Stan pokoju obejmuje połączenia, rezerwacje postaci, wybrane postacie oraz podstawowy stan graczy.
- Stan trwa w pamięci serwera; baza danych nie jest potrzebna do pierwszej wersji, jeśli nie zapisujemy postępów.
- Połączenie klient–serwer korzysta z Socket.IO/WebSocket.
- Serwer przesyła pozycję, obrót, prędkość, aktywną animację oraz zdarzenia interakcji.
- Ruch graczy zdalnych jest interpolowany, aby nie skakał pomiędzy pakietami.
- Po zerwaniu połączenia rezerwacja zostaje zwolniona po krótkim czasie ochronnym na reconnect.

### 10.2. Rezerwacja postaci

Wymagana jest atomowa operacja serwerowa:

```text
selectCharacter(characterId) -> success | alreadyTaken | invalid
```

Przepływ:

1. Klient pobiera aktualną listę.
2. Użytkownik ogląda preview.
3. Klient wysyła żądanie wyboru.
4. Serwer sprawdza i rezerwuje postać w jednej operacji.
5. Serwer informuje wszystkich o zmianie listy.
6. Serwer usuwa odpowiadającego NPC.
7. Po zwolnieniu postaci serwer przywraca dostępność, a klient-host świata tworzy NPC ponownie.

### 10.3. Czat głosowy

Domyślnym rozwiązaniem jest przestrzenny czat głosowy WebRTC:

- po zatwierdzeniu postaci aplikacja prosi o dostęp do mikrofonu;
- ze względu na zasady przeglądarek mikrofon nie może zostać uruchomiony bez zgody i akcji użytkownika;
- odmowa nie blokuje wejścia do gry; gracz pojawia się z wyłączonym mikrofonem;
- każdy ma przycisk wyciszenia i czytelny wskaźnik stanu mikrofonu;
- głos jest pełny w bliskiej odległości, następnie stopniowo cichnie i przy 50 m staje się niesłyszalny;
- dźwięk jest opcjonalnie panoramowany zgodnie z kierunkiem źródła;
- ponieważ obóz jest mały, zasięg 50 m często będzie obejmował większość mapy, ale nadal zachowa właściwe różnice głośności;
- serwer Socket.IO służy tylko do sygnalizacji WebRTC i wymiany pozycji, nie do przesyłania surowego audio;
- dla maksymalnie ośmiu graczy połączenia P2P mesh są wystarczające;
- produkcja przez internet wymaga HTTPS/WSS oraz konfiguracji STUN i TURN;
- audio nie jest nagrywane ani przechowywane.

Tryb globalnego głosu może istnieć jako opcja developerska, ale nie jest trybem domyślnym.

## 11. Interfejs

Ekrany i warstwy:

1. ekran startowy/dołączenie do pokoju;
2. wybór postaci z dostępnością w czasie rzeczywistym;
3. zintegrowany preview postaci;
4. ekran prośby o mikrofon;
5. HUD gry: celownik, interakcja, aktywny efekt, czas efektu, stan mikrofonu;
6. preview/inspekcja przedmiotu z opisem;
7. pauza otwierana `Escape`;
8. opcjonalny prosty ekwipunek pod `Tab`;
9. panel developerski efektów i AI dostępny tylko w development.

Wszystkie klawisze istotne w danym stanie muszą mieć podpowiedź. Klawisz `Escape` nie może jednocześnie wykonać kilku sprzecznych operacji; priorytet to: zamknij preview/inspekcję, potem zamknij pozostały modal, dopiero później otwórz pauzę.

## 12. Docelowa architektura

Wcześniejsze założenie „bez backendu” zostaje zastąpione, ponieważ multiplayer, rezerwacja postaci i głos wymagają serwera. Nadal obowiązuje KISS: nie dodajemy Reacta, ECS ani pełnego silnika fizycznego.

### 12.1. Stos

Klient:

- Vite;
- TypeScript;
- Three.js;
- GLTFLoader;
- EffectComposer, RenderPass, UnrealBloomPass i własny ShaderPass;
- CSS/HTML dla UI;
- Socket.IO Client;
- WebRTC/Web Audio API.

Serwer:

- Node.js;
- TypeScript;
- Socket.IO;
- prosty stan pokojów w pamięci;
- sygnalizacja WebRTC.

### 12.2. Proponowane moduły

```text
src/
  app/
    bootstrap.ts
    Game.ts
    GameStateMachine.ts
  core/
    AssetRegistry.ts
    EventBus.ts
    gameLoop.ts
  config/
    campLayout.ts
    characters.ts
    interactables.ts
    substanceEffects.ts
  scene/
    CampScene.ts
    Environment.ts
    Lighting.ts
  entities/
    LocalPlayer.ts
    RemotePlayer.ts
    NpcCharacter.ts
    Interactable.ts
  systems/
    InputSystem.ts
    MovementSystem.ts
    CollisionSystem.ts
    AnimationSystem.ts
    NpcNavigationController.ts
    InteractionSystem.ts
    CinematicCameraController.ts
    SubstanceEffectManager.ts
    PostProcessingSystem.ts
  network/
    NetworkClient.ts
    RemotePlayerInterpolator.ts
    VoiceChatManager.ts
  ui/
    CharacterSelect.ts
    ModelPreview.ts
    InspectionOverlay.ts
    Hud.ts
    PauseMenu.ts
  shaders/
    SubstanceShader.ts

server/
  src/
    index.ts
    RoomManager.ts
    CharacterReservationService.ts
    PlayerStateService.ts
    WebRtcSignalingService.ts

shared/
  protocol.ts
  types.ts
```

To jest podział odpowiedzialności, a nie nakaz tworzenia klasy dla każdego drobiazgu. Jeżeli dwa małe moduły nie mają niezależnego celu, można je połączyć. Nie wolno natomiast pozostawić całej gry w jednym pliku.

### 12.3. Porządkowanie istniejącego kodu

1. Najpierw wykonać audyt obecnych plików, zależności i przepływu uruchomienia.
2. Zabezpieczyć działającą wersję testami podstawowych funkcji.
3. Oddzielić dane konfiguracyjne od logiki.
4. Utworzyć jeden właścicielski `Game` i jedną pętlę `requestAnimationFrame`.
5. Usunąć duplikaty rendererów, listenerów i timerów.
6. Oddzielić stan UI od stanu sceny, ale połączyć je jasno zdefiniowanymi zdarzeniami.
7. Wydzielić kolizje, animacje, AI, interakcje, postprocessing i sieć.
8. Dopiero po stabilizacji klienta dodać serwer i zdalnych graczy.
9. Refaktoryzować etapami; po każdym etapie uruchamiać testy i build.

## 13. Kolejność implementacji

### Etap 1 — fundament klienta

- audyt i uporządkowanie architektury;
- jedna pętla gry;
- AssetRegistry;
- poprawny ruch zależny od kierunku;
- kolizje i granica mapy;
- poprawne materiały, kolory i oświetlenie.

### Etap 2 — obóz

- wdrożenie `campLayout.ts`;
- duży Mad Dog;
- wysoki maszt i flaga na środku;
- toi-toi w rogu;
- ponumerowane namioty i wąskie ścieżki;
- brak kolizji na linkach.

### Etap 3 — postacie i NPC

- walidacja ośmiu GLB;
- wspólne animacje;
- ruch NPC po całym polu;
- unikanie przeszkód i powrót biegiem od granicy.

### Etap 4 — interakcje

- podpowiedzi `E` i `Esc`;
- wspólny `ModelPreview`;
- obracanie modeli i opisy;
- sekwencje kamerowe i animacje użycia.

### Etap 5 — efekty

- centralny system efektów;
- osobne efekty wszystkich substancji;
- HUD, anulowanie i ustawienia ograniczenia ruchu/błysków.

### Etap 6 — multiplayer

- serwer pokojów;
- wybór i rezerwacja postaci;
- zdalni gracze i interpolacja;
- usuwanie/odtwarzanie NPC;
- synchronizacja animacji.

### Etap 7 — głos i publikacja

- WebRTC, mikrofon, mute, dystans 50 m;
- STUN/TURN i HTTPS/WSS;
- testy wielu przeglądarek;
- optymalizacja i deployment.

## 14. Definition of Done — kiedy projekt jest skończony

Projekt można uznać za skończony dopiero wtedy, gdy wszystkie poniższe warunki są spełnione.

### A. Uruchomienie i stabilność

- [ ] Produkcyjny build uruchamia się bez ręcznych poprawek.
- [ ] `npm test`, `npm run build` i skonfigurowany lint przechodzą.
- [ ] W konsoli nie ma powtarzających się błędów ani ostrzeżeń wskazujących na wycieki.
- [ ] Istnieje tylko jedna główna pętla renderowania.
- [ ] Wielokrotne wejście/wyjście z preview i efektów nie zwiększa stale liczby listenerów, rendererów ani render targetów.

### B. Mapa obozu

- [ ] Kwadrat trawy wyznacza jednoznaczną granicę gry.
- [ ] Układ odpowiada szkicowi i wszystkie namioty mają ID `T01`–`T15`.
- [ ] Każdemu ID można przypisać model, nazwę i opis w konfiguracji bez zmiany logiki sceny.
- [ ] Mad Dog jest największym obiektem, co najmniej około 8 × 6 m, i można swobodnie wejść pod zadaszenie.
- [ ] Flaga znajduje się wysoko na wysokim maszcie w środku obozu.
- [ ] Toi-toi znajduje się w rogu i ma dostępne wejście.
- [ ] Nie ma nieuzgodnionych stoisk, sceny, baru, grilla, kuchni, ogniska, magazynu ani płotu.
- [ ] Wszystkie wąskie ścieżki pomiędzy namiotami są przechodnie.

### C. Grafika i materiały

- [ ] Wszystkie modele mają jasne, naturalne kolory.
- [ ] Tekstury kolorów są poprawnie oznaczone jako sRGB.
- [ ] Tkaniny, skóra, plastik i metal używają sensownych parametrów PBR.
- [ ] W świetle słonecznym i pod Mad Dog twarze oraz ubrania są czytelne.
- [ ] Nie ma przypadkowo czarnych modeli, przepaleń ani nadmiernego połysku.
- [ ] Cienie nie migoczą i nie odcinają się nienaturalnie.

### D. Sterowanie i kolizje

- [ ] `W`/`ArrowUp` zawsze prowadzi do przodu względem kierunku gracza.
- [ ] Ruch po skosie nie jest szybszy.
- [ ] Gracz nie przechodzi przez namioty, słupy, toi-toi, maszt ani ludzi.
- [ ] Gracz może przejść przez linki i odciągi namiotów.
- [ ] Gracz nie może opuścić kwadratu trawy.
- [ ] Kolizje nie powodują trwałego zakleszczania ani silnego drżenia.

### E. Postacie i animacje

- [ ] Wszystkie osiem postaci ładuje się ze spójną skalą i orientacją.
- [ ] Skinning nie rozrywa ramion, dłoni, bioder ani nóg.
- [ ] `Idle`, `Walk` i `Run` działają i przechodzą płynnie między sobą.
- [ ] Chód obejmuje całe ciało i nie polega wyłącznie na ruszaniu nogami.
- [ ] Każda substancja ma właściwą animację całej postaci.
- [ ] Rekwizyty są poprawnie przypinane i odpinane od dłoni.
- [ ] Inni gracze widzą aktualną animację postaci.

### F. Wybór postaci i NPC

- [ ] Ekran pokazuje aktualną dostępność ośmiu postaci.
- [ ] Każda postać ma obracany preview, nazwę i opis.
- [ ] Preview jest częścią strony, nie nowym oknem.
- [ ] Dwie osoby nie mogą skutecznie zająć tej samej postaci.
- [ ] Po wyborze postaci odpowiadający NPC znika.
- [ ] Po trwałym rozłączeniu gracza slot jest zwalniany i NPC może wrócić.
- [ ] Liczba NPC zawsze odpowiada liczbie niezajętych postaci.

### G. NPC

- [ ] NPC wykorzystują cały obszar kwadratu trawy.
- [ ] Nie wchodzą w namioty, toi-toi, słupy, graczy ani innych NPC.
- [ ] Mogą przechodzić przez linki namiotowe.
- [ ] W pobliżu granicy wracają biegiem do centralnej strefy.
- [ ] Po powrocie przechodzą do zwykłego chodu.
- [ ] Kontroler wykrywa utknięcie i odzyskuje prawidłowy ruch.
- [ ] NPC nie wybierają punktów poza mapą ani wewnątrz colliderów.

### H. Inspekcja i interakcje

- [ ] Przy obiekcie pojawia się właściwa podpowiedź `E`.
- [ ] Preview przedmiotu można obracać.
- [ ] Preview pokazuje nazwę i pełny opis przedmiotu.
- [ ] Jest widoczna podpowiedź `Esc — zamknij`.
- [ ] `Escape` i przycisk zamknięcia poprawnie kończą inspekcję.
- [ ] Po zamknięciu sterowanie i Pointer Lock są prawidłowo przywracane.
- [ ] Podczas preview postać nie chodzi w tle.

### I. Sekwencje użycia i efekty

- [ ] Przed użyciem każdej substancji kamera płynnie odsuwa się i pokazuje całą postać.
- [ ] Kamera filmowa nie przechodzi przez geometrię.
- [ ] Właściwa animacja kończy się przed uruchomieniem pełnego efektu.
- [ ] Piwo, papieros, marihuana, blant, LSD, MDMA, kokaina i grzyby mają odróżnialne zachowanie.
- [ ] Marihuana i blant nie są tym samym efektem o innej nazwie.
- [ ] LSD jest geometryczne/neonowe, a grzyby organiczne i falujące.
- [ ] Efekty mają płynne wejście i wyjście.
- [ ] Po zakończeniu kamera i renderer wracają dokładnie do wartości bazowych.
- [ ] Anulowanie efektu nie pozostawia aktywnych uniformów ani timerów.
- [ ] HUD pozostaje czytelny.

### J. Multiplayer

- [ ] Co najmniej dwa i maksymalnie osiem klientów może wejść do jednego pokoju.
- [ ] Pozycje i obroty zdalnych graczy są płynnie interpolowane.
- [ ] Animacje i zdarzenia interakcji są widoczne dla wszystkich.
- [ ] Rezerwacje są zwalniane po rozłączeniu lub wygaśnięciu reconnectu.
- [ ] Ponowne połączenie nie tworzy duplikatu postaci.
- [ ] Błędne lub nadmiernie częste komunikaty klienta są walidowane i ograniczane przez serwer.

### K. Głos

- [ ] Po wyborze postaci pojawia się prawidłowa prośba o mikrofon.
- [ ] Odmowa dostępu nie blokuje gry.
- [ ] Każdy gracz może się wyciszyć i widzi swój stan mikrofonu.
- [ ] Głos cichnie wraz z odległością i jest niesłyszalny od 50 m.
- [ ] Rozłączenie usuwa strumień audio i połączenia peer-to-peer.
- [ ] Głos działa między różnymi sieciami dzięki STUN/TURN.
- [ ] Produkcja korzysta z HTTPS i WSS.
- [ ] Żaden strumień nie jest nagrywany ani zapisywany.

### L. Wydajność i dostępność

- [ ] Na docelowym komputerze/laptopie gra utrzymuje płynne działanie przy ośmiu postaciach i aktywnym postprocessingu.
- [ ] Docelowo należy dążyć do 60 FPS w 1080p, a spadki nie mogą stale schodzić poniżej około 45 FPS na uzgodnionym urządzeniu testowym.
- [ ] Modele i tekstury są kompresowane tam, gdzie nie obniża to widocznie jakości.
- [ ] Efekty mają preset niskiej jakości.
- [ ] Istnieje `reducedMotion` i możliwość wyłączenia błysków.
- [ ] Zmiana rozmiaru okna nie psuje kamery, composerów ani UI.

### M. Test końcowy

Projekt jest zakończony dopiero po przeprowadzeniu pełnej sesji testowej w co najmniej dwóch osobnych przeglądarkach, a najlepiej na dwóch komputerach:

1. Obie osoby dołączają do tego samego pokoju.
2. Próbują jednocześnie wybrać tę samą postać — tylko jedna wygrywa.
3. Drugi gracz wybiera inną postać.
4. Odpowiednie NPC znikają.
5. Gracze słyszą się blisko i przestają słyszeć po przekroczeniu zasięgu.
6. Obie osoby chodzą przez wąskie ścieżki i nie przenikają przez namioty ani siebie.
7. NPC nie opuszczają pola i wracają biegiem od granicy.
8. Każdy typ przedmiotu można obejrzeć, obrócić, przeczytać opis i zamknąć `Escape`.
9. Każda substancja uruchamia animację całej postaci, prawidłowy ruch kamery i odrębny efekt.
10. Po zakończeniu efektów sterowanie, kamera, kolory i UI wracają do normy.
11. Jeden gracz rozłącza się; jego postać zostaje zwolniona, a NPC wraca bez duplikatu.
12. Test trwa co najmniej 20–30 minut bez narastających problemów z pamięcią, dźwiękiem lub wydajnością.

## 15. Dane wymagające późniejszego uzupełnienia przez właściciela projektu

Poniższe informacje nie powinny być zgadywane przez Codex:

- przypisanie konkretnych modeli namiotów do `T01`–`T15`;
- prawdziwe nazwy/właściciele poszczególnych namiotów;
- dokładne opisy wszystkich przedmiotów pokazywane w inspekcji;
- dokładne położenia po porównaniu cyfrowej mapy z rzeczywistymi zdjęciami;
- ewentualny stół zaznaczony niejednoznacznie na szkicu — nie należy go dodawać, dopóki nie zostanie potwierdzony;
- finalna długość działania poszczególnych efektów;
- docelowy adres serwera i konfiguracja TURN.

Do czasu uzupełnienia tych danych należy korzystać z identyfikatorów roboczych i placeholderów opisowych, ale nie z przypadkowych namiotów ani nowych elementów środowiska.

## 16. Rozszerzony kierunek artystyczny i atmosfera

### 16.1. Wrażenie miejsca

Obóz ma wyglądać jak mała, zamieszkała wyspa w środku festiwalowego pola:
barwny, lekko chaotyczny i przyjazny, ale nie sterylny. Czytelność wygrywa z
fotorealizmem. Z daleka gracz powinien natychmiast rozpoznać trzy dominanty:
wysoki maszt z flagą, ciemne zadaszenie Mad Dog oraz grupę różnych namiotów.

- Sylwetki obiektów mają być rozróżnialne już z odległości kilkudziesięciu metrów.
- Kolorystyka tkanin jest żywa, ale zgaszona słońcem: oliwki, granaty, czerwienie,
  beże i turkusowe akcenty; nie należy zalewać świata jednolitą zielenią.
- Na pierwszym planie postać, trawa i przedmiot interakcji muszą być wyraźniejsze
  niż dalekie tło. Nie dodajemy mgły tak gęstej, by ukrywała obóz.
- Horyzont fotograficzny pełni rolę dalekiego tła, nie może mieć własnej kolizji
  ani konkurować z obozem. Powinien łączyć się z kolorem nieba bez widocznej
  „kopuły” lub ostrej krawędzi.

### 16.2. Trawa i teren — aksamitny, ale wydajny

Trawa ma sprawiać wrażenie bardzo gęstej, krótkiej i miękkiej — jak warstwa,
w której „pływa” kamera — bez prześwitów brązowej ziemi i losowych plam zieleni.
Nie oznacza to milionów osobnych obiektów JavaScript.

- Źdźbła są instancjami GPU, a nie osobnymi meshami; gęstość, długość, kolor,
  wiatr i zasięg są parametrami jakości.
- Bazowo trawa pokrywa cały kwadrat gry, a jej część bliska kamerze otrzymuje
  największą gęstość i najwyższą jakość. Dalsze pierścienie stosują LOD oraz
  rzadsze instancje, zachowując ciągłość bez nagłego końca pola.
- Teren ma mieć niewielkie, łagodne falowanie. Różnice wysokości nie mogą
  zasłaniać namiotów, tworzyć nienaturalnych skarp ani psuć kolizji.
- Materiał ziemi pod trawą musi mieć trawiasty albedo/roughness/normal i być
  kolorystycznie dopasowany do źdźbeł. Widoczna gleba jest dopuszczalna tylko
  w bardzo małych miejscach wydeptanych, zaprojektowanych świadomie.
- Wiatr jest subtelny i spójny dla trawy, flagi oraz lekkich tkanin. Nie może
  wyglądać jak niezależne losowe drganie każdego obiektu.
- Należy udostępnić presety `low`, `medium`, `high` i `ultra`; `ultra` może
  obciążać mocny sprzęt, ale nie może zawieszać menu ani blokować wejścia do gry.

### 16.3. Światło i pora dnia

Wersją bazową jest jasny dzień z miękkim światłem nieba i kierunkowym słońcem.
W dalszym etapie można dodać przełączany wariant „golden hour”, lecz nie jako
osobny świat ani skybox. Każdy wariant musi utrzymać czytelne twarze i kolory
materiałów, zwłaszcza pod zadaszeniem i w preview postaci.

### 16.4. Małe sygnały życia

Po ukończeniu podstawowych funkcji można dodać wyłącznie lekkie, powtarzalne
detale: łagodnie poruszającą się flagę, poruszane wiatrem płachty, pojedyncze
odgłosy obozu i delikatne reakcje NPC na bliskość. Detale nie mogą zmieniać
układu obozu, tworzyć nowych atrakcji ani zwiększać liczby aktywnych draw calli
bez budżetu wydajnościowego.

## 17. Asset pipeline, rig i kontrola jakości

### 17.1. Jedno źródło prawdy dla assetów

```text
public/game-assets/               # tylko pliki serwowane przez aplikację
  characters/<id>/
    preview.glb                   # menu / inspekcja postaci
    npc-animations.glb            # rig + zatwierdzone klipy dla gry
  world/                          # namioty, flaga, toi-toi, teren
  interactables/                  # stół i przedmioty interakcji
  textures/                       # tekstury świata i horyzontu
source-assets/                    # źródła do dalszego przetwarzania
  characters/<id>/t-pose.glb
art/                              # tymczasowe materiały wejściowe, nie runtime
```

`src/game/assets/assetManifest.ts` jest jedynym miejscem, z którego kod pobiera
adresy runtime. Żaden moduł sceny nie może odwoływać się bezpośrednio do `art/`,
`dist/`, katalogów pobierania ani do plików o „domyślnej” nazwie.

### 17.2. Proces dodawania modelu

1. Zarchiwizować plik wejściowy w `art/` i odnotować licencję/źródło.
2. Otworzyć go w Blenderze, potwierdzić skalę, orientację, materiały, UV i pełny
   bounding box.
3. Dla modelu statycznego poprawić materiały i wyeksportować pojedynczy GLB do
   `public/game-assets/world` albo `interactables`.
4. Dla postaci zachować jednocześnie t-pose, model preview i osobną paczkę
   animacji; nie mieszać ich bez jawnej migracji.
5. Dopisać asset do manifestu oraz konfiguracji sceny.
6. Sprawdzić w devtools, że ładowanie nie generuje `404`, czarnego modelu ani
   brakujących tekstur.

### 17.3. Rigowanie i animacje

- Najpierw wybieramy jeden kanoniczny model spoczynkowy danej postaci. To on
  definiuje wygląd, skalę, kierunek przodu i materiał — nie przypadkowy drugi
  eksport o podobnej nazwie.
- Ruch z Mixamo lub innego źródła można przenosić tylko na zgodny rig albo po
  retargetingu. Samo podpięcie kości bez poprawnych wag jest błędem.
- Przed przyjęciem paczki należy odtworzyć każdy klip na modelu w Blenderze i w
  przeglądarce: `Idle`, `Walk`, `Run` oraz przynajmniej jeden klip dodatkowy.
- Walidator assetów ma raportować nazwę klipu, liczbę kości, obecność skina,
  długość klipu, orientację, wysokość stóp i bounding box. Błąd walidacji ma
  zatrzymać użycie assetu, a nie kończyć się czarnym ekranem.
- Wielka kula/wielościan w Blenderze może być niestandardowym kształtem kontrolnym
  kości. Nie jest częścią modelu gry i nie należy jej eksportować jako geometrii.
- Postać `pierścień` wymaga szczególnej ostrożności: paczka animacji ma bazować
  na zatwierdzonym modelu spoczynkowym, a nie na innym, wizualnie niezgodnym
  eksporcie. Dopóki nie przejdzie walidacji, jej animacje pozostają oznaczone
  jako eksperymentalne.

### 17.4. Tekstury i eksporty z Blendera

- GLB jest preferowanym formatem runtime, ponieważ może zawierać siatkę,
  materiały i tekstury w jednym pliku.
- Base Color i Emission są sRGB; normal, roughness, metallic i AO są liniowe.
- Materiał złożony z węzłów proceduralnych należy wypiec do obrazów przed
  eksportem. Każda część modelu musi otrzymać właściwy obraz Base Color, nie
  wspólny pusty placeholder.
- Eksport należy sprawdzić w nowym, pustym pliku Blendera oraz w aplikacji —
  poprawny widok tylko w bieżącym pliku roboczym nie jest wystarczający.
- Paczki dla Mixamo są materiałem pośrednim. Brak kolorów w podglądzie Mixamo
  nie może być traktowany jako dowód, że tekstury runtime są uszkodzone;
  decydują test w Blenderze i rendererze gry.

## 18. Menu startowe i preview postaci

Preview jest częścią jednego responsywnego ekranu startowego, nie popupem ani
drugą stroną. Warstwa WebGL jest przezroczysta i nie może przechwytywać kliknięć.

```css
.start-screen {
  position: relative;
}
.character-preview-layer {
  position: absolute;
  inset: 0;
  z-index: 999;
  pointer-events: none;
  background: transparent;
  overflow: visible;
}
.character-preview-layer canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent !important;
}
```

- Renderer preview używa `alpha: true`, `setClearColor(0x000000, 0)`,
  `setClearAlpha(0)` i `scene.background = null`.
- Na szerokim ekranie model zajmuje wolną część po prawej od menu; gdy jej
  brakuje, przechodzi pod wybór postaci. Nie może zakrywać krytycznych przycisków.
- Po załadowaniu modelu kamera jest dopasowywana do pełnego bounding boxu z
  bezpiecznym marginesem. Ten sam pomiar uruchamia się przy zmianie postaci,
  rozmiaru kontenera i zmianie orientacji ekranu.
- Jeśli model, materiał lub tekstura nie załadują się poprawnie, warstwa preview
  znika, a menu pozostaje widoczne wraz z czytelną informacją diagnostyczną.
  Błąd pojedynczej postaci nigdy nie może zasłonić całej strony czarnym ekranem.
- Komponent usuwa animation frame, `ResizeObserver`, renderer, geometrie,
  materiały i tekstury podczas odmontowania.

## 19. Zachowanie NPC i czytelna nawigacja

NPC mają wyglądać na ludzi przebywających w obozie, a nie na agentów krążących
w małym promieniu wokół spawnu.

- Każdy NPC ma stan `idle`, `walk`, `run-home`, `avoid` albo `social`.
- Punkty celu losowane są na całej dostępnej powierzchni kwadratu trawy, z
  marginesem bezpieczeństwa od granicy oraz od colliderów.
- Tylko część NPC pozostaje bez ruchu w danym momencie; inni wędrują po różnych
  sektorach. Stany są zmieniane asynchronicznie, aby nie ruszali jednocześnie.
- NPC przechodzi do `run-home` wyłącznie po zbliżeniu do granicy pola; celem jest
  wtedy wybrany punkt wewnątrz centralnego obozu, a po dotarciu wraca do `walk`
  lub `idle`.
- Unikanie przeszkód używa uproszczonych colliderów namiotów, toi-toia, masztu,
  stołu, gracza i innych NPC. Linki namiotowe nie blokują ruchu.
- Kontroler mierzy czas bez postępu. Po wykryciu utknięcia wybiera nowy cel lub
  wykonuje ograniczoną korektę, zamiast odbijać się wielokrotnie w tym samym
  miejscu. W development dostępny jest widok celów, colliderów i stanu AI.

## 20. Interakcje, sekwencje i efekty wizualne

### 20.1. Stół i inspekcja

Stół jest stałym punktem interakcji w obozie. Leżą na nim: blant, kokaina,
MDMA, grzyby i LSD. Zasięg interakcji, collider i pozycja przedmiotu są danymi
w konfiguracji, a nie wartościami zaszytymi w modelu.

Inspekcja zawsze pokazuje model w neutralnej „próżni”, wolny obrót, nazwę,
opis oraz podpowiedzi `E — użyj` i `Esc — zamknij`. `Escape` kończy inspekcję,
przywraca wejście i Pointer Lock; podczas inspekcji ruch świata jest wstrzymany.

Gracz rozpoczyna nową sesję z pustym plecakiem. Podczas inspekcji może zużyć
przedmiot od razu albo zabrać go do ekwipunku. Zabrany lub zużyty egzemplarz
znika ze stołu. Ekwipunek przechowuje ilości, pozwala później dodać wiele kopii
i zmniejsza licznik dopiero po skutecznym użyciu. Początkowa liczba egzemplarzy
na stole jest częścią konfiguracji każdego przedmiotu; w MVP wynosi `1`.

Raycast korzysta z osobnej warstwy interakcji oraz ciasnych hitboxów opartych
na wymiarach modeli. Tryb `?debugInteractions=1` pokazuje hitboxy podczas prac
developerskich, ale pozostają one niewidoczne w zwykłej rozgrywce.

| Przedmiot | Tekst inspekcji                                                                                   | Kierunek efektu (stylizowany, nie medyczny)                 |
| --------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Blant     | „blant, ktoś oślinił, ale zioło dobre”                                                            | ciepła miękkość, powolne kołysanie i łagodny bloom          |
| Kokaina   | „wczoraj padało, trochę wilgotne, ale trzepie jak trzeba”                                         | wyostrzenie kontrastu, krótkie przyspieszenie rytmu obrazu  |
| MDMA      | „ktoś kiedyś powiedział, weź najpierw ćwierć, ale tutaj próbują najpierw po jednej”               | nasycenie, pulsujące światło i przyjazne miękkie kolory     |
| Grzyby    | „czas, przestrzeń, jesteśmy wszystkim, jesteśmy niczym, nie chemia, nie proszki, ale hemoglobina” | organiczne falowanie, oddech kolorów i deformacja peryferii |
| LSD       | „jak chcesz zbliżyć się do boga purpury, to weź od razu dwa”                                      | geometryczne, purpurowe wzory i neonowe przesunięcia barw   |

Efekty są wyłącznie fikcyjną stylistyką gry. Każdy ma płynne wejście/wyjście,
czas trwania widoczny na HUD oraz ustawienia intensywności, ograniczenia ruchu,
wyłączenia błysków i natychmiastowego przerwania.

### 20.2. Sekwencja użycia

1. Gracz wybiera przedmiot w inspekcji.
2. Kamera przechodzi do bezpiecznego, krótkiego ujęcia trzecioosobowego.
3. Odtwarzana jest animacja całej postaci i ewentualny rekwizyt w dłoni.
   Obecna biblioteka nie zawiera osobnych klipów konsumpcji, dlatego runtime
   generuje jednorazowy addytywny ruch prawej ręki na kanonicznym rigu Mixamo.
   Jeśli model nie ma wymaganych kości, jawnym fallbackiem jest klip `Idle`.
4. Efekt uruchamia się na markerze animacji; dopiero wtedy przedmiot znika ze
   stołu albo ekwipunku. Przerwanie przed markerem nie zużywa przedmiotu.
5. Kamera wraca do perspektywy pierwszoosobowej, a efekt przejmuje obraz.
6. Po zakończeniu wszystkie parametry postprocessingu, audio i kamery wracają
   do wartości bazowych.

Kamera sekwencji sprawdza kilka kierunków i odległości względem colliderów
świata. Przejście do ujęcia trzecioosobowego i z powrotem jest wygładzane, a
postać jest ukrywana, zanim kamera ponownie znajdzie się wewnątrz modelu.

## 21. Budżet wydajności i odporność aplikacji

- Należy mierzyć FPS, czas klatki, liczbę draw calli, trójkątów i pamięć tekstur
  w panelu developerskim. Optymalizacja opiera się na pomiarach, nie zgadywaniu.
- Limit DPR powinien być rozsądny (np. 1.5–2 zależnie od presetu), aby ekran 4K
  nie tworzył niepotrzebnie kosztownego render targetu.
- Scena ma jeden renderer gry. Preview może posiadać własny renderer tylko w
  obrębie menu i musi go zwolnić po przejściu do gry.
- Ładowanie assetów następuje etapami: najpierw UI i świat bazowy, potem postać,
  trawa wysokiej jakości oraz klipy dodatkowe. Widok nie może pozostać czarny
  podczas czekania na którykolwiek z nich.
- Błąd modelu lub tekstury ma obsługę lokalną: log diagnostyczny, fallback,
  zachowane UI i możliwość wyboru innej postaci. Nie wolno dodawać globalnej
  nakładki, która nie znika po błędzie.
- Przed wydaniem testujemy co najmniej 1280×720, 1920×1080 i szeroki ekran;
  menu, preview, HUD i granice trawy muszą zachować działanie na każdym z nich.

## 22. Plan dalszego rozwoju po stabilnym MVP

Kolejne pomysły wolno realizować dopiero po spełnieniu Definition of Done dla
MVP. Preferowana kolejność:

1. Dopracować obóz: rzeczywiste przypisania namiotów, `wcTron`, duży namiot dla
   `T10` i `T15`, materiały oraz oświetlenie pod Mad Dog.
2. Dokończyć bibliotekę animacji na kanonicznych modelach, ze szczególnym
   testem pierścienia i jego modelu spoczynkowego.
3. Wprowadzić profile jakości trawy, łagodny teren, horyzont i audyt wydajności.
4. Dodać bogatsze, lecz lekkie zachowania NPC: krótkie grupy rozmów, reakcję na
   gracza i różne strefy zainteresowania.
5. Dopiero potem rozwijać multiplayer, głos, dodatkowe interakcje i wariant
   światła „golden hour”.

Każdy nowy pomysł musi wskazać: cel dla gracza, assety, wpływ na wydajność,
kolizje/nawigację, dostępność oraz kryterium odbioru. Dzięki temu dokument
pozostaje planem rozwoju, a nie listą efektownych, lecz niezweryfikowanych funkcji.

## 23. Urządzenia mobilne

Mobilny wariant zachowuje tę samą maszynę stanów i akcje świata co desktop.
Sterowanie podstawowe obejmuje joystick ruchu, gest rozglądania po scenie,
kontekstowy przycisk `UŻYJ` oraz przyciski `MENU` i `EKWIPUNEK`. Pełne wychylenie
joysticka uruchamia bieg. Pointer Lock nie jest wymagany na urządzeniu dotykowym.

Każdy modal musi posiadać widoczny przycisk zamknięcia i nie może wymagać
klawiatury. Dalsze gesty, dostępność, safe area oraz macierz testów są opisane w
[`docs/mobile-controls.md`](mobile-controls.md).
