import type { Direction, LevelDefinition, Point } from './types';

export const BIOMES = [
  {
    name: 'Magazyn Amarena',
    item: 'Amareny',
    wall: '#7c344a',
    soil: '#4f2838',
    light: '#ffbc8c',
    accent: '#ff6b92',
    background: 'amarena.svg',
  },
  {
    name: 'Zielone podziemia',
    item: 'Liście',
    wall: '#2b6351',
    soil: '#253e35',
    light: '#c0ff94',
    accent: '#83e67b',
    background: 'roots.svg',
  },
  {
    name: 'Neonowy rave',
    item: 'Cukierki',
    wall: '#53418c',
    soil: '#302951',
    light: '#e9adff',
    accent: '#5ee9e2',
    background: 'rave.svg',
  },
  {
    name: 'Dymna grota',
    item: 'Bonga',
    wall: '#526b79',
    soil: '#2d3f49',
    light: '#ffe0a4',
    accent: '#ffce77',
    background: 'glass.svg',
  },
] as const;

interface CaveSketch {
  title: string;
  hint: string;
  lanes: readonly number[];
  left: number;
  right: number;
  pushes: number;
  patrols: number;
}

/** Authored sketches vary spacing, footprint, push count and enemy rooms; no random cave generation. */
const SKETCHES: readonly CaveSketch[] = [
  {
    title: 'Pierwszy łyk',
    hint: 'Zbieraj butelki. Pchaj skałę w prawo, a na końcu korytarza skręć w górę.',
    lanes: [15, 12, 9, 6, 3],
    left: 2,
    right: 20,
    pushes: 1,
    patrols: 0,
  },
  {
    title: 'Dostawa pod ciśnieniem',
    hint: 'Skały można przepychać tylko poziomo. Zostaw im miejsce na końcu przejścia.',
    lanes: [16, 13, 10, 6, 2],
    left: 3,
    right: 21,
    pushes: 2,
    patrols: 1,
  },
  {
    title: 'Ostatnia paleta',
    hint: 'Czerwony patrol trzyma się prawej ściany. Nie otwieraj mu drogi bez planu.',
    lanes: [15, 11, 8, 5, 2],
    left: 2,
    right: 19,
    pushes: 3,
    patrols: 2,
  },
  {
    title: 'Pod korzeniami',
    hint: 'Podkopanie podpory uruchamia lawinę. Nie wracaj pod spadający przedmiot.',
    lanes: [15, 12, 8, 5, 2],
    left: 3,
    right: 20,
    pushes: 2,
    patrols: 1,
  },
  {
    title: 'Zielone rozwidlenie',
    hint: 'Niebieski patrol obchodzi ściany w drugą stronę. Obserwuj go przed wejściem.',
    lanes: [16, 13, 9, 6, 3],
    left: 2,
    right: 21,
    pushes: 3,
    patrols: 2,
  },
  {
    title: 'Zamknięty obieg',
    hint: 'Po zebraniu wymaganej liczby przedmiotów szukaj świecącego wyjścia.',
    lanes: [16, 12, 8, 5, 2],
    left: 4,
    right: 20,
    pushes: 4,
    patrols: 3,
  },
  {
    title: 'Wejście na rave',
    hint: 'Undercover widzi w prostym korytarzu. Zniknij za zakrętem, żeby przerwać pościg.',
    lanes: [15, 12, 9, 5, 2],
    left: 2,
    right: 20,
    pushes: 2,
    patrols: 1,
  },
  {
    title: 'Ktoś tu nie tańczy',
    hint: 'Nie otwieraj wszystkich bocznych komór naraz. Skały potrafią odciąć patrol.',
    lanes: [16, 13, 10, 7, 3],
    left: 3,
    right: 21,
    pushes: 4,
    patrols: 2,
  },
  {
    title: 'Ostatni drop',
    hint: 'Pełna gałka nie przyspiesza ruchu. W wąskich przejściach liczy się właściwy skręt.',
    lanes: [16, 12, 9, 5, 2],
    left: 2,
    right: 19,
    pushes: 5,
    patrols: 3,
  },
  {
    title: 'Szkło i dym',
    hint: 'Bonga też podlegają grawitacji. Zbieraj stojące, unikaj spadających.',
    lanes: [16, 13, 9, 6, 3],
    left: 3,
    right: 20,
    pushes: 3,
    patrols: 2,
  },
  {
    title: 'Przed wielkim finałem',
    hint: 'Trzy rodzaje patroli, te same zasady. Zaplanuj drogę odwrotu przed kopaniem.',
    lanes: [16, 13, 9, 5, 2],
    left: 2,
    right: 21,
    pushes: 5,
    patrols: 3,
  },
  {
    title: 'Bongo Tasiora',
    hint: 'Zbierz pięć bong. Na górze wepchnij skałę w złote pole zagrody, potem wróć w lewo do nagrody.',
    lanes: [15, 12, 9, 6, 3],
    left: 3,
    right: 19,
    pushes: 4,
    patrols: 3,
  },
];

