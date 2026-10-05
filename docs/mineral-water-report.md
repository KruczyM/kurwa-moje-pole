# Woda mineralna — model

Woda była wpisana w itemConfig/inwentarz, ale nie w katalog modelów ani interactiveAssets, więc stół i inspekcja korzystały z bryły zastępczej.

Dodano `interactables/water.glb` (~106 KB): oryginalna butelka PET z niebieską nakrętką, żebrami i etykietą WODA. Utworzona lokalnie w Blenderze na bazie naszego modelu PET Eko, bez dodatkowego logowania, pobierania modeli czy zmian licencji. Rejestr, istniejący cache/loader, podgląd i ekwipunek korzystają z jednego źródła. Model stoi pionowo na stole, wysokość prezentacji 0.38 m; materiał klasyfikowany jako plastik. Mechanika nawodnienia niezmieniona.

Źródło: `blender/mineral-water.blend` (lokalne, ignorowane przez Git). Generator: `scripts/blender/build-mineral-water.py`, uruchomienie przez Blender `--factory-startup --background --python ...`.

16 testów modelu/prezentacji/PBR/ekwipunku/inspekcji PASS; typecheck, lint i build PASS. Chromium: prawdziwe E wskazuje itemId=water, otwiera podgląd rzeczywistego modelu, kliknięcie „Weź do ekwipunku” zwiększa ilość Woda z 2 do 3; brak page errors. Wizualnie sprawdzono podgląd. Raport w `reports/mineral-water/browser-report.json`, zrzut `reports/mineral-water/inspection.png`. Nie wykonano push/merge.
