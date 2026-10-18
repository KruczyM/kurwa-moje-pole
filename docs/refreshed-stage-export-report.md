# Odświeżenie świata z Blendera — 2026-10-04

Gałąź `feat/festival-next`. Ponownie wyeksportowano zapisany `blender/festival-layout.blend` istniejącym pipeline do `public/game-assets/world/festival/authored-festival.glb`. Nie zmieniano pliku źródłowego, geometrii ani ustawienia obiektów użytkownika; nie wykonano push ani merge.

Eksport: 6328 placementów, 193774360 bajtów. SHA-256 źródła zgodny z raportem eksportu. Zapisany plik źródłowy ma ten sam hash co eksport po flagach: zmiany sceny i wież były już w tym zapisanym układzie. Jeśli w otwartym Blenderze istnieją jeszcze niezapisane zmiany, trzeba najpierw zapisać plik i ponowić eksport.

`python scripts/verify-refreshed-stage.py`: rzeczywista gra w Chromium, nowa duża scena z kolorową fasadą oraz wieże widoczne na obejrzanym zrzucie `reports/festival-blender/refreshed-stage/stage.png`, brak błędów JavaScript, 205 draw calls. Szczegóły w `reports/festival-blender/refreshed-stage/browser-report.json`. Nazwy elementów wież w aktualnym pliku nie zawierają `delay`; nie zmieniano ich arbitralnie.

To weryfikacja eksportu i renderowania, nie pełny audyt kolizji ani funkcji sceny. Starszy walidator całego świata ma nadal niezgodny z ręcznie zmienioną strukturą wymóg placementu `mainStage` (opisany w raporcie flag).
