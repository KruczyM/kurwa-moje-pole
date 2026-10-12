# Bongo Rush — grafika v2

Wbudowany generator imagegen przygotował trzy atlasy: materiały, tła i przedmioty.
Prompty: [bongo-art-v2-prompts.json](bongo-art-v2-prompts.json).
Pliki gry: `public/game-assets/2d/bongo-rush/art-v2/`.
Źródłowe atlasy zachowano; poprzednia grafika pozostaje w repozytorium.

- Amarena: duże cegły z miedzianymi klamrami, czerwona glina, piwnica z łukami.
- Korzenie: kamienie z mchem i kwiatami, ziemia z korzeniami, winorośle i światło w tle.
- Rave: metal, nity, pasy ostrzegawcze, fioletowy gruz, przemysłowe podziemia.
- Grota: śnieżne kamienie, kruszony lód, głęboka lodowa jaskinia.
- Przedmioty: trzy butelki owocowe, cztery bonga, liście, cukierki i skała.

Kamera pokazuje mniej kafelków (cel 17 kolumn i 12 rzędów, limit 40–80 px).
Nadal korzysta z istniejącego CameraRig, minimapy, jednego RAF i ImageCache.
Tła prześwitują przez odkryte korytarze. Nie zmieniono fizyki ani układu poziomów.

Walidacja: 233 testy Bongo Rush, typecheck, ESLint i build przeszły.
Atlas przedmiotów ma rzeczywisty kanał alfa; pakowanie sprawdza przezroczystość.
Test przeglądarkowy: `scripts/verify-bongo-art-v2.py` (serwer na porcie 5210).
Do czasu uzyskania raportu: VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN.
Fizyczny telefon i subiektywna czytelność wymagają ogrania.

Podgląd: `npm run dev:client -- --host 0.0.0.0 --port 5210`, następnie `/bongo-rush.html`.
