import type { FestivalPassport } from './FestivalPassport';

export type BingoSquareId =
  'mlyn' | 'woda' | 'puszki' | 'scena' | 'namiot' | 'quiz' | 'asp' | 'flanki' | 'bloto';

export interface BingoSquare {
  id: BingoSquareId;
  label: string;
  description: string;
  row: number; // 0..2
  col: number; // 0..2
  checked: boolean;
  checkedAt?: number;
}

export type BingoLineType = 'row' | 'column' | 'diagonal';

export interface BingoLine {
  type: BingoLineType;
  index: number;
  squareIds: readonly BingoSquareId[];
}

export interface FestivalBingoOptions {
  passport?: FestivalPassport;
  storageKey?: string;
  onSquareChecked?: (square: BingoSquare) => void;
  onBingo?: (winningLines: BingoLine[]) => void;
  onFullCard?: () => void;
}

interface BingoStorageSchema {
  version: 1;
  checkedSquares: Record<string, { checked: boolean; checkedAt?: number }>;
}

export const BINGO_DEFINITIONS: readonly Omit<BingoSquare, 'checked' | 'checkedAt'>[] = [
  {
    id: 'mlyn',
    label: 'Koło Widokowe',
    description: 'Przejedź się kołem widokowym',
    row: 0,
    col: 0,
  },
  {
    id: 'woda',
    label: 'Ujęcie Wody',
    description: 'Napij się z grzybka lub kranu',
    row: 0,
    col: 1,
  },
  {
    id: 'puszki',
    label: 'Czyste Pole',
    description: 'Zbierz co najmniej 5 puszek',
    row: 0,
    col: 2,
  },
  {
    id: 'scena',
    label: 'Duża Scena',
    description: 'Odwiedź Dużą Scenę',
    row: 1,
    col: 0,
  },
  {
    id: 'namiot',
    label: 'Własny Namiot',
    description: 'Ustaw swój namiot na mapie',
    row: 1,
    col: 1,
  },
  {
    id: 'quiz',
    label: 'Quiz Patrolu',
    description: 'Odpowiedz na pytanie patrolu',
    row: 1,
    col: 2,
  },
  {
    id: 'asp',
    label: 'Wzgórze ASP',
    description: 'Zajrzyj na wzgórze ASP',
    row: 2,
    col: 0,
  },
  {
    id: 'flanki',
    label: 'Mecz Flanek',
    description: 'Zagraj we flanki',
    row: 2,
    col: 1,
  },
  {
    id: 'bloto',
    label: 'Kąpiel Błotna',
    description: 'Odwiedź basen błotny',
    row: 2,
    col: 2,
  },
] as const;

export const BINGO_WINNING_LINES: readonly BingoLine[] = [
  // 3 rzędy poziome
  { type: 'row', index: 0, squareIds: ['mlyn', 'woda', 'puszki'] },
  { type: 'row', index: 1, squareIds: ['scena', 'namiot', 'quiz'] },
  { type: 'row', index: 2, squareIds: ['asp', 'flanki', 'bloto'] },

  // 3 kolumny pionowe
  { type: 'column', index: 0, squareIds: ['mlyn', 'scena', 'asp'] },
  { type: 'column', index: 1, squareIds: ['woda', 'namiot', 'flanki'] },
  { type: 'column', index: 2, squareIds: ['puszki', 'quiz', 'bloto'] },

  // 2 przekątne
  { type: 'diagonal', index: 0, squareIds: ['mlyn', 'namiot', 'bloto'] },
  { type: 'diagonal', index: 1, squareIds: ['puszki', 'namiot', 'asp'] },
] as const;

const DEFAULT_STORAGE_KEY = 'festival_bingo_v1';

export class FestivalBingo {
  private readonly storageKey: string;
  private readonly squares: Map<BingoSquareId, BingoSquare> = new Map();
  private readonly passport?: FestivalPassport;
  private readonly onSquareChecked?: (square: BingoSquare) => void;
  private readonly onBingo?: (winningLines: BingoLine[]) => void;
  private readonly onFullCard?: () => void;
  private hadBingoPreviously = false;
  private hadFullCardPreviously = false;

  constructor(options?: FestivalBingoOptions) {
    this.storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;
    this.passport = options?.passport;
    this.onSquareChecked = options?.onSquareChecked;
    this.onBingo = options?.onBingo;
    this.onFullCard = options?.onFullCard;

    for (const def of BINGO_DEFINITIONS) {
      this.squares.set(def.id, {
        ...def,
        checked: false,
      });
    }

    this.loadFromStorage();
    this.hadBingoPreviously = this.hasBingo();
    this.hadFullCardPreviously = this.isFullCard();
  }

