# Kurwa, moje pole!

Przeglądarkowa gra 3D z obozem, postaciami NPC, animacjami, interakcjami oraz efektami wizualnymi. Projekt działa w **Three.js** i jest budowany przez **Vite**.

## Wymagania

- Node.js 20 LTS lub nowszy;
- npm (instalowany razem z Node.js);
- Git;
- Git LFS — wymagany do pobrania modeli, tekstur i muzyki.

Sprawdzenie instalacji:

```powershell
node --version
npm --version
git --version
git lfs version
```

Jeżeli `git lfs` nie jest dostępny, zainstaluj go ze strony [git-lfs.com](https://git-lfs.com/) i wykonaj jednorazowo:

```powershell
git lfs install
```

## Pobranie projektu

```powershell
git clone https://github.com/KruczyM/kurwa-moje-pole.git
cd kurwa-moje-pole
git lfs pull
npm install
```

`git lfs pull` jest istotne: bez niego pliki `.glb`, tekstury oraz muzyka zostaną pobrane jedynie jako małe wskaźniki Git LFS, a gra nie załaduje zasobów 3D.

## Uruchomienie lokalne

```powershell
npm run dev
```

Vite pokaże w konsoli lokalny adres, zwykle `http://localhost:5173/`. Otwórz go w przeglądarce.

## Build produkcyjny

```powershell
npm run build
```

Gotowa wersja trafia do katalogu `dist/` (ten katalog nie jest zapisywany w Git — jest odtwarzany przez build).

## Struktura projektu

```text
src/
  main.ts                 punkt wejścia aplikacji
  style.css               główne style interfejsu
  preview.css             style podglądu postaci w menu
  ui-additions.css        dodatkowe style HUD/interakcji
  game/                   logika gry Three.js
    assetManifest.ts      centralna lista ścieżek modeli i zasobów
    Game.ts               inicjalizacja sceny, świata i pętli gry
    Player.ts             sterowanie postacią gracza
    NPCController.ts      ruch, animacje i unikanie przeszkód przez NPC
    InteractableSystem.ts interakcje z przedmiotami i ekran inspekcji
    CharacterPreview.ts   przezroczysty podgląd postaci w menu

public/assets/
  characters/             modele postaci i ich animacje
  world/                  namioty oraz flaga obozu
  interactables/          stół i przedmioty do interakcji
  accessories/            dodatkowe elementy sceny
  textures/               tekstury trawy i HDR otoczenia
  music/                  muzyka używana przez grę
```

## Modele i animacje

- `public/assets/characters/meshy/` zawiera modele używane przez NPC z zestawami animacji;
- katalogi poszczególnych postaci zawierają modele podglądu/menu i warianty animowane;
- aktywne ścieżki do modeli są zebrane w `src/game/assetManifest.ts`. Przy zmianie modelu należy aktualizować tę listę, zamiast wpisywać ścieżki w wielu plikach.

## Git LFS

Git LFS przechowuje duże pliki binarne. W tym projekcie dotyczy to przede wszystkim:

- modeli `.glb`;
- tekstur `.png`, `.jpg`, `.JPG`;
- muzyki `.mp4`.

Przed wysłaniem zmian z nowym dużym zasobem wykonaj zwykłe:

```powershell
git add public/assets/sciezka/do/pliku.glb
git commit -m "Dodaj model"
git push
```

Reguły LFS są już zapisane w `.gitattributes`; nie trzeba ich dodawać ponownie dla wymienionych rozszerzeń.

## Co celowo nie znajduje się w repozytorium

Repozytorium zawiera wyłącznie to, co jest potrzebne do dalszego tworzenia i uruchamiania gry. Celowo pominięto między innymi:

- `Hunyuan3D-2GP/` i `TrellisStudio/` — lokalne generatory AI oraz ich zależności;
- `node_modules/`, `.venv/`, cache i pliki builda;
- źródłowe pliki Blender, robocze zrzuty, duplikaty modeli i eksporty diagnostyczne;
- stare skrypty testowe i jednorazowe narzędzia pomocnicze;
- sekrety lokalne, np. `token.txt` oraz pliki `.env`.

## Typowy przepływ pracy

1. Pobierz aktualne zmiany: `git pull` oraz `git lfs pull`.
2. Uruchom projekt przez `npm run dev`.
3. Zmieniaj kod w `src/` i zasoby runtime w `public/assets/`.
4. Zweryfikuj build: `npm run build`.
5. Zapisz zmiany: `git add`, `git commit`, `git push`.
