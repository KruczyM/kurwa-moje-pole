# Animacje festiwalowe — 25.09.2026

## Aktualny status barków — 27.09

Poprzednia korekta samych wag była niewystarczająca. Zastąpiło ją dopasowanie stawów oraz płynna korekta wag w 7 głównych modelach i 50 NPC. Bieżący opis, kopie i ograniczenia: [przegląd rigów barków](shoulder-rig-review.md). Poniższe wpisy z 26.09 są historią prac, nie potwierdzeniem ostatecznej jakości wszystkich modeli.

## Korekta barków Korby i Chlebaka — 26.09

Poprzednia naprawa brody nie dotyczyła wydłużonych barków. Dla Korby i Chlebaka dodano osobny końcowy etap wag: rękaw przechodzi lokalnie od tułowia do ramienia, przedramienia i dłoni, bez wpływu głowy i odległych stawów. Uwzględniono zwisające ozdoby przy nadgarstku. Nie zmieniono długości kości ani źródłowych proporcji siatki. Gruczoł i pozostałe rigi nie są objęte tym etapem; próby na innych automatycznych rigach nie stanowią ich akceptacji.

Zapisano dwa modele przez `npx tsx scripts/repair-character-weights.ts --arms --install`. Kopie sprzed zmiany: `reports/shoulder-weight-repair-20260926/originals`. Weryfikator bajtowy potwierdził zachowanie geometrii, UV, tekstur, szkieletów i klipów. Pełny tryb naprawy również uwzględnia ten etap dla tych dwóch identyfikatorów.

Rendery diagnostyczne: `reports/shoulder-review/grid.png`, `reports/draft-shoulders-review/grid.png`; pokazują rzeczywiste deformacje Three.js, ale bez tekstur. Testy kontrolują lokalne wpływy kości na rękawy w zapisanych assetach i powtarzalność korekty. **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — zwłaszcza pachy, barki i ozdoby wymagają odbioru w ruchu. Nie uznawać wszystkich modeli NPC za naprawione. Po aktualizacji ponownie wczytać stronę, żeby usunąć stare GLB z cache loadera.

## Aktualizacja 26.09: broda podąża za głową

Korekta ośmiu modeli: Gruczoł, Pierścień, Kobra, Antena, Krwiak, Pień, Zawór i Hemoroid. Wybrane przednie fragmenty dolnej twarzy/brody otrzymują 100% wpływu kości Head, po wygładzaniu pozostałych wag. Zachowano hierarchię Neck → Head; korekta nie dodaje animacji ani nie przesuwa kości. Osobne granice dla modeli ograniczają zaznaczenie, żeby nie wiązać z głową koszulki i barków.

Zapis do istniejących modeli gry i menu: `npx tsx scripts/repair-character-weights.ts --beards --install`. Kopie sprzed tej poprawki (już po naprawie ramion) znajdują się w `reports/beard-weight-repair-20260926/originals`. Pełny tryb skryptu również wykonuje korektę brody jako ostatni etap. Nie uruchamiać wygładzania wag po niej bez ponownego wykonania korekty brody.

`node scripts/verify-weight-repair.mjs reports/beard-weight-repair-20260926` potwierdził, że zmieniono tylko JOINTS_0/WEIGHTS_0. Geometria, tekstury, UV, kości i animacje są bajtowo zachowane. Render kontrolny rzeczywistych deformacji Three.js: `reports/beard-skin-review/grid.png` (czerwone zaznaczenie korygowanych obszarów, Idle oraz dodatkowy obrót głowy). Dziewięć nowych testów sprawdza zapisane w GLB wagi, niezmienność pozostałych punktów oraz brak rozciągania wybranych fragmentów przy trzech kombinacjach obrotu głowy i szyi. **706 testów / 77 suit oraz build zaliczone.**

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — sprawdzono render diagnostyczny i geometrię, nie wykonano odbioru ruchu w przeglądarce. Do sprawdzenia: końcówki brody i przejście do szyi podczas chodzenia, gestów i rozglądania się. Zmiana lokalna na `feat/festival-next`, bez push/merge.

