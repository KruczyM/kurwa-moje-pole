# Faza Matrix i efekt cyfrowego kodu (Matrix Code Phase)

Dokumentacja techniczna fazy Matrix z zielonym cyfrowym deszczem glifów, geometrycznym wireframem obiektów oraz ustawieniami dostępności i wydajności w grze _Kurwa, moje pole!_.

---

## 1. Zakres i cel wdrożenia (Issue #43)

Celem zadania było dodanie opcjonalnej, okresowej fazy wizualnej inspirowanej estetyką cyfrowego kodu:

1. **Osobna warstwa zielonych glifów**: Półprzezroczysty cyfrowy deszcz renderowany wydajnie na dedykowanym canvasie 2D (`#matrix-rain`).
2. **Krótkie fazy zamiast ciągłego zasłaniania świata**: Kod pojawia się falami w trakcie intensywnych stanów narkotycznych (np. LSD, Grzyb, Kreska) z łagodnym wejściem (fadeIn ~1.0 s) i wyjściem (fadeOut ~1.2 s).
3. **Cyfrowa siatka obiektów świata**: W kulminacyjnym momencie fazy obiekty świata 3D (namioty, meble, rekwizyty) otrzymują jaskrawozieloną reprezentację wireframe bez trwałej modyfikacji ich oryginalnych materiałów.
4. **Czytelny HUD i interakcje**: Cały interfejs (`#hud`, reticle, napisy interakcji, modale, menu pauzy) renderowany jest na warstwie o wyższym `z-index`, a deszcz ma zablokowane zdarzenia myszy (`pointer-events: none`).
5. **Zerowe alokacje GC w klatce**: Pre-alokowane tablice kolumn, bufor indeksów glifów w pamięci typowanej (`Uint16Array`), stały alfabet znaków.
6. **Dostępność i Reduced Motion**:
   - Respektowanie `reduceMotion`: zatrzymanie opadania kodu i wygaszenie gwałtownego wireframe.
   - Respektowanie `disableFlashes`: wyłączenie stroboskopowych mutacji glifów w strumieniu.
   - Możliwość wyboru trybu w menu pauzy (`Automatyczna w tripie`, `Zawsze aktywna`, `Wyłączona`) oraz presetu jakości (`Niska`, `Średnia`, `Wysoka`).

---

## 2. Architektura komponentów

```
┌────────────────────────────────────────────────────────────────────────┐
│                                Game.ts                                 │
│  ┌────────────────────────┐  ┌─────────────────────┐  ┌─────────────┐  │
│  │ MatrixPhaseController  │  │  MatrixRainOverlay  │  │   Matrix    │  │
│  │ (sterowanie czasem i   │  │  (canvas 2D z       │  │  Wireframe  │  │
│  │  krzywą alpha fazy)    │  │   prealokacją)      │  │  (Three.js) │  │
│  └───────────┬────────────┘  └──────────┬──────────┘  └──────┬──────┘  │
└──────────────┼──────────────────────────┼────────────────────┼─────────┘
               ▼                          ▼                    ▼
        Krzywa jasności            Canvas #matrix-rain    Siatka 3D sceny
     fadeIn -> active -> fadeOut   z-index: 1 (pod #ui)  (color: #00ff77)
```

### 2.1. `MatrixRainOverlay` (`src/game/effects/MatrixRainOverlay.ts`)

Zarządza dedykowanym elementem `<canvas id="matrix-rain">` umieszczonym pomiędzy canvasem świata 3D (`#game`, z-index 0) a interfejsem gracza (`#ui`, z-index 2):

- **Zestaw glifów**: 64 unikalne znaki (cyfry, heksadecymalne litery, katakana, operatory matematyczne):
  `0123456789ABCDEF:・.*+-<>¦|日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ`.
- **Pre-alokacja struktur kolumn**:
  Każda kolumna przechowuje własną pozycję $x$, pozycję głowy $y$, prędkość opadania, długość ogona oraz `Uint16Array` z indeksami glifów.
  Podczas pętli renderującej nie dochodzi do alokacji obiektów ani tablic w pamięci sterty (GC free).
