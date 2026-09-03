# Kurwa, moje pole!

Przeglądarkowa gra 3D z festiwalowym obozem, animowanymi NPC, interakcjami i efektami wizualnymi. Projekt używa Three.js, TypeScriptu oraz Vite.

## Uruchomienie

Wymagane są Node.js 20 LTS (lub nowszy), Git i Git LFS.

```powershell
git lfs install
git clone https://github.com/KruczyM/kurwa-moje-pole.git
cd kurwa-moje-pole
git lfs pull
npm install
npm run dev
```

`git lfs pull` jest obowiązkowe. Modele `.glb` i `.fbx`, tekstury, muzyka oraz nagrania `.wav` są przechowywane przez Git LFS. Bez nich gra uruchomi się z brakującymi albo niepoprawnymi obiektami.

## Najważniejsze polecenia

```powershell
npm run dev          # lokalny serwer deweloperski
npm run lint         # statyczna kontrola kodu TypeScript i JavaScript
npm run typecheck    # kontrola typów bez generowania plików
npm run test:unit    # szybkie testy jednostkowe Vitest
npm test             # pełna kontrola lokalna: kodowanie, assety, rigi i testy
npm run build        # kontrola TypeScriptu i build do dist/
npm run check:assets # modele, tekstury, dźwięki i klipy animacji
npm run check:rigs   # zgodność rigów i bibliotek animacji postaci
npm run format       # automatyczne formatowanie własnego kodu
npm run format:check # sprawdzenie formatowania bez zmiany plików
npm run ci:code      # te same bramki kodu, które wykonuje GitHub Actions
npm run ci:assets    # te same bramki assetów, które wykonuje GitHub Actions
```

Katalog `dist/` jest generowany i nie jest wersjonowany. Raporty walidacji trafiają do lokalnego `reports/`.

## Continuous Integration

Workflow `.github/workflows/asset-validation.yml` uruchamia się dla każdego push i pull requestu. Trzy niezależne zadania sprawdzają kod, assety oraz build produkcyjny. Raporty walidacji i gotowy katalog `dist/` są dołączane jako artefakty, dlatego błąd można przypisać do konkretnej bramki bez analizowania jednego długiego logu.

CI używa `npm ci` oraz pliku `package-lock.json`. Po zmianie zależności należy commitować oba pliki: `package.json` i `package-lock.json`.

## Gdzie znajdują się pliki

```text
src/                         kod aplikacji
public/game-assets/          jedyne assety ładowane podczas działania gry
  characters/<id>/
    preview.glb              model pokazywany w menu
    npc-animations.glb       model NPC z klipami Idle, Walk i Run
  interactables/             stół i używki
  world/                     namioty, flaga, toi-toi i rekwizyty obozu
    toilet.glb               docelowy model wcTron ładowany przez manifest
  textures/                  tekstury trawy, horyzontu i nakładek
  audio/                     muzyka i głos postaci
source-assets/characters/    źródła potrzebne do ponownego rigowania
  <id>/t-pose.glb            model ze skórą i kośćmi bez animacji
  <id>/mixamo/               kanoniczne eksporty FBX
scripts/                     lokalne walidatory i narzędzia GLB
docs/                        dokumentacja techniczna i projektowa
art/                         lokalne pliki robocze; katalog ignorowany przez Git
```

## Mapa kodu TypeScript i JavaScript

Projekt używa głównie plików `.ts`; skrypty Node mają rozszerzenie `.mjs`.

