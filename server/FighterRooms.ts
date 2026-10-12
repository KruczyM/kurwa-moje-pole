import { randomBytes, randomUUID } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import { ROSTER } from '../src/games/fighter/data/fighters/roster.js';
import { STAGES } from '../src/games/fighter/data/stages.js';
import {
  FighterSimulation,
  type SimulationEvent,
} from '../src/games/fighter/simulation/FighterSimulation.js';
import {
  FIGHTER_PROTOCOL,
  type FighterFrame,
  type FighterInput,
  type FighterReply,
  type FighterRequest,
  type FighterRoomState,
} from '../src/games/fighter/network/fighterProtocol.js';

interface Member {
  token: string;
  socketId?: string;
  characterId: string;
  ready: boolean;
  rematch: boolean;
  mask: number;
  queue: number[];
  sequence: number;
  lastInputAt: number;
}
interface Room {
  state: FighterRoomState;
  members: [Member | null, Member | null];
  sim?: FighterSimulation;
  matchId: number;
  frame: number;
  eventId: number;
  events: FighterFrame['events'];
  lastActivity: number;
}

/** Independent namespace; never reserves a festival character or room. */
export class FighterRooms {
  private rooms = new Map<string, Room>();
  private memberships = new Map<string, { room: Room; seat: 0 | 1 }>();
  private limits = new Map<string, { start: number; inputs: number; requests: number }>();
  private timer?: ReturnType<typeof setInterval>;
  private previous = 0;
  private accumulator = 0;
  private ticks = 0;

  constructor(
    private io: Namespace,
    private now: () => number = Date.now,
  ) {
    io.on('connection', (socket) => this.attach(socket));
  }

  start(): void {
    this.previous = this.now();
    this.timer = setInterval(() => {
      const now = this.now();
      this.accumulator += Math.min(100, now - this.previous);
      this.previous = now;
      while (this.accumulator >= 1000 / 60) {
        this.step();
        this.accumulator -= 1000 / 60;
      }
    }, 1000 / 60);
  }

  stop(): void {
    clearInterval(this.timer);
    this.rooms.clear();
    this.memberships.clear();
    this.limits.clear();
  }

  private allowed(socketId: string, kind: 'inputs' | 'requests'): boolean {
    const now = this.now();
    let limit = this.limits.get(socketId);
    if (!limit || now - limit.start >= 1000) {
      limit = { start: now, inputs: 0, requests: 0 };
      this.limits.set(socketId, limit);
    }
    return ++limit[kind] <= (kind === 'inputs' ? 120 : 15);
  }

  private attach(socket: Socket): void {
    socket.emit('fighter:hello', { version: FIGHTER_PROTOCOL });
    socket.on('fighter:request', (request: unknown, acknowledge?: (reply: FighterReply) => void) => {
      if (typeof acknowledge !== 'function') return;
      try {
        if (!this.allowed(socket.id, 'requests')) throw Error('Zbyt wiele żądań. Spróbuj za chwilę.');
        acknowledge(this.request(socket, request));
      } catch (error) {
        acknowledge({ error: error instanceof Error ? error.message : 'Nieprawidłowe żądanie.' });
      }
    });
    socket.on('fighter:input', (input: FighterInput) => {
      const membership = this.memberships.get(socket.id);
      if (!membership || !this.allowed(socket.id, 'inputs')) return;
      const member = membership.room.members[membership.seat]!;
      if (
        membership.room.state.phase !== 'fight' ||
        !input ||
        !Number.isSafeInteger(input.sequence) ||
        input.sequence <= member.sequence ||
        !Number.isInteger(input.mask) ||
        input.mask < 0 ||
        input.mask > 1023
      )
        return;
      member.sequence = input.sequence;
      member.lastInputAt = this.now();
      const lastMask = member.queue.at(-1) ?? member.mask;
      if (input.mask !== lastMask && member.queue.length < 12) member.queue.push(input.mask);
    });
    socket.on('disconnect', () => {
      this.leave(socket, false);
      this.limits.delete(socket.id);
    });
  }

  private member(socketId: string): { room: Room; seat: 0 | 1; member: Member } {
    const membership = this.memberships.get(socketId);
    if (!membership) throw Error('Najpierw dołącz do pokoju.');
    return { ...membership, member: membership.room.members[membership.seat]! };
  }

