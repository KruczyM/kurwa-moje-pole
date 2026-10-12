# Głębia biomów

Wdrożono paralaksę w istniejącym CaveRenderer, bez zmian fizyki, zapisu postępu i sterowania.
Warstwy mają współczynniki ruchu 0.15, 0.4 i 1.1, z ograniczeniem do zapasu obrazu (20% overscan), aby nie odsłaniać pustych krawędzi.
Przesunięcie wynika z istniejącej kamery, z kotwicą ustawianą natychmiast po zmianie poziomu.
Pauza zatrzymuje kamerę i warstwy; resize ponownie oblicza dopasowanie obrazów.
Pierwszy plan ma alfa 0.18 i jest przycięty do zewnętrznych 12% pola gry; HUD i minimapa są rysowane ponad nim.
prefers-reduced-motion wyłącza względny ruch wszystkich warstw bez dodatkowych listenerów.

Grafika: `public/game-assets/2d/bongo-rush/art-v2/depth.png`, atlas 2x2 (piwnica, winorośle, bunkier, lodowe nawisy).
Wygenerowano wbudowanym imagegen. Atlas ładowany raz przez istniejący ImageCache i zwalniany z renderera przy dispose.

## Walidacja

238 testów Bongo Rush przeszło, w tym przesunięcia, brzegi ekranu, resize, reduced motion, zatrzymanie kamery podczas pauzy i ograniczenie dekoracji do obrzeży.
ESLint i build: PASS.
VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN — zapisane uprawnienie przeglądarki blokuje lokalny adres gry. Nie wykonano obejścia tej blokady.
Screeny i film z ruchem wymagają odblokowania lokalnego podglądu; fizyczny telefon pozostaje do sprawdzenia.

## Prompt

Use case: stylized-concept. Production videogame parallax decoration atlas, actual transparent PNG, square exactly 2 by 2 grid four equal cells no borders. Each quadrant contains an edge frame of detailed retro pixel-painted underground decorations, central 65 percent completely transparent, isolated transparent holes between objects. Top left warm burgundy wine cellar arch fragments at corners copper pipe along left edge hanging dark red ivy upper edge, restrained amber highlights. Top right deep emerald underground forest with elegant hanging grape vines ivy leaves thin curling roots along upper corners and side edges, tiny turquoise glints, translucent gaps. Bottom left dark violet industrial bunker thick cables at upper corners worn metal brackets with tiny yellow black hazard stripes on side edges subdued cyan lights. Bottom right midnight blue glacial grotto delicate icicle clusters and fractured translucent blue ice at top corners and side edges. Same crafted pixel-painted style and scale throughout, muted dark edge silhouettes suitable to overlay gameplay at low opacity, no continuous opaque wall or background, no bottom floor, no characters pickups text logos watermarks. Keep all decorations strictly within their own quadrant, generous transparent gap at quadrant boundaries. Four independent edge-frame sprite assets.
