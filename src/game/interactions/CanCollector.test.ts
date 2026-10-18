import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CanCollector, DEFAULT_FESTIVAL_CANS, RECYCLING_CORRALS, BADGE_NAME } from './CanCollector';
import { FestivalPassport } from './FestivalPassport';
import { isOutsideTentColliders } from '../world/campLayout';

describe('CanCollector', () => {
  const TEST_STORAGE_KEY = 'test_festival_can_collector';
  const originalLocalStorage = globalThis.localStorage;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('inicjalizuje się z 10 dostępnymi puszkami i zerowym stanem ekwipunku', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    expect(collector.getAvailableCans().length).toBe(10);
    expect(collector.getAllCans().length).toBe(10);
    expect(collector.getInventoryCount()).toBe(0);
    expect(collector.getTotalDeposited()).toBe(0);
    expect(collector.isRecyclingCompleted()).toBe(false);
  });

  it('wszystkie 10 puszek znajduje się poza colliderami namiotów', () => {
    // Sprawdzamy geometryczną poprawność koordynatów względem wszystkich namiotów
    for (const can of DEFAULT_FESTIVAL_CANS) {
      const isFreeOfObstacles = isOutsideTentColliders(can.position[0], can.position[2], 0.3);
      expect(isFreeOfObstacles, `Puszka ${can.id} (${can.position}) koliduje z namiotem`).toBe(true);
    }
  });

  it('zbiera puszkę w zasięgu interakcji <= 2.5m', () => {
    const onCollected = vi.fn();
    const collector = new CanCollector({
      storageKey: TEST_STORAGE_KEY,
      onCanCollected: onCollected,
    });

    const targetCan = DEFAULT_FESTIVAL_CANS[0];
    const playerPos: [number, number, number] = [targetCan.position[0] + 1.0, 0, targetCan.position[2] + 1.0]; // dystans ~1.41m (w granicach 2.5m)

    const success = collector.collectCan(targetCan.id, playerPos);
    expect(success).toBe(true);
    expect(collector.getInventoryCount()).toBe(1);
    expect(collector.getAvailableCans().length).toBe(9);
    expect(onCollected).toHaveBeenCalledTimes(1);
    expect(onCollected).toHaveBeenCalledWith(
      expect.objectContaining({ id: targetCan.id, collected: true }),
      1,
    );
  });

  it('odrzuca próbę zebrania puszki spoza zasięgu 2.5m', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const targetCan = DEFAULT_FESTIVAL_CANS[0];
    const playerPos: [number, number, number] = [targetCan.position[0] + 3.0, 0, targetCan.position[2] + 3.0]; // dystans ~4.24m (> 2.5m)

    const success = collector.collectCan(targetCan.id, playerPos);
    expect(success).toBe(false);
    expect(collector.getInventoryCount()).toBe(0);
    expect(collector.getAvailableCans().length).toBe(10);
  });

  it('uniemożliwia powtórne zebranie tej samej puszki', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const targetCan = DEFAULT_FESTIVAL_CANS[0];
    const playerPos = targetCan.position;

    expect(collector.collectCan(targetCan.id, playerPos)).toBe(true);
    expect(collector.collectCan(targetCan.id, playerPos)).toBe(false);
    expect(collector.getInventoryCount()).toBe(1);
  });

  it('odrzuca próbę zebrania puszki o nieistniejącym ID', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    expect(collector.collectCan('ghost_can', [0, 0, 0])).toBe(false);
    expect(collector.collectCan('', [0, 0, 0])).toBe(false);
  });

  it('odrzuca próbę oddania puszek przy pustym ekwipunku', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const result = collector.depositCans();
    expect(result.success).toBe(false);
    expect(result.depositedCount).toBe(0);
    expect(result.message).toContain('Brak puszek');
  });

  it('odrzuca oddanie puszek gdy gracz jest zbyt daleko od eko-zagrody', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const can = DEFAULT_FESTIVAL_CANS[0];
    collector.collectCan(can.id, can.position);
    expect(collector.getInventoryCount()).toBe(1);

    // Pozycja daleko od jakiejkolwiek eko-zagrody
    const farPlayerPos: [number, number, number] = [150, 0, 150];
    const result = collector.depositCans(farPlayerPos);

    expect(result.success).toBe(false);
    expect(collector.getInventoryCount()).toBe(1);
    expect(result.message).toContain('Eko Zagrodzie');
  });

  it('pomyślnie oddaje puszki przy eko-zagrodzie obozowej', () => {
    const onDeposited = vi.fn();
    const collector = new CanCollector({
      storageKey: TEST_STORAGE_KEY,
      onCansDeposited: onDeposited,
    });

    const can = DEFAULT_FESTIVAL_CANS[0];
    collector.collectCan(can.id, can.position);
    expect(collector.getInventoryCount()).toBe(1);

    const corral = RECYCLING_CORRALS[0];
    const playerNearCorral = [corral.x + 1.0, 0, corral.z] as [number, number, number];

    const result = collector.depositCans(playerNearCorral);
    expect(result.success).toBe(true);
    expect(result.depositedCount).toBe(1);
    expect(result.totalDeposited).toBe(1);
    expect(collector.getInventoryCount()).toBe(0);
    expect(onDeposited).toHaveBeenCalledWith(1, 1);
  });

  it('pozwala na oddanie puszek bez podania pozycji (np. bezpośredni interfejs UI)', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const can = DEFAULT_FESTIVAL_CANS[1];
    collector.collectCan(can.id, can.position);

    const result = collector.depositCans();
    expect(result.success).toBe(true);
    expect(result.depositedCount).toBe(1);
    expect(result.totalDeposited).toBe(1);
  });

  it('oddanie 10 puszek przyznaje odznakę Czyste Pole i pieczątkę paszportu', () => {
    const passport = new FestivalPassport({ storageKey: 'test_can_passport' });
    const onBadge = vi.fn();
    const collector = new CanCollector({
      storageKey: TEST_STORAGE_KEY,
      passport,
      onBadgeAwarded: onBadge,
    });

    // Zbieramy pierwsze 5 puszek
    for (let i = 0; i < 5; i++) {
      const c = DEFAULT_FESTIVAL_CANS[i];
      collector.collectCan(c.id, c.position);
    }
    expect(collector.getInventoryCount()).toBe(5);

    // Pierwsza partia oddana
    collector.depositCans();
    expect(collector.getTotalDeposited()).toBe(5);
    expect(collector.isRecyclingCompleted()).toBe(false);
    expect(passport.hasStamp('clean_field')).toBe(false);
    expect(onBadge).not.toHaveBeenCalled();

    // Zbieramy kolejne 5 puszek
    for (let i = 5; i < 10; i++) {
      const c = DEFAULT_FESTIVAL_CANS[i];
      collector.collectCan(c.id, c.position);
    }
    expect(collector.getInventoryCount()).toBe(5);

    // Druga partia dopełnia 10 puszek
    const finalResult = collector.depositCans();
    expect(finalResult.success).toBe(true);
    expect(finalResult.badgeAwarded).toBe(true);
    expect(finalResult.totalDeposited).toBe(10);
    expect(collector.isRecyclingCompleted()).toBe(true);
    expect(onBadge).toHaveBeenCalledTimes(1);
    expect(onBadge).toHaveBeenCalledWith(BADGE_NAME);
    expect(passport.hasStamp('clean_field')).toBe(true);
  });

  it('reset() zeruje zebrane puszki, ekwipunek oraz odznakę', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const c = DEFAULT_FESTIVAL_CANS[0];
    collector.collectCan(c.id, c.position);
    collector.depositCans();
    expect(collector.getTotalDeposited()).toBe(1);

    collector.reset();
    expect(collector.getAvailableCans().length).toBe(10);
    expect(collector.getInventoryCount()).toBe(0);
    expect(collector.getTotalDeposited()).toBe(0);
    expect(collector.isRecyclingCompleted()).toBe(false);

    // Nowa instancja potwierdza zresetowany storage
    const fresh = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    expect(fresh.getAvailableCans().length).toBe(10);
    expect(fresh.getTotalDeposited()).toBe(0);
  });

  it('trwale zapisuje stan w localStorage i ładuje go ponownie', () => {
    const collector1 = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const c1 = DEFAULT_FESTIVAL_CANS[0];
    const c2 = DEFAULT_FESTIVAL_CANS[1];
    collector1.collectCan(c1.id, c1.position);
    collector1.collectCan(c2.id, c2.position);
    collector1.depositCans();

    const c3 = DEFAULT_FESTIVAL_CANS[2];
    collector1.collectCan(c3.id, c3.position);

    // Druga instancja odczytująca ten sam storage
    const collector2 = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    expect(collector2.getTotalDeposited()).toBe(2);
    expect(collector2.getInventoryCount()).toBe(1);
    expect(collector2.getAvailableCans().length).toBe(7);
  });

  it('bezpiecznie ignoruje błędy i uszkodzenia localStorage', () => {
    localStorage.setItem(TEST_STORAGE_KEY, 'corrupt-data{{');
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    expect(collector.getAvailableCans().length).toBe(10);

    const mockFaultyStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockFaultyStorage,
      writable: true,
      configurable: true,
    });

    const c = DEFAULT_FESTIVAL_CANS[0];
    expect(() => collector.collectCan(c.id, c.position)).not.toThrow();
    expect(collector.getInventoryCount()).toBe(1);
  });

  it('obsługuje Złotą Puszkę (5x wartość i tymczasowy speed boost)', () => {
    let goldenCollected = false;
    const collector = new CanCollector({
      storageKey: TEST_STORAGE_KEY,
      onGoldenCanCollected: () => {
        goldenCollected = true;
      },
    });

    const can = (collector as any).cans.get('can_01_camp_clearing');
    can.isGolden = true;

    const collected = collector.collectCan(can.id, can.position);
    expect(collected).toBe(true);
    expect(goldenCollected).toBe(true);
    expect(collector.getInventoryCount()).toBe(5);
    expect(collector.getSpeedBoostMultiplier()).toBe(1.35);
    expect(collector.getSpeedBoostRemaining()).toBeGreaterThan(14.0);

    // Po 16s speed boost wygasa
    collector.update(16.0);
    expect(collector.getSpeedBoostMultiplier()).toBe(1.0);
    expect(collector.getSpeedBoostRemaining()).toBe(0);
  });

  it('dynamicznie odradza puszkę (respawn) po zdefiniowanym czasie w pętli update', () => {
    let spawnedCan: any = null;
    const collector = new CanCollector({
      storageKey: TEST_STORAGE_KEY,
      enableRespawns: true,
      respawnDelaySeconds: 10.0,
      onCanSpawned: (c) => {
        spawnedCan = c;
      },
    });

    const target = DEFAULT_FESTIVAL_CANS[0];
    collector.collectCan(target.id, target.position);
    expect(collector.getAvailableCans().length).toBe(9);

    // Krok 5 sekund – jeszcze się nie zrespawnowała
    collector.update(5.0);
    expect(collector.getAvailableCans().length).toBe(9);
    expect(spawnedCan).toBeNull();

    // Kolejny krok 6 sekund – puszka pojawia się ponownie
    collector.update(6.0);
    expect(collector.getAvailableCans().length).toBe(10);
    expect(spawnedCan).toBeDefined();
    expect(spawnedCan.id).toBe(target.id);
    expect(spawnedCan.collected).toBe(false);
  });

  it('obsługuje tryb Eko-Rush Challenge z medalem i odliczaniem czasu', () => {
    let rushResult: any = null;
    const collector = new CanCollector({
      storageKey: TEST_STORAGE_KEY,
      onRushFinished: (res) => {
        rushResult = res;
      },
    });

    collector.startRush(60.0);
    expect(collector.isRushActive()).toBe(true);
    expect(collector.getRushTimeRemaining()).toBe(60);

    // Zbieramy 6 puszek (kwalifikacja do medalu brązowego)
    for (let i = 0; i < 6; i++) {
      const c = DEFAULT_FESTIVAL_CANS[i];
      collector.collectCan(c.id, c.position);
    }

    const stats = collector.getRushStats();
    expect(stats.cansCollected).toBe(6);

    // Upływ czasu kończący wyzwanie
    collector.update(61.0);
    expect(collector.isRushActive()).toBe(false);
    expect(rushResult).toBeDefined();
    expect(rushResult.medal).toBe('bronze');
    expect(rushResult.totalCollected).toBe(6);
  });

  it('zwraca aktywne markery puszek dla FestivalMap', () => {
    const collector = new CanCollector({ storageKey: TEST_STORAGE_KEY });
    const markers = collector.getActiveCanMarkers();
    expect(markers.length).toBe(10);
    expect(markers[0]).toHaveProperty('id');
    expect(markers[0]).toHaveProperty('x');
    expect(markers[0]).toHaveProperty('z');
    expect(markers[0]).toHaveProperty('isGolden');

    collector.collectCan(markers[0].id, [markers[0].x, 0, markers[0].z]);
    expect(collector.getActiveCanMarkers().length).toBe(9);
  });
});
