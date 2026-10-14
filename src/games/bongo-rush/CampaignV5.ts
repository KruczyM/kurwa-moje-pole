import type { ExitPuzzle } from './ExitPuzzles';
import { EXIT_PUZZLES } from './ExitPuzzles';
import { LOOT_PUZZLES } from './LootPuzzles';
import { alignExit } from './VaultComposer';
import { buildChallenges, huntingPocket } from './ChallengeCaves';
import type {
  Direction,
  LevelDefinition,
  Point,
  TerrainMotif,
  LootSource,
  ReplayInput,
  PortalPair,
} from './types';
import { neighbour } from './types';

const run = (d: Direction, n: number): Direction[] => Array<Direction>(n).fill(d);
const mirrorDirection = (d: Direction): Direction => (d === 'left' ? 'right' : d === 'right' ? 'left' : d);

/** Alternating floors make compact reservoirs and gates instead of a long service hallway. */
export function foldedRooms(name: string, modules: readonly ExitPuzzle[]): ExitPuzzle {
  const parts = modules.map(alignExit),
    width = Math.max(...parts.map((p) => p.rows[0].length)) + 4;
  const height = parts.reduce((n, p) => n + p.rows.length + 3, 1);
  const grid = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  const solution: Direction[] = [];
  let offset = 1,
    entry: Point | undefined,
    previousExit: Point | undefined;
  parts.forEach((part, i) => {
    const flip = i % 2 === 1,
      pw = part.rows[0].length;
    const point = (p: Point) => ({ x: 2 + (flip ? pw - 1 - p.x : p.x), y: offset + p.y });
    part.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        const at = point({ x, y });
        grid[at.y][at.x] = c === 'P' || c === 'E' ? ' ' : x === 0 ? '#' : c;
      }),
    );
    const start = point(part.entry),
      end = point(part.exit);
    if (!entry) {
      entry = start;
      grid[start.y][start.x] = 'P';
    }
    if (previousExit) {
      const cursor = { ...previousExit },
        gutter = flip ? width - 2 : 1;
      const walk = (axis: 'x' | 'y', value: number) => {
        while (cursor[axis] !== value) {
          const sign = Math.sign(value - cursor[axis]);
          cursor[axis] += sign;
          solution.push(axis === 'x' ? (sign > 0 ? 'right' : 'left') : sign > 0 ? 'down' : 'up');
          grid[cursor.y][cursor.x] = ' ';
        }
      };
      walk('x', gutter);
      walk('y', start.y);
      walk('x', start.x);
    }
    solution.push(...part.solution.map((d) => (flip ? mirrorDirection(d) : d)));
    previousExit = end;
    offset += part.rows.length + 3;
  });
  grid[previousExit!.y][previousExit!.x] = 'E';
  return {
    name,
    hint: modules.map((p) => p.hint).join(' '),
    rows: grid.map((r) => r.join('')),
    entry: entry!,
    exit: previousExit!,
    solution,
  };
}

/** The colony is sealed by the deposit itself; removing its last layers exposes growth space. */
function colonyDeposit(columns = 6, layers = 4, two = false): ExitPuzzle {
  const p = layeredReservoir(columns, layers),
    grid = p.rows.map((r) => [...r]);
  grid[1][4] = 'V';
  if (two) grid[1][5 + columns] = 'V';
  return {
    ...p,
    name: two ? 'Dwie kolonie' : 'Serce złoża',
    rows: grid.map((r) => r.join('')),
    hint: 'Kolonie są zablokowane przez przedmioty. Przygotuj dolną galerię, a po odsłonięciu twarzy pilnuj drogi odwrotu.',
  };
}

/** Existing growth on a separate approach races towards a shared junction. */
export function growingPassage(): ExitPuzzle {
  return {
    name: 'Zarastający przesmyk',
    hint: 'Kobra rośnie już od początku. Najpierw zbierz boczną amarenę i przejdź przez środkowe skrzyżowanie, zanim zajmie je kolonia.',
    rows: [
      '#################',
      '####V############',
      '#### ############',
      '#### ############',
      '#### ############',
      '#P.. O.........E#',
      '######.##########',
      '######O##########',
      '#################',
    ],
    entry: { x: 1, y: 5 },
    exit: { x: 15, y: 5 },
    solution: [...run('right', 5), 'down', 'down', 'up', 'up', ...run('right', 9)],
  };
}

