import { LOOT_PUZZLES } from './LootPuzzles';
import { patrolEncounter, trapInputs, trapLoops } from './PatrolEncounter';
import type {
  LevelDefinition,
  Point,
  ReplayInput,
  LootSource,
  ChamberDefinition,
  PortalPair,
  Direction,
} from './types';

interface Module {
  name: string;
  hint: string;
  rows: readonly string[];
  entry: Point;
  exit: Point;
  solution: readonly ReplayInput[];
  returnRoute?: readonly ReplayInput[];
  lootSources?: readonly LootSource[];
  optionalPickups?: readonly Point[];
}
const run = (direction: Direction, count: number): Direction[] => Array<Direction>(count).fill(direction);

/** A collector must leave the shaft, let each falling bottle land, then collect from the side. */
export function bottleTower(height: number): Module {
  const grid = Array.from({ length: height + 4 }, () => Array<string>(15).fill('#'));
  const y = height + 1;
  for (let x = 1; x <= 13; x++) grid[y][x] = '.';
  for (let row = 1; row <= height; row++) grid[row][8] = 'O';
  grid[y][1] = 'P';
  grid[y][13] = 'E';
  const solution: ReplayInput[] = [...run('right', 7)];
  for (let n = 0; n < height; n++) solution.push('left', undefined, 'right');
  solution.push(...run('right', 5));
  return {
    name: 'Wieża amaren',
    hint: 'Odkop podporę, cofnij się w lewo i poczekaj na opadnięcie butelki. Dopiero wtedy wróć po łup.',
    rows: grid.map((row) => row.join('')),
    entry: { x: 1, y },
    exit: { x: 13, y },
    solution,
    returnRoute: run('left', 12),
  };
}

/** A bounded emitter makes the player alternate collection with clearing its outlet. */
export function cobraCache(count: number, roots = 1): Module {
  const grid = Array.from({ length: 9 }, () => Array<string>(15).fill('#'));
  for (let y = 3; y <= 6; y++) for (let x = 1; x <= 13; x++) grid[y][x] = '.';
  for (let x = 1; x <= 13; x++) grid[4][x] = ' ';
  grid[5][6] = '#';
  grid[4][1] = 'P';
  grid[6][13] = 'E';
  const rootPoints = Array.from({ length: roots }, (_, n) => ({ x: [5, 9, 12][n], y: 3 }));
  for (const root of rootPoints) grid[root.y][root.x] = ' ';
  const solution: ReplayInput[] = [...run('right', 3), 'down', 'up', ...run('right', 2)];
  for (let n = 1; n < count; n++) solution.push('left', 'right');
  solution.push('left', 'down', 'down', ...run('right', 8));
  return {
    name: 'Skrzynia Kobry',
    hint: 'Najpierw obejrzyj ujście i dolny odwrót. Rozbij oznaczony kafel: łup wypływa pojedynczo, a Kobra zaczyna rosnąć.',
    rows: grid.map((row) => row.join('')),
    entry: { x: 1, y: 4 },
    exit: { x: 13, y: 6 },
    solution,
    returnRoute: [...run('left', 12), 'up', 'up'],
    lootSources: [{ tile: { x: 4, y: 5 }, outlet: { x: 6, y: 4 }, count, roots: rootPoints }],
  };
}