- **Trzypoziomowe cieniowanie kolumny**:
  - **Czoło**: Najjaśniejszy, biało-zielony glif (`rgba(225, 255, 235, alpha)`).
  - **Góra strumienia**: Intensywna zieleń (`rgba(0, 255, 110, alpha)`).
  - **Ogon strumienia**: Wygasająca ciemna zieleń (`rgba(0, 180, 60, alpha)`).
- **Presety gęstości**:
  - `low`: odstęp 32 px, maksymalnie 45 kolumn.
  - `medium`: odstęp 22 px, maksymalnie 90 kolumn.
  - `high`: odstęp 16 px, maksymalnie 140 kolumn.

### 2.2. `MatrixWireframeEffect` (`src/game/effects/MatrixWireframeEffect.ts`)

Zapewnia efekt przechodzenia fragmentów obozu w reprezentację cyfrową:

- Aktywuje się w szczycie fazy, gdy $\text{alpha} \ge 0.35$ i `reduceMotion === false`.
- Zastępuje materiały siatek obiektów (`THREE.Mesh`) instancjami `THREE.MeshBasicMaterial` z parametrem `wireframe: true`, jaskrawozielonym kolorem `#00ff77` i mieszaniem addytywnym `THREE.AdditiveBlending`.
- Bezwzględnie wyklucza elementy oznaczone `userData.excludeMatrixWireframe` / `userData.excludeMushroomWireframe` (teren obozu, panorama horyzontu) oraz niewidoczne kolizje (`InteractionHitbox_`).
- Po zakończeniu fazy lub wywołaniu `dispose()` w 100% przywraca oryginalne materiały z mapy referencji i zwalnia geometrię materiałów tymczasowych.

### 2.3. `MatrixPhaseController` (`src/game/effects/MatrixPhaseController.ts`)

Koordynuje cykle czasowe bez obciążania logiki innych efektów:

- **Tryb `auto` (domyślny)**:
  Faza pojawia się falami co $\sim 14\,\text{s}$ podczas aktywnego stanu używki.
  - `fadeIn`: $1.0\,\text{s}$ (płynny wzrost alfa od 0 do 1).
  - `active`: $3.2\,\text{s}$ (pełna widoczność).
  - `fadeOut`: $1.2\,\text{s}$ (łagodne wygaszenie).
- **Tryb `always`**:
  Stały, delikatny deszcz o kontrolowanym kontraście ($\text{alpha} = 0.55$, w trybie reduced motion $0.25$).
- **Tryb `off`**:
  Całkowite wyłączenie fazy Matrix ($\text{alpha} = 0$, ukrycie canvasa).

---

## 3. Integracja z interfejsem i menu pauzy

Gracz ma pełną kontrolę nad efektem w menu pauzy (`#pause`):

- **Faza Matrix** (`#setting-matrix-mode`):
  - `Automatyczna w tripie` (`auto`)
  - `Zawsze aktywna` (`always`)
  - `Wyłączona` (`off`)
- **Jakość Matrix** (`#setting-matrix-quality`):
  - `Niska (low)`
  - `Średnia (medium)`
  - `Wysoka (high)`
- Ustawienia są trwale zapisywane w `localStorage` pod kluczem `camp-visual-settings`.
- Zmiana ustawień w menu pauzy lub zmiana rozmiaru okna natychmiast synchronizuje canvas i parametry bez konieczności restartu gry.

---

## 4. Testy i odporność

Pakiet testów weryfikuje poprawność implementacji:

- `src/game/effects/MatrixRainOverlay.test.ts`: testy kolumn, brak alokacji, skalowanie jakości i zachowanie przy `reduceMotion`.
- `src/game/effects/MatrixWireframeEffect.test.ts`: podmiana materiałów na zielony wireframe, wykluczanie podłoża, pełne przywracanie przy wyłączeniu.
- `src/game/effects/MatrixPhaseController.test.ts`: przebieg cyklu czasowego, łagodne przejścia `fadeIn`/`fadeOut`, natychmiastowe wygaszanie po zakończeniu efektu.
- `src/game/GameMatrix.test.ts`: trwałość konfiguracji w `localStorage`, obsługa nieprawidłowych danych i fallback do domyślnych presetów.