/** Two receiving ledges at different heights must be mined separately. */
function terracedDeposit(): ExitPuzzle {
  return foldedRooms('Schodkowa lawina', [layeredReservoir(5, 3), layeredReservoir(3, 5)]);
}

/** A buried prize must be approached through the mass; descending escapes the collapsing return. */
export function deepDeposit(two = false): ExitPuzzle {
  const grid = Array.from({ length: 9 }, () => Array<string>(17).fill('#'));
  for (let y = 1; y <= 5; y++) for (let x = 5; x <= 10; x++) grid[y][x] = 'Q';
  for (let x = 1; x <= 4; x++) grid[3][x] = '.';
  for (let x = 8; x <= 14; x++) grid[6][x] = '.';
  grid[3][1] = 'P';
  grid[3][9] = 'O';
  grid[6][14] = 'E';
  grid[1][4] = 'V';
  if (two) grid[1][11] = 'V';
  return {
    name: 'Ostatnia amarena',
    hint: 'Złota amarena jest w głębi górki. Wejdź środkową warstwą, po jej zabraniu schodź w dół i uciekaj prawą wnęką. Powrót tą samą drogą prowadzi pod kaskadę.',
    rows: grid.map((r) => r.join('')),
    entry: { x: 1, y: 3 },
    exit: { x: 14, y: 6 },
    solution: [...run('right', 8), ...run('down', 3), ...run('right', 5)],
  };
}

/** A compact funnel with staggered retaining walls and two independent outlets. */
function funnel(): ExitPuzzle {
  const p = layeredReservoir(8, 5),
    grid = p.rows.map((r) => [...r]);
  for (let y = 1; y <= 4; y++) {
    for (let x = 5; x < 10 - y; x++) grid[y][x] = '#';
    for (let x = 8 + y; x < 13; x++) grid[y][x] = '#';
  }
  return {
    ...p,
    name: 'Lej',
    rows: grid.map((r) => r.join('')),
    hint: 'Skośne ściany kierują przedmioty do dwóch ujść. Przygotuj całą dolną galerię; nie czekaj pod środkową kaskadą.',
  };
}

/** A broad deposit above a receiving gallery: excavate first, then harvest settled layers. */
export function layeredReservoir(columns = 6, layers = 4): ExitPuzzle {
  const width = columns + 10,
    y = layers + 1;
  const grid = Array.from({ length: y + 2 }, () => Array<string>(width).fill('#'));
  for (let row = 1; row <= layers; row++) for (let x = 5; x < 5 + columns; x++) grid[row][x] = 'O';
  for (let x = 1; x < width - 1; x++) grid[y][x] = '.';
  grid[y][1] = 'P';
  grid[y][width - 2] = 'E';
  const solution: Direction[] = [];
  // The first pass prepares the gallery. Each following pass collects a settled layer.
  for (let pass = 0; pass <= layers; pass++) {
    solution.push(...run(pass % 2 ? 'left' : 'right', width - 4));
    if (pass < layers) solution.push(...run('down', layers * 2 + 1));
  }
  solution.push(...run('right', layers % 2 ? width - 3 : 1));
  return {
    name: 'Warstwy amaren',
    hint: 'Najpierw odkop dolną galerię. Wycofaj się poza złoże, pozwól opaść warstwom i zbieraj od boku; nie zawracaj pod kaskadą.',
    rows: grid.map((r) => r.join('')),
    entry: { x: 1, y },
    exit: { x: width - 2, y },
    solution,
  };
}

