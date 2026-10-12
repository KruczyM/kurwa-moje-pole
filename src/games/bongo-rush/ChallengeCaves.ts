import type { ExitPuzzle } from './ExitPuzzles';
import { composeVault } from './VaultComposer';
import { LOOT_PUZZLES } from './LootPuzzles';
import type { Direction, LevelDefinition, Point } from './types';
import { STEP_SECONDS } from './types';

/** Expands deliberate cardinal routes; the production simulation evaluates every step. */
function moves(...runs: [Direction, number][]): Direction[] {
  return runs.flatMap(([direction, count]) => Array<Direction>(count).fill(direction));
}

/** Opens a support from the side, crushes a penned enemy, then returns for its dropped loot. */
export function huntingPocket(reservoir = false, timingLoops = 1): ExitPuzzle {
  return {
    name: reservoir ? 'Rezerwuar nad pułapką' : 'Wyspa z pułapką',
    hint: 'Obserwuj kwadrat w trzyczęściowym kanale. Odkop podporę, gdy wraca pod szyb, i od razu cofnij się. Po uderzeniu wróć po łup; za wczesny zrzut zablokuje pułapkę.',
    rows: [
      '###########',
      reservoir ? '###QQQQQQ##' : '###########',
      reservoir ? '##.QQQQQQ##' : '###########',
      reservoir ? '##.OQQQQQ##' : '###########',
      reservoir ? '##.......##' : '###########',
      ' PO..R...E#',
      '###...#####',
      '#####S  ###',
      '###########',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 9, y: 5 },
    solution: [
      ...(reservoir
        ? moves(['right', 1], ['up', 2], ['right', 1], ['left', 1], ['down', 2], ['right', 1])
        : moves(['right', 2])),
      ...Array.from({ length: timingLoops }, () => ['left', 'right'] as Direction[]).flat(),
      ...moves(
        ['down', 1],
        ['right', 2],
        ['left', 1],
        ['up', 1],
        ['down', 1],
        ['right', 1],
        ['left', 1],
        ['up', 1],
        ['right', 5],
      ),
    ],
  };
}

/** Two rows of three sealed islands, connected at the right; return along a mirrored second row. */
function sixIslands(): ExitPuzzle {
  const top = composeVault(
    'Trzy wyspy',
    [1, 2, 1].map((loops) => huntingPocket(false, loops)),
  );
  const bottom = composeVault(
    'Trzy wyspy powrotne',
    [2, 2, 1].map((loops) => huntingPocket(false, loops)),
  );
  const width = top.rows[0].length,
    offset = top.rows.length + 3;
  const grid = Array.from({ length: top.rows.length + offset }, () => Array<string>(width).fill('#'));
  top.rows.forEach((row, y) =>
    [...row].forEach((tile, x) => {
      grid[y][x] = tile === 'E' || tile === 'P' ? ' ' : tile;
      grid[y + offset][width - 1 - x] = tile === 'P' ? ' ' : tile;
    }),
  );
  for (let y = top.exit.y; y <= top.entry.y + offset; y++) grid[y][top.exit.x] = '.';
  grid[top.entry.y][0] = '#';
  grid[top.entry.y + offset][width - 1] = '#';
  grid[top.entry.y][top.entry.x] = 'P';
  return {
    name: 'Sześć wysp BHP',
    hint: huntingPocket().hint,
    rows: grid.map((row) => row.join('')),
    entry: top.entry,
    exit: { x: width - 1 - top.exit.x, y: top.exit.y + offset },
    solution: [
      ...top.solution,
      ...moves(['down', offset]),
      ...bottom.solution.map((direction): Direction =>
        direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction,
      ),
    ],
  };
}

/** An inward/outward spiral: collect every milestone, then escape sideways from the central falling door. */
function spiral(): ExitPuzzle {
  const grid = Array.from({ length: 25 }, () => Array<string>(25).fill('#'));
  const entry = { x: 1, y: 5 },
    cursor = { ...entry },
    route: Direction[] = [];
  grid[entry.y][entry.x] = '.';
  const runs: [Direction, number][] = [
    ['down', 18],
    ['right', 22],
    ['up', 22],
    ['left', 20],
    ['down', 20],
    ['right', 18],
    ['up', 18],
    ['left', 16],
    ['down', 16],
    ['right', 14],
    ['up', 14],
    ['left', 12],
    ['down', 12],
    ['right', 10],
    ['up', 10],
    ['left', 8],
    ['down', 8],
    ['right', 6],
    ['up', 6],
    ['left', 4],
    ['down', 4],
    ['right', 2],
    ['up', 2],
  ];
  for (const direction of moves(...runs)) {
    cursor.x += direction === 'right' ? 1 : direction === 'left' ? -1 : 0;
    cursor.y += direction === 'down' ? 1 : direction === 'up' ? -1 : 0;
    grid[cursor.y][cursor.x] = '.';
    route.push(direction);
  }
  grid[10][13] = 'R';
  grid[11][13] = 'O';
  for (const y of [17, 19, 21, 23]) grid[y][12] = 'O';
  grid[5][1] = 'P';
  grid[5][2] = 'E';
  const reverse: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const returnRoute = moves(...runs)
    .reverse()
    .map((direction) => reverse[direction]);
  return {
    name: 'Spirala z pamięcią',
    hint: 'Zbierz złote łupy na kolejnych zwojach. Ze środka po zabraniu podpory cofnij się dwa pola w dół i od razu w lewo; skała zamknie środek za Tobą.',
    rows: grid.map((row) => row.join('')),
    entry,
    exit: { x: 2, y: 5 },
    solution: [...route, ...returnRoute, 'right'],
  };
}