| Plik lub katalog                                  | Odpowiedzialność                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/main.ts`                                     | Uruchamia interfejs, podgląd postaci oraz właściwą grę.                 |
| `src/game/Game.ts`                                | Spina scenę, kamerę, sterowanie, stany aplikacji, interakcje i efekty.  |
| `src/game/animation/animationContract.ts`         | Ujednolica nazwy klipów `Idle`, `Walk` i `Run`.                         |
| `src/game/assets/AssetLoader.ts`                  | Ładuje modele GLB i raportuje brakujące pliki.                          |
| `src/game/assets/assetManifest.ts`                | Jest jedynym miejscem definiującym adresy assetów runtime.              |
| `src/game/audio/SpeakerAudio.ts`                  | Steruje muzyką głośnika i bezpieczną modulacją audio używek.            |
| `src/game/audio/VoiceReactionManager.ts`          | Losuje i odtwarza reakcje głosowe zależnie od zdarzeń.                  |
| `src/game/effects/EffectManager.ts`               | Obsługuje fazy używek oraz shader i post-processing obrazu.             |
| `src/game/effects/EffectTimeline.ts`              | Prowadzi niezależny od renderera cykl wejście–aktywność–wygaszanie.     |
| `src/game/effects/MushroomWireframeEffect.ts`     | Czasowo przełącza obiekty na efekt siatki po grzybach.                  |
| `src/game/interactions/InteractionManager.ts`     | Wykrywa obiekt wskazywany przez gracza i zwraca jego akcję.             |
| `src/game/interactions/itemConfig.ts`             | Zawiera nazwy i teksty inspekcji używek.                                |
| `src/game/interactions/itemPresentationConfig.ts` | Zawiera skale i orientacje modeli na stole oraz w inspekcji.            |
| `src/game/interactions/inspectPresentation.ts`    | Centruje modele na osobnej osi obrotu podglądu.                         |
| `src/game/interactions/InspectControls.ts`        | Obsługuje obrót i bezpieczne zbliżenie przedmiotu w inspekcji.          |
| `src/game/interactions/ItemUseSequence.ts`        | Steruje kamerą, postacią, animacją, rekwizytem i markerem użycia.       |
| `src/game/interactions/itemUseSequenceConfig.ts`  | Konfiguruje czasy, rekwizyty i ruch pięciu sekwencji użycia.            |
| `src/game/lifecycle/AppStateMachine.ts`           | Pilnuje przejść między menu, grą, inspekcją i pauzą.                    |
| `src/game/lifecycle/InputBindings.ts`             | Jest jednym źródłem skrótów klawiaturowych i podpowiedzi kontekstowych. |
| `src/game/lifecycle/PointerLockPauseGate.ts`      | Odróżnia wyjście z Pointer Lock od nieudanego przejęcia myszy.          |
| `src/game/lifecycle/AnimationLoop.ts`             | Prowadzi pojedynczą pętlę `requestAnimationFrame`.                      |
| `src/game/lifecycle/EventScope.ts`                | Rejestruje zdarzenia i zbiorczo je usuwa podczas sprzątania.            |
| `src/game/lifecycle/disposeThree.ts`              | Klonuje modele i zwalnia geometrie, materiały i tekstury.               |
| `src/game/npc/NpcAnimator.ts`                     | Odtwarza animacje NPC i zabezpiecza wadliwy ruch kości bioder.          |
| `src/game/npc/NpcManager.ts`                      | Steruje celami, ruchem, bezczynnością, kolizjami i skalą NPC.           |
| `src/game/npc/npcConfig.ts`                       | Definiuje zachowania i parametry ruchu postaci.                         |
| `src/game/player/PlayerController.ts`             | Obsługuje ruch, kamerę pierwszoosobową i Pointer Lock.                  |
| `src/game/ui/CharacterPreview.ts`                 | Renderuje przezroczysty podgląd postaci w menu.                         |
| `src/game/ui/previewLayout.ts`                    | Dopasowuje podgląd tak, aby cały model mieścił się w ekranie.           |
| `src/game/world/CampWorld.ts`                     | Buduje teren, trawę, namioty, stół, używki, kolizje i granice obozu.    |
| `src/game/world/HorizonSkybox.ts`                 | Dodaje panoramę horyzontu.                                              |
| `scripts/check-text-encoding.mjs`                 | Wykrywa uszkodzone UTF-8 i typowe ślady mojibake.                       |
| `scripts/validate-assets.mjs`                     | Sprawdza kompletność i strukturę assetów runtime.                       |
| `scripts/validate-character-rigs.mjs`             | Porównuje rigi, siatki, materiały, tekstury i klipy postaci.            |
| `scripts/strip-glb-animations.mjs`                | Tworzy kopię GLB bez animacji, zachowując model i rig.                  |

Katalog `src/game/world/vendor/three-stylized/` jest wydzielonym kodem bibliotecznym trawy. Nie jest automatycznie formatowany razem z kodem gry.

## Skala i pozycja używek

Wszystkie ustawienia prezentacji są w `src/game/interactions/itemPresentationConfig.ts`. Każdy przedmiot ma sześć wartości:

- `tableSize` — największy wymiar modelu na stole;
- `tableRotation` — obrót modelu na stole w radianach `[X, Y, Z]`;
- `tablePosition` — bezpieczna pozycja `[X, Z]` względem środka obróconego blatu;
- `inspectSize` — największy wymiar modelu w podglądzie;
- `inspectRotation` — naturalna orientacja modelu w podglądzie.
- `inspectOffsetY` — przesunięcie modelu w górę lub w dół w podglądzie.

Przykład zmniejszenia LSD bez wpływu na interakcję lub podgląd:

```ts
lsd: {
  ...lying(0.16, [0.82, -0.18]),
  tableSize: 0.12,
},
```

Obecnie wszystkie używki są obrócone o 90 stopni i leżą na stole. Ich pozycje są liczone lokalnie względem stołu, dlatego pozostają na blacie również po jego obróceniu. Podczas inspekcji używany jest czysty klon modelu z naturalnym obrotem, automatycznym dopasowaniem kamery i regulowanym przesunięciem pionowym. Niewidoczna strefa interakcji ma niezależną skalę i nie kurczy się razem z modelem.

## Efekty używek

`EffectManager` zapisuje stan kamery, bloom, afterimage, uniformów shadera i muzyki przed pierwszym efektem. Joint ma senny afterimage, kokaina szybki puls i szersze FOV, grzyby organiczne falowanie z krótkimi impulsami wireframe, MDMA jasne mieszanie obrazu, a LSD pryzmatyczne przesunięcia z półprzezroczystą nakładką. Zmiana używki zachowuje pierwotny snapshot, natomiast koniec, anulowanie i `dispose()` przywracają go dokładnie.

HUD pokazuje aktualną fazę oraz czas pozostały w tej fazie. Opcja ograniczenia ruchu wyłącza deformacje ruchome, animację nakładki LSD i impulsy wireframe po grzybach.

## Zasady pracy z assetami

- Gotowe pliki runtime dodawaj tylko do `public/game-assets/`.
- Wszystkie ścieżki klienta definiuj w `src/game/assets/assetManifest.ts`.
- Nazwy techniczne zapisuj w ASCII i kebab-case/lowercase, np. `pierscien`.
- Zachowuj `source-assets/characters/<id>/t-pose.glb`, ponieważ ułatwia ponowne rigowanie.
- Pliki robocze `.blend`, próbne eksporty i referencje przechowuj w ignorowanym `art/`.
- Po zmianie modelu wykonaj `npm run check:assets`, `npm test` i `npm run build`.
- Nie commituj przypadkowych lokalnych eksportów ani starych wersji modeli.

Pipeline Mixamo i odbudowę bibliotek opisuje [`docs/character-animation-pipeline.md`](docs/character-animation-pipeline.md). Stany aplikacji, priorytet `Escape`, Pointer Lock i sprzątanie zasobów opisuje [`docs/app-lifecycle.md`](docs/app-lifecycle.md).

Sterowanie dotykowe oraz plan kolejnych interakcji telefonicznych opisuje
[`docs/mobile-controls.md`](docs/mobile-controls.md).

## Git LFS

Reguły są zapisane w `.gitattributes` i obejmują duże modele, źródła FBX, obrazy, filmy oraz nagrania WAV. Asset dodaje się zwykłym `git add`; Git LFS zapisze w repozytorium wskaźnik, a dane binarne wyśle do magazynu LFS.

```powershell
git add public/game-assets/sciezka/do/modelu.glb
git commit -m "Dodaj model"
git push
```

## Celowo pominięte katalogi

`art/`, `Hunyuan3D-2GP/`, `TrellisStudio/`, `node_modules/`, cache, build, tokeny i lokalne środowiska nie są częścią repozytorium. Nie są wymagane do uruchomienia gry.