/** Continuous bands follow actual room boundaries; there are no random decorative candidates. */
export function architecturalBands(rows: readonly string[], variant = 0): TerrainMotif[] {
  const motifs: TerrainMotif[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 1; x + 2 < rows[0].length; x++) {
      const boundary =
        rows[y].slice(x, x + 3) === '###' &&
        [y - 1, y + 1].some((n) => n >= 0 && n < rows.length && /[^#]/.test(rows[n].slice(x, x + 3)));
      if (boundary) {
        motifs.push({ at: { x, y }, kind: 'horizontal', variant });
        x += 2;
      }
    }
  }
  for (let x = 0; x < rows[0].length; x++) {
    for (let y = 1; y + 2 < rows.length; y++) {
      const solid = [0, 1, 2].every((d) => rows[y + d][x] === '#');
      const edge = [x - 1, x + 1].some(
        (n) => n >= 0 && n < rows[0].length && [0, 1, 2].every((d) => rows[y + d][n] !== '#'),
      );
      if (solid && edge) {
        motifs.push({ at: { x, y }, kind: 'vertical', variant: variant + 1 });
        y += 2;
      }
    }
  }
  return motifs;
}

export function puzzleLevel(puzzle: ExitPuzzle, id: number, title = puzzle.name): LevelDefinition {
  const rows = puzzle.rows.map((row) => '#' + row.slice(1));
  const requiredPickups: Point[] = rows.flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === 'O' ? [{ x, y }] : [])),
  );
  return {
    id,
    title,
    hint: puzzle.hint,
    biome: Math.min(3, Math.floor((id - 1) / 5)),
    rows,
    quota: Math.max(1, requiredPickups.length),
    requiredPickups,
    solution: puzzle.solution,
    replay: puzzle.solution,
    bonus: id > 20,
    style: 'puzzle',
    decorations: architecturalBands(rows, Math.floor((id - 1) / 5)),
    terrainTheme: 0,
  };
}

/** A sealed cache drains into a physical receiving gallery while an exposed colony pursues the route. */
function richCache(): LevelDefinition {
  const grid = Array.from({ length: 12 }, () => Array<string>(21).fill('#'));
  for (let x = 1; x <= 5; x++) grid[5][x] = '.';
  for (let y = 5; y <= 9; y++) grid[y][3] = '.';
  for (let y = 2; y <= 8; y++) for (let x = 7; x <= 11; x++) grid[y][x] = ' ';
  for (let x = 3; x <= 18; x++) grid[9][x] = '.';
  grid[4][5] = 'V';
  grid[5][1] = 'P';
  grid[9][18] = 'E';
  const route: ReplayInput[] = [...run('right', 4), ...run('left', 2), ...run('down', 4)];
  for (let pass = 0; pass < 5; pass++) {
    route.push(...run(pass % 2 ? 'left' : 'right', 13));
    if (pass < 4) route.push(...Array<undefined>(6).fill(undefined));
  }
  route.push('right', 'right');
  const source: LootSource = {
    tile: { x: 5, y: 5 },
    outlet: { x: 9, y: 2 },
    count: 12,
    required: true,
    roots: [],
  };
  return {
    id: 10,
    title: 'Bogaty kafelek',
    biome: 1,
    hint: 'Przed rozbiciem skrytki obejrzyj dolną galerię. Łup spada szybem, a odsłonięta twarz zaczyna się powielać. Przy zbieraniu wycofuj się poza zrzut.',
    rows: grid.map((r) => r.join('')),
    quota: 12,
    solution: route.filter((d): d is Direction => d !== undefined),
    replay: route,
    lootSources: [source],
    decorations: architecturalBands(
      grid.map((r) => r.join('')),
      1,
    ),
    style: 'puzzle',
  };
}

