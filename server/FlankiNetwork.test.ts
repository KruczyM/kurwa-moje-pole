import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { RoomServer } from './roomServer';
import type { FlankiLobbyState } from '../src/game/network/flankiProtocol';

describe('Flanki Socket.IO', () => {
  let server: RoomServer;
  const peers: Socket[] = [];
  afterEach(async () => {
    peers.forEach((peer) => peer.disconnect());
    peers.length = 0;
    await server?.stop();
  });
  const event = <T>(peer: Socket, name: string, predicate: (value: T) => boolean = () => true) =>
    new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        peer.off(name, listener);
        reject(new Error(`Missing ${name}`));
      }, 3000);
      const listener = (value: T) => {
        if (predicate(value)) {
          clearTimeout(timeout);
          peer.off(name, listener);
          resolve(value);
        }
      };
      peer.on(name, listener);
    });
  it('shares a waiting roster, locks it at host start, relays input without echo and cancels on disconnect', async () => {
    server = new RoomServer({ port: 3902 });
    await server.start();
    const unconfirmed = io('http://localhost:3902', { autoConnect: false });
    peers.push(unconfirmed);
    const connection = event(unconfirmed, 'connect'); unconfirmed.connect(); await connection;
    const roomJoined = event(unconfirmed, 'room:joined');
    unconfirmed.emit('room:join', { roomId: 'flanki-test' }); await roomJoined;
    const rejection = event<{ message: string }>(unconfirmed, 'flanki:rejected');
    const declined = await new Promise<boolean>(resolve => unconfirmed.emit('flanki:lobby_request', { operation: 'join' }, resolve));
    expect(declined).toBe(false);
    expect((await rejection).message).toContain('postać nie jest potwierdzona');
    unconfirmed.disconnect();
    const connect = async (character: string) => {
      const peer = io('http://localhost:3902', { autoConnect: false });
      peers.push(peer);
      const connected = event(peer, 'connect');
      peer.connect();
      await connected;
      const joined = event(peer, 'room:joined');
      peer.emit('room:join', { roomId: 'flanki-test' });
      await joined;
      const reserved = event<{ slots: Record<string, { status: string }> }>(
        peer,
        'room:state',
        (state) => state.slots[character].status === 'reserving',
      );
      peer.emit('character:reserve', { character, nickname: character });
      await reserved;
      const confirmed = event<{ slots: Record<string, { status: string }> }>(
        peer,
        'room:state',
        (state) => state.slots[character].status === 'occupied',
      );
      peer.emit('character:confirm', { character });
      await confirmed;
      return peer;
    };
    const host = await connect('Amper');
    const guest = await connect('Antena');
    const lobbyReady = event<FlankiLobbyState>(host, 'flanki:lobby', (state) => state?.players.length === 2);
    host.emit('flanki:lobby_request', { operation: 'join' });
    guest.emit('flanki:lobby_request', { operation: 'join' });
    const waiting = await lobbyReady;
    expect(waiting.players.map((player) => player.team)).toEqual(['A', 'B']);
    const changed = event<FlankiLobbyState>(guest, 'flanki:lobby', state => state?.runners?.A === host.id);
    const runnerAccepted = await new Promise<boolean>(resolve => host.emit('flanki:lobby_request', { operation: 'runner', team: 'A', runnerId: host.id }, resolve));
    expect(runnerAccepted).toBe(true);
    expect((await changed).runners?.A).toBe(host.id);
    const denied = event(guest, 'flanki:rejected');
    guest.emit('flanki:lobby_request', { operation: 'start' });
    await denied;
    const started = event<FlankiLobbyState>(guest, 'flanki:lobby', (state) => state?.phase === 'playing');
    host.emit('flanki:lobby_request', { operation: 'start' });
    await started;
    const input = event<{ playerId: string; action: string }>(host, 'flanki:action');
    let echoed = false;
    guest.on('flanki:action', () => {
      echoed = true;
    });
    guest.emit('flanki:action', {
      sessionId: waiting.sessionId,
      action: 'flanki:throw',
      payload: { power: 0.7, direction: [0, -0.3, 1], swaySeconds: 1 },
    });
    expect((await input).playerId).toBe(guest.id);
    expect(echoed).toBe(false);
    const late = await connect('Gruczoł');
    const lateDenied = event(late, 'flanki:rejected');
    late.emit('flanki:lobby_request', { operation: 'join' });
    await lateDenied;
    const cancelled = event(host, 'flanki:lobby', (state) => state === null);
    guest.disconnect();
    await cancelled;
  });
});
