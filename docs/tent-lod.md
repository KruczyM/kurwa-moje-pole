# Namiot tunelowy i poziomy szczegółowości

## Zakres

Dodano `familyTunnel` jako T19 na pozycji (22, 0, 24). Jasne łuki, beżowy dół, podłoga z wywiniętą krawędzią, wejście ze zwiniętą osłoną, boczne okna PVC, tylne łukowe okno z moskitierą oraz czerwone odciągi Y. Wymiary są autorską interpretacją; to nie skan produktu ani odwzorowanie 1:1. Stary `large` pozostaje bez zmian względem poprzedniej iteracji.

Wszystkie cztery nowe GLB przechowują dwa poziomy geometrii. Stare dziewięć modeli nadal ma jeden poziom.

| Model         | Trójkąty blisko | Trójkąty daleko | Meshe blisko / daleko | Plik z oboma poziomami |
| ------------- | --------------: | --------------: | --------------------: | ---------------------: |
| trekkingDome  |            9937 |            1315 |                 8 / 4 |               453032 B |
| baseShelter   |            3300 |             556 |                 8 / 5 |               201316 B |
| domeVestibule |           12396 |            1602 |                10 / 6 |               552868 B |
| familyTunnel  |           16682 |            2055 |                 9 / 5 |               735008 B |

Oszczędność geometrii w dalekim widoku wynosi około 83–88%. To nie jest pomiar FPS ani liczby wywołań GPU: cienie i dwustronne materiały przezroczyste mogą wymagać dodatkowych przebiegów.

## Integracja

- `Tent_LOD0` i `Tent_LOD1` to oznaczone metadanymi grupy w jednym GLB. Oba poziomy korzystają ze wspólnych materiałów i tekstur.
- `attachTentLod` wywoływane jest przez istniejące `CampWorld.placeTent` wyłącznie na klonie modelu. Nie modyfikuje cache loadera ani starych assetów.
- Standardowy `THREE.LOD` przełącza geometrię w istniejącym rendererze: niski poziom od 28 m, powrót poniżej 24,64 m (histereza 12%). Nie ma nowej pętli ani listenerów.
- Na raz widoczny jest jeden poziom. Zachowano identyczną transformację obiektu i stały collider. Wyłączone poziomy też podlegają wspólnemu sprzątaniu zasobów sceny.
- Skala, podłoga i maska trawy T19 testowane nad rzeczywistą funkcją terenu. T19 ma korektę wysokości 4 cm; stare T01–T18 nie zostały przesunięte.

Bez crossfade. Przejście może być widoczne; wymaga oceny w ruchu w grze. Niskie poziomy nie mają drobnych odciągów, śledzi i części lamówek. Nie wdrożono jeszcze setek namiotów ani instancjonowania.

## Odtworzenie

Z worktree `E:/kodowanie/gra/.ai/worktrees/festival-2026-tent-upgrades`:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/build-festival-tents.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/audit-tents.py -- --root public/game-assets/world/tents/festival --output reports/tent-audit/prototypes
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/audit-tents.py -- --root public/game-assets/world/tents/festival --output reports/tent-audit/lod1 --lod 1
```

Generator przyjmuje `-- --only familyTunnel` do odtworzenia jednego modelu. Audyt domyślnie renderuje tylko poziom 0; `--lod 1` wybiera poziom 1. Oba poziomy naraz w zwykłym zewnętrznym podglądzie GLB mogą się nakładać — nie oznacza to sposobu wyświetlania przez grę.

## Weryfikacja i ograniczenia

Testy w `tentAssets.test.ts`: rzeczywiste GLB, skalowanie i podłogi, brak pokrywania colliderów, UV/PBR, budżety osobnych poziomów, rzeczywiste otwory okienne, histereza, dokładnie jeden widoczny poziom, brak mutacji cache i pojedyncze zwalnianie współdzielonych materiałów.

Rendery wszystkich uproszczonych sylwetek oraz tunelowego z boku/tyłu/wnętrza obejrzane. Rodzinny namiot nadal ma uproszczone fałdy i wyposażenie, a wcześniejszy kopułowy z przedsionkiem wymaga dalszego dopracowania połączenia poszyć.

Próba przeglądarki zgodna ze skillem `browser:control-in-app-browser`: backend `iab` niedostępny, po diagnostyce lista przeglądarek pusta. Nie obchodzono tego innym mechanizmem.
**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**.

Odbiór ręczny: uruchomić `npm run dev` w worktree, obejrzeć T16–T19 z bliska i odchodzić na ponad 28 m, wrócić poniżej 24 m, sprawdzić dzień/noc, cienie, migotanie powierzchni, kolizje i FPS. Otwarte wejścia modeli nie zmieniają pełnobryłowych kolizji namiotów.
