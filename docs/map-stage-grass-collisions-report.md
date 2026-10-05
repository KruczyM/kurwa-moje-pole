# Mapa, scena, trawa i linki — 2026-10-04

Gałąź `feat/festival-next`; bez push/merge. Zachowano ustawienie modeli użytkownika.

## Mapa i kolizje

Skala mapy jest jednakowa w X i Z, niezależnie od proporcji canvasu oraz powiększenia. Transformacja odwrotna, zoom pod kursorem i przeciąganie korzystają z tej samej projekcji. Dodano podziałkę 50 m. Mapa nie rysuje powtórnie arbitralnie dużych prostokątów landmarków ponad rzeczywistymi footprintami.

Referencja: wygenerowany bez zapisywania sceny rzut ortograficzny z Blendera `reports/festival-blender/top-reference.png`. Podstawy 195 namiotów w aktualnym świecie pochodzą z meshów `Tent_Groundsheet`, a nie granic obejmujących linki i śledzie. Obrócone podstawy są polygonami zarówno na mapie, jak i w spatial grid kolizji; narożniki ich world AABB nie blokują już przejścia. Modele bez groundsheet zachowują konserwatywny stary fallback, zamiast tracić kolizje w całości. Rzeczywistych obiektów na drodze w źródłowym Blenderze nie przesuwano tylko po to, żeby mapa wyglądała inaczej.

## Trawa i scena

`PROCEDURAL_GRASS_ENABLED=false`: nie jest konstruowany generator Grass ani maska GPU, nie ma traw w scenie i nie są aktualizowane. Kod generatora oraz ustawienia jakości pozostają. Teksturowana powierzchnia terenu pozostaje widoczna. Nie są tworzone runtime lasery ani sztuczne stożki świateł sceny; fizyczne oprawy modelu pozostają.

UV logo nad sceną i obu gitarzystów skorygowano do jednakowej liczby pikseli na metr w obu osiach. Obrzeża ekranów zachowują oryginalne współdzielone UV, aby białe otwory i ramki nie rozjechały się z geometrią. Pierwszy wariant cropu wszystkich 12 paneli odrzucono po obejrzeniu screena. Końcowy wariant dotyczy trzech paneli. Zapisano Blender i eksport gry, kopia sprzed korekty w `blender/backups/festival-layout-before-facade-uv.blend`.

Następnie użytkownik dostarczył `Gemini_Generated_Image_jcspxijcspxijcsp.jpg` (3388 × 1216). `scripts/blender/apply-stage-reference.py` kopiuje oryginalne bajty do `source-assets/stages/main_stage_reference_supplied.jpg`, pakuje obraz do Blendera i podmienia istniejące węzły tekstury fasady. Nie tworzy drugiego frontu ani nie zmienia żadnego transformu obiektu. Trzy niezależne banery zostały ponownie skalibrowane do rozdzielczości nowego obrazu (błąd proporcji < 0,00001). Raport: `reports/festival-blender/stage-reference.json`. Kopia przed podmianą: `blender/backups/festival-layout-before-stage-reference.blend`.

Ograniczenie: to nie pełne usunięcie rozciągania całej fasady. Boki i dolny baner nadal korzystają z zarejestrowanego atlasu. Proporcje całego obrazu różnią się od proporcji obecnej geometrii; zachowanie jednocześnie całej grafiki, jej izotropii oraz wszystkich obecnych otworów ekranów wymaga zmiany geometrii frontu albo osobno zaprojektowanych grafik panelowych. Nie zmieniono samowolnie konstrukcji ustawionej przez użytkownika.

Weryfikacja podmiany: gra załadowała teksturę 3388 × 1216, bez błędów JavaScript, eksport obejmuje 6328 placementów. Dodatkowy `stage-front.png` ujawnił, że isotropowy crop na górnym banerze ucina części logo. **Ocena wizualna całej fasady: NIEZALICZONA**, mimo poprawnego ładowania nowej tekstury i zaliczonych testów numerycznych. To pozostaje zadaniem do dalszej przebudowy UV/geometrii, nie wymaga kolejnego zdjęcia użytkownika. Raport przeglądarki nie jest dowodem ukończenia dopasowania grafiki.

## Weryfikacja

25 testów w FestivalMap, tentFootprint, AuthoredFestivalWorld, ColliderSpatialGrid — PASS; typecheck, lint wskazanych plików oraz build — PASS (istniejące ostrzeżenie rozmiaru bundla).

Przeglądarka w rzeczywistej grze: brak generatora trawy, brak stage effects, 195 polygonów kolizji namiotów, identyczna skala obu osi (1,5984814164 px/m przy badanym canvasie). Artefakty `reports/festival-blender/refreshed-stage/browser-report.json`, `map.png`, `stage.png`. Referencja Blendera obejrzana. Testy polygonów sprawdzają przejście poza podstawą obróconego namiotu i brak blokady od linki daleko od płótna. To nie pełny ręczny walkthrough każdego namiotu.

Trawa: pojedyncze trójkąty mogą uprościć geometrię, ale duża liczba na całej mapie nadal zużywa pamięć i czas GPU. Późniejszy wariant do benchmarku: sektory, instancing, culling i LOD; porównywać tę samą kamerę, liczbę NPC, sprzęt i ustawienia. Instancing zmniejsza liczbę draw calls, nie eliminuje kosztu pikseli/ilości widocznej geometrii: https://threejs.org/docs/pages/InstancedMesh.html.
