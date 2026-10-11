# After — prezentacja sprite’ów i kamera

Pakiet lokalny A-VERTICAL, kontynuacja A-STORY/dialogues. Branch `feat/after-presentation`,
baza `23997c4`. Worktree `.ai/worktrees/after-presentation`.

## Zakres

- `src/games/after/presentation/SpriteAnimator.ts`: atlas 64×64 zgodny z metadanymi
  Gemini, kierunki down/right/up/left, idle i czteroklatkowy chód. Chód 8 klatek/s,
  szybszy ruch 12 klatek/s. Brak osobnego klipu biegu — przyspieszony istniejący chód.
  Obrót nie resetuje kroku, zatrzymanie wraca do idle, pauza zatrzymuje fazę.
- `CameraRig.ts`: kamera w metrach, projekcja do pikseli CSS, płynne śledzenie
  niezależne od FPS, granice mapy i centrowanie małej mapy przy dużym viewport.
  Host dostarcza rozmiar kontenera przez `resize()`; moduł nie tworzy listenera.
- `AfterPresentation.ts`: interpolacja snapshotów 30 Hz, ruch rozpoznawany po
  faktycznym przemieszczeniu, sortowanie po Y stóp z deterministycznym tie-breakerem,
  sprzątanie animatorów nieobecnych slotów i `dispose()` przy wyjściu.
- `AfterPresentation.test.ts`: siedem testów kierunków, pętli, pauzy, metadanych,
  resize, kamery, izolacji stanu oraz interpolacji/sortowania.

Moduły generują instrukcje rysowania. Nie tworzą renderera, RAF, loadera, połączenia
sieciowego ani wejścia. Nie kopiują i nie zmieniają assetów z gałęzi Gemini.
Host powinien użyć `frame` jako prostokąta źródłowego atlasu oraz `screenFeet`
jako pivota przy podeszwach. Skalowanie obrazu i rzeczywisty pivot w przezroczystej
ramce wymagają odbioru grafik. Wielkość i kotwica nie są wyliczane z samego 64×64.

## Weryfikacja i review

- Testy After: 46/46; TypeScript i lint prezentacji: OK.
- Pełna regresja jednostkowa: 1462/1462 w 158 plikach; build i kontrola UTF-8: OK.
- Przegląd sprawdził izolację snapshotów/metadanych, brak nowej pętli i loadera,
  sprzątanie slotów, resize i pauzę, brak zależności od festiwalu 3D w runtime.
- Test ujawnił błąd floating point na granicy pełnej pętli; indeks klatki używa
  małej tolerancji i modulo. Zmiana kierunku zachowuje fazę również na tej granicy.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: to jeszcze nie ekran gry.
Nie wykonano testu wizualnego sprite’ów i nie deklaruje się gotowej minigry ani
pełnego A-VERTICAL. Wspólny GameHost/registry (SHARED-01), połączenie menu,
tilemapa/rysowanie, HUD, dialog panel, wejścia mobilne i zapis nadal czekają na integrację.
Pakiet przygotowuje dane dla jednego hosta, zamiast tworzyć zastępczy drugi silnik.

Status: autorski review wykonany; oczekuje niezależnego review. Bez push/PR/merge.
