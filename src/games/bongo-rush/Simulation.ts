import { BUSH_GROWTH_TICKS, DIRECTIONS, STEP_SECONDS, neighbour, same } from './types';
import type { Cell, Direction, Enemy, LevelDefinition, LooseObject, Point, SoundEvent, World } from './types';

/** Loads an authored ASCII cave into fresh state; restarts never reuse mutated objects. */
export function createWorld(level: LevelDefinition): World {
  const width = level.rows[0]?.length ?? 0;
  if (width < 3 || level.rows.length < 3 || level.rows.some((row) => row.length !== width))
    throw new Error('Nieprawidłowe wymiary planszy');
  const world: World = {
    width,
    height: level.rows.length,
    cells: [],
    player: { id: 0, x: -1, y: -1, previous: { x: -1, y: -1 }, direction: 'down' },
    objects: [],
    enemies: [],
    collected: 0,
    kills: 0,
    tick: 0,
    status: 'playing',
    reason: '',
    trapped: false,
    bushRoots: [],
  };
  let id = 1;
  let players = 0;
  let exits = 0;
  level.rows.forEach((row, y) =>
    [...row].forEach((symbol, x) => {
      if (!'#. PEORCBUJKSQ'.includes(symbol)) throw new Error(`Nieznany kafelek: ${symbol}`);
      const point = { x, y };
      world.cells.push(
        symbol === '#'
          ? 'wall'
          : symbol === '.'
            ? 'soil'
            : symbol === 'K'
              ? 'buried-bush'
              : symbol === 'E'
                ? 'exit'
                : 'air',
      );
      if (symbol === 'P') {
        world.player = { id: 0, ...point, previous: { ...point }, direction: 'right' };
        players++;
      }
      if (symbol === 'E') exits++;
      if (symbol === 'O' || symbol === 'Q' || symbol === 'R')
        world.objects.push({
          id: id++,
          ...point,
          previous: { ...point },
          kind: symbol === 'R' ? 'rock' : 'pickup',
          required: symbol === 'O' && level.requiredPickups?.some((required) => same(required, point)),
          falling: false,
          variant: (x + y) % 4,
        });
      if ('CBUJS'.includes(symbol))
        world.enemies.push({
          id: id++,
          ...point,
          previous: { ...point },
          direction: 'up',
          chasing: false,
          kind:
            symbol === 'C'
              ? 'red'
              : symbol === 'B'
                ? 'blue'
                : symbol === 'U'
                  ? 'undercover'
                  : symbol === 'S'
                    ? 'sweeper'
                    : 'boss',
        });
    }),
  );
  if (
    players !== 1 ||
    exits !== 1 ||
    level.quota < 1 ||
    world.objects.filter((o) => o.kind === 'pickup').length +
      world.enemies.filter((enemy) => enemy.kind !== 'boss').length <
      level.quota
  )
    throw new Error('Plansza musi mieć start, wyjście i wystarczającą liczbę przedmiotów');
  if (
    level.requiredKills !== undefined &&
    (!Number.isInteger(level.requiredKills) ||
      level.requiredKills < 0 ||
      level.requiredKills > world.enemies.filter((enemy) => enemy.kind !== 'boss').length)
  )
    throw new Error('Nieprawidłowa liczba wymaganych eliminacji');
  if (
    level.requiredPickups?.some((point) => !world.objects.some((body) => body.required && same(body, point)))
  )
    throw new Error('Wymagany łup musi wskazywać przedmiot na planszy');
  for (let x = 0; x < width; x++)
    if (world.cells[x] !== 'wall' || world.cells[(world.height - 1) * width + x] !== 'wall')
      throw new Error('Otwarta granica planszy');
  for (let y = 0; y < world.height; y++)
    if (world.cells[y * width] !== 'wall' || world.cells[y * width + width - 1] !== 'wall')
      throw new Error('Otwarta granica planszy');
  return world;
}

/** Owns deterministic grid rules only; the existing host RAF owns time and rendering. */
export class Simulation {
  readonly world: World;
  private sounds: SoundEvent[] = [];
  private opened?: Point;