/** Independent caches expose a choice of trigger order and leave growing roots behind. */
function multiCache(counts: readonly number[]): Module {
  const width = counts.length * 8 + 7;
  const grid = Array.from({ length: 9 }, () => Array<string>(width).fill('#'));
  for (let y = 3; y <= 6; y++) for (let x = 1; x < width - 1; x++) grid[y][x] = '.';
  for (let x = 1; x < width - 1; x++) grid[4][x] = ' ';
  grid[4][1] = 'P';
  grid[6][width - 2] = 'E';
  const sources: LootSource[] = [];
  const solution: ReplayInput[] = [];
  let cursor = 1;
  counts.forEach((count, index) => {
    const tile = { x: 4 + index * 8, y: 5 },
      outlet = { x: 6 + index * 8, y: 4 },
      root = { x: 5 + index * 8, y: 3 };
    grid[5][outlet.x] = '#';
    grid[root.y][root.x] = ' ';
    solution.push(...run('right', tile.x - cursor), 'down', 'up', 'right', 'right');
    if (index % 2 === 0) solution.push(undefined);
    for (let n = 1; n < count; n++) solution.push('left', 'right');
    cursor = outlet.x;
    sources.push({ tile, outlet, count, roots: [root] });
  });
  solution.push('left', 'down', 'down', ...run('right', width - 2 - (cursor - 1)));
  return {
    name: 'Niezależne skrytki',
    hint: 'Wybierz kolejność skrytek. Każda uwalnia własny łup i uruchamia osobny korzeń Kobry; dolny tunel zostaw na odwrót.',
    rows: grid.map((row) => row.join('')),
    entry: { x: 1, y: 4 },
    exit: { x: width - 2, y: 6 },
    solution,
    lootSources: sources,
  };
}

/** Two reachable circuits guard optional mining branches off the shutter puzzle. */
function rootLabyrinth(): Module {
  const base = LOOT_PUZZLES[5];
  const grid = Array.from({ length: 15 }, () => Array<string>(25).fill('#'));
  base.rows.forEach((row, y) => [...row].forEach((cell, x) => (grid[y][x] = x === 0 ? '#' : cell)));
  for (const [y, symbol] of [
    [2, 'C'],
    [8, 'B'],
  ] as const) {
    for (let x = 15; x <= 21; x++) grid[y][x] = grid[y + 2][x] = ' ';
    grid[y + 1][15] = grid[y + 1][21] = ' ';
    grid[y][16] = symbol;
    for (let x = 7; x <= 15; x++) grid[y + 1][x] = '.';
    grid[y + 1][12] = 'K';
    grid[y + 1][22] = 'O';
  }
  return {
    ...base,
    name: 'Zielony labirynt',
    hint: 'Dwie zasuwy strzegą głównego łupu. Boczne pętle mają różne patrole i dodatkowe liście; odkopana Kobra może odciąć skrót.',
    rows: grid.map((row) => row.join('')),
    optionalPickups: [
      { x: 22, y: 3 },
      { x: 22, y: 9 },
    ],
  };
}

/** Two independently supported pockets introduce a real choice immediately beside the spawn. */
function firstWarehouse(): Module {
  return {
    name: 'Podziemna hurtownia',
    hint: 'Wybierz górną lub dolną kieszeń. Zabierz butelkę spod podpory i odsuń się zanim spadnie głaz; potem wróć do wyjścia.',
    rows: [
      '###################',
      '###################',
      '####.....##########',
      '####..RO.##########',
      '####..O..##########',
      '#P.......E#########',
      '####..O..##########',
      '####.R.O.##########',
      '####.....##########',
      '###################',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 9, y: 5 },
    solution: [...run('right', 3), 'up', 'right', 'right', 'left', 'down', ...run('right', 4)],
  };
}

/** A compact finale keeps the boss pen above a sealed two-push gate. */
function bossVault(): Module {
  const grid = Array.from({ length: 13 }, () => Array<string>(23).fill('#'));
  for (let x = 1; x <= 20; x++) grid[8][x] = '.';
  for (let y = 2; y <= 7; y++) for (let x = 17; x <= 18; x++) grid[y][x] = ' ';
  for (let x = 16; x <= 20; x++) grid[8][x] = ' ';
  grid[2][18] = 'J';
  grid[8][1] = 'P';
  grid[8][2] = 'O';
  grid[8][15] = 'R';
  grid[9][15] = '.';
  grid[9][16] = 'E';
  return {
    name: 'Zagroda Tasiora',
    hint: 'Najpierw opróżnij oba skarbce. Następnie pchnij głaz dwa razy w prawo, cofnij się i zejdź do wyjścia.',
    rows: grid.map((row) => row.join('')),
    entry: { x: 1, y: 8 },
    exit: { x: 16, y: 9 },
    solution: [...run('right', 15), 'left', 'down', 'right'],
  };
}

