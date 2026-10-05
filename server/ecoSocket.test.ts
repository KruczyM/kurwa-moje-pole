import { it, expect } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { RoomServer } from './roomServer';
import { ecoPosition, type EcoState } from '../src/game/interactions/ecoChallenge';

it('runs an Eko lobby and scores private pickups over real sockets', async () => {
  const port = 3907,
    server = new RoomServer({ port, corsOrigin: '*' }),
    clients: Socket[] = [];
  await server.start();
  try {
    const connect = async (character: string) => {
      const socket = io(`http://localhost:${port}`, { reconnection: false });
      clients.push(socket);
      await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
      const occupied = new Promise<void>((resolve) =>
        socket.on('room:state', (state) => {
          if (state.slots[character].status === 'occupied') resolve();
        }),
      );
      socket.emit('room:join', { roomId: 'eco-test', sessionToken: character });
      socket.emit('character:reserve', { character, nickname: character, sessionToken: character });
      socket.emit('character:confirm', { character, sessionToken: character });
      await occupied;
      return socket;
    };
    const a = await connect('Amper'),
      b = await connect('Antena');
    let state: EcoState | null = null;
    a.on('eco:state', (value) => {
      state = value;
    });
    const request = (socket: Socket, operation: string, payload: Record<string, unknown> = {}) =>
      new Promise<boolean>((resolve, reject) =>
        socket
          .timeout(2000)
          .emit('eco:request', { operation, ...payload }, (error: Error | null, ok: boolean) =>
            error ? reject(error) : resolve(ok),
          ),
      );
    const pool = Array.from({ length: 96 }, (_, i) => ({ x: (i % 12) * 6, z: Math.floor(i / 12) * 6 }));
    expect(await request(a, 'create', { pool })).toBe(true);
    expect(await request(b, 'join')).toBe(true);
    expect(await request(a, 'start')).toBe(true);
    const round = state as EcoState | null;
    expect(round?.phase).toBe('playing');
    const point = ecoPosition(round!.seed, 0, 0, pool);
    for (const socket of [a, b]) {
      socket.emit('player:update', {
        transform: {
          position: [point.x, 0, point.z],
          yaw: 0,
          locomotion: 'idle',
          speed: 0,
          timestamp: Date.now(),
        },
      });
      expect(await request(socket, 'collect', { roundId: round!.id, canId: 'eco_0', generation: 0 })).toBe(
        true,
      );
    }
    expect((state as EcoState | null)?.players.map((p) => p.score)).toEqual([1, 1]);
    expect(await request(a, 'collect', { roundId: round!.id, canId: 'eco_0', generation: 0 })).toBe(false);
    const transferred = new Promise<EcoState>((resolve) =>
      b.on('eco:state', (value) => {
        if (value?.hostId === b.id) resolve(value);
      }),
    );
    a.disconnect();
    expect((await transferred).players).toHaveLength(1);
  } finally {
    clients.forEach((client) => client.disconnect());
    await server.stop();
  }
}, 10000);
