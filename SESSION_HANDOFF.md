# Techniczne Podsumowanie Projektu (Handoff dla Nowego Modelu AI)

> **Projekt:** Gra 3D w przeglądarce odtwarzająca Festiwal Pol'and'Rock (Lotnisko Czaplinek-Broczyno)  
> **Główna technologia:** TypeScript, Three.js, Vite, Node.js / Colyseus (Multiplayer), Blender Python (`bpy`)  
> **Kontekst przekazania:** Zestawienie stanu prac, decyzji architektonicznych i kolejnych kroków zintegrowane ze wszystkich aktywnych sesji projektowych.

---

## 1. Co do tej pory zrobiliśmy (Przegląd prac z sesji)

### A. Architektura Świata i Układ Terenu (Pol'and'Rock 2026)
* **Obóz centralny (*Kurwa Moje Pole*):** Zdefiniowany w centrum koordynatów (`X: [-18, 18], Z: [-18, 18]`), otoczony strefami namiotowymi sąsiadów (207 w pełni bezkolizyjnych namiotów).
* **Dwie betonowe aleje komunikacyjne:**
  * **Aleja Północna (`NORTH_CONCRETE_LANE`):** `Z: [-40, -30]`, szerokość 10 m, długość 280 m.
  * **Aleja Południowa (`SOUTH_CONCRETE_LANE`):** `Z: [26, 36]`, szerokość 10 m, długość 280 m.
  * Zastosowano fotorealistyczne tekstury płyt betonowych PBR (Concrete019 z ambientCG, CC0).
  * System proceduralnej trawy (`createMarketGrassMask`) automatycznie wycina trawnik pod obiema alejami i stoiskami jarmarkowymi.
* **Kluczowe punkty orientacyjne (Landmarks):**
  * **Strefa Pomorza Zachodniego:** Przeniesiona na lewy (zachodni) skraj północnego pasażu (`X: -122, Z: -44`, rotacja `0`), z kontenerami, tarasem i dedykowanym ogrodzeniem.
  * **Lidl Rock Shop:** Przeniesiony na południowy pasaż (`X: -50, Z: 46`, wejście skierowane na północ).
  * **Scena ASP / Namiot ASP (`smallStage`):** Przeniesiony na południowy pasaż (`X: 52, Z: 63`), z zachowaniem monumentalnych proporcji (zbliżonych do Dużej Sceny).
  * **Infrastruktura sanitarna i woda:** Modele i logika dla Grzybka festiwalowego (`festivalGrzybek.ts`), kranów wielostanowiskowych, kurtyn wodnych, wozów OSP oraz rzędów ToiToi.

### B. Pipeline Postaci, Rigging i Animacje NPC
* **Generowanie i naprawa modeli 3D:**
  * Ponad 80 modeli postaci w `public/game-assets/npc_models/` (generowanych m.in. przez potok Hunyuan3D).
  * Przygotowano dedykowane skrypty naprawcze (`scripts/run_fixed_models.ps1`, `scripts/fix_missing_arms.py`, `scripts/blender/rig-festival-npc.py`).
* **Korekta deformacji siatek w locie (Runtime Weight Repair):**
  * Zaimplementowano algorytmy naprawy wag wierzchołków dla ubrań, brody i ramion (`repairDraftArmSkin.ts`, `refitDraftShoulders.ts`, `repairBeardSkin.ts`), eliminujące zniekształcenia ramion w trakcie animacji.
* **Bank Animacji (`FestivalMotionBank`):**
  * Zunifikowany kontrakt animacji (`animationContract.ts`), zoptymalizowane przejścia (locomotion, idle, gesty festiwalowe, picie piwa, granie na gitarze).
  * Komponent tłumu `FestivalCrowd` sterujący tłumem na alejach.

### C. Mapy i Narzędzia Podglądu
* W folderze `docs/` wygenerowano interaktywne i wektorowe rzuty z góry:
  * `docs/camp-map.html` i `docs/camp-map.svg` — szczegółowy rzut na obóz i strefy sąsiadów.
  * `docs/festival-overview.html` — interaktywny pulpit nawigacyjny mapy festiwalu.
  * `docs/festival-context-map.svg` — mapa makro całego lotniska Czaplinek-Broczyno ze skalą odległości.
  * `docs/game-world-macro-map.svg` — 9 sektorów nawigacyjnych świata gry Three.js.