const shift = (point: Point): Point => ({ x: point.x + 3, y: point.y + 3 });
function author(
  id: number,
  title: string,
  biome: number,
  module: Module,
  rooms: readonly { module: Module; required: boolean }[] = [],
): LevelDefinition {
  const width = module.rows[0].length + 6;
  const grid = Array.from({ length: module.rows.length + 6 }, () => Array<string>(width).fill('#'));
  module.rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      grid[y + 3][x + 3] = x === 0 && cell === ' ' ? '#' : cell;
    }),
  );
  const entry = shift(module.entry);
  const mainLoot: Point[] = [];
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell === 'O' && !module.optionalPickups?.some((point) => point.x + 3 === x && point.y + 3 === y))
        mainLoot.push({ x, y });
    }),
  );
  const sources = module.lootSources?.map((source) => ({
    ...source,
    required: true,
    tile: shift(source.tile),
    outlet: shift(source.outlet),
    roots: source.roots.map(shift),
  }));
  const chambers: ChamberDefinition[] = [];
  const portals: PortalPair[] = [];
  const visit: ReplayInput[] = [];
  const requiredTrips: ReplayInput[][] = [];
  const optional: ReplayInput[] = [];
  rooms.forEach(({ module: room, required }, index) => {
    const name = `room-${index + 1}`;
    const landing = { x: entry.x, y: entry.y + (index === 0 ? -1 : 1) };
    grid[landing.y][landing.x] = ' ';
    const requiredPickups: Point[] = [];
    if (required)
      room.rows.forEach((row, y) =>
        [...row].forEach((cell, x) => {
          if (cell === 'O') requiredPickups.push({ x, y });
        }),
      );
    const rows = room.rows.map((row) => row.replace('E', ' '));
    chambers.push({
      id: name,
      name: room.name,
      hint: room.hint,
      rows,
      requiredPickups,
      lootSources: room.lootSources?.map((source) => ({ ...source, required })),
    });
    portals.push({
      name: required ? 'Wymagany skarbiec' : 'Boczny skarbiec',
      a: { ...landing, chamber: 'main' },
      b: { ...room.entry, chamber: name },
    });
    const trip: ReplayInput[] = [
      index === 0 ? 'up' : 'down',
      ...room.solution,
      ...(room.returnRoute ?? []),
      index === 0 ? 'down' : 'up',
    ];
    (required ? visit : optional).push(...trip);
    if (required) requiredTrips.push(trip);
  });
  const sourceCount = sources?.reduce((n, s) => n + s.count, 0) ?? 0;
  const requiredRoomCount = rooms
    .filter((r) => r.required)
    .reduce(
      (n, r) =>
        n +
        r.module.rows
          .join('')
          .split('')
          .filter((c) => c === 'O').length +
        (r.module.lootSources?.reduce((m, s) => m + s.count, 0) ?? 0),
      0,
    );
  const quota = id === 1 ? 1 : Math.max(1, mainLoot.length + sourceCount + requiredRoomCount);
  const patrolRoom = module.rows.some((row) => row.includes('U'));
  const opening = rooms.filter((room) => room.required).length * 2 + 1;
  const moduleRoute = patrolRoom ? [undefined, ...trapInputs(trapLoops('U', opening))] : module.solution;
  const replay = [...visit, ...moduleRoute];
  return {
    id,
    title,
    biome,
    bonus: id > 12,
    style: id % 2 ? 'exploration' : 'puzzle',
    rows: grid.map((row) => row.join('')),
    quota,
    hint: module.hint,
    requiredPickups: id === 1 ? [] : patrolRoom ? mainLoot.slice(0, 1) : mainLoot,
    lootSources: sources,
    chambers,
    portals,
    solution: replay.filter((input): input is Direction => input !== undefined),
    replay,
    alternateReplays:
      requiredTrips.length > 1
        ? [
            {
              name: 'Odwrotna kolejność skarbców',
              inputs: [...[...requiredTrips].reverse().flat(), ...moduleRoute],
            },
          ]
        : optional.length
          ? [{ name: 'Z bocznym skarbcem', inputs: [...visit, ...optional, ...module.solution] }]
          : [],
    terrainTheme: id % 3,
    timeLimitSeconds: id > 12 ? Math.max(180, replay.length * 2) : undefined,
  };
}

