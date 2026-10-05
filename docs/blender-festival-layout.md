# Scena festiwalu w Blenderze i integracja z grą

Plik: `blender/festival-layout.blend`. Podgląd: `blender/festival-overview.png`.

Scena powstała na bazie rozmieszczenia z kodu gry, a następnie została ręcznie
zmieniona. Aktualny plik Blendera jest źródłem scenografii gry; nie jest pomiarem festiwalu
1:1. Zawiera teren 520 × 520 m, drogi i ścieżki, prostokątne obozy, główny
obóz, pasaż handlowy, dwie strefy Red Bull, Lidl, obie sceny, infrastrukturę,
młyn Allegro, wyposażenie obozów i pole słoneczników. NPC, logika interakcji,
efekty cząsteczkowe i trawa generowana shaderem pozostają w grze; nie są
zamieniane na nieruchomą geometrię tego projektu.

## Eksport do gry — 4 października 2026

Po zapisaniu zmian w `blender/festival-layout.blend` uruchom `npm run world:export`.
Powstaje `public/game-assets/world/festival/authored-festival.glb`; eksport nie
nadpisuje projektu Blendera. Inna instalacja Blendera: zmienna `BLENDER_PATH`.
Następnie uruchom `npm run dev` i odśwież grę.

Istniejący `AssetLoader` wczytuje eksport zamiast osobnych modeli scenografii.
`AuthoredFestivalWorld` wiąże kolizje i interakcje z nazwanymi obiektami i ich
aktualnymi wymiarami. Powtarzające się modele są instancjonowane w niewielkich
komórkach, a kompatybilne nieanimowane elementy łączone dla mniejszej liczby
wywołań renderowania. Trawa i jej maska pozostają w Three.js; maska korzysta
z aktualnych obiektów, a nie starych współrzędnych.

NPC, Flanki, przedmioty na stole, puszki i efekty sceniczne nadal działają w
istniejącej pętli gry. Młyn korzysta z istniejącego kontrolera i metadanych
`wheelPart`. Drzwi mogą być animowane tylko jeśli model ma osobne węzły
`ToiToi_Door_N`; obecny `toitoi_row.glb` jest pojedynczą siatką, bez takich drzwi.
Nie należy traktować samego przejścia builda jako potwierdzenia tych animacji.

Raport przeglądarki i obrazy: `reports/festival-blender/runtime/`.
Test przeglądarki: `python scripts/verify-authored-world.py` (lokalny serwer
na porcie 5173, pakiet Playwright i przeglądarka Chromium).

## Historia i edycja sceny

Barierki dużej sceny dodano do kolekcji `MainStage_Barrier_Perimeter`:
Współdzielone instancje istniejącego `crowd_barrier.glb`. Po korekcie użytkownika
tworzą półokrąg wokół widowni od obu boków sceny, z trzema przejściami
kontrolnymi (około 7 m): dwoma bocznymi i środkowym. Ten układ nie jest jeszcze
przeniesiony do kodu gry. Skrypt: `scripts/blender/curve-stage-barriers.py`.
Dodatek nie przesuwa sceny ani innych obiektów użytkownika. Podgląd:
`blender/festival-stage-semicircle.png`; raport zapisu i weryfikacji:
`reports/festival-blender/curved-stage-barriers-report.json`.

### Wyposażenie obozów — 4 października 2026

Kolekcja `Camp_Life` zawiera 12 podkolekcji `Life_*`: krzesła, stoliki,
zadaszenia, skrzynki, wodę, lodówki turystyczne, plecaki, koce i miejsca
odpoczynku; część obozów ma gitarę. Układy są zróżnicowane. Mały pleciony
stolik pochodzi z lokalnego cache BlenderKit i ma potwierdzone `is_free=1`;
pozostałe modele pochodzą z istniejących zasobów projektu lub prostej geometrii.
Nie pobierano płatnych assetów.

Każdy obóz ma roboczą flagę. Siatki `*_Flag` mają UV `FlagPhotoUV`, więc
można później podmienić kolorowe pasy na dostarczone zdjęcia flag.
Nowe podglądy: `blender/festival-camps-overview.png` oraz
`blender/festival-camp-detail.png`. Pierwotny podgląd jest historyczny.

Zachowano ręcznie ustawione pozycje istniejących obiektów. Kopia przed
dodaniem wyposażenia: `blender/backups/festival-layout-before-camp-details-20261004.blend`.
Weryfikacja tej wersji: `scripts/blender/verify-camp-details.py` — porównuje
z kopią użytkownika, nie ze starym snapshotem kodu. Nadal bez migracji do gry.

- Jednostka Blendera to metr. Osie: Three.js `(x,y,z)` → Blender `(x,-z,y)`.
- Kolekcje grupują elementy według zastosowania. `Guides` zawiera granice działek.
- Przesuwaj nazwany obiekt nadrzędny, np. `Market_1`, `mainStage` lub `T20`.
- Potomny obiekt `_Model` jest instancją kolekcji: wiele namiotów współdzieli
  geometrię i materiały. Można zmieniać ich pozycję, obrót i skalę osobno.
- Aby zmienić geometrię pojedynczej kopii, użyj Object → Apply → Make Instances
  Real. Powstaną rzeczywiste obiekty; może zwiększyć to rozmiar projektu.
- Szablony `Asset_*` można znaleźć w Outlinerze w trybie Blender File.
- Kamera `Overview` służy do podglądu całej mapy. Tekstury są spakowane w `.blend`.

## Odtworzenie i walidacja

1. `npx tsx scripts/snapshot-blender-festival.ts`
2. Blender w trybie background: `--python scripts/blender/build-festival-layout.py`.
3. `--python scripts/blender/verify-festival-layout.py` ponownie otwiera zapisany
   plik i sprawdza rozmieszczenie, instancje, skalę oraz spakowane tekstury.

Snapshot i raporty znajdują się w `reports/festival-blender/`.
Builder odmawia zastąpienia istniejącego projektu bez jawnego `-- --replace`.
Po ręcznej edycji zapisz go pod inną nazwą przed ponownym budowaniem.

Pierwotnie projekt był wyłącznie podglądem bez migracji. Obecnie gra korzysta
z eksportu opisanym powyżej. Historyczny builder i snapshot nie odtwarzają
późniejszych ręcznych edycji: nie uruchamiaj buildera z `--replace`, aby ich nie utracić.
Ewentualne nakładanie modeli ustawionych w Blenderze wymaga korekty w tej scenie.