const LETTERS: Record<string, readonly string[]> = {
  K: ['101', '110', '100', '110', '101'],
  U: ['101', '101', '101', '101', '111'],
  R: ['110', '101', '110', '101', '101'],
  W: ['101', '101', '101', '111', '101'],
  A: ['010', '101', '111', '101', '101'],
  M: ['101', '111', '111', '101', '101'],
  O: ['111', '101', '101', '101', '111'],
  J: ['001', '001', '001', '101', '111'],
  E: ['111', '100', '110', '100', '111'],
  P: ['110', '101', '110', '100', '100'],
  L: ['100', '100', '100', '100', '111'],
};

/** Real loose rocks spell three words. Their lower strokes support mandatory loot and close mined passages. */
function stoneLetters(): ExitPuzzle {
  const width = 25,
    height = 27;
  const grid = Array.from({ length: height }, (_, y) =>
    Array<string>(width).fill(y === 0 || y === height - 1 ? '#' : '.'),
  );
  for (const row of grid) {
    row[0] = '#';
    row[width - 1] = '#';
  }
  ['KURWA', 'MOJE', 'POLE'].forEach((word, line) => {
    const top = 3 + line * 8,
      bottom = top + 5;
    for (let x = 2; x < width - 2; x++) grid[bottom + 1][x] = '#';
    [...word].forEach((letter, index) =>
      LETTERS[letter].forEach((row, dy) =>
        [...row].forEach((bit, dx) => {
          if (bit === '1') grid[top + dy][3 + index * 4 + dx] = 'R';
        }),
      ),
    );
    for (let x = 3; x < width - 2; x++) if (grid[bottom - 1][x] === 'R') grid[bottom][x] = 'O';
  });
  grid[5][1] = 'P';
  grid[24][23] = 'E';
  grid[5][0] = ' ';
  return {
    name: 'KURWA MOJE POLE',
    hint: 'Kamienne litery są luźne. Zbieraj pod ich dolnymi kreskami, nie rozkopuj od góry. Najpierw zaplanuj kierunek przejścia i odwrót.',
    rows: grid.map((row) => row.join('')),
    entry: { x: 1, y: 5 },
    exit: { x: 23, y: 24 },
    solution: moves(['down', 3], ['right', 22], ['down', 8], ['left', 22], ['down', 8], ['right', 22]),
  };
}

/** Adds an optional live wall-following arena, isolated by soil until the player deliberately opens it. */
function withSweeperArena(puzzle: ExitPuzzle): ExitPuzzle {
  const width = puzzle.rows[0].length;
  const grid = puzzle.rows.map((row) => [...row]);
  // Upper-left reserved wall block, away from all recorded entrances and mining supports.
  if (width >= 11 && grid[1].slice(1, 8).every((tile) => tile === '#')) {
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 7; x++) grid[y][x] = ' ';
    grid[2][4] = '#';
    grid[1][2] = 'S';
    grid[4][2] = '.';
  }
  return { ...puzzle, rows: grid.map((row) => row.join('')) };
}

/** Converts an authored chamber to a complete challenge without replacing existing campaign physics. */
function level(puzzle: ExitPuzzle, id: number, requiredKills: number): LevelDefinition {
  const rows = puzzle.rows.map((row) => `#${row.slice(1)}`);
  const requiredPickups: Point[] = rows.flatMap((row, y) =>
    [...row].flatMap((tile, x) => (tile === 'O' ? [{ x, y }] : [])),
  );
  return {
    id,
    title: puzzle.name,
    hint: puzzle.hint,
    biome: (id - 13) % 4,
    bonus: true,
    rows,
    requiredPickups,
    requiredKills,
    quota: requiredPickups.length + requiredKills,
    solution: puzzle.solution,
    timeLimitSeconds: Math.max(240, Math.ceil((puzzle.solution.length * STEP_SECONDS * 4) / 30) * 30),
    vault: { entry: puzzle.entry, name: puzzle.name, hint: puzzle.hint, stages: puzzle.stages },
  };
}

/** Four new challenges use original layouts inspired by the supplied reservoir, island and spiral references. */
export function buildChallenges(gates: readonly ExitPuzzle[]): readonly LevelDefinition[] {
  return [
    level(
      composeVault('Dwa rezerwuary, dwa spusty', [
        huntingPocket(true, 2),
        huntingPocket(true, 3),
        LOOT_PUZZLES[1],
        gates[4],
      ]),
      13,
      2,
    ),
    level(sixIslands(), 14, 6),
    level(spiral(), 15, 0),
    level(
      composeVault('KURWA MOJE POLE — skalny finał', [
        stoneLetters(),
        withSweeperArena(huntingPocket(false, 2)),
        gates[4],
      ]),
      16,
      1,
    ),
  ];
}