/** Fixed campaign definitions, with short authored rooms instead of long service galleries. */
export function buildCampaignV4(): readonly LevelDefinition[] {
  const patrol = patrolEncounter('U');
  const encounter: Module = { ...patrol, solution: trapInputs(trapLoops('U', 0)) };
  const levels: LevelDefinition[] = [
    author(1, 'Podziemna hurtownia', 0, firstWarehouse()),
    author(2, 'Szyby dostawcze', 0, bottleTower(5)),
    author(3, 'Magazyn pod zwałem', 0, cobraCache(8)),
    author(4, 'Katakumby korzeni', 1, LOOT_PUZZLES[0], [{ module: bottleTower(3), required: false }]),
    author(5, 'Zielony labirynt', 1, rootLabyrinth(), [{ module: cobraCache(6), required: false }]),
    author(6, 'Serce kolonii', 1, cobraCache(6), [{ module: bottleTower(4), required: true }]),
    author(7, 'Kopalnia basu', 2, encounter),
    author(8, 'Neonowe uskoki', 2, LOOT_PUZZLES[5], [{ module: bottleTower(5), required: false }]),
    author(9, 'Rave pod lawiną', 2, multiCache([6, 8]), [{ module: cobraCache(8), required: false }]),
    author(10, 'Kryształowe głębiny', 3, LOOT_PUZZLES[4], [{ module: bottleTower(6), required: true }]),
    author(11, 'Dwanaście podziemnych dróg', 3, LOOT_PUZZLES[1], [
      { module: bottleTower(4), required: true },
      { module: cobraCache(8), required: true },
    ]),
    author(12, 'Twierdza Tasiora', 3, bossVault(), [
      { module: bottleTower(5), required: true },
      { module: cobraCache(8, 2), required: true },
    ]),
    author(13, 'Wieża amaren', 0, bottleTower(8), [{ module: bottleTower(6), required: true }]),
    author(14, 'Ogród Kobry', 1, multiCache([5, 6, 7])),
    author(15, 'Neonowy skarbiec', 2, encounter, [
      { module: cobraCache(10), required: true },
      { module: bottleTower(5), required: true },
    ]),
    author(16, 'Wielki zawał', 3, LOOT_PUZZLES[2], [{ module: bottleTower(8), required: true }]),
  ];
  levels[0].decorations = [
    { at: { x: 1, y: 6 }, kind: 'vertical', variant: 0 },
    { at: { x: 4, y: 4 }, kind: 'horizontal', variant: 1 },
    { at: { x: 4, y: 10 }, kind: 'accent', variant: 2 },
  ];
  levels[11].gate = shift({ x: 17, y: 8 });
  levels[11].pen = Array.from({ length: 12 }, (_, n) => shift({ x: 17 + (n % 2), y: 2 + Math.floor(n / 2) }));
  // First level has two different routes and no mandatory room detour.
  levels[0].alternateReplays = [
    {
      name: 'Dolna kieszeń',
      inputs: levels[0].replay!.map((input) => (input === 'up' ? 'down' : input === 'down' ? 'up' : input)),
    },
  ];
  return levels;
}