  private request(socket: Socket, value: unknown): FighterReply {
    if (!value || typeof value !== 'object' || !('action' in value)) throw Error('Nieprawidłowe żądanie.');
    const request = value as FighterRequest;
    if (request.action === 'create' || request.action === 'join') {
      if (request.version !== FIGHTER_PROTOCOL) throw Error('Zaktualizuj stronę i serwer bijatyki.');
      if (this.memberships.has(socket.id)) throw Error('Najpierw opuść obecny pokój.');
      let room: Room;
      let seat: 0 | 1 = 0;
      if (request.action === 'create') {
        if (this.rooms.size >= 256) throw Error('Serwer jest zajęty. Spróbuj później.');
        let code: string;
        do {
          code = randomBytes(3).toString('hex').toUpperCase();
        } while (this.rooms.has(code));
        room = {
          state: {
            version: FIGHTER_PROTOCOL,
            code,
            revision: 0,
            phase: 'lobby',
            players: [null, null],
            stageId: 'main_stage',
            countdownEndsAt: null,
            reconnectUntil: null,
            message: '',
          },
          members: [null, null],
          matchId: 0,
          frame: 0,
          eventId: 0,
          events: [],
          lastActivity: this.now(),
        };
        this.rooms.set(code, room);
      } else {
        if (typeof request.code !== 'string' || !/^[A-F0-9]{6}$/.test(request.code))
          throw Error('Podaj kod pokoju złożony z sześciu znaków.');
        const found = this.rooms.get(request.code);
        if (!found || found.state.phase === 'closed') throw Error('Pokój nie istnieje lub został zamknięty.');
        room = found;
        const resumed =
          typeof request.token === 'string' ? room.members.findIndex((m) => m?.token === request.token) : -1;
        if (resumed >= 0) {
          seat = resumed as 0 | 1;
          if (room.members[seat]?.socketId) throw Error('Ten gracz jest już połączony.');
          if (room.state.reconnectUntil !== null && this.now() >= room.state.reconnectUntil)
            throw Error('Czas na ponowne połączenie minął.');
        } else {
          if (room.state.phase !== 'lobby' || room.members[1])
            throw Error('Pokój jest pełny lub mecz już trwa.');
          seat = 1;
        }
      }
      let member = room.members[seat];
      if (!member)
        member = {
          token: randomUUID(),
          characterId: seat === 0 ? 'amper' : 'korba',
          ready: false,
          rematch: false,
          mask: 0,
          queue: [],
          sequence: -1,
          lastInputAt: this.now(),
        };
      member.socketId = socket.id;
      member.mask = 0;
      member.queue = [];
      member.sequence = -1;
      room.members[seat] = member;
      this.memberships.set(socket.id, { room, seat });
      void socket.join(room.state.code);
      if (room.state.phase === 'suspended' && room.members.every((m) => !m || m.socketId)) {
        room.state.phase = room.sim
          ? room.sim.getState().roundState === 'matchOver'
            ? 'finished'
            : 'countdown'
          : 'lobby';
        room.state.countdownEndsAt = room.state.phase === 'countdown' ? this.now() + 3000 : null;
        room.state.reconnectUntil = null;
        room.state.message = '';
      }
      this.publish(room);
      if (room.sim) socket.emit('fighter:frame', this.frame(room, []));
      return { room: room.state, seat, token: member.token };
    }
    const { room, seat, member } = this.member(socket.id);
    if (request.action === 'leave') {
      this.leave(socket, true);
      return { room: room.state, seat, token: member.token };
    }
    if (room.state.phase === 'closed' || room.state.phase === 'suspended')
      throw Error('Pokój jest niedostępny.');
    if (request.action === 'rematch') {
      if (room.state.phase !== 'finished') throw Error('Mecz jeszcze trwa.');
      member.rematch = true;
      if (room.members.every((m) => m?.socketId && m.rematch)) {
        room.sim = undefined;
        this.countdown(room);
      }
    } else {
      if (room.sim || (room.state.phase !== 'lobby' && room.state.phase !== 'countdown'))
        throw Error('Poczekaj na koniec meczu.');
      if (request.action === 'select') {
        if (typeof request.characterId !== 'string' || !Object.hasOwn(ROSTER, request.characterId))
          throw Error('Nieznana postać.');
        member.characterId = request.characterId;
        this.invalidate(room);
      } else if (request.action === 'stage') {
        if (seat !== 0 || typeof request.stageId !== 'string' || !Object.hasOwn(STAGES, request.stageId))
          throw Error('Tylko gospodarz wybiera arenę.');
        room.state.stageId = request.stageId;
        this.invalidate(room);
      } else if (request.action === 'ready') {
        if (typeof request.ready !== 'boolean') throw Error('Nieprawidłowa gotowość.');
        if (room.state.phase === 'countdown') this.invalidate(room);
        member.ready = request.ready;
        if (room.members.every((m) => m?.socketId && m.ready)) this.countdown(room);
      } else throw Error('Nieznana operacja.');
    }
    this.publish(room);
    return { room: room.state, seat, token: member.token };
  }

