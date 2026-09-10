import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { RoomServer } from './roomServer';
import type { RoomState } from '../src/game/network/networkProtocol';

describe('RoomServer (Integracja Socket.IO)', () => {
  let server: RoomServer;
  const PORT = 3899;
  let clientA: ClientSocketType;
  let clientB: ClientSocketType;

  beforeAll(async () => {
    server = new RoomServer({ port: PORT, corsOrigin: '*' });
    await server.start();
  });

  afterAll(async () => {
    clientA?.disconnect();
    clientB?.disconnect();
    await server.stop();
  });

  it('obsługuje /health endpoint', async () => {
    const res = await fetch(`http://localhost:${PORT}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.protocol).toBe('1.0.0');
  });

  it('synchronizuje stan pokoju między dwoma klientami w czasie rzeczywistym', async () => {
    clientA = ClientSocket(`http://localhost:${PORT}`);
    clientB = ClientSocket(`http://localhost:${PORT}`);

    // Czekamy na połączenie obu klientów
    await new Promise<void>((resolve) => {
      let connected = 0;
      const onConn = () => {
        connected++;
        if (connected === 2) resolve();
      };
      clientA.on('connect', onConn);
      clientB.on('connect', onConn);
    });

    // Dołączamy do pokoju
    clientA.emit('room:join', { roomId: 'test-room-1', sessionToken: 'token-A' });
    clientB.emit('room:join', { roomId: 'test-room-1', sessionToken: 'token-B' });

    // Klient B nasłuchuje aktualizacji stanu:
    const statePromise = new Promise<RoomState>((resolve) => {
      clientB.on('room:state', (state: RoomState) => {
        if (state.slots['Amper'].status === 'reserving') {
          resolve(state);
        }
      });
    });

    // Klient A rezerwuje postać Amper
    clientA.emit('character:reserve', {
      character: 'Amper',
      nickname: 'Aleksander',
      sessionToken: 'token-A',
    });

    const receivedState = await statePromise;
    expect(receivedState.slots['Amper'].status).toBe('reserving');
    expect(receivedState.slots['Amper'].nickname).toBe('Aleksander');

    // Klient B próbuje zarezerwować zajętego Ampera i otrzymuje błąd:
    const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
      clientB.once('error', (err) => resolve(err));
    });

    clientB.emit('character:reserve', {
      character: 'Amper',
      nickname: 'InnyGracz',
      sessionToken: 'token-B',
    });

    const err = await errorPromise;
    expect(err.code).toBe('CHARACTER_OCCUPIED');
  });
});

