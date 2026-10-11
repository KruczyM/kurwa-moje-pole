import type { Direction, LevelDefinition, Point } from './types';
import { exitPuzzleForLevel } from './ExitPuzzles';

export interface CaveSketch {
  title: string;
  hint: string;
  columns: number;
  rows: number;
  route: 'rows' | 'columns';
  geology: number;
  patrols: number;
}
interface Chamber extends Point {
  width: number;
  height: number;
}

/** Stable integer hash: the same authored geology on every browser and restart. */
function grain(x: number, y: number, seed: number): number {
  return (((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0) % 101;
}

/** Builds connected, looping chamber networks and a deterministic real-input acceptance route. */
export function buildCave(sketch: CaveSketch, index: number): LevelDefinition {
  const puzzle = exitPuzzleForLevel(index);
  const mainWidth = sketch.columns * 14 + 4,
    width = mainWidth + puzzle.rows[0].length + 2,
    height = sketch.rows * 10 + 4;
  const grid = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  const chambers: Chamber[] = [],
    solution: Direction[] = [],
    path: Point[] = [];
  const key = (p: Point) => p.y * width + p.x;

  /** Never opens the outside boundary while carving authored rooms and passages. */
  function carve(x: number, y: number, tile = '.'): void {
    if (x > 0 && y > 0 && x < width - 1 && y < height - 1) grid[y][x] = tile;
  }
  for (let row = 0; row < sketch.rows; row++)
    for (let column = 0; column < sketch.columns; column++) {
      const room = {
        x: 2 + column * 14,
        y: 2 + row * 10,
        width: 11 + ((index + column + row) % 2),
        height: 8,
      };
      chambers.push(room);
      for (let y = room.y; y < room.y + room.height; y++)
        for (let x = room.x; x < room.x + room.width; x++) {
          const corner =
            (x === room.x || x === room.x + room.width - 1) &&
            (y === room.y || y === room.y + room.height - 1);
          if (!corner) carve(x, y);
        }
    }
  // Every room connects in both axes, creating optional loops rather than one mandatory snake.
  for (const room of chambers) {
    const cx = room.x + 5,
      cy = room.y + 4;
    if (room.x + 14 < mainWidth - 4)
      for (let x = cx; x <= cx + 14; x++) {
        carve(x, cy);
        if ((index + room.y) % 2) carve(x, cy + 1);
      }
    if (room.y + 10 < height - 4) for (let y = cy; y <= cy + 10; y++) carve(cx + (index % 3), y);
  }
  const ordered: Chamber[] = [];
  if (sketch.route === 'rows') {
    for (let row = sketch.rows - 1; row >= 0; row--) {
      const band = chambers.slice(row * sketch.columns, (row + 1) * sketch.columns);
      ordered.push(...((sketch.rows - 1 - row) % 2 ? band.reverse() : band));
    }
  } else
    for (let column = 0; column < sketch.columns; column++) {
      const band = chambers.filter((_, i) => i % sketch.columns === column);
      ordered.push(...(column % 2 ? band : band.reverse()));
    }
  const start = { x: ordered[0].x + 1, y: ordered[0].y + 6 },
    cursor = { ...start };
  path.push({ ...cursor });

  /** Records cardinal inputs and carves a passage wherever this route crosses a partition. */
  function walkTo(target: Point, verticalFirst = false): void {
    const axes = verticalFirst ? (['y', 'x'] as const) : (['x', 'y'] as const);
    for (const axis of axes)
      while (cursor[axis] !== target[axis]) {
        const sign = Math.sign(target[axis] - cursor[axis]);
        cursor[axis] += sign;
        solution.push(axis === 'x' ? (sign > 0 ? 'right' : 'left') : sign > 0 ? 'down' : 'up');
        if (grid[cursor.y][cursor.x] === '#') carve(cursor.x, cursor.y);
        path.push({ ...cursor });
      }
  }
  ordered.forEach((room, n) => {
    walkTo({ x: room.x + 1, y: room.y + 6 }, n % 2 === 1);
    walkTo({ x: room.x + room.width - 3, y: room.y + 6 });
    walkTo({ x: cursor.x, y: room.y + 2 });
    walkTo({ x: room.x + 3, y: cursor.y });
    walkTo({ x: cursor.x, y: room.y + 4 });
    walkTo({ x: room.x + 5, y: cursor.y });
  });
  let gate: Point | undefined, pen: Point[] | undefined, exit: Point;
  if (index === 11) {
    const gx = mainWidth - 5;
    walkTo({ x: gx - 3, y: 3 });
    for (let y = 1; y <= 4; y++) for (let x = gx - 2; x <= gx + 2; x++) carve(x, y, '#');
    for (let x = gx - 3; x <= gx; x++) carve(x, 3, ' ');
    pen = [
      { x: gx, y: 1 },
      { x: gx + 1, y: 1 },
      { x: gx, y: 2 },
      { x: gx + 1, y: 2 },
    ];
    pen.forEach((p) => carve(p.x, p.y, ' '));
    gate = { x: gx, y: 3 };
    exit = { x: gx - 2, y: 2 };
    walkTo({ x: gx - 1, y: 3 });
    walkTo({ x: gx - 2, y: 3 });
    walkTo(exit);
  } else {
    exit = { x: cursor.x + 2, y: cursor.y };
    walkTo(exit);
  }
  const puzzleOrigin = {
    x: mainWidth + 1,
    y: Math.max(1, Math.min(height - puzzle.rows.length - 1, exit.y - puzzle.entry.y)),
  };
  const puzzleEntry = { x: puzzleOrigin.x + puzzle.entry.x, y: puzzleOrigin.y + puzzle.entry.y };
  // A single approach gallery reaches a sealed vault; spare deposits cannot bypass its rock gate.
  walkTo({ x: cursor.x, y: puzzleEntry.y });
  walkTo(puzzleEntry);
  const reserved = new Set(path.map(key));
  const finalZone = (x: number, y: number) => index === 11 && x >= mainWidth - 8 && y <= 4;
  // Four chamber architectures break up repeated rectangular rooms while preserving deliberate doorways.
  chambers.forEach((room, n) => {
    const shape = (index + n) % 4;
    for (let dy = 0; dy < room.height; dy++)
      for (let dx = 1; dx < room.width - 1; dx++) {
        const x = room.x + dx,
          y = room.y + dy;
        if (reserved.has(key({ x, y })) || finalZone(x, y)) continue;
        const pillar = shape === 0 && dx >= 5 && dx <= 6 && dy >= 3 && dy <= 4;
        const baffle = shape === 1 && dx === 6 && dy >= 1 && dy <= 6 && dy !== 4;
        const ceiling = shape === 2 && dx >= 4 && dx <= 6 && dy <= 1;
        if (pillar || baffle || ceiling) carve(x, y, '#');
        else if (shape === 3 && dx >= 4 && dx <= 6 && dy >= 1 && dy <= 2) carve(x, y, ' ');
      }
  });
  // Dense supported veins outside the acceptance route release real cascades when supports are dug.
  for (let y = 2; y < height - 2; y++)
    for (let x = 2; x < mainWidth - 2; x++) {
      if (
        grid[y][x] !== '.' ||
        reserved.has(key({ x, y })) ||
        reserved.has(key({ x, y: y + 1 })) ||
        finalZone(x, y)
      )
        continue;
      const noise = grain(x, y, index + 1);
      if (noise < sketch.geology) carve(x, y, 'R');
      else if (noise < sketch.geology + 8) carve(x, y, 'O');
      else if (noise > 90) carve(x, y, ' ');
    }
  // Stabilise veins until their support is dug; initial cascades must not clog entrances.
  for (let y = height - 3; y >= 2; y--)
    for (let x = 2; x < mainWidth - 2; x++) {
      if (
        (grid[y][x] === 'R' || grid[y][x] === 'O') &&
        !reserved.has(key({ x, y: y + 1 })) &&
        !finalZone(x, y)
      )
        carve(x, y + 1, '.');
    }
  let quota = 0;
  const deposits = new Set<number>();
  for (const room of ordered) {
    const candidates = path.filter(
      (p) =>
        p.x >= room.x + 3 &&
        p.x < room.x + room.width - 3 &&
        (p.y === room.y + 2 || p.y === room.y + 6) &&
        !reserved.has(key({ x: p.x, y: p.y + 1 })) &&
        !finalZone(p.x, p.y),
    );
    const seen = new Set<number>();
    for (const p of candidates) {
      if (seen.has(p.y)) continue;
      seen.add(p.y);
      carve(p.x, p.y, 'O');
      deposits.add(key(p));
      carve(p.x, p.y + 1, '.');
      quota++;
    }
  }
  // Horizontal gates require pushing into prepared receiving pockets, never into diggable earth.
  ordered.forEach((room, n) => {
    if (n % 3 !== index % 3) return;
    const y = room.y + 6,
      end = room.x + room.width - 3;
    if (reserved.has(key({ x: end + 1, y })) || reserved.has(key({ x: end + 1, y: y + 1 }))) return;
    if (
      Array.from({ length: end - room.x - 4 }, (_, i) => room.x + 6 + i).some((x) =>
        deposits.has(key({ x, y })),
      )
    )
      return;
    for (let x = room.x + 6; x <= end + 1; x++) {
      carve(x, y, ' ');
      if (!reserved.has(key({ x, y: y - 1 }))) carve(x, y - 1, '.');
      if (!reserved.has(key({ x, y: y + 1 }))) carve(x, y + 1, '.');
    }
    carve(room.x + 6, y, 'R');
  });
  ordered.slice(1, sketch.patrols + 1).forEach((room, n) => {
    const x = room.x + room.width - 1,
      y = room.y + 1;
    if (reserved.has(key({ x, y })) || reserved.has(key({ x: x - 1, y }))) return;
    // Patrol pockets can be opened through soil, so exploring extra deposits carries a real risk.
    carve(x, y, index < 3 ? 'C' : index < 6 ? 'B' : index < 9 ? 'U' : ['C', 'B', 'U'][n % 3]);
    carve(x - 1, y, ' ');
  });
  carve(start.x, start.y, 'P');
  carve(start.x + 1, start.y, 'K');
  ordered
    .filter((_, n) => n > 0 && n % 4 === 0)
    .forEach((room) => {
      const p = { x: room.x + 1, y: room.y + 1 };
      if (!reserved.has(key(p))) carve(p.x, p.y, 'K');
    });
  if (gate && pen) {
    carve(gate.x - 2, gate.y, 'R');
    carve(gate.x + 1, 1, 'J');
  }
  puzzle.rows.forEach((row, dy) => {
    [...row].forEach((tile, dx) =>
      carve(puzzleOrigin.x + dx, puzzleOrigin.y + dy, tile === 'P' ? ' ' : tile),
    );
  });
  solution.push(...puzzle.solution);
  return {
    id: index + 1,
    title: sketch.title,
    hint: sketch.hint,
    biome: Math.floor(index / 3),
    rows: grid.map((row) => row.join('')),
    quota,
    solution,
    gate,
    pen,
    vault: {
      entry: puzzleEntry,
      name: puzzle.name,
      hint: puzzle.hint,
      stages: puzzle.stages?.map((stage) => ({
        ...stage,
        entry: { x: puzzleOrigin.x + stage.entry.x, y: puzzleOrigin.y + stage.entry.y },
      })),
    },
  };
}
