import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { RoomServer } from './roomServer';
import { CANONICAL_CHARACTERS, type RoomState } from '../src/game/network/networkProtocol';

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

  it('przekazuje sygnały WebRTC (voice:signal) oraz stan wyciszenia (voice:mute) między graczami', async () => {
    // Test przekazywania sygnału WebRTC:
    const signalPromise = new Promise<{ senderPeerId: string; signal: { type: string; sdp: string } }>((resolve) => {
      clientB.once('voice:signal', (payload) => resolve(payload));
    });

    clientA.emit('voice:signal', {
      targetPeerId: clientB.id,
      signal: { type: 'offer', sdp: 'v=0\r\ntest' },
    });

    const signalRelayed = await signalPromise;
    expect(signalRelayed.senderPeerId).toBe(clientA.id);
    expect(signalRelayed.signal.type).toBe('offer');
    expect(signalRelayed.signal.sdp).toBe('v=0\r\ntest');

    // Test rozgłaszania wyciszenia mikrofonu:
    const mutePromise = new Promise<{ peerId: string; isMuted: boolean }>((resolve) => {
      clientB.once('voice:peer-mute', (payload) => resolve(payload));
    });

    clientA.emit('voice:mute', { isMuted: true });

    const muteRelayed = await mutePromise;
    expect(muteRelayed.peerId).toBe(clientA.id);
    expect(muteRelayed.isMuted).toBe(true);
  });

  it('blokuje dołączanie i rezerwację postaci kodem ROOM_FULL gdy pokój jest pełny (16 graczy), z wyjątkiem reconnectu', async () => {
    const fullRoomId = 'test-room-full';
    const room = server.getOrCreateRoom(fullRoomId);

    // Zapełniamy wszystkie 16 slotów
    for (let i = 0; i < CANONICAL_CHARACTERS.length; i++) {
      const char = CANONICAL_CHARACTERS[i];
      room.reserve(`fake-socket-${i}`, char, `Bot${i}`, `reconnect-token-${i}`);
      room.confirm(`fake-socket-${i}`, char, `reconnect-token-${i}`);
    }
    expect(room.isFull).toBe(true);

    const clientNew = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => clientNew.on('connect', () => resolve()));

    // Próba dołączenia nowego gracza do pełnego pokoju:
    const joinErrorPromise = new Promise<{ code: string; message: string }>((resolve) => {
      clientNew.once('error', (err) => resolve(err));
    });

    clientNew.emit('room:join', { roomId: fullRoomId });
    const joinErr = await joinErrorPromise;
    expect(joinErr.code).toBe('ROOM_FULL');

    // Gracz posiadający ważny sessionToken reconnectuje do pełnego pokoju:
    const clientReconnect = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => clientReconnect.on('connect', () => resolve()));

    const joinedPromise = new Promise<{ roomId: string; reconnectedCharacter?: string }>((resolve) => {
      clientReconnect.once('room:joined', (payload) => resolve(payload));
    });

    clientReconnect.emit('room:join', { roomId: fullRoomId, sessionToken: 'reconnect-token-0' });
    const joinedData = await joinedPromise;
    expect(joinedData.roomId).toBe(fullRoomId);
    expect(joinedData.reconnectedCharacter).toBe(CANONICAL_CHARACTERS[0]);

    clientNew.disconnect();
    clientReconnect.disconnect();
  });

  it('zwraca błąd ROOM_FULL przy character:reserve gdy pokój jest pełny a gracz nie posiada slotu', async () => {
    const roomFillId = 'test-room-reserve-full';
    const room = server.getOrCreateRoom(roomFillId);

    const client = ClientSocket(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => client.on('connect', () => resolve()));

    // Gracz dołącza zanim pokój jest pełny:
    await new Promise<void>((resolve) => {
      client.once('room:joined', () => resolve());
      client.emit('room:join', { roomId: roomFillId });
    });

    // Zapełniamy wszystkie 16 slotów przez innych graczy:
    for (let i = 0; i < CANONICAL_CHARACTERS.length; i++) {
      const char = CANONICAL_CHARACTERS[i];
      room.reserve(`other-socket-${i}`, char, `Other${i}`, `other-token-${i}`);
    }
    expect(room.isFull).toBe(true);

    // Gracz próbuje zarezerwować postać w pełnym pokoju:
    const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
      client.once('error', (err) => resolve(err));
    });

    client.emit('character:reserve', {
      character: 'Amper',
      nickname: 'NowyGracz',
    });

    const err = await errorPromise;
    expect(err.code).toBe('ROOM_FULL');

    client.disconnect();
  });
});

