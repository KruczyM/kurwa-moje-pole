# Flagi generycznych obozów — 2026-10-04

Gałąź: `feat/festival-next`. Bez commitowania, pushowania i merge.

Zastosowano wszystkie 40 wzorów z dziesięciu plików użytkownika. Oryginalne atlasy skopiowano do `public/game-assets/textures/camp-flags/`; UV wybierają pojedyncze wzory bez białych przerw i bez przerysowania obrazów. Dziesięć współdzielonych materiałów, dwustronne płótna o proporcjach około 3,1:1.

W 12 generycznych obozach jest po 3–4 flagi. Maszty mają 15,088 m, czyli 92% zmierzonej wysokości głównej flagi (16,4 m). Główna flaga i pozostałe obiekty zachowały dotychczasowe transformacje. Dodatkowe maszty ustawiono w wolnych punktach działek, poza obrysami istniejących modeli. Kolizje dotyczą tylko masztów, nie płótna ani trawy.

Zapisano `blender/festival-layout.blend` i wyeksportowano aktualny `public/game-assets/world/festival/authored-festival.glb`. Kopia sprzed operacji: `blender/backups/festival-layout-before-photo-flags.blend`. Jeśli Blender miał już otwarty ten plik, należy ponownie go otworzyć, aby nie nadpisać zmian starszym stanem z pamięci.

## Weryfikacja

- `scripts/blender/verify-camp-flags.py`: 40 unikalnych indeksów, 12 obozów, wysokości i osadzenie masztów na ziemi, granice UV, SHA-256 oryginalnych atlasów, zachowanie pozostałych transformacji — PASS.
- `npx vitest run src/game/world/AuthoredFestivalWorld.test.ts`: 6 testów PASS, w tym kolizje masztów bez wycinania trawy.
- `npm run build`: PASS, istniejące ostrzeżenie wielkości bundla.
- `python scripts/verify-camp-flags-browser.py`: Chromium, rzeczywisty renderer gry; 40 teksturowanych dwustronnych flag, brak błędów JavaScript. Raport `reports/festival-blender/flags/browser-report.json`, obejrzany screenshot `reports/festival-blender/flags/camps.png`.
- Pełny starszy `validate-authored-world.mjs` nie przechodzi: brak placementu `mainStage` w bieżącym modelu. Aktualny plik Blender ma inną strukturę sceny/więcej segmentów barierek niż dawny kontrakt walidatora. Nie przebudowywano cudzych zmian sceny w zadaniu dotyczącym flag. Powyższa walidacja flag jest niezależna od tego problemu; nie oznacza pozytywnego audytu całego świata.

## Powtórzenie

Uruchomić Blender 5.2 w tle z `--python scripts/blender/apply-camp-flag-atlases.py`, następnie `node scripts/export-authored-world.mjs`. Skrypt ponownie wykorzystuje istniejące dodatkowe flagi i maszty; nie tworzy kolejnej kopii świata. Wymaga folderu wejściowego użytkownika; grafiki są też spakowane w zapisanym pliku Blender.
