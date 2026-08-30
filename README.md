# Kurwa, moje pole!

Przeglądarkowa gra 3D z obozem, NPC, animacjami i interakcjami. Kod używa Three.js oraz Vite.

## Wymagania

- Node.js 20 LTS lub nowszy;
- Git oraz Git LFS.

```powershell
git lfs install
git clone https://github.com/KruczyM/kurwa-moje-pole.git
cd kurwa-moje-pole
git lfs pull
npm install
npm run dev
```

`git lfs pull` jest wymagane: modele `.glb`, tekstury i muzyka są przechowywane przez Git LFS.

## Build produkcyjny

```powershell
npm run build
```

Wynik trafia do `dist/`, które nie jest wersjonowane.

## Struktura

```text
src/
  game/
    assets/               loader i centralny manifest adresów assetów
    audio/ effects/ interactions/ npc/ player/ ui/ world/
  main.ts                 wejście aplikacji
  *.css                   interfejs gry i menu

public/game-assets/       jedyne zasoby serwowane działającej grze
  characters/<id>/
    preview.glb           model menu postaci
    npc-animations.glb    model NPC z animacjami
  world/                  namioty i flaga
  interactables/          stół oraz przedmioty interaktywne
  props/                  pozostałe rekwizyty świata
  textures/               trawa i panorama horyzontu
  audio/                  muzyka gry

source-assets/            wersjonowane źródła techniczne postaci
  characters/<id>/t-pose.glb
                           model ze skórą i kośćmi w pozycji spoczynkowej

docs/                     dokumentacja projektu
art/                      lokalne źródła i archiwum; ignorowane przez Git
```

## Zasady pracy z zasobami

- Do gry dodawaj tylko gotowe pliki runtime w `public/game-assets/`.
- Wszystkie ścieżki klienta definiuj w `src/game/assets/assetManifest.ts`.
- Nazwy techniczne stosuj w ASCII i kebab-case/lowercase, np. `pierscien`, `main.glb`.
- `source-assets/characters/<id>/t-pose.glb` zachowuje model do ponownego rigowania; nie jest ładowany przez grę.
- Pliki robocze (`.blend`, FBX z Mixamo, referencje, stare eksporty) przechowuj w `art/`; nie trafiają do repozytorium.
- Po dodaniu modelu lub tekstury wykonaj `npm run build` przed commitem.

## Git LFS

Reguły Git LFS są w `.gitattributes` i obejmują `.glb`, obrazy oraz `.mp4`. Nowy asset runtime dodaj normalnie:

```powershell
git add public/game-assets/sciezka/do/modelu.glb
git commit -m "Dodaj model"
git push
```

## Celowo pominięte pliki

`art/`, `Hunyuan3D-2GP/`, `TrellisStudio/`, `node_modules/`, cache, build, tokeny i środowiska lokalne nie są częścią repozytorium. Są to materiały źródłowe albo lokalne narzędzia, a nie zależności potrzebne do uruchomienia gry.
