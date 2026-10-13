import type { Direction, Point } from './types';
import type { ExitPuzzle } from './ExitPuzzles';

/** Routes a low exit below its sealed chamber, never cutting through a receiving pocket. */
export function alignExit(puzzle: ExitPuzzle): ExitPuzzle {
  if (puzzle.exit.y === puzzle.entry.y) return puzzle;
  const width = puzzle.rows[0].length + 4,
    height = puzzle.rows.length + 2;
  const grid = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  puzzle.rows.forEach((row, y) => [...row].forEach((tile, x) => (grid[y][x] = tile === 'E' ? '.' : tile)));
  const cursor = { ...puzzle.exit },
    solution = [...puzzle.solution];
  /** Carves only the explicit external service passage and records its matching inputs. */
  function walk(axis: 'x' | 'y', value: number): void {
    while (cursor[axis] !== value) {
      const sign = Math.sign(value - cursor[axis]);
      cursor[axis] += sign;
      solution.push(axis === 'x' ? (sign > 0 ? 'right' : 'left') : sign > 0 ? 'down' : 'up');
      grid[cursor.y][cursor.x] = '.';
    }
  }
  walk('y', height - 2);
  walk('x', width - 2);
  walk('y', puzzle.entry.y);
  grid[cursor.y][cursor.x] = 'E';
  return { ...puzzle, rows: grid.map((row) => row.join('')), exit: { ...cursor }, solution };
}

/** Joins authored gates in a sealed chain, preserving each gate instead of carving a bypass. */
export function composeVault(name: string, modules: readonly ExitPuzzle[]): ExitPuzzle {
  if (!modules.length) throw new Error('Komora wymaga co najmniej jednej zagadki');
  const parts = modules.map(alignExit);
  const width = parts.reduce((sum, part) => sum + part.rows[0].length, 0) + (parts.length - 1) * 2;
  const height = Math.max(...parts.map((part) => part.rows.length));
  const grid = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  const stages: { entry: Point; name: string; hint: string }[] = [];
  const solution: Direction[] = [];
  let offset = 0,
    previousExit: Point | undefined;
  parts.forEach((part, index) => {
    part.rows.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        grid[y][offset + x] = tile === 'E' || (tile === 'P' && index > 0) ? ' ' : tile;
      }),
    );
    const entry = { x: offset + part.entry.x, y: part.entry.y };
    if (previousExit) {
      if (previousExit.y !== entry.y) throw new Error('Niezgodne wysokości wejścia i wyjścia');
      for (let x = previousExit.x + 1; x <= entry.x; x++) {
        grid[entry.y][x] = ' ';
        solution.push('right');
      }
    }
    stages.push({ entry, name: part.name, hint: part.hint });
    solution.push(...part.solution);
    previousExit = { x: offset + part.exit.x, y: part.exit.y };
    offset += part.rows[0].length + 2;
  });
  const exit = previousExit!;
  grid[exit.y][exit.x] = 'E';
  return {
    name,
    hint: parts[0].hint,
    rows: grid.map((row) => row.join('')),
    entry: parts[0].entry,
    exit,
    solution,
    stages,
  };
}