  /** Creates one isolated run of a level. */
  constructor(readonly level: LevelDefinition) {
    if (
      level.timeLimitSeconds !== undefined &&
      (!Number.isFinite(level.timeLimitSeconds) || level.timeLimitSeconds <= 0)
    )
      throw new Error('Nieprawidłowy limit czasu');
    this.world = createWorld(level);
  }

  /** Treats coordinates outside the authored cave as solid walls. */
  cell(point: Point): Cell {
    const { x, y } = point;
    return x < 0 || y < 0 || x >= this.world.width || y >= this.world.height
      ? 'wall'
      : this.world.cells[y * this.world.width + x];
  }

  /** Looks up the single loose body occupying a tile. */
  object(point: Point): LooseObject | undefined {
    return this.world.objects.find((body) => same(body, point));
  }

  /** Looks up an enemy using logical coordinates, not its drawn position. */
  enemy(point: Point): Enemy | undefined {
    return this.world.enemies.find((body) => same(body, point));
  }

  /** Returns and clears events so audio never replays on every rendered frame. */
  drainSounds(): SoundEvent[] {
    return this.sounds.splice(0);
  }

  /** Advances one stable tick: player, gravity, enemies, trap and exit checks. */
  step(input?: Direction): void {
    const w = this.world;
    if (w.status !== 'playing') return;
    for (const body of [w.player, ...w.objects, ...w.enemies]) body.previous = { x: body.x, y: body.y };
    w.tick++;
    this.opened = undefined;
    const wasOpen = this.exitOpen;
    const moved = new Set<number>();
    if (input) this.movePlayer(input, moved);
    if (w.status !== 'playing') return;
    this.gravity(moved);
    if (w.status !== 'playing') return;
    this.moveEnemies();
    if (w.status !== 'playing') return;
    if (this.level.gate && this.level.pen) {
      const gate = this.object(this.level.gate);
      const boss = w.enemies.find((enemy) => enemy.kind === 'boss');
      if (gate?.kind === 'rock' && boss && this.level.pen.some((point) => same(point, boss)) && !w.trapped) {
        w.trapped = true;
        this.sounds.push('trap');
      }
    }
    if (!wasOpen && this.exitOpen) this.sounds.push('exit');
    if (this.cell(w.player) === 'exit' && this.exitOpen) {
      w.status = 'won';
      this.sounds.push('won');
    }
    if (w.status === 'playing' && this.remainingSeconds === 0)
      this.lose('Czas minął. Zaplanuj krótszą trasę i spróbuj ponownie.');
    if (w.status === 'playing') this.growBushes();
  }

  /** Active simulation ticks are the only clock; pausing cannot consume the level budget. */
  get remainingSeconds(): number | undefined {
    const limit = this.level.timeLimitSeconds;
    return limit === undefined ? undefined : Math.max(0, limit - this.world.tick * STEP_SECONDS);
  }

  /** Mandatory mining loot cannot be replaced by spare deposits; the final also requires the boss trap. */
  get exitOpen(): boolean {
    return (
      this.world.collected >= this.level.quota &&
      this.requiredRemaining === 0 &&
      this.world.kills >= (this.level.requiredKills ?? 0) &&
      (!this.level.gate || this.world.trapped)
    );
  }

  /** Counts remaining marked bodies, including loot that has moved under gravity. */
  get requiredRemaining(): number {
    return this.world.objects.filter((body) => body.required).length;
  }

  /** Checks vacant air; exits are reserved for the player and cannot be clogged by rocks. */
  private empty(point: Point): boolean {
    return (
      this.cell(point) === 'air' &&
      !this.object(point) &&
      !this.enemy(point) &&
      !same(this.world.player, point)
    );
  }

  /** Applies a body translation once, preserving its previous position for interpolation. */
  private move(body: Point, point: Point): void {
    body.x = point.x;
    body.y = point.y;
  }

