import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Room } from './Room';
import { validateAndSanitizeNickname } from '../src/game/network/networkProtocol';

describe('validateAndSanitizeNickname', () => {
  it('akceptuje prawidłowy pseudonim z polskimi znakami', () => {
    const res = validateAndSanitizeNickname('Gracz_123 ąćę');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('Gracz_123 ąćę');
  });

  it('odrzuca pseudonim krótszy niż 2 znaki', () => {
    const res = validateAndSanitizeNickname('A');
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/co najmniej 2 znaki/i);
  });

  it('odrzuca pseudonim złożony wyłącznie ze spacji', () => {
    const res = validateAndSanitizeNickname('     ');
    expect(res.valid).toBe(false);
  });

  it('usuwa tagi HTML i niedozwolone znaki z pseudonimu (ochrona przed XSS)', () => {
    const res = validateAndSanitizeNickname('<script>alert(1)</script>Jan');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('alert1Jan'); // tagi i niedozwolone znaki usunięte
  });

  it('przycina i odrzuca pseudonim powyżej 18 znaków', () => {
    const res = validateAndSanitizeNickname('BardzoDlugaNazwaGracza123456');
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/nie może przekraczać 18 znaków/i);
  });
});

describe('Room', () => {
  let room: Room;

  beforeEach(() => {
    vi.useFakeTimers();
    room = new Room({
      roomId: 'test-room',
      reservationTimeoutMs: 5000,
      gracePeriodMs: 10000,
    });
  });

  it('inicjalizuje wszystkie 8 postaci jako wolne (free)', () => {
    const state = room.getPublicState();
    expect(state.roomId).toBe('test-room');
    expect(state.playerCount).toBe(0);
    expect(Object.keys(state.slots).length).toBe(8);
    expect(state.slots['Amper'].status).toBe('free');
  });

  it('rezerwuje postać i blokuje ją dla innego gracza (atomowość)', () => {
    const res1 = room.reserve('p1', 'Amper', 'Gracz1', 'token-1');
    expect(res1.success).toBe(true);
    expect(res1.slot?.status).toBe('reserving');

    // Próba zajęcia tej samej postaci przez innego gracza:
    const res2 = room.reserve('p2', 'Amper', 'Gracz2', 'token-2');
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/jest właśnie rezerwowana/i);

    const state = room.getPublicState();
    expect(state.slots['Amper'].status).toBe('reserving');
    expect(state.slots['Amper'].nickname).toBe('Gracz1');
  });

  it('zwalnia rezerwację po upływie timeoutu', () => {
    room.reserve('p1', 'Amper', 'Gracz1', 'token-1');
    expect(room.getSlot('Amper')?.status).toBe('reserving');

    // Przewijamy czas o 5.1 sekundy:
    vi.advanceTimersByTime(5100);

    expect(room.getSlot('Amper')?.status).toBe('free');
  });

  it('potwierdza postać i ustawia status occupied', () => {
    room.reserve('p1', 'Klątwa', 'Gracz1', 'token-1');
    const confirmRes = room.confirm('p1', 'Klątwa', 'token-1');
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.slot?.status).toBe('occupied');

    // Po potwierdzeniu timeout rezerwacji nie zwalnia postaci:
    vi.advanceTimersByTime(6000);
    expect(room.getSlot('Klątwa')?.status).toBe('occupied');
  });

  it('po rozłączeniu gracza zajętego uruchamia grace period i umożliwia reconnect', () => {
    room.reserve('p1', 'Zawór', 'Gracz1', 'token-1');
    room.confirm('p1', 'Zawór', 'token-1');

    // Gracz się rozłącza:
    const disconnectedChar = room.handleDisconnect('p1');
    expect(disconnectedChar).toBe('Zawór');
    expect(room.getSlot('Zawór')?.status).toBe('occupied'); // nadal trzymany w grace period

    // Gracz łączy się ponownie z nowym socket ID ale tym samym sessionToken:
    const reconnectRes = room.handleReconnect('token-1', 'p1-new-socket');
    expect(reconnectRes.restored).toBe(true);
    expect(reconnectRes.character).toBe('Zawór');
    expect(room.getSlot('Zawór')?.playerId).toBe('p1-new-socket');

    // Czas mija - slot nie jest zwalniany bo reconnect anulował timer:
    vi.advanceTimersByTime(15000);
    expect(room.getSlot('Zawór')?.status).toBe('occupied');
  });

  it('zwalnia slot zajęty jeśli grace period upłynie bez reconnectu', () => {
    room.reserve('p1', 'Zawór', 'Gracz1', 'token-1');
    room.confirm('p1', 'Zawór', 'token-1');

    room.handleDisconnect('p1');
    // Mija grace period (10s):
    vi.advanceTimersByTime(11000);

    expect(room.getSlot('Zawór')?.status).toBe('free');
  });

  it('zwalnia poprzedni slot gdy gracz rezerwuje inną postać', () => {
    room.reserve('p1', 'Amper', 'Gracz1', 'token-1');
    expect(room.getSlot('Amper')?.status).toBe('reserving');

    room.reserve('p1', 'Antena', 'Gracz1', 'token-1');
    expect(room.getSlot('Amper')?.status).toBe('free');
    expect(room.getSlot('Antena')?.status).toBe('reserving');
  });

  describe('PlayerTransforms & WorldSnapshot', () => {
    it('aktualizuje transformację gracza o statusie occupied i generuje snapshot świata', () => {
      room.reserve('p1', 'Amper', 'Kolega1', 'token-1');
      room.confirm('p1', 'Amper', 'token-1');

      const updated = room.updatePlayerTransform('p1', {
        position: [12.5, 0, -8.2],
        yaw: 1.57,
        pitch: 0.1,
        locomotion: 'Walk',
        speed: 3.2,
        timestamp: Date.now(),
      });
      expect(updated).toBe(true);

      const snapshot = room.getWorldSnapshot();
      expect(snapshot.players.length).toBe(1);
      expect(snapshot.players[0].playerId).toBe('p1');
      expect(snapshot.players[0].character).toBe('Amper');
      expect(snapshot.players[0].nickname).toBe('Kolega1');
      expect(snapshot.players[0].transform.position).toEqual([12.5, 0, -8.2]);
      expect(snapshot.players[0].transform.locomotion).toBe('Walk');
    });

    it('odrzuca nieprawidłowe lub wykraczające poza świat pozycje (NaN, Infinity, poza mapą)', () => {
      room.reserve('p1', 'Amper', 'Kolega1', 'token-1');
      room.confirm('p1', 'Amper', 'token-1');

      const badNan = room.updatePlayerTransform('p1', {
        position: [NaN, 0, 0],
        yaw: 0,
      });
      expect(badNan).toBe(false);

      const badOutOfBounds = room.updatePlayerTransform('p1', {
        position: [9999, 0, 0],
        yaw: 0,
      });
      expect(badOutOfBounds).toBe(false);
    });

    it('usuwa transformację ze snapshotu po zwolnieniu slotu', () => {
      room.reserve('p1', 'Amper', 'Kolega1', 'token-1');
      room.confirm('p1', 'Amper', 'token-1');
      room.updatePlayerTransform('p1', {
        position: [1, 0, 1],
        yaw: 0,
        locomotion: 'Idle',
        speed: 0,
        timestamp: Date.now(),
      });
      expect(room.getWorldSnapshot().players.length).toBe(1);

      room.release('p1', 'Amper', 'token-1');
      expect(room.getWorldSnapshot().players.length).toBe(0);
    });
  });
});
