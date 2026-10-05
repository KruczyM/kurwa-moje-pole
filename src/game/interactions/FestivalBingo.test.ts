import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FestivalBingo, BINGO_DEFINITIONS } from './FestivalBingo';
import { FestivalPassport } from './FestivalPassport';

describe('FestivalBingo', () => {
  const TEST_STORAGE_KEY = 'test_festival_bingo';
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

  it('inicjalizuje się z 9 pustymi polami', () => {
    const bingo = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    expect(bingo.getCheckedCount()).toBe(0);
    expect(bingo.hasBingo()).toBe(false);
    expect(bingo.isFullCard()).toBe(false);

    const grid = bingo.getGrid();
    expect(grid.length).toBe(9);
    grid.forEach((square) => {
      expect(square.checked).toBe(false);
      expect(square.checkedAt).toBeUndefined();
    });

    const rows = bingo.getRows();
    expect(rows.length).toBe(3);
    rows.forEach((row) => expect(row.length).toBe(3));
  });

  it('zaznacza pole poprawnie i idempotentnie', async () => {
    const onChecked = vi.fn();
    const bingo = new FestivalBingo({
      storageKey: TEST_STORAGE_KEY,
      onSquareChecked: onChecked,
    });

    const success = bingo.checkSquare('woda');
    expect(success).toBe(true);
    expect(bingo.isSquareChecked('woda')).toBe(true);
    expect(bingo.getCheckedCount()).toBe(1);
    expect(onChecked).toHaveBeenCalledTimes(1);

    const square = bingo.getSquare('woda');
    const firstTimestamp = square?.checkedAt;
    expect(typeof firstTimestamp).toBe('number');

    await new Promise((r) => setTimeout(r, 10));

    // Idempotentne ponowne zaznaczenie
    const secondSuccess = bingo.checkSquare('woda');
    expect(secondSuccess).toBe(true);
    expect(bingo.getSquare('woda')?.checkedAt).toBe(firstTimestamp);
    // Callback nie jest wołany ponownie
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it('zwraca false dla nieznanego identyfikatora pola', () => {
    const bingo = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    expect(bingo.checkSquare('non_existent_square')).toBe(false);
    expect(bingo.checkSquare('')).toBe(false);
    expect(bingo.getCheckedCount()).toBe(0);
  });

  it('wykrywa Bingo w pierwszym poziomym wierszu (mlyn, woda, puszki)', () => {
    const onBingo = vi.fn();
    const bingo = new FestivalBingo({
      storageKey: TEST_STORAGE_KEY,
      onBingo,
    });

    bingo.checkSquare('mlyn');
    bingo.checkSquare('woda');
    expect(bingo.hasBingo()).toBe(false);
    expect(onBingo).not.toHaveBeenCalled();

    bingo.checkSquare('puszki');
    expect(bingo.hasBingo()).toBe(true);
    expect(onBingo).toHaveBeenCalledTimes(1);

    const lines = bingo.getWinningLines();
    expect(lines.length).toBe(1);
    expect(lines[0].type).toBe('row');
    expect(lines[0].index).toBe(0);
    expect(lines[0].squareIds).toEqual(['mlyn', 'woda', 'puszki']);
  });

  it('wykrywa Bingo w kolumnie pionowej (woda, namiot, flanki)', () => {
    const bingo = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    bingo.checkSquare('woda');
    bingo.checkSquare('namiot');
    bingo.checkSquare('flanki');

    expect(bingo.hasBingo()).toBe(true);
    const winning = bingo.getWinningLines();
    expect(winning.some((l) => l.type === 'column' && l.index === 1)).toBe(true);
  });

  it('wykrywa Bingo na głównej przekątnej (mlyn, namiot, bloto)', () => {
    const bingo = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    bingo.checkSquare('mlyn');
    bingo.checkSquare('namiot');
    bingo.checkSquare('bloto');

    expect(bingo.hasBingo()).toBe(true);
    const winning = bingo.getWinningLines();
    expect(winning.some((l) => l.type === 'diagonal' && l.index === 0)).toBe(true);
  });

  it('wykrywa Bingo na anty-przekątnej (puszki, namiot, asp)', () => {
    const bingo = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    bingo.checkSquare('puszki');
    bingo.checkSquare('namiot');
    bingo.checkSquare('asp');

    expect(bingo.hasBingo()).toBe(true);
    const winning = bingo.getWinningLines();
    expect(winning.some((l) => l.type === 'diagonal' && l.index === 1)).toBe(true);
  });

  it('automatycznie przyznaje pieczątkę paszportu bingo_win po pierwszym Bingo', () => {
    const passport = new FestivalPassport({ storageKey: 'test_bingo_passport' });
    const bingo = new FestivalBingo({
      storageKey: TEST_STORAGE_KEY,
      passport,
    });

    bingo.checkSquare('mlyn');
    bingo.checkSquare('woda');
    expect(passport.hasStamp('bingo_win')).toBe(false);

    bingo.checkSquare('puszki');
    expect(passport.hasStamp('bingo_win')).toBe(true);
  });

  it('wykrywa pełną kartę (Full Card) i uruchamia onFullCard', () => {
    const onFullCard = vi.fn();
    const bingo = new FestivalBingo({
      storageKey: TEST_STORAGE_KEY,
      onFullCard,
    });

    for (const def of BINGO_DEFINITIONS) {
      bingo.checkSquare(def.id);
    }

    expect(bingo.isFullCard()).toBe(true);
    expect(bingo.hasBingo()).toBe(true);
    expect(bingo.getCheckedCount()).toBe(9);
    expect(onFullCard).toHaveBeenCalledTimes(1);
  });

  it('reset() zeruje zaznaczenia i aktualizuje storage', () => {
    const bingo = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    bingo.checkSquare('mlyn');
    bingo.checkSquare('woda');
    bingo.checkSquare('puszki');
    expect(bingo.hasBingo()).toBe(true);

    bingo.reset();
    expect(bingo.getCheckedCount()).toBe(0);
    expect(bingo.hasBingo()).toBe(false);
    expect(bingo.isSquareChecked('mlyn')).toBe(false);

    // Druga instancja potwierdza zresetowany storage
    const fresh = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    expect(fresh.getCheckedCount()).toBe(0);
  });

  it('trwale zapisuje stan w localStorage i ładuje go ponownie', () => {
    const bingo1 = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    bingo1.checkSquare('asp');
    bingo1.checkSquare('flanki');

    const bingo2 = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    expect(bingo2.isSquareChecked('asp')).toBe(true);
    expect(bingo2.isSquareChecked('flanki')).toBe(true);
    expect(bingo2.isSquareChecked('mlyn')).toBe(false);
    expect(bingo2.getCheckedCount()).toBe(2);
  });

  it('bezpiecznie ignoruje błędy i uszkodzenia storage', () => {
    localStorage.setItem(TEST_STORAGE_KEY, '{invalidJson: true');
    const bingo = new FestivalBingo({ storageKey: TEST_STORAGE_KEY });
    expect(bingo.getCheckedCount()).toBe(0);

    // Zepsute setItem
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

    expect(() => bingo.checkSquare('bloto')).not.toThrow();
    expect(bingo.isSquareChecked('bloto')).toBe(true);
  });
});