  /** Digging and collecting are automatic; only one rock can be pushed horizontally. */
  private movePlayer(direction: Direction, moved: Set<number>): void {
    const w = this.world;
    w.player.direction = direction;
    const target = neighbour(w.player, direction);
    if (
      this.cell(target) === 'wall' ||
      this.cell(target) === 'bush' ||
      (this.cell(target) === 'exit' && !this.exitOpen)
    )
      return;
    if (this.enemy(target)) {
      this.lose('Patrol Cię złapał. Spróbuj innej drogi.');
      return;
    }
    const object = this.object(target);
    if (object?.kind === 'rock') {
      const destination = neighbour(target, direction);
      if ((direction !== 'left' && direction !== 'right') || object.falling || !this.empty(destination))
        return;
      this.move(object, destination);
      moved.add(object.id);
      this.sounds.push('push');
    } else if (object) {
      if (object.falling) {
        this.lose('Spadający przedmiot Cię przygniótł.');
        return;
      }
      w.objects = w.objects.filter((body) => body.id !== object.id);
      w.collected++;
      this.opened = target;
      this.sounds.push('pickup');
    }
    if (this.cell(target) === 'buried-bush') {
      w.bushRoots.push({ ...target });
      w.nextBushGrowth ??= w.tick + BUSH_GROWTH_TICKS;
    }
    if (this.cell(target) === 'soil' || this.cell(target) === 'buried-bush') {
      w.cells[target.y * w.width + target.x] = 'air';
      this.opened = target;
      this.sounds.push('dig');
    }
    this.move(w.player, target);
  }

  /** Expands one simultaneous four-neighbour wave into vacant air, never through soil or bodies. */
  private growBushes(): void {
    const w = this.world;
    if (w.nextBushGrowth === undefined || w.tick < w.nextBushGrowth) return;
    const sources = [...w.bushRoots];
    w.cells.forEach((cell, index) => {
      if (cell === 'bush') sources.push({ x: index % w.width, y: Math.floor(index / w.width) });
    });
    const additions = new Set<number>();
    for (const source of sources) {
      for (const target of [source, ...DIRECTIONS.map((direction) => neighbour(source, direction))]) {
        if (this.empty(target)) additions.add(target.y * w.width + target.x);
      }
    }
    for (const index of additions) w.cells[index] = 'bush';
    w.nextBushGrowth = w.tick + BUSH_GROWTH_TICKS;
  }

  /** Bottom-up stable ordering prevents double falls and makes replays independent of array order. */
  private gravity(moved: Set<number>): void {
    const w = this.world;
    const ordered = [...w.objects].sort((a, b) => b.y - a.y || a.x - b.x || a.id - b.id);
    for (const body of ordered) {
      if (moved.has(body.id)) continue;
      const below = neighbour(body, 'down');
      if (same(below, w.player) && body.falling) {
        this.lose('Przygnieciony! Najpierw zaplanuj drogę odwrotu.');
        return;
      }
      const victim = this.enemy(below);
      if (victim && body.kind === 'rock' && body.falling && victim.kind !== 'boss') {
        w.enemies = w.enemies.filter((enemy) => enemy.id !== victim.id);
        w.kills++;
        // The crushing rock vacates this tile. Dropping here never overlaps the rock, a wall or the player.
        // Reusing the removed enemy ID is unique among live bodies and deterministic across replays.
        w.objects.push({
          id: victim.id,
          x: body.x,
          y: body.y,
          previous: { x: body.x, y: body.y },
          kind: 'pickup',
          required: (this.level.requiredKills ?? 0) > 0,
          variant: victim.id % 4,
          falling: false,
        });
        this.move(body, below);
        this.sounds.push('impact');
        continue;
      }
      if (this.empty(below)) {
        this.move(body, below);
        body.falling = true;
        continue;
      }
      const support = this.object(below);
      if (support) {
        for (const side of ['left', 'right'] as const) {
          const beside = neighbour(body, side);
          const diagonal = neighbour(beside, 'down');
          if (this.empty(beside) && this.empty(diagonal)) {
            this.move(body, beside);
            body.falling = true;
            moved.add(body.id);
            break;
          }
        }
        if (moved.has(body.id)) continue;
      }
      if (body.falling) this.sounds.push('impact');
      body.falling = false;
    }
  }