/** Portals form a complete loop through prepared chambers rather than optional return trips. */
function portalLevel(id: 12 | 18): LevelDefinition {
  const main = puzzleLevel(
    id === 12 ? LOOT_PUZZLES[5] : LOOT_PUZZLES[2],
    id,
    id === 12 ? 'Teleport: zbiornik' : 'Teleport: trzy komory',
  );
  const start: Point = { x: 1, y: 4 };
  const grid = main.rows.map((r) => [...r]);
  // The last portal brings the player back to a distinct entrance beside the original spawn.
  grid[5][2] = ' ';
  grid[4][1] = ' ';
  const room1 = layeredReservoir(id === 12 ? 6 : 4, id === 12 ? 4 : 3);
  const room2 = colonyDeposit(6, 4);
  const rooms = id === 12 ? [room1] : [room1, room2];
  main.chambers = rooms.map((p, i) => {
    const tiles = p.rows.map((r) => [...r.replace('E', ' ')]);
    tiles[p.entry.y - 1][p.entry.x] = ' ';
    tiles[p.exit.y - 1][p.exit.x] = ' ';
    return {
      id: `vault-${i + 1}`,
      name: p.name,
      hint: p.hint,
      rows: tiles.map((r) => r.join('')),
      requiredPickups: p.rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'O' ? [{ x, y }] : []))),
      decorations: architecturalBands(p.rows, i + 1),
    };
  });
  const landing = (p: Point) => ({ x: p.x, y: p.y - 1 });
  const portals: PortalPair[] = [
    {
      name: 'Do zbiornika',
      a: { chamber: 'main', ...start },
      b: { chamber: 'vault-1', ...landing(room1.entry) },
    },
  ];
  if (id === 18)
    portals.push({
      name: 'Do kolonii',
      a: { chamber: 'vault-1', ...landing(room1.exit) },
      b: { chamber: 'vault-2', ...landing(room2.entry) },
    });
  portals.push({
    name: 'Powrót dolnym obejściem',
    a: { chamber: `vault-${rooms.length}`, ...landing(rooms.at(-1)!.exit) },
    b: { chamber: 'main', x: 1, y: 5 },
  });
  main.portals = portals;
  main.rows = grid.map((r) => r.join(''));
  // Leave spawn then enter its portal; return at x2, already one step along the main puzzle.
  main.replay = [
    'up',
    ...rooms.flatMap((p) => ['down' as const, ...p.solution, 'up' as const]),
    ...main.solution,
  ];
  main.solution = main.replay.filter((d): d is Direction => d !== undefined);
  main.quota += main.chambers.reduce((n, room) => n + room.requiredPickups!.length, 0);
  main.hint =
    'Najpierw przygotuj złoża w komorach. Portale tworzą pętlę między różnymi wysokościami; czas i rozrost płyną także poza aktualną komorą. ' +
    main.hint;
  return main;
}

function finalVault(): LevelDefinition {
  const reservoir = colonyDeposit(6, 4),
    width = reservoir.rows[0].length + 24;
  const grid = Array.from({ length: 15 }, () => Array<string>(width).fill('#'));
  reservoir.rows.forEach((r, y) => [...r].forEach((c, x) => (grid[y][x] = c === 'E' ? ' ' : c)));
  const offset = reservoir.rows[0].length;
  for (let x = reservoir.exit.x; x <= offset + 20; x++) grid[5][x] = '.';
  for (let y = 1; y <= 4; y++) for (let x = offset + 17; x <= offset + 18; x++) grid[y][x] = ' ';
  for (let x = offset + 16; x <= offset + 20; x++) grid[5][x] = ' ';
  grid[1][offset + 18] = 'J';
  grid[5][offset + 15] = 'R';
  grid[6][offset + 15] = '.';
  grid[6][offset + 16] = 'E';
  const solution = [
    ...reservoir.solution,
    ...run('right', offset + 16 - reservoir.exit.x),
    'left' as const,
    'down' as const,
    'right' as const,
  ];
  const p: ExitPuzzle = {
    ...reservoir,
    rows: grid.map((r) => r.join('')),
    solution,
    exit: { x: offset + 16, y: 6 },
    name: 'Finał',
    hint: 'Opróżnij złoże i wydostań się przed rozrostem. Pchnij końcowy głaz dwa razy w prawo, zamykając bossa w zagrodzie; cofnij się i zejdź do wyjścia.',
  };
  const level = puzzleLevel(p, 20);
  level.gate = { x: offset + 17, y: 5 };
  level.pen = Array.from({ length: 8 }, (_, n) => ({ x: offset + 17 + (n % 2), y: 1 + Math.floor(n / 2) }));
  return level;
}

/** Additional recesses between letter strokes, entered from the existing upper galleries. */
function expandedLetters(original: LevelDefinition): LevelDefinition {
  const grid = original.rows.map((r) => [...r]),
    extra: Point[] = [],
    route: Direction[] = [];
  const sy = original.rows.findIndex((r) => r.includes('P'));
  let cursor: Point = { x: original.rows[sy].indexOf('P'), y: sy };
  const visited = new Set<string>();
  for (const input of original.solution) {
    route.push(input);
    cursor = neighbour(cursor, input);
    if (![2, 10, 18].includes(cursor.y) || ![6, 10, 14, 18].includes(cursor.x)) continue;
    const pocket = neighbour(cursor, 'down'),
      key = `${pocket.x},${pocket.y}`;
    if (visited.has(key) || grid[pocket.y][pocket.x] !== '.') continue;
    grid[pocket.y][pocket.x] = 'O';
    visited.add(key);
    extra.push(pocket);
    route.push('down', 'up');
  }
  return {
    ...original,
    rows: grid.map((r) => r.join('')),
    solution: route,
    replay: [...Array<undefined>(5).fill(undefined), ...route],
    requiredPickups: [...original.requiredPickups!, ...extra],
    quota: original.quota + extra.length,
    hint:
      original.hint +
      ' Dodatkowe złote znajdźki są między literami: wejdź do krótkich wnęk z górnych galerii, zanim podkopiesz dolne kreski.',
  };
}

