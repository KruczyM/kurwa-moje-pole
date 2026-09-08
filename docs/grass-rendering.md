# Renderowanie aksamitnej trawy i LOD

System renderowania trawy w obozie łączy wielopoziomowy model LOD (Level of Detail), dynamiczną nieskończoną siatkę (moving tile wrap) oraz paletę aksamitnej, gęstej darni bez widocznych przerw czy szwów.

## Architektura LOD i podział warstw

Trawa składa się z trzech współpracujących komponentów:

1. **Near Grass (`TutorialTriangleGrass`)**:
   - Ruchomy kafelek wokół kamery gracza o wymiarach $52\text{m} \times 52\text{m}$ ($[-26, 26]$).
   - Generuje od $75\,000$ do $500\,000$ pojedynczych trójkątnych źdźbeł w zależności od presetu jakości.
   - Płynny promień wygaszania (distance fade) od `innerRadius` ($18\text{m}-21\text{m}$) do `outerRadius` ($25.5\text{m}$) przy użyciu `1.0 - smoothstep(uInnerRadius, uOuterRadius, dist)`.
   - Zapewnia brak wyskakiwania źdźbeł (zero popping) na granicach kafelka toroidalnego wrapu oraz idealne przenikanie z podłożem i dalszymi warstwami.

2. **Distant Grass (`DistantTriangleGrass`)**:
   - Statyczna siatka pokrywająca cały obszar obozu ($[-80, 80]$), licząca od $25\,000$ do $120\,000$ źdźbeł.
   - Tworzy tło dla widoku perspektywicznego na wzgórza i horyzont.

3. **GrassLayer (`GrassLayer`)**:
   - Stylizowana proceduralna warstwa źdźbeł instancjonowanych dla podłoża obozu, synchronizowana pod kątem gęstości z wybranym presetem.

4. **Harmonizacja podłoża (`CampWorld`)**:
   - Kolor bazowy gleby został dostrojony do `0x213c14` (ciemna, soczysta darń), ściśle odpowiadając odcieniowi korzeni źdźbeł w shaderze (`vec3(0.018, 0.12, 0.045)`).
   - Eliminuje to efekt "brązowej obwódki" i niepożądane plamy odsłoniętej gleby przy oddalaniu kamery.

## Presety jakości (`GrassQualityPreset`)

Zdefiniowane w `src/game/world/grassQuality.ts`:

| Preset                | Źdźbła bliskie | Źdźbła dalekie | Gęstość warstwy |        Wysokość źdźbła        |           Promień wygaszania            |
| :-------------------- | :------------: | :------------: | :-------------: | :---------------------------: | :-------------------------------------: |
| **Low**               |   $75\,000$    |   $25\,000$    |        4        | $0.13\text{m} - 0.26\text{m}$ | $18.0\text{m} \rightarrow 25.5\text{m}$ |
| **Medium**            |   $160\,000$   |   $50\,000$    |        8        | $0.13\text{m} - 0.27\text{m}$ | $19.0\text{m} \rightarrow 25.5\text{m}$ |
| **High** _(domyślny)_ |   $320\,000$   |   $80\,000$    |       14        | $0.13\text{m} - 0.28\text{m}$ | $20.0\text{m} \rightarrow 25.5\text{m}$ |
| **Ultra**             |   $500\,000$   |   $120\,000$   |       20        | $0.13\text{m} - 0.29\text{m}$ | $21.0\text{m} \rightarrow 25.5\text{m}$ |

Długości źdźbeł zostały skrócone z dawnych $0.5\text{m}-1.2\text{m}$ do naturalnej wysokości trawnikowej ($0.13\text{m}-0.28\text{m}$), dając efekt gęstego, miękkiego kobierca.

## Dynamiczne przełączanie w menu pauzy

Gracz może w każdej chwili zmienić jakość trawy w menu pauzy (`#setting-grass-quality`):

- Wybór jest zapisywany w `localStorage` (`grassQuality`).
- Zmiana buforów geometrii w GPU następuje natychmiastowo w czasie działania gry (`< 10ms`) z automatycznym wywołaniem `oldGeometry.dispose()`, co zapobiega wyciekom pamięci WebGL.