  private invalidate(room: Room): void {
    room.state.phase = 'lobby';
    room.state.countdownEndsAt = null;
    room.members.forEach((m) => {
      if (m) m.ready = false;
    });
  }

  private countdown(room: Room): void {
    room.state.phase = 'countdown';
    room.state.countdownEndsAt = this.now() + 3000;
    room.members.forEach((m) => {
      if (m) {
        m.rematch = false;
        m.mask = 0;
        m.queue = [];
      }
    });
  }

  private leave(socket: Socket, intentional: boolean): void {
    const membership = this.memberships.get(socket.id);
    if (!membership) return;
    const { room, seat } = membership;
    this.memberships.delete(socket.id);
    void socket.leave(room.state.code);
    const member = room.members[seat]!;
    member.socketId = undefined;
    member.mask = 0;
    member.queue = [];
    if (room.state.phase === 'closed') return;
    if (intentional) {
      room.state.phase = 'closed';
      room.state.message = 'Gracz opuścił pokój. Mecz zakończony bez wyniku.';
    } else {
      room.state.phase = 'suspended';
      room.state.reconnectUntil ??= this.now() + 20000;
      room.state.message = 'Utracono połączenie. Czekamy na powrót gracza.';
    }
    this.publish(room);
  }

  private publish(room: Room): void {
    room.state.players = room.members.map((m) =>
      m
        ? { characterId: m.characterId, connected: Boolean(m.socketId), ready: m.ready, rematch: m.rematch }
        : null,
    ) as FighterRoomState['players'];
    room.state.revision++;
    room.lastActivity = this.now();
    this.io.to(room.state.code).emit('fighter:room', room.state);
  }

  private frame(room: Room, events: (SimulationEvent & { eventId: number })[]): FighterFrame {
    return { sequence: ++room.frame, matchId: room.matchId, snapshot: room.sim!.getSnapshot(), events };
  }

  /** Public fixed step also permits deterministic session tests without timers. */
  step(): void {
    this.ticks++;
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (room.state.phase === 'suspended' && now >= room.state.reconnectUntil!) {
        room.state.phase = 'closed';
        room.state.message = 'Czas na ponowne połączenie minął. Mecz zakończony bez wyniku.';
        this.publish(room);
      }
      if (
        (room.state.phase === 'closed' && now - room.lastActivity > 20000) ||
        ((room.state.phase === 'lobby' || room.state.phase === 'finished') &&
          now - room.lastActivity > 600000)
      ) {
        room.state.phase = 'closed';
        room.state.message = 'Pokój wygasł.';
        this.publish(room);
        for (const m of room.members)
          if (m?.socketId) {
            this.memberships.delete(m.socketId);
            void this.io.sockets.get(m.socketId)?.leave(code);
          }
        this.rooms.delete(code);
        continue;
      }
      if (room.state.phase === 'countdown' && now >= room.state.countdownEndsAt!) {
        if (!room.sim) {
          room.sim = new FighterSimulation(
            ROSTER[room.members[0]!.characterId]!.definition,
            ROSTER[room.members[1]!.characterId]!.definition,
          );
          room.matchId++;
        }
        room.state.phase = 'fight';
        room.state.countdownEndsAt = null;
        this.publish(room);
      }
      if (room.state.phase !== 'fight' || !room.sim) continue;
      const masks = room.members.map((m) => {
        if (!m || now - m.lastInputAt > 250) {
          if (m) {
            m.mask = 0;
            m.queue = [];
          }
          return 0;
        }
        m.mask = m.queue.shift() ?? m.mask;
        return m.mask;
      });
      room.sim.update(masks[0]!, masks[1]!);
      room.events.push(...room.sim.getEvents().map((e) => ({ ...e, eventId: ++room.eventId })));
      const finished = room.sim.getState().roundState === 'matchOver';
      if (this.ticks % 3 === 0 || finished) {
        this.io.to(code).emit('fighter:frame', this.frame(room, room.events));
        room.events = [];
      }
      if (finished) {
        room.state.phase = 'finished';
        this.publish(room);
      }
    }
  }
}