## Aktualizacja 26.09: szwy siatek i wybór postaci

### Podgląd menu

Po doprecyzowaniu użytkownika menu pokazuje **nową Klątwę**, nie starszą. Statycznemu `characters/klatwa/preview.glb` dodano rig i Idle/Walk/Run; osobny wynik to `new-preview-animations.glb`. Oryginalny model, starszy `legacy-preview.glb` i dotychczasowy model Klątwy w rozgrywce nie zostały zastąpione nową siatką. Amper zachowuje swój podgląd; pozostałe postacie używają rigowanych modeli z Idle. Pierwszą klatkę Idle nakładamy przed pomiarem kadru i renderowaniem. 16 testów rzeczywistych modeli potwierdza opuszczenie obu dłoni poniżej ramion.

### Korekta wyciąganych ubrań i ramion

Problem nie ograniczał się do UV: automatyczne rigowanie przypisywało fragmenty ubrania do odległych kości, a sąsiadujące wierzchołki miały gwałtownie różne wpływy. Dodano ograniczanie odległych wpływów w przestrzeni bind oraz wygładzanie wag po topologii (bez zmiany położenia wierzchołków i bez sklejania bliskich, niezależnych powierzchni).

`npx tsx scripts/repair-character-weights.ts --install` zapisał poprawione wagi w 108 plikach: 107 postaci i dodatkowy podgląd nowej Klątwy. Kosztowna korekta nie jest wykonywana podczas ładowania gry. Kopie przed korektą i raport są w `reports/skin-weight-repair-20260926/`; ponowne uruchomienie zawsze zaczyna od tych kopii, nie wygładza kolejny raz wyniku. Nie usuwać kopii przed odbiorem.

`node scripts/verify-weight-repair.mjs` potwierdza bajtowo, że poza JOINTS_0/WEIGHTS_0 nie zmieniono plików (siatki, UV, obrazy, kości i klipy są zachowane). Sprawdzono render siatek deformowanych rzeczywistym Three.js dla 24 modeli, z dotychczasowym Idle i Idle z banku; materiały zastąpiono gliną tylko w raporcie. Przykłady: `reports/arm-deformation-before/grid.png` (pierwszy render zapisany przez Blender także pod `C:/reports/arm-deformation-before/grid.png`) i `reports/arm-deformation-final/grid.png`.

Weryfikacja tej iteracji: **697 testów / 76 suit, build i lint zaliczone**. Widoczna poprawa nie jest akceptacją wszystkich rigów; szczególnie fragmenty akcesoriów modeli 002/007 nadal wymagają osobnego obejrzenia i ewentualnej ręcznej korekty. **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — rendery statyczne nie zastępują ruchu i tekstur w grze.

