# Nawierzchnie i pasaż — 24.09.2026

Aktualny stan zastępuje wcześniejsze opisy betonowej drogi i zastępczego frontu w historii `festival-market.md`.

- Świat 320 × 320 m, płaskie parcele; usunięte brązowe nakładki zasłaniające teksturę gruntu.
- Sześć parceli przeniesione wokół głównego obozu, sześć pozostało na północy. Łącznie 207 namiotów, z zachowanymi przejściami.
- Wszystkie 18 stoisk, Lidl i IQOS przy głównym pasażu; tylko dwa namioty Red Bull. Droga asfaltowa 280 × 10 m.
- Trawa shaderowa uwzględnia mgłę, tone mapping i przestrzeń kolorów; krótsze źdźbła i łagodne zanikanie bliskiej warstwy. Wykluczenia nadal obejmują drogę i obiekty, ale nie zastępują gruntu brązowymi płytami.

## Źródła i licencje

Pobrane materiały PBR 1K: [Asphalt012](https://ambientcg.com/view?id=Asphalt012) i [Grass004](https://ambientcg.com/view?id=Grass004), na licencji [CC0 ambientCG](https://docs.ambientcg.com/license/). Zachowano mapy Color, NormalGL i Roughness w `public/game-assets/textures/asphalt` oraz `ground`. Mapy asfaltu są również osadzone w bibliotece GLB. Tekstura gruntu powtarza się co około 1,4 m.

`source-assets/festival/siemashop-user-photo.jpg` to niezmieniony plik dostarczony przez użytkownika, nie materiał CC0. Prawa do zdjęcia i znaków pozostają przy ich właścicielach; przed publicznym wykorzystaniem należy potwierdzić uprawnienia.

Front SiemaShopu wykorzystuje widoczny fragment oryginalnej fotografii przez UV siatki. Zdjęcie ma perspektywę i ucięty prawy kraniec, więc odwzorowanie proporcji jest przybliżone. Pozostałe szyldy odtworzono z czytelnych nazw, kolorów i układu napisów; nie są to wycięte oryginalne logotypy. Dane i oznaczenie rekonstrukcji: `src/game/world/festivalSigns.json`. Do wierniejszych grafik potrzebne są osobne ostre zdjęcia szyldów.

## Odtworzenie biblioteki

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/blender/build-market-stalls.py -- --siemashop-source-photo source-assets/festival/siemashop-user-photo.jpg
```

Bez argumentu fotografii generator nadal tworzy front zastępczy, nie bieżący asset.

## Odbiór

Zaliczone: `ci:code` (539 testów jednostkowych, 25 testów narzędzi, lint, typy, formatowanie i kodowanie), `ci:assets` (180 assetów oraz 8 rigów), build produkcyjny i 3 testy materiału frontu w Blenderze. Build zgłasza istniejące ostrzeżenie o bundlu ponad 500 kB; brak pomiaru FPS tej iteracji.

Obejrzano render offline frontu SiemaShopu. Nie zastępuje on sprawdzenia shaderów i rozgrywki. Backend przeglądarki `iab` był niedostępny: **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Do sprawdzenia w grze: trawa w dzień/noc, styki asfaltu, dojścia między parcelami, czytelność szyldów oraz FPS.

Praca pozostaje na `feat/festival-2026-tent-upgrades`, bez push, PR i merge. Uruchamiać `npm run dev` z worktree `.ai/worktrees/festival-2026-tent-upgrades`, nie z głównego katalogu zawierającego inną gałąź.
