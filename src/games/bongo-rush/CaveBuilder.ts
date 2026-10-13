import type { Direction, LevelDefinition, Point } from './types';
import { DIRECTIONS, neighbour, STEP_SECONDS } from './types';
import { EXIT_PUZZLES } from './ExitPuzzles';
import type { ExitPuzzle } from './ExitPuzzles';
import { LOOT_PUZZLES } from './LootPuzzles';
import { alignExit, composeVault } from './VaultComposer';
import { patrolEncounter, trapInputs, trapLoops } from './PatrolEncounter';

export interface CaveSketch {
  title: string;
  hint: string;
}
interface Sector {
  origin: Point;
  puzzle: ExitPuzzle;
  entry: Point;
  exit: Point;
}

/** Six fixed ore/shortcut arrangements, rather than the old mandatory room-clearing snake. */
const EXPLORATION_SECTORS = [
  [0, 3, 1, 4, 2, 5],
  [2, 0, 4, 1, 5, 3],
  [4, 1, 0, 5, 3, 2],
  [1, 5, 3, 0, 2, 4],
  [3, 2, 5, 4, 0, 1],
  [5, 4, 2, 3, 1, 0],
] as const;

/** Optional deposits use existing gravity challenges, but quota can be met by different selections. */
function exploration(sketch: CaveSketch, index: number): LevelDefinition {
  const grid = Array.from({ length: 54 }, () => Array<string>(index === 10 ? 80 : 68).fill('#'));
  const corridors = new Set<string>();
  const key = (p: Point) => `${p.x},${p.y}`;
  const carve = (x: number, y: number) => {
    grid[y][x] = '.';
    corridors.add(`${x},${y}`);
  };
  const style = Math.floor(index / 2);
  const symbol = index < 3 ? 'C' : index < 6 ? 'B' : index < 9 ? 'U' : 'C';
  for (const x of [3, 33, 63]) for (let y = 3; y <= 50; y++) carve(x, y);
  for (const y of [15, 31, 50]) for (let x = 3; x <= 63; x++) carve(x, y);
  let veinItem = 0;
  const vein = {
    ...LOOT_PUZZLES[3],
    rows: LOOT_PUZZLES[3].rows.map((row) => row.replace(/O/g, () => (veinItem++ % 2 ? '.' : 'O'))),
  };
  const pieces = [
    LOOT_PUZZLES[0],
    LOOT_PUZZLES[1],
    LOOT_PUZZLES[2],
    LOOT_PUZZLES[4],
    vein,
    patrolEncounter(symbol),
  ];
  const sectors: Sector[] = [];
  for (let slot = 0; slot < 6; slot++) {
    const identity = EXPLORATION_SECTORS[style][slot];
    const puzzle = alignExit(pieces[identity]);
    const origin = { x: slot % 2 ? 37 : 9, y: 2 + Math.floor(slot / 2) * 16 };
    const entry = { x: origin.x + puzzle.entry.x, y: origin.y + puzzle.entry.y };
    const exit = { x: origin.x + puzzle.exit.x, y: origin.y + puzzle.exit.y };
    puzzle.rows.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        grid[origin.y + y][origin.x + x] = tile === 'P' || tile === 'E' ? '.' : tile;
      }),
    );
    for (let x = slot % 2 ? 33 : 3; x <= entry.x; x++) carve(x, entry.y);
    for (let x = exit.x; x <= (slot % 2 ? 63 : 33); x++) carve(x, exit.y);
    sectors[identity] = { origin, puzzle, entry, exit };
  }
  // Alcoves and optional rooted intersections break up the service-gallery silhouette.
  for (let band = 0; band < 3; band++) {
    const y = band === 2 ? 49 : 14 + band * 16;
    for (let x = 18 + ((style + band) % 3) * 4; x < 26 + ((style + band) % 3) * 4; x++)
      if (grid[y][x] === '#') grid[y][x] = '.';
  }
  if (index >= 4) grid[31][33] = 'K';
  if (index === 10) {
    // A second, opposite-handed patrol has its own reward loop, never overlaps the first circuit.
    for (let y = 1; y <= 3; y++) for (let x = 69; x <= 75; x++) grid[y][x] = ' ';
    for (let x = 70; x <= 74; x++) grid[2][x] = '#';
    grid[1][70] = 'B';
    grid[2][76] = 'O';
    grid[4][75] = '.';
    for (let x = 63; x <= 75; x++) grid[5][x] = '.';
  }
  const spawn = { x: 3, y: 9 },
    exit = { x: 63, y: 50 };
  const quotas = [3, 4, 5, 5, 4, 6];
  const selections = [
    [0, 1],
    [2, 1, 3],
    [3, 1, 4],
    [0, 2, 1, 3],
    [2, 4],
    [3, 2, 1, 4],
  ];
  grid[spawn.y][spawn.x] = 'P';
  grid[exit.y][exit.x] = 'E';

  /** Records service-gallery moves; never carves a bypass through a puzzle. */
  function itinerary(hunt: boolean): Direction[] {
    const inputs: Direction[] = [];
    let cursor = { ...spawn };
    function walk(target: Point): void {
      const queue = [cursor];
      const parents = new Map<string, { point: Point; input: Direction }>();
      const visited = new Set([key(cursor)]);
      for (let n = 0; n < queue.length && !visited.has(key(target)); n++)
        for (const input of DIRECTIONS) {
          const next = neighbour(queue[n], input);
          if (
            !corridors.has(key(next)) ||
            grid[next.y][next.x] === 'K' ||
            (key(next) === key(exit) && key(target) !== key(exit)) ||
            visited.has(key(next))
          )
            continue;
          visited.add(key(next));
          parents.set(key(next), { point: queue[n], input });
          queue.push(next);
        }
      if (!visited.has(key(target))) throw new Error(`Brak galerii ${index + 1}: ${key(target)}`);
      const route: Direction[] = [];
      let current = target;
      while (key(current) !== key(cursor)) {
        const parent = parents.get(key(current))!;
        route.push(parent.input);
        current = parent.point;
      }
      inputs.push(...route.reverse());
      cursor = { ...target };
    }
    function mine(identity: number): void {
      const sector = sectors[identity];
      walk(sector.entry);
      inputs.push(
        ...(identity === 5 ? trapInputs(trapLoops(symbol, inputs.length)) : sector.puzzle.solution),
      );
      cursor = { ...sector.exit };
    }
    if (hunt) {
      mine(0);
      mine(5);
      let collected = 3;
      for (const identity of [2, 1, 3, 4]) {
        if (collected >= quotas[style]) break;
        mine(identity);
        collected += pieces[identity].rows.join('').split('O').length - 1;
      }
    } else {
      const remaining = [...selections[style]];
      while (remaining.length) {
        remaining.sort(
          (a, b) =>
            Math.abs(sectors[a].entry.x - cursor.x) +
            Math.abs(sectors[a].entry.y - cursor.y) -
            (Math.abs(sectors[b].entry.x - cursor.x) + Math.abs(sectors[b].entry.y - cursor.y)),
        );
        mine(remaining.shift()!);
      }
    }
    walk(exit);
    return inputs;
  }
  const solution = itinerary(false),
    huntSolution = itinerary(true);
  return {
    id: index + 1,
    title: sketch.title,
    hint: sketch.hint,
    biome: Math.floor(index / 3),
    style: 'exploration',
    rows: grid.map((row) => row.join('')),
    quota: quotas[style],
    requiredPickups: [],
    solution,
    alternatives: [{ name: 'Pułapka zamiast drugiego złoża', inputs: huntSolution }],
    timeLimitSeconds: Math.max(
      180,
      Math.ceil((Math.max(solution.length, huntSolution.length) * STEP_SECONDS * 4) / 30) * 30,
    ),
    encounters: [
      {
        spawn: { x: sectors[5].origin.x + 9, y: sectors[5].origin.y + 7 },
        role: 'Patrol pilnuje bocznego złoża i skrótu. Obejście lub zrzut z bocznym odwrotem.',
        minimumCircuit: 16,
      },
      ...(index === 10
        ? [
            {
              spawn: { x: 70, y: 1 },
              role: 'Niebieski patrol chroni rezerwowe złoże w osobnym obiegu.',
              minimumCircuit: 16,
            },
          ]
        : []),
    ],
  };
}

