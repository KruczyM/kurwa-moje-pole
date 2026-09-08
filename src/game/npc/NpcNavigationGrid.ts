import * as THREE from 'three';

export const NPC_NAVIGATION_RADIUS = 0.5;
export const NPC_NAVIGATION_CELL_SIZE = 0.75;

export type NavigationBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type NavigationSearchDiagnostics = {
  found: boolean;
  expandedNodes: number;
  durationMs: number;
  rawWaypoints: number;
  smoothedWaypoints: number;
};

type OpenNode = { index: number; score: number };

const now = () => globalThis.performance?.now() ?? Date.now();

/** Minimalna kolejka priorytetowa używana przez A* bez zależności zewnętrznych. */
class MinHeap {
  private values: OpenNode[] = [];

  get size() {
    return this.values.length;
  }

  push(node: OpenNode) {
    this.values.push(node);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.values[parent].score <= node.score) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = node;
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || this.values.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.values.length) break;
      const right = left + 1;
      const child =
        right < this.values.length && this.values[right].score < this.values[left].score ? right : left;
      if (this.values[child].score >= last.score) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

/** Statyczny grid pola z A*, wygładzaniem line-of-sight i diagnostyką kosztu wyszukiwania. */
export class NpcNavigationGrid {
  readonly width: number;
  readonly depth: number;
  readonly buildDurationMs: number;
  readonly walkableCellCount: number;
  lastSearch: NavigationSearchDiagnostics | null = null;
  private readonly walkable: Uint8Array;
  private readonly walkableIndices: number[] = [];

  constructor(
    readonly bounds: NavigationBounds,
    readonly cellSize: number,
    private readonly isWalkableWorld: (x: number, z: number) => boolean,
  ) {
    if (cellSize <= 0) throw new Error('Rozmiar komórki nawigacji musi być dodatni.');
    this.width = Math.floor((bounds.maxX - bounds.minX) / cellSize) + 1;
    this.depth = Math.floor((bounds.maxZ - bounds.minZ) / cellSize) + 1;
    this.walkable = new Uint8Array(this.width * this.depth);
    const started = now();
    for (let index = 0; index < this.walkable.length; index += 1) {
      const point = this.pointForIndex(index);
      if (!isWalkableWorld(point.x, point.z)) continue;
      this.walkable[index] = 1;
      this.walkableIndices.push(index);
    }
    this.walkableCellCount = this.walkableIndices.length;
    this.buildDurationMs = now() - started;
  }

  /** Sprawdza punkt świata z dokładnym predykatem colliderów, nie tylko przybliżeniem komórki. */
  canStandAt(x: number, z: number) {
    return (
      x >= this.bounds.minX &&
      x <= this.bounds.maxX &&
      z >= this.bounds.minZ &&
      z <= this.bounds.maxZ &&
      this.isWalkableWorld(x, z)
    );
  }

