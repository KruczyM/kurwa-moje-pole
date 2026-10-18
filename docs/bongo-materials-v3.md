# Bongo Rush: materiały biomów i szczegółowi przeciwnicy

## Zakres i integracja

Gałąź: `codex/bongo-materials-npc`, worktree: `.ai/worktrees/bongo-materials-npc`, baza: `2ca6387`.
Zmiany nie modyfikują map, symulacji, sterowania, zapisu postępu ani zasad patroli.
Renderer nadal korzysta z jednej istniejącej pętli RAF i wspólnego cache obrazów.

Każdy biom ma własny atlas 768 × 512 px (6 × 4 komórki po 128 px):

- 0–3: cztery warianty muru;
- 4–7: cztery warianty kopanego gruntu;
- 8–11: cztery akcenty;
- 12–17: dwa trzykomórkowe motywy poziome;
- 18–23: dwa trzykomórkowe motywy pionowe.

Amarena łączy cegłę i miedź; Korzenie — omszały kamień i próchnicę;
Rave — przygaszony grafit, przewody i gruz; Grota — niebiesko-szary kamień oraz lód.
Prompty generatora obrazów zapisano w `bongo-materials-v3-prompts.json`.
Własne źródła są w `source-assets/bongo-rush/materials-v3`, manifesty i gotowe atlasy
w `public/game-assets/2d/bongo-rush/materials-v3`. Stare źródła pozostają nienaruszone.

`TerrainLayout` oblicza dekoracje raz dla świata. Hash współrzędnych i identyfikatora
poziomu jest niezależny od kamery. Motywy mieszczą się w ciągłych ścianach z marginesem,
nie rozcinają się na granicy viewportu. Górne limity: pasma 15% pól ścian,
akcenty 5%, ostrzegawczy akcent żółty 2%. Geometria może obniżyć te udziały.
`TerrainDetails` zachowuje niewielkie prześwity tylko w gruncie. Ich podkład jest
przyciemniony, a mury pozostają nieprzezroczyste. Kolizje nie zależą od grafiki.
LRU Renderer ogranicza cache kafelków do 256; eksmisja i dispose zwalniają backing store canvas.

## NPC i pipeline offline

Czerwony i niebieski patrol oraz Undercover używają osobnych atlasów 1280 × 512 px:
cztery kierunki, po dwie klatki Idle i osiem Walk. Są prerenderami lokalnego modelu 3D,
nie figurkami rysowanymi procedurami canvas. Undercover ma ciemną cywilną kurtkę
bez widocznych oznaczeń patrolu; niebieski patrol ma odrębny kolor i kieszenie kamizelki.
Boss zachowuje istniejący szczegółowy atlas. Obiekt siatkowy nie jest humanoidem i pozostaje siatkowy.

Polecenia odtworzenia (lokalny Blender, Python/Pillow):

```powershell
python scripts/pack-bongo-materials-v3.py
blender -b --factory-startup --threads 6 --python scripts/blender/build-bongo-patrols.py
blender -b --factory-startup --threads 6 --python scripts/blender/render-bongo-atlases.py -- patrol-red-v3 patrol-blue-v3 undercover-v3
python scripts/pack-bongo-atlases.py
python scripts/validate-bongo-patrols.py
```

Nowe rigowane GLB i raporty znajdują się w `source-assets/bongo-rush/models-v3`.
Ważne ograniczenie: Blender bone-heat nie wyliczył wag źródłowej siatki. Pipeline
użył jawnie raportowanych wag geometrycznych (25654 wierzchołki). Rig jest szkicem
automatycznym, nie ręcznie dopracowanym rigiem produkcyjnym. Kontrola klatek potwierdza
pełną sylwetkę i widoczny ruch kończyn; naturalność deformacji wymaga oceny człowieka.

`PatrolAnimator` jest wyłącznie warstwą prezentacji i korzysta z istniejącego
`SpriteAnimator`. Własny stan każdego NPC podtrzymuje fazę chodu przez przerwę
między krokami symulacji (maksymalnie trzy ticki); po zablokowaniu wraca do Idle,
pułapka zatrzymuje chód, a pauza zamraża fazę. Brak atlasu jest błędem ładowania:
menu pokazuje ponowienie, zamiast uruchamiać poziom z uproszczonym ludzikiem.

## Walidacja

- `npm run ci:code`: PASS, 199 plików / 1871 testów jednostkowych oraz testy narzędzi,
  formatowanie, lint, kodowanie i TypeScript.
- `npm run ci:assets`: PASS, w tym 16 rigów istniejących postaci i sektory świata.
- `npm run build`: PASS; istniejące ostrzeżenie o dużym głównym bundle pozostaje.
- `python scripts/validate-bongo-patrols.py`: PASS, 40 klatek na NPC, margines sylwetki,
  jasność, różne stroje i rzeczywiste zmiany ruchu nóg.
- Testy deterministyczne sprawdzają wszystkie 16 map, kompletność pasm, budżety,
  stabilność układu, cache LRU oraz wszystkie osiem klatek chodu przy rzeczywistej
  kadencji symulacji poziomów 2 i 4. Dotychczasowe rozwiązania kampanii nadal przechodzą.
- `scripts/verify-bongo-materials-v3.py`: Chromium i WebKit iPhone 13 PASS;
  cztery biomy, trzy typy NPC, wszystkie osiem kolumn Walk, pauza bez zatrzymania RAF,
  focus, dotyk, cache i retry po błędzie assetu; brak błędów JS/HTTP.
- `scripts/verify-bongo-living.py`: regresja galerii 15 postaci, biomów, dotyku,
  orientacji, reduced motion i prześwitów; osobny przebieg produkcyjny sprawdza
  ścieżki `/kurwa-moje-pole/` bez debug API.
- `scripts/compare-bongo-materials-v3.py`: porównanie bazowego Bongo (`5b794a1`,
  kod Bongo identyczny z `2ca6387`) i aktualnego buildu w tych samych profilach.
  Chromium: średni render poziomu 2: 0.284 → 0.321 ms, poziomu 7:
  0.362 → 0.402 ms; p95 odstępu RAF pozostało 16.7 ms.
  WebKit: poziom 2: 3.303 → 2.484 ms, poziom 7: 3.246 → 3.287 ms;
  p95 odstępu odpowiednio 91 → 63 ms i 70 → 70 ms. Wyniki WebKit są zmienne
  i nie spełniają dowodu 60 FPS; nie interpretujemy ich jako przyspieszenia telefonu.
  Surowe wyniki i zrzuty: `reports/bongo-materials-v3/`; raport regresji:
  `reports/bongo-living/`. Raporty są lokalne, ignorowane przez Git.
- Niezależny read-only review: wykryty P2 restartu chodu naprawiony;
  ponowne review i 24/24 testy celowane PASS, brak dalszych blockerów.

Status: lokalna weryfikacja przeglądarkowa wykonana. Fizyczny iPhone, ostateczna
ocena wyglądu i deformacji NPC: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
WebKit na Windows nie dowodzi 60 FPS na telefonie. Publikację wspólnego PR wykonuje
orkiestrator po integracji; ta gałąź nie wykonuje push, PR ani merge samodzielnie.