/** Compact reasoning wings replace the old mandatory 300–700-move mining preamble. */
function puzzleCave(sketch: CaveSketch, index: number): LevelDefinition {
  const modules: Record<number, readonly ExitPuzzle[]> = {
    1: [LOOT_PUZZLES[4], EXIT_PUZZLES[0]],
    3: [LOOT_PUZZLES[3], EXIT_PUZZLES[3]],
    5: [LOOT_PUZZLES[1], EXIT_PUZZLES[5]],
    7: [LOOT_PUZZLES[5], EXIT_PUZZLES[4]],
    9: [LOOT_PUZZLES[2], LOOT_PUZZLES[5], EXIT_PUZZLES[4]],
    11: [LOOT_PUZZLES[2], LOOT_PUZZLES[5], EXIT_PUZZLES[4]],
  };
  const vault = composeVault(sketch.title, modules[index]);
  const offset = 12;
  const grid = Array.from({ length: Math.max(13, vault.rows.length) }, () =>
    Array<string>(vault.rows[0].length + offset).fill('#'),
  );
  vault.rows.forEach((row, y) =>
    [...row].forEach((tile, x) => (grid[y][x + offset] = tile === 'P' ? '.' : tile)),
  );
  for (let y = 1; y <= 9; y++) grid[y][1] = '.';
  for (let x = 1; x <= 11; x++) grid[1][x] = '.';
  for (let y = 1; y <= 5; y++) grid[y][11] = '.';
  for (let x = 10; x <= vault.entry.x + offset; x++) grid[5][x] = '.';
  grid[9][1] = 'P';
  // The guarded route saves eight moves, but rejoins before every mandatory puzzle.
  for (let y = 7; y <= 9; y++) for (let x = 4; x <= 10; x++) grid[y][x] = ' ';
  for (let x = 5; x <= 9; x++) grid[8][x] = '#';
  grid[7][5] = index < 3 ? 'C' : index < 6 ? 'B' : 'U';
  grid[9][2] = grid[9][3] = grid[6][10] = '.';
  const solution: Direction[] = [
    ...Array<Direction>(8).fill('up'),
    ...Array<Direction>(10).fill('right'),
    ...Array<Direction>(4).fill('down'),
    'right',
    'right',
    ...vault.solution,
  ];
  if (index === 3 || index === 5) {
    const second = vault.stages![1].entry;
    grid[second.y][second.x + offset - 1] = 'K';
  }
  let gate: Point | undefined, pen: Point[] | undefined;
  let width = grid[0].length;
  if (index === 11) {
    const oldExit = { x: vault.exit.x + offset, y: vault.exit.y };
    grid[oldExit.y][oldExit.x] = '.';
    const origin = width + 2;
    width += 14;
    for (const row of grid) while (row.length < width) row.push('#');
    for (let x = oldExit.x; x <= origin + 9; x++) grid[5][x] = '.';
    for (let y = 1; y <= 4; y++) for (let x = origin + 8; x <= origin + 9; x++) grid[y][x] = ' ';
    grid[1][origin + 9] = 'J';
    gate = { x: origin + 8, y: 5 };
    pen = [1, 2, 3, 4].flatMap((y) => [8, 9].map((x) => ({ x: origin + x, y })));
    grid[5][origin + 6] = 'R';
    grid[5][origin + 7] = ' ';
    grid[5][origin + 8] = ' ';
    grid[5][origin + 9] = '#';
    grid[6][origin + 6] = 'E';
    solution.push(...Array<Direction>(origin + 7 - oldExit.x).fill('right'), 'left', 'down');
  }
  const rows = grid.map((row) => row.join(''));
  const requiredPickups = rows.flatMap((row, y) =>
    [...row].flatMap((tile, x) => (tile === 'O' ? [{ x, y }] : [])),
  );
  return {
    id: index + 1,
    title: sketch.title,
    hint: sketch.hint,
    biome: Math.floor(index / 3),
    style: 'puzzle',
    rows,
    quota: requiredPickups.length,
    requiredPickups,
    solution,
    gate,
    pen,
    timeLimitSeconds: Math.max(180, Math.ceil((solution.length * STEP_SECONDS * 4) / 30) * 30),
    encounters: [
      {
        spawn: { x: 5, y: 7 },
        role: 'Patrol kontroluje skrót o osiem ruchów krótszy od bezpiecznego obejścia; oba prowadzą przed zagadkę.',
        minimumCircuit: 16,
      },
      ...(pen
        ? [
            {
              spawn: { x: gate!.x + 1, y: 1 },
              role: 'Boss: zamknięcie zagrody dwoma pchnięciami.',
              minimumCircuit: 8,
            },
          ]
        : []),
    ],
    vault: {
      entry: { x: vault.entry.x + offset, y: vault.entry.y },
      name: vault.name,
      hint: vault.hint,
      stages: vault.stages?.map((stage) => ({
        ...stage,
        entry: { x: stage.entry.x + offset, y: stage.entry.y },
      })),
    },
  };
}

/** Stable IDs/biomes, unchanged physics, alternating exploration and reasoning. */
export function buildCave(sketch: CaveSketch, index: number): LevelDefinition {
  return index % 2 ? puzzleCave(sketch, index) : exploration(sketch, index);
}