- Przyczyna rozdarć: identyczne pozycje wierzchołków na szwach UV miały różne przypisania kości (m.in. Jęczmień, Szerszeń i modele tłumu). `repairSkinSeams` ujednolica ich cztery znormalizowane wagi przy ładowaniu. Nie zmienia UV, pozycji, trójkątów ani plików źródłowych; nie skleja sąsiednich, różnych powierzchni.
- Test wszystkich 107 rigów sprawdza brak rozchodzenia się zdublowanych wierzchołków podczas animacji. Osobny test chroni UV i niezależne pobliskie powierzchnie.
- Menu, katalog loadera i multiplayer zawierają teraz 16 postaci. Dodano: Ambona, Chlebak, Dziąsło, Hemoroid, Jęczmień, Kobra, Korba, Szerszeń. Po zmianie listy należy zrestartować również serwer dev.
- Walidator rozpoznaje źródła draft-rig oraz wspólny bank animacji. Surowe jednostki geometrii porównuje w obrębie rodziny eksportera; rzeczywiste skalowanie postaci sprawdzają testy runtime.
- Weryfikacja: 680 testów / 74 suity przeszły; walidacja rigów 16/16; build i lint zmienionego kodu przeszły. Weryfikacja wizualna tej poprawki pozostaje `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.

Gałąź: `feat/festival-next`. Bez push/merge.

## Import

- 75 FBX z `public/game-assets/animacje`, w tym 72 pliki ruchu i 3 bazowe modele postaci.
- Wspólny bank: `public/game-assets/animations/festival-motion-bank.glb` (około 10 MB).
- `src/game/animation/festivalMotionManifest.json` wiąże każdy plik z nazwą klipu. Paczki mają pierwszeństwo dla Idle/Walk/Run. Pliki o podobnych nazwach pozostają wariantami; porównanie próbek nie wykazało identycznych kopii.
- `Walking` z głównego folderu działa jako `WalkingVariant`, bez nadpisania pakietowego `Walk`.
- `LieDown` jest roboczym odwróceniem `StandUpFromLaying`, nie osobnym pobranym klipem. Warto później zastąpić go dedykowanym kładzeniem się.

Odtwarzalny import (z katalogu worktree, Blender 5):

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/blender/build-festival-motion-bank.py -- --source public/game-assets/animacje --output public/game-assets/animations/festival-motion-bank.glb --manifest src/game/animation/festivalMotionManifest.json
```

## Działanie

Istniejący AssetLoader wczytuje bank raz. FestivalMotionBank przenosi ruch na istniejące szkielety, bez zmiany siatek i wag. Przemieszczenie po ziemi należy do nawigacji, ruch pionowy pozostaje w animacji. Brak banku pozostawia stare klipy lokomocji.

W menu pauzy: „Gesty i odpoczynek” → klip → „Wykonaj animację”. Potrzebne jest wolne miejsce wokół gracza. E/Escape kończy gest; przy odpoczynku postać najpierw kończy przejście wstawania. Jest to podgląd/akcja w trzeciej osobie, a nie nowa fizyka skoku ani kompletne sterowanie ruchem bocznym. Akcje gracza nie są jeszcze synchronizowane jako gesty w multiplayerze.

NPC losują gesty podczas postoju. Część botów poza pasażem może odpocząć 15–40 s, jeśli wokół nie ma przeszkód, innej postaci ani gracza. Cała sekwencja kładzenia, leżenia i wstawania blokuje nawigację. Większość tłumu nadal chodzi pasażem. Pozy siedzące dostępne są w bibliotece/podglądzie; nie przypisujemy automatycznie animacji krzesłowych do trawy.

## Weryfikacja

- Bank parsowany przez rzeczywisty GLTFLoader; retarget i poprawność klipów sprawdzona na 107 modelach. Próbkowanie geometrii dla chodzenia, biegu, machania, siedzenia, leżenia i wstawania: brak NaN/rozsypania siatek.
- Deterministyczne testy wejścia/odpoczynku/wyjścia oraz blokowania nawigacji.
- Build przeszedł (ostrzeżenie Vite o wielkości bundla).
- Pełny przebieg przed końcowymi dodatkowymi testami: 659 testów przeszło; dwie niezwiązane puste suity `GrzybekWaterAudio.test.ts` i `festivalGrzybek.test.ts` blokowały zielony wynik całości. Nie zmieniano ich w tym zadaniu.
- Obejrzano wybrane statyczne rendery pozy donora. To nie zastępuje sprawdzenia gry.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — przeglądarka aplikacji niedostępna (brak dostępnych przeglądarek). Do sprawdzenia w grze: kontakt stóp/ciała z ziemią przy nietypowych proporcjach, płynność przejść odpoczynku, osadzenie na krześle, wydajność podczas doładowywania tłumu. Nie deklarujemy pełnej akceptacji wizualnej wszystkich wariantów.
