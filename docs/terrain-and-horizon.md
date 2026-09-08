# Teren, podłoże PBR i panorama horyzontu

Dokumentacja techniczna zmian wprowadzonych w ramach Issue #11 dotyczących rzeźby terenu, fakturowanego materiału ziemi PBR oraz cylindrycznej panoramy horyzontu.

## 1. Rzeźba terenu i synchronizacja wysokości

Teren obozu jest generowany proceduralnie przez funkcję `terrainHeight(x, z)` w `src/game/world/CampWorld.ts`:

$$y(x, z) = 0.18 \sin(0.065x) \cos(0.055z) + 0.09 \sin(0.19x + 0.13z)$$

Charakterystyka:

- **Amplituda**: wahania wysokości rzędu $\pm 0.27\text{m}$, tworzące łagodne, naturalne fałdy darni.
- **Maksymalne nachylenie**: poniżej $0.03\text{m}/\text{m}$ ($< 3\%$), co zapobiega powstawaniu skarp, zsuwaniu się obiektów oraz problemom z kolizjami.
- **Wysokość gracza (`PlayerController`)**: kamera gracza w każdej klatce płynnie dopasowuje wysokość oczu do podłoża (`groundY + baseY + bob + shake`) przy użyciu wytłumienia `MathUtils.damp`, eliminując zapadanie się w dolinach lub lewitację na wzniesieniach.
- **Wysokość postaci NPC (`NpcManager`)**: stopy postaci podczas spawnu, marszu, biegu, oczekiwania i powrotu do bazy są bezpośrednio osadzone na powierzchni terenu (`npc.root.position.y = terrainHeight(...)`), zapobiegając przenikaniu siatek z gruntem.
- **Obiekty obozu**: namioty T01–T15, toaleta wcTron, zadaszenie Mad Dog, maszt z flagą i miejsca siedzące są kotwiczone do `terrainHeight(x, z)`.

## 2. Fakturowany materiał ziemi PBR (`createGroundMaterial`)

Zamiast płaskiej, jednolitej geometrii bez tekstur, podłoże obozu wykorzystuje zestaw map PBR z katalogu `public/game-assets/textures/grass/`:

- **Albedo / Base Color** (`color.jpg`): przestrzeń barw `SRGBColorSpace`.
- **Normal Map** (`normal.jpg`): przestrzeń danych `NoColorSpace`, skala `Vector2(0.85, 0.85)`.
- **Roughness Map** (`roughness.jpg`): przestrzeń danych `NoColorSpace`, bazowa chropowatość `0.88`, metaliczność `0.0`.
- **Tiling**: 32 powtórzenia w osiach U i V (`RepeatWrapping`) na płaszczyźnie $117.6\text{m} \times 117.6\text{m}$, dające szczegółowość darni i gleby w skali ~3.6 metra na kafelek.
- **Harmonizacja barwna**: nasycony odcień ciemnej leśnej darni (`color: 0x3d5c22`) idealnie zgrany z korzeniami źdźbeł trawy procedury instancjonowanej, co zapobiega kontrastowym brązowym plamom czy odsłoniętemu błotu pod kępami traw.

## 3. Cylindryczna panorama horyzontu (`HorizonPanorama`)

Usunięto sztuczną kopułę shaderową `Sky` z Three.js, która kolidowała ze skyboxem (`TimeOfDaySkybox`) i tworzyła odciętą krawędź.

Zamiast tego wdrożono klasę `HorizonPanorama` (`src/game/world/HorizonSkybox.ts`):

- **Geometria**: bezdenny cylinder o promieniu $85\text{m}$ i wysokości $34\text{m}$, otaczający pole obozu ($WORLD\_SIZE = 117.6\text{m}$).
- **Tekstura**: panorama 360° `field.jpg` (2048x1024) przedstawiająca odległy pas drzew i łąk.
- **Shader z płynnym wygaszaniem (Alpha Fade)**:
  - **Dół** ($vUv.y \in [0.0, 0.16]$): `smoothstep(0.0, 0.16, vUv.y)` płynnie wyłania linię drzew z odległej darni i traw bez ostrej dolnej krawędzi cylindra.
  - **Góra** ($vUv.y \in [0.68, 0.96]$): `1.0 - smoothstep(0.68, 0.96, vUv.y)` miękko stapia koronę drzew i niebo panoramy z cubemapą skyboxa (`scene.background`).
  - **Środek**: pas drzew pozostaje w 100% ostry, wyrazisty i czytelny.
  - **Integracja z mgłą sceny**: shader implementuje chunk `#include <fog_pars_fragment>` i `#include <fog_fragment>`, co pozwala mgle `scene.fog` (`Fog(0x8da1b5, 45, 120)`) na naturalne budowanie głębi atmosferycznej.
- **Śledzenie kamery**: w metodzie `update()` cylinder przesuwa się w osiach X i Z za kamerą gracza, zachowując stałą odległość pozornego nieskończonego horyzontu.
