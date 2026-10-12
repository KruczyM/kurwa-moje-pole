# Bongo Rush — oprawa i zasady

Zmiany: `feat/bongo-gameplay-polish`, worktree `.ai/worktrees/bongo-polish`.
Nie wykonano push ani merge. After i robocze grafiki Chlebaka pozostają nienaruszone.

## Wykonane

- 16 oddzielnych atlasów (15 grywalnych postaci + Kobra) z rzeczywistych klipów Idle/Walk.
- 320 klatek z walidacją marginesów alfa. Stała kamera obejmuje wszystkie animowane pozy i kierunki.
- Butelki Amareny mają czarny pas z nazwą, złotą nakrętkę i etykiety wiśni, brzoskwini lub jabłka.
  Rysunek Canvas powstał według trzech zdjęć użytkownika; zdjęcia nie są assetami gry.
- Zegar oparty wyłącznie o kroki symulacji, minimum 3 minuty, restart bez limitu prób.
- Pomoc „?” dostępna także na telefonie; nie zużywa czasu gry.
- Cztery oryginalne motywy ambientu WebAudio; żadnych zewnętrznych nagrań ani płatnych API.
- Korzenie Kobry w odnogach oraz obowiązkowe odkopanie przed zagadką na poziomach 3/6/9/12.
- Kieszenie patroli otoczone nieprzekopaną ziemią poza trasą odbiorczą: odkrywanie odnogi
  nadal wypuszcza patrol, ale krótkie zatrzymanie na podstawowej trasie nie otwiera go przypadkiem.
- Nowy czerwony patrolowy i satyryczny boss Owsiak: obrazy referencyjne, rzeczywiste teksturowane
  modele 3D oraz cztery wyrenderowane widoki do lekkiej gry 2D.

## Referencje i źródła