  /** Losuje środek przechodniej komórki, opcjonalnie ograniczony do centralnego obszaru. */
  randomWalkablePoint(random = Math.random, bounds: Partial<NavigationBounds> = {}) {
    if (!this.walkableIndices.length) return null;
    const minColumn = Math.max(
      0,
      Math.ceil(((bounds.minX ?? this.bounds.minX) - this.bounds.minX) / this.cellSize),
    );
    const maxColumn = Math.min(
      this.width - 1,
      Math.floor(((bounds.maxX ?? this.bounds.maxX) - this.bounds.minX) / this.cellSize),
    );
    const minRow = Math.max(
      0,
      Math.ceil(((bounds.minZ ?? this.bounds.minZ) - this.bounds.minZ) / this.cellSize),
    );
    const maxRow = Math.min(
      this.depth - 1,
      Math.floor(((bounds.maxZ ?? this.bounds.maxZ) - this.bounds.minZ) / this.cellSize),
    );
    if (minColumn > maxColumn || minRow > maxRow) return null;
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const column = minColumn + Math.floor(random() * (maxColumn - minColumn + 1));
      const row = minRow + Math.floor(random() * (maxRow - minRow + 1));
      const index = row * this.width + column;
      if (this.walkable[index]) return this.pointForIndex(index);
    }
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const index = row * this.width + column;
        if (this.walkable[index]) return this.pointForIndex(index);
      }
    }
    return null;
  }

  /** Wyznacza pełną trasę A* i usuwa pośrednie waypointy widoczne w linii prostej. */
  findPath(start: THREE.Vector3, goal: THREE.Vector3) {
    const started = now();
    const startIndex = this.nearestWalkableIndex(start.x, start.z);
    const goalIndex = this.nearestWalkableIndex(goal.x, goal.z);
    if (startIndex < 0 || goalIndex < 0) return this.finishSearch(started, 0, [], []);

    const cameFrom = new Int32Array(this.walkable.length).fill(-1);
    const cost = new Float64Array(this.walkable.length).fill(Infinity);
    const closed = new Uint8Array(this.walkable.length);
    const open = new MinHeap();
    cost[startIndex] = 0;
    open.push({ index: startIndex, score: this.heuristic(startIndex, goalIndex) });
    let expandedNodes = 0;

    while (open.size) {
      const current = open.pop()!;
      if (closed[current.index]) continue;
      if (current.index === goalIndex) {
        const raw = this.reconstruct(cameFrom, current.index, start, goal);
        return this.finishSearch(started, expandedNodes, raw, this.smooth(raw));
      }
      closed[current.index] = 1;
      expandedNodes += 1;
      for (const [neighbor, stepCost] of this.neighbors(current.index)) {
        if (closed[neighbor]) continue;
        const candidate = cost[current.index] + stepCost;
        if (candidate >= cost[neighbor]) continue;
        cameFrom[neighbor] = current.index;
        cost[neighbor] = candidate;
        open.push({ index: neighbor, score: candidate + this.heuristic(neighbor, goalIndex) });
      }
    }
    return this.finishSearch(started, expandedNodes, [], []);
  }

  /** Próbkuje odcinek gęściej niż rozmiar komórki, aby bezpiecznie skracać trasę. */
  hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3) {
    const distance = from.distanceTo(to);
    const steps = Math.max(1, Math.ceil(distance / (this.cellSize * 0.4)));
    for (let step = 0; step <= steps; step += 1) {
      const alpha = step / steps;
      if (
        !this.canStandAt(THREE.MathUtils.lerp(from.x, to.x, alpha), THREE.MathUtils.lerp(from.z, to.z, alpha))
      ) {
        return false;
      }
    }
    return true;
  }

  /** Zapisuje metryki ostatniego wyszukiwania i zwraca gotową trasę. */
  private finishSearch(
    started: number,
    expandedNodes: number,
    raw: THREE.Vector3[],
    smoothed: THREE.Vector3[],
  ) {
    this.lastSearch = {
      found: smoothed.length > 0,
      expandedNodes,
      durationMs: now() - started,
      rawWaypoints: raw.length,
      smoothedWaypoints: smoothed.length,
    };
    return smoothed;
  }

  /** Usuwa waypointy, które można ominąć jednym bezkolizyjnym odcinkiem. */
  private smooth(path: THREE.Vector3[]) {
    if (path.length <= 2) return path;
    const result = [path[0]];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let visible = path.length - 1;
      while (visible > anchor + 1 && !this.hasLineOfSight(path[anchor], path[visible])) visible -= 1;
      result.push(path[visible]);
      anchor = visible;
    }
    return result;
  }

  /** Odtwarza trasę komórek i zachowuje dokładne, poprawne punkty początku oraz celu. */
  private reconstruct(cameFrom: Int32Array, end: number, start: THREE.Vector3, goal: THREE.Vector3) {
    const reversed: THREE.Vector3[] = [];
    for (let current = end; current >= 0; current = cameFrom[current])
      reversed.push(this.pointForIndex(current));
    reversed.reverse();
    const exactStart = new THREE.Vector3(start.x, 0, start.z);
    if (this.canStandAt(start.x, start.z) && this.hasLineOfSight(exactStart, reversed[0])) {
      reversed[0] = exactStart;
    }
    const exactGoal = new THREE.Vector3(goal.x, 0, goal.z);
    const last = reversed[reversed.length - 1];
    if (this.canStandAt(goal.x, goal.z) && this.hasLineOfSight(last, exactGoal))
      reversed[reversed.length - 1] = exactGoal;
    return reversed;
  }

  /** Zwraca sąsiadów 8-kierunkowych bez ścinania zablokowanych narożników. */
  private neighbors(index: number): [number, number][] {
    const row = Math.floor(index / this.width);
    const column = index % this.width;
    const result: [number, number][] = [];
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (
          (!dx && !dz) ||
          column + dx < 0 ||
          column + dx >= this.width ||
          row + dz < 0 ||
          row + dz >= this.depth
        )
          continue;
        const neighbor = (row + dz) * this.width + column + dx;
        if (!this.walkable[neighbor]) continue;
        if (dx && dz) {
          const horizontal = row * this.width + column + dx;
          const vertical = (row + dz) * this.width + column;
          if (!this.walkable[horizontal] || !this.walkable[vertical]) continue;
        }
        result.push([neighbor, dx && dz ? Math.SQRT2 : 1]);
      }
    }
    return result;
  }

  /** Oblicza dopuszczalną heurystykę oktalną dla ruchu 8-kierunkowego. */
  private heuristic(from: number, to: number) {
    const fromRow = Math.floor(from / this.width);
    const toRow = Math.floor(to / this.width);
    const dx = Math.abs((from % this.width) - (to % this.width));
    const dz = Math.abs(fromRow - toRow);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  }

  /** Znajduje komórkę punktu albo najbliższy przechodni odpowiednik celu w przeszkodzie. */
  private nearestWalkableIndex(x: number, z: number) {
    const column = Math.max(0, Math.min(this.width - 1, Math.round((x - this.bounds.minX) / this.cellSize)));
    const row = Math.max(0, Math.min(this.depth - 1, Math.round((z - this.bounds.minZ) / this.cellSize)));
    const direct = row * this.width + column;
    if (this.walkable[direct]) return direct;
    const limit = Math.max(this.width, this.depth);
    for (let radius = 1; radius < limit; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
          const candidateColumn = column + dx;
          const candidateRow = row + dz;
          if (
            candidateColumn < 0 ||
            candidateColumn >= this.width ||
            candidateRow < 0 ||
            candidateRow >= this.depth
          )
            continue;
          const candidate = candidateRow * this.width + candidateColumn;
          if (this.walkable[candidate]) return candidate;
        }
      }
    }
    return -1;
  }

  /** Zamienia indeks komórki na jej pozycję w świecie. */
  private pointForIndex(index: number) {
    return new THREE.Vector3(
      this.bounds.minX + (index % this.width) * this.cellSize,
      0,
      this.bounds.minZ + Math.floor(index / this.width) * this.cellSize,
    );
  }
}