export function buildCampaignV5(): readonly LevelDefinition[] {
  const constructions: [string, ExitPuzzle][] = [
    ['Dwie hale', foldedRooms('Dwie hale', [layeredReservoir(4, 3), LOOT_PUZZLES[0]])],
    ['Warstwy amaren', foldedRooms('Warstwy amaren', [layeredReservoir(7, 4), EXIT_PUZZLES[0]])],
    ['Spust', foldedRooms('Spust', [EXIT_PUZZLES[4], layeredReservoir(6, 5)])],
    [
      'Pokoje i podpory',
      foldedRooms('Pokoje i podpory', [LOOT_PUZZLES[4], LOOT_PUZZLES[0], EXIT_PUZZLES[5]]),
    ],
    ['Lej', foldedRooms('Lej', [funnel(), LOOT_PUZZLES[1]])],
    ['Uśpiona Kobra', foldedRooms('Uśpiona Kobra', [colonyDeposit(5, 3), LOOT_PUZZLES[4]])],
    ['Serce złoża', foldedRooms('Serce złoża', [LOOT_PUZZLES[5], deepDeposit()])],
    ['Zarastający przesmyk', foldedRooms('Zarastający przesmyk', [growingPassage(), LOOT_PUZZLES[1]])],
    [
      'Dwa rezerwuary, jedna droga',
      foldedRooms('Dwa rezerwuary', [colonyDeposit(5, 4), EXIT_PUZZLES[4], layeredReservoir(7, 3)]),
    ],
    ['Bogaty kafelek', LOOT_PUZZLES[5]],
    [
      'Tory i patrole',
      foldedRooms('Tory i patrole', [huntingPocket(true, 2), huntingPocket(false, 0), LOOT_PUZZLES[4]]),
    ],
    ['Teleport: zbiornik', layeredReservoir(6, 4)],
    [
      'Przeciwne zasuwy',
      foldedRooms('Przeciwne zasuwy', [LOOT_PUZZLES[5], EXIT_PUZZLES[4], LOOT_PUZZLES[2]]),
    ],
    ['Sześć kieszeni', foldedRooms('Sześć kieszeni', [LOOT_PUZZLES[1], LOOT_PUZZLES[5], LOOT_PUZZLES[1]])],
    [
      'Łup pod presją',
      foldedRooms('Łup pod presją', [growingPassage(), huntingPocket(true, 2), LOOT_PUZZLES[5]]),
    ],
    ['Schodkowa lawina', terracedDeposit()],
    ['Dwie kolonie', foldedRooms('Dwie kolonie', [growingPassage(), colonyDeposit(8, 4, true)])],
    ['Teleport: trzy komory', LOOT_PUZZLES[5]],
    [
      'Ostatnia amarena',
      foldedRooms('Ostatnia amarena', [deepDeposit(true), LOOT_PUZZLES[2], EXIT_PUZZLES[4]]),
    ],
    ['Finał', LOOT_PUZZLES[2]],
  ];
  const levels = constructions.map(([name, p], i) => puzzleLevel(p, i + 1, name));
  levels[9] = richCache();
  levels[11] = portalLevel(12);
  levels[17] = portalLevel(18);
  levels[19] = finalVault();
  levels[7].bushGrowthSeconds = levels[14].bushGrowthSeconds = levels[16].bushGrowthSeconds = 2.4;
  for (const id of [11, 15]) {
    levels[id - 1].requiredKills = id === 11 ? 2 : 1;
    levels[id - 1].quota += levels[id - 1].requiredKills!;
  }
  const previous = buildChallenges(EXIT_PUZZLES);
  levels.push(
    ...previous.map((p, i) => ({
      ...p,
      id: i + 21,
      replay: p.solution,
      decorations: architecturalBands(p.rows, i),
    })),
  );
  levels[23] = expandedLetters(levels[23]);
  return levels;
}
