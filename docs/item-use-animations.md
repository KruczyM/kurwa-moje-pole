# Animacje używania przedmiotów

Sekwencje uruchamia istniejący `ItemUseSequence` po użyciu przedmiotu ze stołu
lub ekwipunku. Działają na wszystkich ośmiu aktualnych modelach postaci.

- Papieros i joint: podniesienie dłoni, przytrzymanie przy ustach i opuszczenie.
- Kreska: podniesienie rekwizytu oraz pochylenie tułowia i głowy.
- Grzyby, MDMA, LSD: gest do ust; rekwizyt znika po markerze spożycia.
- Piwo: gest picia z modelem puszki, gdy sekwencja zostanie wywołana.

Papieros jest także dostępny na stole: można obejrzeć go, użyć albo zabrać do
plecaka. Piwo pozostaje obsługiwanym efektem ekwipunku; ta zmiana nie dodaje
osobnego źródła piwa w świecie. Zakres obejmuje lokalną sekwencję wybranej
postaci, nie nowe zachowania autonomicznych NPC ani synchronizację użycia w sieci.

## Szkielet i rekwizyty

`rigBones.ts` rozpoznaje oryginalne nazwy `mixamorig:RightHand`, nazwy
oczyszczone przez GLTFLoader (`mixamorigRightHand`) i `userData.name`.
Brak kości nie zastępuje poprawnie załadowanego modelu czerwoną kapsułą.

`itemUseMotion.ts` przygotowuje addytywny klip na pierwszej klatce Idle.
Podczas gestu ta klatka bazowa pozostaje zatrzymana, dzięki czemu Idle nie
przesuwa punktu kontaktu dłoni z twarzą. Ruch uwzględnia długości ramienia,
przedramienia, ograniczone podniesienie barku i powierzchnię twarzy.
Klip odtwarza istniejący mikser, aktualizowany przez główną pętlę gry.
Nie dodano nowych zewnętrznych klipów mocap: lokalna biblioteka 13 animacji
nie zawierała ruchów użycia przedmiotów.

`itemUseProp.ts` wyznacza chwyt z wierzchołków przypisanych do dłoni i palców.
To istotne dla dużych, stylizowanych pięści oraz uproszczonego rigu Pnia.
Skala rekwizytu kompensuje cały łańcuch rodziców, w tym skalę armatury.
Osobne węzły centrowania i obrotu zachowują transformacje oryginalnego GLB.
Kopie geometrii, materiałów i tekstur są zwalniane razem z sekwencją;
zasoby w cache pozostają nietknięte.

## Model papierosa

`public/game-assets/interactables/cigarette.glb` jest lokalnie wygenerowanym
modelem z filtrem, papierem i żarem oraz osadzoną proceduralną teksturą papieru,
bez zewnętrznych tekstur ani zależności.
Generator korzysta z tej samej geometrii co awaryjny rekwizyt runtime:

```powershell
node --import tsx scripts/build-cigarette-prop.mjs
```

Konfiguracja gestów, rozmiarów i momentów spożycia znajduje się w
`itemUseSequenceConfig.ts`; położenie papierosa na stole w
`itemPresentationConfig.ts`.

## Weryfikacja

`itemUseRuntime.test.ts` ładuje rzeczywiste GLB przez GLTFLoader, zastępując
jedynie przeglądarkowe dekodowanie tekstur. Sprawdza osiem postaci i siedem
efektów: zachowanie skinned mesha, widoczność, rozmiar i mocowanie rekwizytu,
ruch dłoni, jednokrotność markera, sprzątanie i nienaruszenie cache.
Dodatkowo kontroluje ciągłość klipu i niezależność od podziału delta time.

Weryfikacja 2026-09-20: `npm test` zakończył się powodzeniem (274 testy
jednostkowe, 23 testy orkiestratora, 172 zasoby i 8 rigów bez błędów).
`npm run build`, ESLint zmienionych plików, kontrola formatowania zmienionych
plików TS/JSON/generatora/dokumentacji i `git diff --check` również przeszły.
Build zgłasza ostrzeżenie o dużym bundlu JavaScript (ponad 500 kB).

Podglądy geometrii po skinningu z rzeczywistego `ItemUseSequence`, wyrenderowane
w Blenderze, są lokalnymi artefaktami w `reports/use-animation-audit/`
(24 klatki: 8 postaci × papieros, kreska, grzyby).
To kontrola klatek kontaktu, nie test gry w przeglądarce.

Status odbioru runtime: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
Wbudowana przeglądarka nie była dostępna w tej sesji.

Do odbioru w grze: sprawdź papierosa, jointa, kreskę i grzyby kolejno na
różnych postaciach, zarówno przez `E` przy stole, jak i po zabraniu do
ekwipunku (`Tab`). Obejrzyj podniesienie, kontakt i opuszczenie ręki;
sprawdź anulowanie przez `Esc` przed i po markerze oraz powrót kamery FPS.