  /**
   * Zaznacza pole bingo jako zrealizowane.
   * Działanie jest idempotentne. Zwraca true jeśli pole istnieje.
   */
  checkSquare(squareId: string): boolean {
    if (!squareId || typeof squareId !== 'string') return false;

    const normalizedId = squareId.toLowerCase().trim() as BingoSquareId;
    const square = this.squares.get(normalizedId);
    if (!square) return false;

    if (square.checked) {
      return true;
    }

    square.checked = true;
    square.checkedAt = Date.now();

    this.saveToStorage();

    if (this.onSquareChecked) {
      try {
        this.onSquareChecked({ ...square });
      } catch {
        // Callback nie może przerwać działania
      }
    }

    const currentWinningLines = this.getWinningLines();
    const hasBingoNow = currentWinningLines.length > 0;

    if (hasBingoNow && !this.hadBingoPreviously) {
      this.hadBingoPreviously = true;

      if (this.passport) {
        try {
          this.passport.recordEvent('bingo_win');
        } catch {
          // Błąd paszportu nie przerywa działania bingo
        }
      }

      if (this.onBingo) {
        try {
          this.onBingo(currentWinningLines);
        } catch {
          // Błąd callbacku nie przerywa działania
        }
      }
    }

    if (this.isFullCard() && !this.hadFullCardPreviously) {
      this.hadFullCardPreviously = true;

      if (this.onFullCard) {
        try {
          this.onFullCard();
        } catch {
          // Błąd callbacku nie przerywa działania
        }
      }
    }

    return true;
  }

  /** Sprawdza czy dane pole jest zaznaczone. */
  isSquareChecked(squareId: string): boolean {
    const square = this.squares.get(squareId.toLowerCase().trim() as BingoSquareId);
    return Boolean(square?.checked);
  }

  /** Zwraca tablicę wszystkich 9 pól siatki bingo. */
  getGrid(): BingoSquare[] {
    return Array.from(this.squares.values()).map((s) => ({ ...s }));
  }

  /** Zwraca siatkę jako 3 wiersze po 3 kolumny. */
  getRows(): BingoSquare[][] {
    const grid = this.getGrid();
    return [
      grid.filter((s) => s.row === 0).sort((a, b) => a.col - b.col),
      grid.filter((s) => s.row === 1).sort((a, b) => a.col - b.col),
      grid.filter((s) => s.row === 2).sort((a, b) => a.col - b.col),
    ];
  }

  /** Zwraca dane konkretnego pola. */
  getSquare(squareId: string): BingoSquare | undefined {
    const square = this.squares.get(squareId.toLowerCase().trim() as BingoSquareId);
    return square ? { ...square } : undefined;
  }

  /** Liczba aktualnie zaznaczonych pól. */
  getCheckedCount(): number {
    let count = 0;
    for (const square of this.squares.values()) {
      if (square.checked) count++;
    }
    return count;
  }

  /** Zwraca listę wszystkich skompletowanych linii bingo (wiersze, kolumny, przekątne). */
  getWinningLines(): BingoLine[] {
    const winning: BingoLine[] = [];
    for (const line of BINGO_WINNING_LINES) {
      const isComplete = line.squareIds.every((id) => this.squares.get(id)?.checked);
      if (isComplete) {
        winning.push({
          type: line.type,
          index: line.index,
          squareIds: [...line.squareIds],
        });
      }
    }
    return winning;
  }

  /** Czy ułożono przynajmniej jedną pełną linię (Bingo!). */
  hasBingo(): boolean {
    return BINGO_WINNING_LINES.some((line) => line.squareIds.every((id) => this.squares.get(id)?.checked));
  }

  /** Czy zaznaczono wszystkie 9 pól karty. */
  isFullCard(): boolean {
    return Array.from(this.squares.values()).every((s) => s.checked);
  }

  /** Resetuje całą kartę bingo i czyści zapis w pamięci i storage. */
  reset(): void {
    for (const square of this.squares.values()) {
      square.checked = false;
      delete square.checkedAt;
    }
    this.hadBingoPreviously = false;
    this.hadFullCardPreviously = false;
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidSchema(parsed)) return;

      for (const [id, data] of Object.entries(parsed.checkedSquares)) {
        const square = this.squares.get(id as BingoSquareId);
        if (square && data.checked) {
          square.checked = true;
          square.checkedAt = typeof data.checkedAt === 'number' ? data.checkedAt : Date.now();
        }
      }
    } catch {
      // Bezpieczny fallback
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const checkedSquares: Record<string, { checked: boolean; checkedAt?: number }> = {};
      for (const [id, square] of this.squares.entries()) {
        checkedSquares[id] = {
          checked: square.checked,
          checkedAt: square.checkedAt,
        };
      }

      const payload: BingoStorageSchema = {
        version: 1,
        checkedSquares,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Bezpieczny fallback przy błędzie zapisu
    }
  }

  private isValidSchema(obj: unknown): obj is BingoStorageSchema {
    if (typeof obj !== 'object' || obj === null) return false;
    const candidate = obj as Record<string, unknown>;
    if (candidate.version !== 1) return false;
    if (typeof candidate.checkedSquares !== 'object' || candidate.checkedSquares === null) {
      return false;
    }
    return true;
  }
}