[Oficjalny opis Pokojowego Patrolu](https://newsroom.polandrockfestival.pl/201161-pokojowy-patrol-na-najpiekniejszym-festiwalu-swiata)
potwierdza czerwone koszulki wolontariuszy, żółte liderów i czarne łącznościowców.
Blue Patrol jest odrębną profesjonalną ochroną, nie niebieską odmianą wolontariuszy.
Wizerunek czerwonego patrolowego jest stylizowaną inspiracją, nie kopią konkretnego wolontariusza.

Owsiak: [oficjalny presskit WOŚP](https://newsroom.wosp.org.pl/presskits/jurek-owsiak),
zdjęcie referencyjne Łukasza Widziszowskiego. Fotografie z internetu pozostały w lokalnym
ignorowanym `reports/visual-references/`; nie są dystrybuowane jako grafiki gry.
Gra jest nieoficjalną satyrą, nie sugeruje poparcia przedstawionych osób ani organizacji.

## Generowanie

Użyto wbudowanego **imagegen**, nie CLI z kluczem API. Oryginały pozostały w katalogu
`C:/Users/krucz/.codex/generated_images/01a023dd-9678-7e32-b323-c0edaa01a41f/`.
Wybrane kopie: `source-assets/bongo-rush/references/{owsiak,patrol}-front.png`.

Prompty (wspólne wymagania): pełna sylwetka, styl winylowej figurki, przód, duża głowa,
opuszczone ręce oddzielone lekko od tułowia, całe buty i głowa, miękkie światło, bez sceny,
bez dodatkowych postaci, przezroczyste tło, referencja do image-to-3D.

- Owsiak: „Jerzy Owsiak, older Polish man, short grey hair, red rectangular glasses,
  friendly smile, black festival T-shirt with colourful heart, blue jeans, red sneakers;
  unofficial fictional videogame boss, not an endorsement”.
- Patrol: „fictional adult male Pokojowy Patrol volunteer, bright red T-shirt with white
  POKOJOWY PATROL text and peace symbol, red cap, navy shorts, grey sneakers, black lanyard ID”.

`scripts/generate-bongo-models.py` uruchamia lokalny Hunyuan3D-2mini-turbo z profilem 2,
seedem 20261011, 8 krokami i rozdzielczością 256. Flaga `--paint` używa lokalnego Hunyuan3D-2 Paint.
Tryb offline zabrania automatycznego pobierania wag. Skrypt zachowuje istniejące wyniki.
Geometria bazowa i wersja z teksturami znajdują się osobno w `source-assets/bongo-rush/models/`.

```powershell
& E:/kodowanie/gra/Hunyuan3D-2GP/.venv/Scripts/python.exe scripts/generate-bongo-models.py --runtime E:/kodowanie/gra/Hunyuan3D-2GP
& E:/kodowanie/gra/Hunyuan3D-2GP/.venv/Scripts/python.exe scripts/generate-bongo-models.py --runtime E:/kodowanie/gra/Hunyuan3D-2GP --paint
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' -b --factory-startup --threads 8 --python scripts/blender/render-bongo-atlases.py
# Nowi NPC są świadomie osobnym eksportem, bo jeszcze nie mają animacji:
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' -b --factory-startup --threads 8 --python scripts/blender/render-bongo-atlases.py -- owsiak patrol
python scripts/pack-bongo-atlases.py
```

Hunyuan ma własną licencję Tencent i licencje zależności; przed komercyjnym użyciem modeli
sprawdź obowiązujące warunki. Obraz referencyjny nie jest dowodem posiadania praw do znaków
organizacji ani zezwoleniem na sugerowanie jej poparcia.

## Co pozostaje

- Nowe modele Owsiaka i patrolowego są **bez rigu i animacji kończyn**. W grze przemieszczają
  się płynnie istniejącą interpolacją i obracają między czterema widokami, ale nie wykonują Walk.
- Blue Patrol i undercover nadal mają poprzednie rysunki Canvas; nie udajemy, że powstały ich nowe GLB.
- Rigowanie nowych NPC, dopracowanie detali koszulek i dedykowana animacja finału są osobnym etapem.
- Odsłuch muzyki i test ergonomii/FPS na fizycznym iPhonie wymagają człowieka; emulacja ich nie potwierdza.

## Weryfikacja 2026-10-11

- `npm run ci:code`: PASS — kodowanie, format, lint, TypeScript, 6 testów narzędzi i **1599 testów jednostkowych**.
- `npm run build`: PASS. Ostrzeżenie rozmiaru dotyczy istniejącego bundla festiwalu 3D, nie Bongo.
- `node scripts/validate-bongo-art.mjs`: PASS — 18 atlasów, dwa rzeczywiste GLB z osadzonymi teksturami.
- Packer: PASS — **328 klatek**: 320 Idle/Walk i 8 statycznych widoków nowych NPC; żadna nie dotyka brzegu kadru.
- `verify-bongo-polish.py`: PASS Chromium i WebKit/iPhone 13 — 15 wyborów postaci,
  pomoc, zatrzymanie zegara, żywy RAF, wznowienie/fokus, emulowane sterowanie gałką i brak błędów HTTP/JS.
- `verify-bongo-bush.py`: PASS Chromium i WebKit — odkopanie obowiązkowego korzenia,
  wzrost, blokada powrotu, pauza oraz restart. Test korzysta teraz z poziomu 3, nie usuniętego korzenia przy starcie.
- `verify-bongo-puzzles.py --port 5198 --levels 3 6 9 12`: PASS — galeria 12 jaskiń
  i rzeczywiste pełne przejścia czterech końców biomów. Bez teleportacji ani przyspieszania symulacji.
- `verify-bongo-production.py http://127.0.0.1:5199/kurwa-moje-pole/bongo-rush.html`:
  PASS Chromium i WebKit — właściwy zbudowany bundle, pauza bez dryfu obrazu,
  RAF, odzyskiwanie sterowania, responsywność oraz brak diagnostycznego API w produkcji.
- Własny przegląd kodu: skorygowano początkowe zaokrąglanie zegara o dodatkową sekundę,
  nakładanie pomocy na pauzę i niefortunne otwieranie kieszeni patrolu na poziomie 9.
  Testy obejmują również krótkie przystanki przy każdym skręcie na wszystkich 12 trasach.

Raporty i zrzuty pozostają w ignorowanym `reports/bongo-polish/`, `reports/bongo-bush/`,
`reports/bongo-polish-vaults-final/` i `reports/bongo-rush/`. Fizyczny iPhone, odsłuch i
subiektywny balans limitów czasu: **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**.

Nowe narzędzia:

| Plik                                      | Zadanie                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `scripts/generate-bongo-models.py`        | Lokalna geometria i tekstury Hunyuan, offline, bez kluczy API                      |
| `scripts/blender/render-bongo-atlases.py` | Render Idle/Walk oraz osobnych statycznych widoków nowych NPC, poprawne kadrowanie |
| `scripts/pack-bongo-atlases.py`           | Pakowanie PNG i odrzucanie pustych lub przyciętych klatek                          |
| `scripts/validate-bongo-art.mjs`          | Walidacja wymiarów i metadanych atlasów oraz struktury teksturowanych GLB          |
| `scripts/verify-bongo-polish.py`          | Testy przeglądarkowe zegara, pomocy, postaci i wejścia mobilnego                   |