---

## 2. Kluczowe Decyzje Architektoniczne

1. **Rygorystyczne reguły projektowe (`AGENTS.md`):**
   * Całkowity zakaz bezpośrednich commitów do `main`. Praca wyłącznie w izolowanych gałęziach i worktree.
   * Zakaz używania kluczy API (`OPENAI_API_KEY`, `GEMINI_API_KEY`, itp.) wewnątrz repozytorium.
   * Pojedynczy `requestAnimationFrame`, aktualizacje oparte wyłącznie na `delta time`, czyszczenie geometrii/materiałów Three.js i brak wycieków pamięci.
2. **Izolacja prac w Git Worktree:**
   * Główny katalog repozytorium jest na branchu `feat/issue-24-use-animations`.
   * Prace nad nowym układem festiwalu, alejami betonowymi i scenami toczyły się w worktree `.ai/worktrees/festival-2026-tent-upgrades` (branch `feat/festival-next`).
3. **Podejście do Assetów 3D:**
   * Wszystkie modele trafiają do `public/game-assets/` w zoptymalizowanym formacie glTF/GLB (część pod kontrolą Git LFS).
   * Modele środowiskowe mają automatycznie wypiekane kolizje i maski dla instancjonowanej trawy.

---

## 3. Stan Plików i Gałęzi (Git Status)

* **Główny katalog (`E:/kodowanie/gra` — branch `feat/issue-24-use-animations`):**
  * Zmodyfikowane modele GLB w `public/game-assets/npc_models/` (np. `008_grunge_flannel_rocker.glb`, `050_blue_alien_girl.glb`).
  * Skrypty automatyzacji generacji: `scripts/run_fixed_models.ps1`, `scripts/shutdown_after_gen.ps1`.
  * Nowo utworzone mapy w `docs/` (`camp-map.html`, `festival-overview.html` i pliki `.svg`).
* **Worktree Festiwalu (`.ai/worktrees/festival-2026-tent-upgrades` — branch `feat/festival-next`):**
  * Wdrożone obie aleje betonowe (`festivalLayout.ts`, `festivalMarket.ts`).
  * Nowe pozycje dla Pomorza Zachodniego, Lidla i monumentalnego namiotu ASP.
  * Dodane modele sanitarne: Grzybek, krany, ToiToi, kurtyny wodne (`festivalInfrastructure.ts`, `festivalGrzybek.ts`).
* **Testy i Jakość:**
  * **`npm test`**: Wszystkie **81 plików testowych i 829 testów jednostkowych przechodzi na zielono (100% PASS)**.
  * **`npm run build`**: Przechodzi pomyślnie bez błędów TypeScript/Vite.
  * **Status runtime:** Zgodnie z zasadą 8 `AGENTS.md` oznaczony jako `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

---

## 4. Dokładny Kolejny Krok (Do wykonania przez nowy model)

1. **Weryfikacja wizualna i scalenie alei festiwalowych:**
   * Zweryfikować w przeglądarce ostateczny wygląd obu betonowych alei, strefy Pomorza Zachodniego oraz namiotu ASP z gałęzi `feat/festival-next`.
   * Przygotować scalenie zmian z worktree `festival-2026-tent-upgrades` do głównego nurtu (zgodnie z procedurą PR opisaną w `AGENTS.md`).
2. **Dokończenie generacji brakujących modeli NPC:**
   * Dokończyć generowanie i weryfikację pozostałych uszkodzonych siatek modeli NPC (skrypt `scripts/run_fixed_models.ps1`), upewniając się, że nie posiadają brakujących kończyn ani deformacji ramion.
3. **Integracja interaktywnej mapy (`docs/camp-map.html`):**
   * Sprawdzić, czy koordynaty z nowo wygenerowanych map w `docs/` odpowiadają w 100% finalnym pozycjom w `festivalLayout.ts`.
