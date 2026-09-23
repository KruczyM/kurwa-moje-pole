# Lidl Rock Shop — prototyp hali

Referencja: zdjęcie Damiana Kalinowskiego w [oficjalnym artykule o strefach partnerów 2026](https://newsroom.polandrockfestival.pl/466935-festiwal-trwa-w-najlepsze-co-znajdziecie-w-strefach-naszych-partnerow). Obejrzany plik roboczy: `reports/festival-references/lidl_Damian_Kalinowski.jpg`. Przedstawia biały dach, niebieskie pole nad witryną, napis Rock Shop i motywy słoneczników. Starsza zielona elewacja ze zdjęcia użytkownika nie jest tu oznaczana jako wygląd 2026.

## Wykonanie

- Autorska geometria, bez fotografii w teksturach: ramy co 3 m, stężenia, powłoka dachu z lekkim ugięciem, boki, podłoga, przeszklony front, dwa otwory wejściowe, zwinięte osłony, uproszczone regały.
- Przyjęto 24 × 18 m, kalenicę 7 m i okap 3,6 m. To szacunki, nie potwierdzone wymiary rzeczywistego sklepu.
- Litery i słoneczniki jako siatki; logo uproszczone, nie oficjalny plik identyfikacji. Mapy PBR poszycia generowane lokalnie.
- `lidlRockShop.glb`: 621024 B, 14304 trójkąty, 12 meshy i materiałów. Jedna bryła jakościowa bez osobnego LOD; jeden egzemplarz w świecie.
- Istniejący katalog/loader/cache, profil `mixed`, współdzielone geometrie i materiały, istniejące sprzątanie sceny. Bez nowych listenerów/pętli.
- Tymczasowo X=0, Z=-38; nie jest to rekonstrukcja układu lotniska. Podłoga nad najwyższym punktem terenu pod budynkiem; maska trawy obejmuje halę i przedpole.

## Ograniczenia i odbiór

Pełnobryłowy collider: otwory w elewacji są prawdziwą geometrią, ale nie można jeszcze wejść postacią. Nie wdrożono nawigacji po podwyższonej podłodze ani zakupów. Brakuje wyposażenia, tłumu, zabrudzeń, otoczenia oraz dokładnych grafik. Obecny teren może odsłaniać niewielki prześwit pod częścią budynku — wymaga docelowego podłoża/fundamentu przy przeniesieniu na mapę.

Rendery Blender beauty/front/side w `reports/festival-landmarks/` obejrzane. W renderze wykryto i poprawiono zasłanianie liter znaku przez żółty dysk. Testy sprawdzają rozmiar i budżet GLB, PBR, prawdziwe otwory drzwiowe, kolejność warstw znaku, podłogę, maskę, brak kolizji z namiotami, brak mutacji cache i pojedyncze zwalnianie zasobów.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: niedostępny backend przeglądarki. Sprawdzić w grze front, szkło, cienie, styki z ziemią i obejście hali. Pełny zestaw na tym etapie: 361 testów jednostkowych + 23 orkiestratora, 177 assetów, 8 rigów; build i zakresowy ESLint zaliczone.

## Odtworzenie

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/build-rock-shop.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/audit-tents.py -- --root public/game-assets/world/festival --output reports/festival-landmarks --models lidlRockShop --views beauty front side
```
