import type { Direction, Point } from './types';
import { composeVault } from './VaultComposer';
import { LOOT_PUZZLES } from './LootPuzzles';

export interface ExitPuzzle {
  name: string;
  hint: string;
  rows: readonly string[];
  entry: Point;
  exit: Point;
  solution: readonly Direction[];
  stages?: readonly { entry: Point; name: string; hint: string }[];
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
  {
    name: 'Dwa piętra skał',
    hint: 'Dwa głazy dzielą podporę. Sprawdź głębokość szybu i zostaw sobie boczny odwrót.',
    rows: [
      '###########',
      '###########',
      '###########',
      '###########',
      '#####R#####',
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
    name: 'Najpierw górny głaz',
    hint: 'Nie odkopuj dolnej wnęki zbyt wcześnie: górny głaz może ją zatkać. Najpierw przygotuj mu miejsce wyżej.',
    rows: [
      '#############',
      '#############',
      '##......#####',
      '##.###..#####',
      '##.###..#####',
      ' P...R..#####',
      '###..R..#####',
      '#####E#######',
      '#############',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 5, y: 7 },
    solution: moves(
      ['right', 1],
      ['up', 3],
      ['right', 5],
      ['down', 3],
      ['left', 1],
      ['up', 3],
      ['left', 4],
      ['down', 3],
      ['right', 4],
      ['down', 1],
      ['up', 1],
      ['left', 2],
      ['down', 1],
      ['right', 1],
      ['down', 1],
    ),
  },
  {
    name: 'Zmiana strony',
    hint: 'Głazy trzeba odsunąć w przeciwne strony. Odkop obie wnęki i zachowaj obejście — nie pchaj na ślepo.',
    // Original layout; narrow-space planning references Boulder Dash's Crowd, not its cave data.
    rows: [
      '###########',
      '###########',
      '##.....####',
      '##.###.####',
      '##.###.####',
      ' P...R.####',
      '#####.#####',
      '###.....###',
      '###.###.###',
      '###..R..###',
      '#####.#####',
      '#####E#####',
      '###########',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 5, y: 11 },
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
      ['left', 2],
      ['down', 2],
      ['right', 1],
      ['left', 1],
      ['up', 2],
      ['right', 4],
      ['down', 2],
      ['left', 2],
      ['down', 2],
    ),
  },
];

/** Twelve distinct compositions: introduce mechanics, then combine them in different orders. */
export const CAMPAIGN_VAULTS: readonly ExitPuzzle[] = [
  composeVault('Podkop i pierwsza zasuwa', [LOOT_PUZZLES[0], EXIT_PUZZLES[0]]),
  composeVault('Dostawa z dwóch szybów', [LOOT_PUZZLES[1], EXIT_PUZZLES[1]]),
  composeVault('Zwał nad magazynem', [LOOT_PUZZLES[2], EXIT_PUZZLES[0], EXIT_PUZZLES[1]]),
  composeVault('Korzenna droga bez powrotu', [LOOT_PUZZLES[3], EXIT_PUZZLES[3]]),
  composeVault('Zielony skarbiec', [LOOT_PUZZLES[4], LOOT_PUZZLES[0], EXIT_PUZZLES[0]]),
  composeVault('Zasuwy pod korzeniami', [LOOT_PUZZLES[5], EXIT_PUZZLES[5]]),
  composeVault('Basowy komin', [LOOT_PUZZLES[2], EXIT_PUZZLES[4]]),
  composeVault('Ładunek między uskokami', [LOOT_PUZZLES[1], LOOT_PUZZLES[4], EXIT_PUZZLES[3]]),
  composeVault('Lawinowa kopalnia', [LOOT_PUZZLES[3], LOOT_PUZZLES[2], LOOT_PUZZLES[1], EXIT_PUZZLES[3]]),
  composeVault('Szkło pod dwiema zasuwami', [LOOT_PUZZLES[5], EXIT_PUZZLES[4]]),
  composeVault('Wyprawa bez odwrotu', [LOOT_PUZZLES[4], LOOT_PUZZLES[3], EXIT_PUZZLES[5], EXIT_PUZZLES[3]]),
  composeVault('Ostatnia lawina Tasiora', [
    LOOT_PUZZLES[2],
    LOOT_PUZZLES[5],
    LOOT_PUZZLES[3],
    EXIT_PUZZLES[4],
    EXIT_PUZZLES[3],
  ]),
];

/** Selects a fixed authored composition; invalid level indices never silently reuse the last puzzle. */
export function exitPuzzleForLevel(index: number): ExitPuzzle {
  const puzzle = CAMPAIGN_VAULTS[index];
  if (!puzzle) throw new Error('Nieznana komora poziomu');
  return puzzle;
}
