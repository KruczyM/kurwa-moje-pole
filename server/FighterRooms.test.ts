import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server, type Namespace, type Socket } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { FighterRooms } from './FighterRooms';
import { INPUT } from '../src/games/fighter/simulation/CombatTypes';
import type {
  FighterFrame,
  FighterReply,
  FighterRequest,
  FighterRoomState,
} from '../src/games/fighter/network/fighterProtocol';

function harness() {
  let now = 1000;
  let attach: (socket: Socket) => void;
  const clients: FakeSocket[] = [];
  class FakeSocket {
    id = String(clients.length);
    rooms = new Set<string>();
    handlers = new Map<string, (...args: any[]) => void>();
    frames: FighterFrame[] = [];
    room?: FighterRoomState;
    on(name: string, fn: (...args: any[]) => void) {
      this.handlers.set(name, fn);
    }
    emit(name: string, data: any) {
      if (name === 'fighter:frame') this.frames.push(structuredClone(data));
      if (name === 'fighter:room') this.room = structuredClone(data);
    }
    join(code: string) {
      this.rooms.add(code);
    }
    leave(code: string) {
      this.rooms.delete(code);
    }
    request(request: FighterRequest | unknown): FighterReply {
      let reply!: FighterReply;
      this.handlers.get('fighter:request')!(request, (r: FighterReply) => {
        reply = structuredClone(r);
      });
      return reply;
    }
    input(sequence: number, mask: number) {
      this.handlers.get('fighter:input')!({ sequence, mask });
    }
    disconnect() {
      this.handlers.get('disconnect')!();
    }
  }
  const io = {
    on: (_name: string, fn: (socket: Socket) => void) => {
      attach = fn;
    },
    to: (code: string) => ({
      emit: (name: string, data: unknown) =>
        clients.filter((c) => c.rooms.has(code)).forEach((c) => c.emit(name, data)),
    }),
    sockets: new Map(),
  };
  const server = new FighterRooms(io as unknown as Namespace, () => now);
  const client = () => {
    const c = new FakeSocket();
    clients.push(c);
    attach(c as unknown as Socket);
    io.sockets.set(c.id, c);
    return c;
  };
  const a = client();
  const b = client();
  const created = a.request({ action: 'create', version: 1 });
  if ('error' in created) throw Error(created.error);
  const joined = b.request({ action: 'join', version: 1, code: created.room.code });
  if ('error' in joined) throw Error(joined.error);
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) server.step();
  };
  const start = () => {
    a.request({ action: 'ready', ready: true });
    b.request({ action: 'ready', ready: true });
    now += 3000;
    advance(3);
  };
  return {
    server,
    a,
    b,
    client,
    created,
    joined,
    advance,
    start,
    time: (ms: number) => {
      now += ms;
    },
  };
}

