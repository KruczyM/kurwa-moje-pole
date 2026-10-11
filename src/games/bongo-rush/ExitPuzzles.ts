import type { Direction, Point } from './types';

export interface ExitPuzzle {
  name: string;
  hint: string;
  rows: readonly string[];
  entry: Point;
  exit: Point;
  solution: readonly Direction[];
}

/** Expands readable input runs without adding a second movement or physics implementation. */
function moves(...runs: [Direction, number][]): Direction[] {
  return runs.flatMap(([direction, count]) => Array<Direction>(count).fill(direction));
}

/** Fixed single-entrance vaults: digging/pushing order is necessary, not just a longer walk. */
export const EXIT_PUZZLES: readonly ExitPuzzle[] = [
  {
    name: 'Kieszeń na głaz',
    hint: 'Przed wyjściem: obejdź głaz górą, odkop wnękę po jego prawej stronie, wróć i wepchnij go do wnęki.',
    rows: [
      '###########',
      '###########',
      '##.....####',
      '##.###.####',
      '##.###.####',
      ' P...R.####',
      '#####.#####',
      '#####E#####',
      '###########',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 5, y: 7 },
    solution: moves(
      ['right', 1],
      ['up', 3],
      ['right', 4],
      ['down', 3],
      ['up', 3],
      ['left', 4],
      ['down', 3],
      ['right', 3],
      ['down', 2],
    ),
  },
  {
    name: 'Spust skalny',
    hint: 'Przed wyjściem: zejdź do podpory pod głazem, odkop ją z boku i natychmiast cofnij się. Wróć na górny korytarz.',
    rows: [
      '###########',
      '###########',
      '###########',
      '###########',
      '###########',
      ' P...R...E#',
      '###...#####',
      '##### #####',
      '###########',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 9, y: 5 },
    solution: moves(['right', 2], ['down', 1], ['right', 2], ['left', 1], ['up', 1], ['right', 5]),
  },
  {
    name: 'Podwójny spust',
    hint: 'Przed wyjściem: uwolnij dwa głazy osobno. Po odkopaniu podpory wycofuj się w bok, nigdy w spadający głaz.',
    rows: [
      '###############',
      '###############',
      '###############',
      '###############',
      '###############',
      ' P...R...R...E#',
      '###...#...#####',
      '##### ### #####',
      '###############',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 13, y: 5 },
    solution: moves(
      ['right', 2],
      ['down', 1],
      ['right', 2],
      ['left', 1],
      ['up', 1],
      ['right', 3],
      ['down', 1],
      ['right', 2],
      ['left', 1],
      ['up', 1],
      ['right', 5],
    ),
  },
];

/** Introduces preparation, then gravity, then a chained gravity puzzle over the campaign. */
export function exitPuzzleForLevel(index: number): ExitPuzzle {
  return EXIT_PUZZLES[index < 3 ? 0 : index < 6 ? 1 : 2];
}
