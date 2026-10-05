import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FestivalPassport, DEFAULT_STAMPS } from './FestivalPassport';

describe('FestivalPassport', () => {
  const TEST_STORAGE_KEY = 'test_festival_passport';
  const originalLocalStorage = globalThis.localStorage;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
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

  it('inicjalizuje się z pełną listą domyślnych zablokowanych pieczątek', () => {
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    expect(passport.getStampCount()).toBe(0);
    expect(passport.getTotalCount()).toBe(DEFAULT_STAMPS.length);

    const stamps = passport.getStamps();
    expect(stamps.length).toBe(DEFAULT_STAMPS.length);
    stamps.forEach((stamp) => {
      expect(stamp.unlocked).toBe(false);
      expect(stamp.unlockedAt).toBeUndefined();
    });

    const progress = passport.getProgress();
    expect(progress.collected).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('odblokowuje pieczątkę przez recordEvent() bezpośrednim ID', () => {
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    const result = passport.recordEvent('ferris_wheel');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('ferris_wheel');
    expect(result?.unlocked).toBe(true);
    expect(typeof result?.unlockedAt).toBe('number');

    expect(passport.hasStamp('ferris_wheel')).toBe(true);
    expect(passport.getStampCount()).toBe(1);

    const progress = passport.getProgress();
    expect(progress.collected).toBe(1);
    expect(progress.percentage).toBeGreaterThan(0);
  });

  it('odblokowuje pieczątki przez aliasy zdarzeń', () => {
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });

    passport.recordEvent('mlyn');
    expect(passport.hasStamp('ferris_wheel')).toBe(true);

    passport.recordEvent('clean_field_completed');
    expect(passport.hasStamp('clean_field')).toBe(true);

    passport.recordEvent('quiz');
    expect(passport.hasStamp('patrol_quiz')).toBe(true);

    passport.recordEvent('woda');
    expect(passport.hasStamp('water_refill')).toBe(true);

    passport.recordEvent('bloto');
    expect(passport.hasStamp('mud_bath')).toBe(true);

    passport.recordEvent('flanki');
    expect(passport.hasStamp('flanki_player')).toBe(true);

    passport.recordEvent('scena');
    expect(passport.hasStamp('main_stage')).toBe(true);

    passport.recordEvent('namiot');
    expect(passport.hasStamp('tent_builder')).toBe(true);

    passport.recordEvent('bingo');
    expect(passport.hasStamp('bingo_win')).toBe(true);

    passport.recordEvent('guitar_played');
    expect(passport.hasStamp('campfire_guitar')).toBe(true);

    expect(passport.getStampCount()).toBe(10);
    expect(passport.getProgress().percentage).toBe(100);
  });

  it('recordEvent jest w pełni idempotentny i nie nadpisuje unlockedAt', async () => {
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    const first = passport.recordEvent('clean_field');
    const firstTimestamp = first?.unlockedAt;

    // Krótkie opóźnienie
    await new Promise((r) => setTimeout(r, 10));

    const second = passport.recordEvent('clean_field');
    expect(second?.unlockedAt).toBe(firstTimestamp);
    expect(passport.getStampCount()).toBe(1);
  });

  it('ignoruje nieznane zdarzenia bez rzucania wyjątków', () => {
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    expect(passport.recordEvent('unknown_random_event')).toBeNull();
    expect(passport.recordEvent('')).toBeNull();
    expect(passport.getStampCount()).toBe(0);
  });

  it('wywołuje callback onStampAwarded tylko przy pierwszym odblokowaniu', () => {
    const onAwarded = vi.fn();
    const passport = new FestivalPassport({
      storageKey: TEST_STORAGE_KEY,
      onStampAwarded: onAwarded,
    });

    passport.recordEvent('patrol_quiz');
    expect(onAwarded).toHaveBeenCalledTimes(1);
    expect(onAwarded).toHaveBeenCalledWith(expect.objectContaining({ id: 'patrol_quiz', unlocked: true }));

    // Ponowne zgłoszenie nie powinno wywoływać callbacku
    passport.recordEvent('patrol_quiz');
    expect(onAwarded).toHaveBeenCalledTimes(1);
  });

  it('odporność na błąd wewnątrz onStampAwarded callback', () => {
    const failingCallback = vi.fn().mockImplementation(() => {
      throw new Error('Callback exploded');
    });

    const passport = new FestivalPassport({
      storageKey: TEST_STORAGE_KEY,
      onStampAwarded: failingCallback,
    });

    expect(() => passport.recordEvent('water_refill')).not.toThrow();
    expect(passport.hasStamp('water_refill')).toBe(true);
  });

  it('trwale zapisuje stan w localStorage i ładuje go ponownie', () => {
    const passport1 = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    passport1.recordEvent('ferris_wheel');
    passport1.recordEvent('flanki_player');

    // Druga instancja odczytująca ten sam klucz storage
    const passport2 = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    expect(passport2.hasStamp('ferris_wheel')).toBe(true);
    expect(passport2.hasStamp('flanki_player')).toBe(true);
    expect(passport2.hasStamp('clean_field')).toBe(false);
    expect(passport2.getStampCount()).toBe(2);
  });

  it('reset() zeruje wszystkie pieczątki i aktualizuje storage', () => {
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    passport.recordEvent('clean_field');
    passport.recordEvent('main_stage');
    expect(passport.getStampCount()).toBe(2);

    passport.reset();
    expect(passport.getStampCount()).toBe(0);
    expect(passport.hasStamp('clean_field')).toBe(false);

    // Nowa instancja potwierdza zresetowany storage
    const fresh = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    expect(fresh.getStampCount()).toBe(0);
  });

  it('bezpiecznie ignoruje uszkodzony JSON w localStorage', () => {
    localStorage.setItem(TEST_STORAGE_KEY, 'corrupted{json');
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    expect(passport.getStampCount()).toBe(0);
    expect(passport.hasStamp('ferris_wheel')).toBe(false);
  });

  it('bezpiecznie ignoruje schemat z nieprawidłową wersją', () => {
    localStorage.setItem(
      TEST_STORAGE_KEY,
      JSON.stringify({ version: 999, stamps: { ferris_wheel: { unlocked: true } } }),
    );
    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    expect(passport.getStampCount()).toBe(0);
  });

  it('działa bez błędu gdy localStorage rzuca wyjątki (np. quota exceeded)', () => {
    const mockFaultyStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
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

    const passport = new FestivalPassport({ storageKey: TEST_STORAGE_KEY });
    expect(() => passport.recordEvent('ferris_wheel')).not.toThrow();
    expect(passport.hasStamp('ferris_wheel')).toBe(true);
  });
});
