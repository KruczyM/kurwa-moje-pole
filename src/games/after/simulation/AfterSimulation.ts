import type { CharacterName } from '../../../game/network/networkProtocol';
import { canStand, slideMove, validateMap } from './Collision';
import { nearestInteraction } from './Interaction';
import {
  AFTER_CONTENT_VERSION,
  AFTER_SCHEMA_VERSION,
  AFTER_STEP_SECONDS,
  type AfterWorldState,
  type InteractionCommand,
  type MapDefinition,
  type PlayerInput,
  type WorldEvent,
} from './WorldState';

const WALK_SPEED = 2.4;
const RUN_SPEED = 4;
const MAX_CATCH_UP_SECONDS = 0.25;

/** DOM-free local session; the future host supplies elapsed time from its existing RAF. */
export class AfterSimulation {
  private readonly map: MapDefinition;
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly exhausted = new Set<string>();
  private readonly world: AfterWorldState;
  private accumulator = 0;
  private paused = false;

  /** Copies and validates content so external mutation cannot change an active session. */
  constructor(
    map: MapDefinition,
    sessionId = 'after-local',
    seed = 1,
    private readonly interactionAvailable: (targetId: string, flags: readonly string[]) => boolean = () =>
      true,
  ) {
    validateMap(map);
    if (!sessionId || !Number.isSafeInteger(seed)) throw new Error('Invalid After session');
    this.map = structuredClone(map);
    this.world = {
      schemaVersion: AFTER_SCHEMA_VERSION,
      contentVersion: AFTER_CONTENT_VERSION,
      sessionId,
      seed,
      tick: 0,
      mapId: map.id,
      nightPhase: 'after-concert',
      players: [],
      flags: [],
    };
  }

  /** Adds a stable participant slot; duplicate character identities are allowed in After. */
  addPlayer(slotId: string, characterId: CharacterName): void {
    if (
      !slotId ||
      this.world.players.some((player) => player.slotId === slotId) ||
      this.world.players.length >= 4
    ) {
      throw new Error('Invalid or full After participant slot');
    }
    const spawn = this.map.spawns[this.world.players.length % this.map.spawns.length];
    this.world.players.push({
      slotId,
      characterId,
      position: { ...spawn },
      previousPosition: { ...spawn },
      facing: 'south',
      stamina: 100,
      carrying: false,
      abilityCooldownTicks: 0,
      lastSequence: -1,
    });
  }

  /** Sanitizes local input and prevents held movement from surviving a paused menu. */
  setInput(slotId: string, input: PlayerInput): void {
    if (this.paused || !this.world.players.some((player) => player.slotId === slotId)) return;
    const axis = (value: number) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0);
    this.inputs.set(slotId, {
      moveX: axis(input.moveX),
      moveY: axis(input.moveY),
      sprint: input.sprint === true,
    });
  }

  /** Local pause clears input and accumulated time; unpause cannot replay stale movement. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.inputs.clear();
    this.accumulator = 0;
    for (const player of this.world.players) player.previousPosition = { ...player.position };
  }

  /** Advances fixed 30 Hz ticks, bounding catch-up after hidden tabs; returns interpolation alpha. */
  advance(elapsedSeconds: number): number {
    if (this.paused || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0)
      return this.accumulator / AFTER_STEP_SECONDS;
    this.accumulator += Math.min(elapsedSeconds, MAX_CATCH_UP_SECONDS);
    while (this.accumulator + 1e-10 >= AFTER_STEP_SECONDS) {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - AFTER_STEP_SECONDS);
    }
    return this.accumulator / AFTER_STEP_SECONDS;
  }

  /** Integrates one fixed tick, normalizing diagonals and limiting sprint by stamina/carrying. */
  private step(): void {
    this.world.tick++;
    for (const player of this.world.players) {
      const input = this.inputs.get(player.slotId) ?? { moveX: 0, moveY: 0, sprint: false };
      const length = Math.hypot(input.moveX, input.moveY);
      const divisor = Math.max(1, length);
      if (player.stamina >= 25) this.exhausted.delete(player.slotId);
      const running =
        input.sprint &&
        length > 0 &&
        player.stamina > 0 &&
        !player.carrying &&
        !this.exhausted.has(player.slotId);
      const speed = (running ? RUN_SPEED : WALK_SPEED) * (player.carrying ? 0.65 : 1);
      player.previousPosition = { ...player.position };
      player.position = slideMove(this.map, player.position, {
        x: (input.moveX / divisor) * speed * AFTER_STEP_SECONDS,
        y: (input.moveY / divisor) * speed * AFTER_STEP_SECONDS,
      });
      if (length > 0)
        player.facing =
          Math.abs(input.moveX) > Math.abs(input.moveY)
            ? input.moveX > 0
              ? 'east'
              : 'west'
            : input.moveY > 0
              ? 'south'
              : 'north';
      player.stamina = Math.max(0, Math.min(100, player.stamina + (running ? -24 : 12) * AFTER_STEP_SECONDS));
      if (player.stamina === 0) this.exhausted.add(player.slotId);
      player.abilityCooldownTicks = Math.max(0, player.abilityCooldownTicks - 1);
    }
  }

  /** Returns an independent snapshot; presentation cannot mutate authoritative simulation data. */
  snapshot(): AfterWorldState {
    return structuredClone(this.world);
  }

  /** Advances narrative time from story progress, not a hidden real-time failure timer. */
  approachDawn(): void {
    this.world.nightPhase = 'before-dawn';
  }

  /** Returns the legal prompt for one participant without changing quest/world state. */
  prompt(slotId: string) {
    const player = this.world.players.find((entry) => entry.slotId === slotId);
    const target =
      player && nearestInteraction(this.map, player, this.world.flags, this.interactionAvailable);
    return target ? structuredClone(target) : undefined;
  }

  /** Accepts only fresh in-session commands for the selected reachable target; once flags deduplicate rewards. */
  interact(command: InteractionCommand): WorldEvent | undefined {
    if (
      this.paused ||
      command.sessionId !== this.world.sessionId ||
      !Number.isSafeInteger(command.sequence) ||
      command.sequence < 0
    )
      return;
    const player = this.world.players.find((entry) => entry.slotId === command.slotId);
    if (!player || command.sequence <= player.lastSequence) return;
    player.lastSequence = command.sequence;
    const target = nearestInteraction(this.map, player, this.world.flags, this.interactionAvailable);
    if (!target || target.id !== command.targetId) return;
    const flag = `interaction:${target.id}`;
    if (target.once) this.world.flags.push(flag);
    return {
      id: `${this.world.sessionId}:${player.slotId}:${command.sequence}`,
      tick: this.world.tick,
      type: 'interacted',
      slotId: player.slotId,
      targetId: target.id,
    };
  }

  /** Recovers an invalid position to a validated spawn, leaving already-safe participants untouched. */
  recoverPlayer(slotId: string): boolean {
    const player = this.world.players.find((entry) => entry.slotId === slotId);
    if (!player || canStand(this.map, player.position)) return false;
    player.position = { ...this.map.spawns[0] };
    player.previousPosition = { ...player.position };
    this.inputs.delete(slotId);
    return true;
  }

  /** Changes carry state through the session boundary rather than mutating snapshots. */
  setCarrying(slotId: string, carrying: boolean): void {
    const player = this.world.players.find((entry) => entry.slotId === slotId);
    if (player) player.carrying = carrying;
  }
}
