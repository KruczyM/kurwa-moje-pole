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
    server = new RoomServer({ 
      port: PORT, 
      corsOrigin: '*',
      reservationTimeoutMs: 500,
      gracePeriodMs: 500 
    });
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
    expect(err.code).toBe('CHARACTER_RESERVING');
  });

  it('odrzuca 9. klienta przed wyborem postaci, gdy pokój jest pełny (limit to 8)', async () => {
    const clients: ClientSocketType[] = [];
    
    // Connect 8 clients
    for (let i = 0; i < 8; i++) {
      const client = ClientSocket(`http://localhost:${PORT}`);
      await new Promise<void>((resolve) => client.on('connect', resolve));
      client.emit('room:join', { roomId: 'full-room' });
      await new Promise<void>((resolve) => client.once('room:joined', () => resolve()));
      clients.push(client);
    }
    
    // 9th client
    const client9 = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client9.on('connect', resolve));
    
    const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
      client9.once('error', (err) => resolve(err));
    });
    
    client9.emit('room:join', { roomId: 'full-room' });
    const err = await errorPromise;
    expect(err.code).toBe('ROOM_FULL');
    
    // Cleanup
    client9.disconnect();
    for (const c of clients) c.disconnect();
  });

  it('emituje błąd TIMEOUT do właściciela, gdy rezerwacja wygasa i powiadamia pokój', async () => {
    const client = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client.on('connect', resolve));
    
    client.emit('room:join', { roomId: 'timeout-room' });
    await new Promise<void>((resolve) => client.once('room:joined', () => resolve()));
    
    const statePromise = new Promise<RoomState>((resolve) => {
      client.on('room:state', (state: RoomState) => {
        if (state.slots['Amper'].status === 'reserving') resolve(state);
      });
    });
    
    client.emit('character:reserve', { character: 'Amper', nickname: 'Test', sessionToken: 'abc' });
    await statePromise;
    
    const timeoutPromise = new Promise<{ code: string; message: string }>((resolve) => {
      client.once('error', (err) => {
        if (err.code === 'TIMEOUT') resolve(err);
      });
    });
    
    const freeStatePromise = new Promise<RoomState>((resolve) => {
      client.on('room:state', (state: RoomState) => {
        if (state.slots['Amper'].status === 'free') resolve(state);
      });
    });

    const err = await timeoutPromise;
    expect(err.code).toBe('TIMEOUT');
    
    const freeState = await freeStatePromise;
    expect(freeState.slots['Amper'].status).toBe('free');
    
    client.disconnect();
  });

  it('obsługuje poprawny reconnect, zachowując postać i nazwę (grace period)', async () => {
    const client = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client.on('connect', resolve));
    
    client.emit('room:join', { roomId: 'reconnect-room', sessionToken: 'reconnect-token' });
    await new Promise<void>((resolve) => client.once('room:joined', () => resolve()));
    
    client.emit('character:reserve', { character: 'Amper', nickname: 'Reconnecter', sessionToken: 'reconnect-token' });
    client.emit('character:confirm', { character: 'Amper', sessionToken: 'reconnect-token' });
    
    // Wait for occupied state
    await new Promise<void>((resolve) => {
      client.on('room:state', (state: RoomState) => {
        if (state.slots['Amper'].status === 'occupied') resolve();
      });
    });
    
    // Disconnect
    client.disconnect();
    
    // wait a bit but not over grace period
    await new Promise(r => setTimeout(r, 20));
    
    // Reconnect with same token
    const clientReconnect = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => clientReconnect.on('connect', resolve));
    
    const joinedPromise = new Promise<{ state: RoomState, reconnectedCharacter: string }>((resolve) => {
      clientReconnect.once('room:joined', (payload) => resolve(payload));
    });
    
    clientReconnect.emit('room:join', { roomId: 'reconnect-room', sessionToken: 'reconnect-token' });
    
    const joined = await joinedPromise;
    expect(joined.reconnectedCharacter).toBe('Amper');
    expect(joined.state.slots['Amper'].status).toBe('occupied');
    expect(joined.state.slots['Amper'].nickname).toBe('Reconnecter');
    
    clientReconnect.disconnect();
  });

  it('zwalnia postać po wygaśnięciu grace period, jeśli gracz nie wrócił', async () => {
    const clientObserver = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => clientObserver.on('connect', resolve));
    clientObserver.emit('room:join', { roomId: 'grace-room' });
    await new Promise<void>((resolve) => clientObserver.once('room:joined', () => resolve()));

    const client = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client.on('connect', resolve));
    
    client.emit('room:join', { roomId: 'grace-room', sessionToken: 'grace-token' });
    await new Promise<void>((resolve) => client.once('room:joined', () => resolve()));
    
    client.emit('character:reserve', { character: 'Amper', nickname: 'Leaver', sessionToken: 'grace-token' });
    client.emit('character:confirm', { character: 'Amper', sessionToken: 'grace-token' });
    
    await new Promise<void>((resolve) => {
      clientObserver.on('room:state', (state: RoomState) => {
        if (state.slots['Amper'].status === 'occupied') resolve();
      });
    });
    
    // Disconnect owner
    client.disconnect();
    
    const freeStatePromise = new Promise<RoomState>((resolve) => {
      clientObserver.on('room:state', (state: RoomState) => {
        if (state.slots['Amper'].status === 'free') resolve(state);
      });
    });
    
    const freeState = await freeStatePromise;
    expect(freeState.slots['Amper'].status).toBe('free');
    
    clientObserver.disconnect();
  });

  it('pozwala na zmianę pokoju i zwalnia zasoby w poprzednim', async () => {
    const client = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client.on('connect', resolve));
    
    client.emit('room:join', { roomId: 'room-1' });
    await new Promise<void>((resolve) => client.once('room:joined', () => resolve()));
    
    client.emit('room:join', { roomId: 'room-2' });
    const joined2 = await new Promise<any>((resolve) => client.once('room:joined', resolve));
    
    expect(joined2.roomId).toBe('room-2');
    // Check if room-1 has 0 members
    const room1 = server.rooms.get('room-1');
    expect(room1?.getMemberCount()).toBe(0);
    
    client.disconnect();
  });

  it('nie pozwala nowemu graczowi dołączyć, jeśli pokój jest pełny, a jeden z graczy jest w grace period, ale pozwala na reconnect', async () => {
    const roomName = 'full-grace-room';
    const clients: ClientSocketType[] = [];
    
    const characters = ['Amper', 'Antena', 'Gruczoł', 'Klątwa', 'Krwiak', 'Pień', 'Pierścień', 'Zawór'];
    for (let i = 0; i < 8; i++) {
      const client = ClientSocket(`http://localhost:${PORT}`);
      await new Promise<void>((resolve) => client.on('connect', resolve));
      client.emit('room:join', { roomId: roomName, sessionToken: `token-${i}` });
      await new Promise<void>((resolve) => client.once('room:joined', () => resolve()));
      
      client.emit('character:reserve', { character: characters[i], nickname: `Player${i}`, sessionToken: `token-${i}` });
      client.emit('character:confirm', { character: characters[i], sessionToken: `token-${i}` });
      
      await new Promise<void>((resolve) => {
        const handler = (state: RoomState) => {
          if (state.slots[characters[i]].status === 'occupied') {
             client.off('room:state', handler);
             resolve();
          }
        };
        client.on('room:state', handler);
      });
      clients.push(client);
    }
    
    clients[0].disconnect();
    await new Promise(r => setTimeout(r, 20));
    
    const client9 = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client9.on('connect', resolve));
    
    const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
      client9.once('error', (err) => resolve(err));
    });
    
    client9.emit('room:join', { roomId: roomName });
    const err = await errorPromise;
    expect(err.code).toBe('ROOM_FULL');
    
    const clientReconnect = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => clientReconnect.on('connect', resolve));
    
    clientReconnect.emit('room:join', { roomId: roomName, sessionToken: 'token-0' });
    const joined = await new Promise<any>((resolve) => clientReconnect.once('room:joined', resolve));
    
    expect(joined.reconnectedCharacter).toBe(characters[0]);
    const room = server.rooms.get(roomName);
    expect(room?.getMemberCount()).toBe(8);
    
    client9.disconnect();
    clientReconnect.disconnect();
    for (let i = 1; i < 8; i++) clients[i].disconnect();
  });

  it('nie pozwala aktywnemu graczowi ukraść drugiego slotu przez ponowny join z obcym tokenem w grace period', async () => {
    const roomName = 'steal-room';
    const client1 = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client1.on('connect', resolve));
    client1.emit('room:join', { roomId: roomName, sessionToken: 'token-1' });
    await new Promise<void>((resolve) => client1.once('room:joined', () => resolve()));
    
    client1.emit('character:reserve', { character: 'Amper', nickname: 'Player1', sessionToken: 'token-1' });
    client1.emit('character:confirm', { character: 'Amper', sessionToken: 'token-1' });
    
    await new Promise<void>((resolve) => {
      const handler = (state: RoomState) => {
        if (state.slots['Amper'].status === 'occupied') {
           client1.off('room:state', handler);
           resolve();
        }
      };
      client1.on('room:state', handler);
    });

    const client2 = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client2.on('connect', resolve));
    client2.emit('room:join', { roomId: roomName, sessionToken: 'token-2' });
    await new Promise<void>((resolve) => client2.once('room:joined', () => resolve()));
    
    client2.emit('character:reserve', { character: 'Antena', nickname: 'Player2', sessionToken: 'token-2' });
    client2.emit('character:confirm', { character: 'Antena', sessionToken: 'token-2' });
    
    await new Promise<void>((resolve) => {
      const handler = (state: RoomState) => {
        if (state.slots['Antena'].status === 'occupied') {
           client2.off('room:state', handler);
           resolve();
        }
      };
      client2.on('room:state', handler);
    });

    client2.disconnect();
    await new Promise(r => setTimeout(r, 20));
    
    const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
      client1.once('error', (err) => resolve(err));
    });
    client1.emit('room:join', { roomId: roomName, sessionToken: 'token-2' });
    
    const err = await errorPromise;
    expect(err.code).toBe('UNAUTHORIZED');
    
    const room = server.rooms.get(roomName);
    const slotForClient1 = room?.findSlotByPlayerId(client1.id);
    expect(slotForClient1?.character).toBe('Amper');
    
    const antenaSlot = room?.getSlot('Antena');
    expect(antenaSlot?.status).toBe('occupied');
    expect(antenaSlot?.playerId).toBeUndefined();

    client1.disconnect();
  });
});