describe('private fighter sessions', () => {
  it('restores a lone host lobby and rejects edits while resuming an existing match', () => {
    const h = harness();
    const host = h.client();
    const created = host.request({ action: 'create', version: 1 });
    if ('error' in created) throw Error(created.error);
    host.disconnect();
    const returned = h.client();
    expect(
      returned.request({ action: 'join', version: 1, code: created.room.code, token: created.token }),
    ).not.toHaveProperty('error');
    expect(returned.room?.phase).toBe('lobby');
    expect(h.client().request({ action: 'join', version: 1, code: created.room.code })).not.toHaveProperty(
      'error',
    );
    h.start();
    const before = h.a.frames.at(-1)!.snapshot;
    h.b.disconnect();
    const resumed = h.client();
    resumed.request({ action: 'join', version: 1, code: h.created.room.code, token: h.joined.token });
    expect(h.a.room?.phase).toBe('countdown');
    expect(h.a.request({ action: 'select', characterId: 'korba' })).toHaveProperty('error');
    expect(h.a.request({ action: 'stage', stageId: h.created.room.stageId })).toHaveProperty('error');
    expect(resumed.request({ action: 'ready', ready: false })).toHaveProperty('error');
    h.time(3000);
    h.advance(3);
    expect(h.a.room?.phase).toBe('fight');
    expect(h.a.frames.at(-1)!.snapshot.p1.id).toBe(before.p1.id);
    expect(h.a.frames.at(-1)!.snapshot.tick).toBeGreaterThan(before.tick);
  });
  it('enforces capacity, ownership, same-character matches and readiness invalidation', () => {
    const h = harness();
    expect(h.client().request({ action: 'join', version: 1, code: h.created.room.code })).toHaveProperty(
      'error',
    );
    expect(h.b.request({ action: 'stage', stageId: 'grzybek' })).toHaveProperty('error');
    expect(h.a.request({ action: 'select', characterId: '__proto__' })).toHaveProperty('error');
    h.b.request({ action: 'select', characterId: 'amper' });
    h.a.request({ action: 'ready', ready: true });
    h.b.request({ action: 'ready', ready: true });
    expect(h.a.room?.phase).toBe('countdown');
    h.a.request({ action: 'stage', stageId: 'grzybek' });
    expect(h.b.room?.phase).toBe('lobby');
    expect(h.b.room?.players.every((p) => p?.ready === false)).toBe(true);
    h.start();
    expect(h.a.frames.at(-1)?.snapshot.p1.id).toBe('amper');
    expect(h.b.frames.at(-1)?.snapshot.p2.id).toBe('amper');
  });

  it('preserves short presses, rejects stale and forged inputs, and synchronizes hit/block/launch', () => {
    const h = harness();
    h.start();
    h.a.input(1, INPUT.RIGHT);
    h.b.input(1, INPUT.LEFT);
    h.advance(90);
    h.a.input(2, 0);
    h.b.input(2, 0);
    h.advance(3);
    const initial = h.a.frames.at(-1)!.snapshot.p2.hp;
    h.a.input(3, INPUT.LP);
    h.a.input(4, 0);
    h.advance(35);
    h.advance(3);
    expect(h.b.frames.at(-1)!.snapshot.p2.hp).toBeLessThan(initial);
    h.b.input(3, INPUT.BLOCK);
    h.a.input(5, INPUT.RP);
    h.a.input(6, 0);
    h.advance(65);
    expect(h.b.frames.flatMap((f) => f.events).some((e) => e.type === 'block')).toBe(true);
    h.b.input(4, 0);
    h.a.input(7, INPUT.DOWN | INPUT.RP);
    h.a.input(8, 0);
    h.advance(35);
    expect(h.b.frames.flatMap((f) => f.events).some((e) => e.type === 'launch')).toBe(true);
    expect(h.a.frames.at(-1)).toEqual(h.b.frames.at(-1));
    const tick = h.a.frames.at(-1)!.snapshot.tick;
    h.a.input(7, INPUT.SPECIAL);
    h.a.input(9, -1);
    h.a.input(10, 4096);
    h.advance(3);
    expect(h.a.frames.at(-1)!.snapshot.tick).toBe(tick + 3);
    expect(h.a.frames.at(-1)!.snapshot.p1.currentMove?.id).not.toBe('special');
  });

  it('freezes on disconnect, resumes the same match, and expires without assigning a winner', () => {
    const h = harness();
    h.start();
    h.advance(12);
    const tick = h.a.frames.at(-1)!.snapshot.tick;
    h.b.disconnect();
    h.advance(30);
    expect(h.a.room?.phase).toBe('suspended');
    expect(h.a.frames.at(-1)!.snapshot.tick).toBe(tick);
    const reconnect = h.client();
    expect(
      reconnect.request({ action: 'join', version: 1, code: h.created.room.code, token: h.joined.token }),
    ).not.toHaveProperty('error');
    h.time(3000);
    h.advance(3);
    expect(h.a.frames.at(-1)!.snapshot.tick).toBe(tick + 3);
    reconnect.disconnect();
    h.time(20001);
    h.advance(3);
    expect(h.a.room?.phase).toBe('closed');
    expect(h.a.frames.at(-1)!.snapshot.winner).toBeNull();
    expect(
      h.client().request({ action: 'join', version: 1, code: h.created.room.code, token: h.joined.token }),
    ).toHaveProperty('error');
  });

  it('requires both rematch votes, isolates rooms and expires abandoned lobbies', () => {
    const h = harness();
    h.start();
    const other = h.client();
    const otherRoom = other.request({ action: 'create', version: 1 });
    expect(otherRoom).not.toHaveProperty('error');
    h.a.request({ action: 'rematch' });
    expect(h.a.room?.phase).toBe('fight');
    // Let the authoritative timer resolve two rounds and the match.
    h.advance(12000);
    expect(h.a.room?.phase).toBe('finished');
    h.a.request({ action: 'rematch' });
    expect(h.b.room?.phase).toBe('finished');
    h.b.request({ action: 'rematch' });
    expect(h.a.room?.phase).toBe('countdown');
    h.time(3000);
    h.advance(3);
    expect(h.a.frames.at(-1)!.matchId).toBe(2);
    expect(other.frames).toHaveLength(0);
    h.time(600001);
    h.advance(3);
    expect(other.room?.phase).toBe('closed');
  });

  it('bounds request and input floods and rejects unauthorized operations', () => {
    const h = harness();
    const stranger = h.client();
    expect(stranger.request({ action: 'ready', ready: true })).toHaveProperty('error');
    expect(stranger.request({ action: 'join', version: 99, code: h.created.room.code })).toHaveProperty(
      'error',
    );
    expect(stranger.request(null)).toHaveProperty('error');
    for (let i = 0; i < 20; i++) h.a.request({ action: 'select', characterId: 'korba' });
    expect(h.a.request({ action: 'ready', ready: true })).toHaveProperty('error');
    h.time(1001);
    h.start();
    for (let i = 0; i < 1000; i++) h.a.input(i, i % 2 ? INPUT.RIGHT : 0);
    h.time(251);
    h.advance(3);
    expect(h.a.frames.at(-1)!.snapshot.p1.x).toBe(-180);
  });
});

it('runs two real Socket.IO clients in the fighter namespace without joining festival rooms', async () => {
  const http = createServer();
  const io = new Server(http);
  let now = 1000;
  const rooms = new FighterRooms(io.of('/fighter'), () => now);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}/fighter`;
  const a = connect(url, { transports: ['websocket'], forceNew: true });
  const b = connect(url, { transports: ['websocket'], forceNew: true });
  const request = (socket: typeof a, data: FighterRequest) =>
    new Promise<FighterReply>((resolve) => socket.emit('fighter:request', data, resolve));
  let frameA: FighterFrame | undefined, frameB: FighterFrame | undefined;
  a.on('fighter:frame', (frame) => {
    frameA = frame;
  });
  b.on('fighter:frame', (frame) => {
    frameB = frame;
  });
  try {
    await vi.waitFor(() => expect(a.connected && b.connected).toBe(true));
    const created = await request(a, { action: 'create', version: 1 });
    if ('error' in created) throw Error(created.error);
    await request(b, { action: 'join', version: 1, code: created.room.code });
    await request(a, { action: 'ready', ready: true });
    await request(b, { action: 'ready', ready: true });
    now += 3000;
    for (let i = 0; i < 6; i++) rooms.step();
    await vi.waitFor(() => expect(frameA?.snapshot.tick).toBe(6));
    expect(frameA).toEqual(frameB);
    expect(io.of('/').sockets.size).toBe(0);
  } finally {
    a.disconnect();
    b.disconnect();
    rooms.stop();
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
});
