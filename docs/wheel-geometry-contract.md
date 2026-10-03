# Kontrakt Geometrii Młyna Diabelskiego (Ferris Wheel A0)
**Wersja specyfikacji:** 1.0 (2026-10-03)  
**Model referencyjny:** `public/game-assets/world/festival/allegroWheel.glb`  
**Koordynaty bazy młyna w świecie:** `FESTIVAL_WHEEL_SITE` = `{ x: 116.0, z: -59.0 }`, `Y_terenu` ≈ `0.025 m`

---

### 1. Węzły strukturalne i transformacje modelu
| Nazwa węzła w GLTF | Rola | Pozycja lokalna (rel. root) | Wymiary / Promień |
| :--- | :--- | :--- | :--- |
| `Festival_Allegro_Wheel` | Korzeń sceny obiektu | `(116.0, ground + 0.025, -59.0)` | `31.7m (X) x 33.05m (Y) x 10.3m (Z)` |
| `Static_Wheel_Deck` | Podest wejściowy dla pasażerów | `(0, 0, 0)` | Wysokość podłogi podestu: `~1.2m` |
| `Wheel_Rotor` | Oś obrotowa i szprychy | `(0, 18.0, 0)` | Oś obrotu Z: `AXIS = (0, 0, 1)`, promień gondoli: `15.0 m` |
| `Gondola_0` .. `Gondola_23` | 24 wiszące gondole pasażerskie | Na obwodzie `R = 15.0m` od rotora | Kontr-obrót zachowujący stały pion |

---

### 2. Wybór kabiny pasażerskiej MVP i faza dolna
- **Kabina startowa (`gondolaIndex = 0`):**
  W pliku GLB przy zerowym obrocie rotora kabina 0 znajduje się na samej górze (`Y = 18.0 + 15.0 = 33.0 m`).
- **Kabina dolna MVP (`MVP_CABIN_INDEX = 12`):**
  Kabina o indeksie 12 znajduje się po przeciwnej stronie (kąt $\pi$ radiany = 180°), czyli przy kącie zerowym rotora znajduje się bezpośrednio przy dolnym podeście:
  - Pozycja relatywna do rotora: `(0, -15.0, 0)`.
  - Pozycja w świecie: `Y = 18.0 - 15.0 + ground = 3.0 + ground` (idealna wysokość nad podestem).
- **Punkt oka kamery (Eye anchor) wewnątrz kabiny:**
  - `EyeOffset`: `(0, 1.15, 0)` od punktu obrotu gondoli (wysokość wzroku siedzącego człowieka).
  - Wektor patrzenia początkowy: wzdłuż osi festiwalu na zachód (w stronę Dużej Sceny i obozu).
- **Punkt wejścia i wyjścia na ziemi (Ground boarding target):**
  - Przed schodkami podestu, poza twardym colliderem konstrukcji młyna:
    `BoardingPoint`: `(116.0 - 8.5, ground, -59.0)`
  - Płynny fade ekranu (250 ms) przenosi gracza z `BoardingPoint` do `EyeAnchor` dolnej gondoli.

---

### 3. Kontrakt interakcji i bezpieczeństwa FPP
1. **Tryb kamery w kabinie:**
   - Własny kąt yaw/pitch gracza (swobodne rozglądanie się w 360° bez ruszania nogami).
   - Brak head-bobbingu i kroków.
   - Horyzont pozostaje idealnie poziomy dzięki dynamicznemu kontr-obrotowi gondoli.
2. **Warunki wysiadania:**
   - Wysiadanie jest dozwolone **wyłącznie w fazie dolnej** (`phase === 'bottom'`).
   - Naciśnięcie klawisza `E` w trakcie jazdy kolejkują wyjście — gracz nie wypada z gondoli na wysokości, lecz bezpiecznie wysiada po zakończeniu pełnego cyklu na ziemię.
