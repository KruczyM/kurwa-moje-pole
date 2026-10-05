# Raport z audytu kolizji i nakładania się modeli w świecie (Zadanie G5)

**Data audytu:** 2026-10-03  
**Status:** Zweryfikowany (PASS) — 0 kolizji

---

### 1. Zgłoszenie

Sprawdzenie podejrzenia, że namioty gastronomiczne (kramy pasażu) renderują się na zwykłych namiotach kempingowych.

### 2. Architektura i mechanizm rozmieszczania

W grze występują trzy niezależne grupy obiektów obozowych i handlowych:

1. **Pasaż handlowo-gastronomiczny (`src/game/world/festivalMarket.ts`):**
   - 18 stoisk (w tym duży sklep SiemaShop, stoiska merchu, gastronomii, kawy, antykwariatu, Kodano, zuch, itp.).
   - Główna aleja handlowa `MAIN_ASPHALT_ROAD` / `MARKET_LANE`: `X: [-140, 140]`, `Z: [-40, -30]`.
   - Współrzędne stoisk:
     - `SiemaShop`: `x = 75, z = -50` (wymiary kolizji `24.3m x 18.3m`).
     - Stoiska 1–5: `x = -100 + (index-1)*7, z = -43` (wymiary `4.9m x 4.2m`).
     - Stoiska 6–17: `x = -33 + (index-6)*7, z = -43` (wymiary `4.9m x 4.2m`).
2. **Główny obóz kanoniczny T01–T15 (`tentLayout` w `campLayout.ts`):**
   - Namioty T01–T15 znajdują się w parceli `PRIMARY_CAMP_PLOT` o wymiarach `36m x 36m` wokół środka `(0, 0)`: `X: [-18, 18]`, `Z: [-18, 18]`.
   - Zasięg Z namiotów obozu nie przekracza `Z = -33` (najdalej wysunięty T01 przy `Z = -33`, podczas gdy stoiska zaczynają się od `Z = -43` do `Z = -50`).
3. **Proceduralne sektory kempingowe festiwalu (`festivalCamping.ts` / `festivalTentLayout`):**
   - Generator `createFestivalCamp()` pobiera listę wykluczonych obszarów (`reserved`), w tym:
     - Wszystkie kolizje namiotów T01–T15 oraz T16–T19.
     - `MARKET_LANE` (droga asfaltowa `Z: [-40, -30]`).
     - `SOUTH_CONCRETE_LANE` (droga południowa `Z: [68, 78]`).
     - Pełne obrysy wszystkich 18 stoisk `MARKET_STALL_LAYOUT.map(marketColliderBounds)`.
   - Każdy slot namiotu przed utworzeniem sprawdza bufor bezpieczeństwa `3.15 m` (uwzględniający linki odciągowe):
     ```ts
     if (
       reserved.some((r) => x + 3.15 > r.minX && x - 3.15 < r.maxX && z + 3.15 > r.minZ && z - 3.15 < r.maxZ)
     )
       continue;
     ```

### 3. Wyniki weryfikacji i testów jednostkowych

- Skrypt analityczny `scripts/check_collisions.py` przetestował przecięcia wszystkich obrysów:
  `>> SUCCESS: Zero collisions between tents and market stalls.`
- Testy jednostkowe Vitest:
  - `src/game/world/festivalMarket.test.ts` (7 testów passed)
  - `src/game/world/festivalCamping.test.ts` (7 testów passed)
  - `src/game/world/campLayout.test.ts` (15 testów passed)
- Potwierdzono brak przenikania siatek, brak z-fightingu podłoża oraz zachowanie szerokiej, wolnej alei dla graczy i pojazdów technicznych.
