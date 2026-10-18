import type { ExitPuzzle } from './ExitPuzzles';
import type { Direction } from './types';

/** An optional shortcut and ore seam share a 16-cell patrol circuit; a side support releases its trap. */
export function patrolEncounter(symbol: 'C' | 'B' | 'U'): ExitPuzzle {
  const grid = Array.from({ length: 12 }, () => Array<string>(19).fill('#'));
  for (let x = 0; x <= 17; x++) grid[5][x] = '.';
  grid[5][1] = 'P';
  grid[5][2] = 'O';
  grid[5][9] = 'R';
  grid[5][17] = 'E';
  for (let x = 3; x <= 9; x++) grid[6][x] = '.';
  for (let x = 7; x <= 13; x++) grid[7][x] = grid[9][x] = ' ';
  grid[8][7] = grid[8][13] = ' ';
  grid[7][9] = symbol;
  // A deliberate soil door opens a guarded cross-gallery. No two-cell decorative pen.
  for (let x = 14; x <= 17; x++) grid[9][x] = '.';
  for (let y = 6; y <= 8; y++) grid[y][17] = '.';
  grid[9][16] = 'O';
  return {
    name: 'Patrol przy skrócie',
    hint: 'Patrol obchodzi filar. Możesz ominąć galerię lub zrzucić głaz, gdy jest pod szybem. Łup spadnie nad skałę.',
    rows: grid.map((row) => row.join('')),
    entry: { x: 1, y: 5 },
    exit: { x: 17, y: 5 },
    solution: [],
  };
}

/** A successful trap route is authored against the unchanged patrol clock, including safe timing loops. */
export function trapInputs(loops: number): Direction[] {
  return [
    'right',
    'right',
    ...Array.from({ length: loops }, () => ['left', 'right'] as Direction[]).flat(),
    'down',
    ...Array<Direction>(6).fill('right'),
    'left',
    'up',
    ...Array.from({ length: 5 }, () => ['left', 'right'] as Direction[]).flat(),
    'down',
    'down',
    'up',
    'up',
    ...Array<Direction>(9).fill('right'),
  ];
}

/** Aligns safe back-and-forth waits with the unchanged patrol clock. */
export function trapLoops(symbol: 'C' | 'B' | 'U', arrivalTick: number): number {
  const period = symbol === 'C' ? 48 : 32;
  const target = symbol === 'C' ? 39 : 23;
  return Math.floor(((((target - arrivalTick) % period) + period) % period) / 2);
}