/** Builds an original zig-zag cave and its canonical input recording from a compact authored sketch. */
function buildLevel(sketch: CaveSketch, index: number): LevelDefinition {
  const width = 24,
    height = 18;
  const grid = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  const solution: Direction[] = [];
  const cursor: Point = { x: sketch.left, y: sketch.lanes[0] };
  grid[cursor.y][cursor.x] = 'P';
  sketch.lanes.forEach((y, lane) => {
    while (cursor.y > y) {
      cursor.y--;
      grid[cursor.y][cursor.x] = '.';
      solution.push('up');
    }
    const sign = lane % 2 === 0 ? 1 : -1;
    const end = sign === 1 ? sketch.right : sketch.left;
    const start = cursor.x;
    while (cursor.x !== end) {
      cursor.x += sign;
      grid[y][cursor.x] = '.';
      solution.push(sign === 1 ? 'right' : 'left');
    }
    const itemX = start + sign * 2;
    grid[y][itemX] = 'O';
    if (lane < sketch.pushes) {
      const rockX = start + sign * 5;
      for (let x = rockX; sign === 1 ? x <= end + 1 : x >= end - 1; x += sign) grid[y][x] = ' ';
      grid[y][rockX] = 'R';
    }
    // Optional soil alcoves give shortcuts and overhead hazards before the push track.
    if (y >= 4) {
      for (let x = 6; x <= 16; x++) if (grid[y - 1][x] === '#') grid[y - 1][x] = '.';
      grid[y - 1][start + sign * 3] = 'R';
    }
    if (lane < sketch.patrols && y >= 5 && sketch.lanes[lane + 1] !== y - 2) {
      const enemyX = start + sign * 3;
      for (let offset = 2; offset <= 3; offset++) grid[y - 1][start + sign * offset] = ' ';
      grid[y - 1][enemyX] = index < 3 ? 'C' : index < 6 ? 'B' : index < 9 ? 'U' : ['C', 'B', 'U'][lane % 3];
    }
  });
  grid[sketch.lanes[0]][sketch.left] = 'P';
  // A buried root on the first corridor introduces time pressure without changing the recorded route.
  grid[sketch.lanes[0]][sketch.left + 1] = 'K';
  const final = index === 11;
  let gate: Point | undefined;
  let pen: Point[] | undefined;
  if (final) {
    // The rock stays supported at the mouth of the pen; there is no combat or crushing the boss.
    for (let x = 17; x <= 20; x++) grid[3][x] = ' ';
    grid[3][18] = 'R';
    grid[3][21] = '#';
    grid[4][20] = '#';
    pen = [
      { x: 20, y: 1 },
      { x: 21, y: 1 },
      { x: 20, y: 2 },
      { x: 21, y: 2 },
    ];
    pen.forEach((point) => {
      grid[point.y][point.x] = ' ';
    });
    grid[1][21] = 'J';
    grid[2][18] = 'E';
    gate = { x: 20, y: 3 };
    solution.push('left', 'up');
  } else {
    grid[cursor.y - 1][cursor.x] = 'E';
    solution.push('up');
  }
  return {
    id: index + 1,
    title: sketch.title,
    hint: sketch.hint,
    biome: Math.floor(index / 3),
    rows: grid.map((row) => row.join('')),
    quota: 5,
    solution,
    gate,
    pen,
  };
}

export const LEVELS: readonly LevelDefinition[] = SKETCHES.map(buildLevel);