  /** Enemies cannot dig or push; wall followers remain deterministic and never overlap. */
  private moveEnemies(): void {
    const w = this.world;
    for (const enemy of [...w.enemies].sort((a, b) => a.id - b.id)) {
      const period = enemy.kind === 'red' || enemy.kind === 'boss' ? 3 : 2;
      if (w.tick % period !== 0) continue;
      const visible = this.visiblePlayer(enemy);
      enemy.chasing = enemy.kind === 'undercover' && visible;
      const forward = DIRECTIONS.indexOf(enemy.direction);
      const hand = enemy.kind === 'blue' ? -1 : 1;
      let choices =
        enemy.kind === 'sweeper'
          ? this.sweeperChoices(enemy)
          : [hand, 0, -hand, 2].map((turn) => DIRECTIONS[(forward + turn + 4) % 4]);
      if (enemy.chasing)
        choices = [...DIRECTIONS].sort(
          (a, b) => this.distance(neighbour(enemy, a)) - this.distance(neighbour(enemy, b)),
        );
      for (const direction of choices) {
        const target = neighbour(enemy, direction);
        // A newly dug/collected opening becomes traversable to patrols on the next tick.
        // This gives the player one visible reaction beat instead of an instant ambush.
        if (this.opened && same(this.opened, target)) continue;
        if (enemy.kind === 'boss' && !this.level.pen?.some((point) => same(point, target))) continue;
        if (this.cell(target) !== 'air' || this.object(target) || this.enemy(target)) continue;
        enemy.direction = direction;
        this.move(enemy, target);
        if (same(enemy, w.player)) {
          this.lose('Patrol Cię złapał. Skały mogą odciąć mu drogę.');
          return;
        }
        break;
      }
    }
  }

  /** A mesh square first reaches the nearest visible edge, then follows it with its left hand. */
  private sweeperChoices(enemy: Enemy): Direction[] {
    const solid = (point: Point) => this.cell(point) !== 'air' || !!this.object(point);
    const adjacent = DIRECTIONS.findIndex((direction) => solid(neighbour(enemy, direction)));
    if (!enemy.wallAttached && adjacent >= 0) {
      enemy.wallAttached = true;
      enemy.direction = DIRECTIONS[(adjacent + 1) % 4];
    }
    if (!enemy.wallAttached) {
      const nearest = [...DIRECTIONS].sort((a, b) => {
        /** Bounded axial ray; cave borders are solid even for malformed out-of-range queries. */
        const distance = (direction: Direction) => {
          let point = neighbour(enemy, direction),
            steps = 1;
          while (!solid(point) && steps < this.world.width + this.world.height) {
            point = neighbour(point, direction);
            steps++;
          }
          return steps;
        };
        return distance(a) - distance(b);
      });
      return nearest;
    }
    const facing = DIRECTIONS.indexOf(enemy.direction);
    return [-1, 0, 1, 2].map((turn) => DIRECTIONS[(facing + turn + 4) % 4]);
  }

  /** Computes Manhattan distance for the short straight-line undercover chase. */
  private distance(point: Point): number {
    return Math.abs(point.x - this.world.player.x) + Math.abs(point.y - this.world.player.y);
  }

  /** Walls, dirt, bodies and the six-tile range all interrupt undercover sight. */
  private visiblePlayer(enemy: Enemy): boolean {
    const player = this.world.player;
    if (this.distance(enemy) > 6 || (enemy.x !== player.x && enemy.y !== player.y)) return false;
    const dx = Math.sign(player.x - enemy.x),
      dy = Math.sign(player.y - enemy.y);
    let point = { x: enemy.x + dx, y: enemy.y + dy };
    while (!same(point, player)) {
      if (this.cell(point) !== 'air' || this.object(point) || this.enemy(point)) return false;
      point = { x: point.x + dx, y: point.y + dy };
    }
    return true;
  }

  /** Ends a run once; loss events cannot repeat while the overlay is displayed. */
  private lose(reason: string): void {
    this.world.status = 'lost';
    this.world.reason = reason;
    this.sounds.push('lost');
  }
}
