import { io, type Socket } from 'socket.io-client';
import { resolveServerUrl } from '../../../game/network/NetworkClient';
import {
  FIGHTER_PROTOCOL,
  type FighterFrame,
  type FighterReply,
  type FighterRequest,
  type FighterRoomState,
} from './fighterProtocol';

export class FighterOnline {
  room: FighterRoomState | null = null;
  seat: 0 | 1 = 0;
  private socket?: Socket;
  private token = '';
  private sequence = 0;
  private frameSequence = -1;
  private eventId = -1;
  private mask = -1;
  private sentAt = 0;
  private generation = 0;
  private helloTimer?: ReturnType<typeof setTimeout>;
  private pendingFrame?: FighterFrame;

  constructor(
    private onRoom: (room: FighterRoomState | null) => void,
    private onFrame: (frame: FighterFrame) => void,
    private status: (message: string) => void,
  ) {}

  open(action: 'create' | 'join', code = ''): void {
    this.close();
    const server = resolveServerUrl();
    if (!server) {
      this.status('Online niedostępne: brak adresu serwera. Tryby offline są dostępne.');
      return;
    }
    const generation = this.generation;
    const socket = (this.socket = io(server.replace(/\/$/, '') + '/fighter', {
      autoConnect: false,
      reconnection: true,
    }));
    let initial = true;
    let saved: { code?: string; token?: string } = {};
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem('fighter-online-session') ?? '{}');
      if (parsed && typeof parsed === 'object') saved = parsed;
    } catch {
      /* Optional persistence. */
    }
    this.status('Łączenie z serwerem bijatyki…');
    socket.on('connect', () => {
      clearTimeout(this.helloTimer);
      this.helloTimer = setTimeout(
        () => this.status('Online niedostępne: serwer wymaga aktualizacji. Możesz grać offline.'),
        5000,
      );
    });
    socket.on('fighter:hello', async (hello: { version: number }) => {
      clearTimeout(this.helloTimer);
      if (hello?.version !== FIGHTER_PROTOCOL) {
        this.status('Serwer bijatyki wymaga aktualizacji.');
        return;
      }
      const request: FighterRequest = initial
        ? action === 'create'
          ? { action, version: FIGHTER_PROTOCOL }
          : { action, version: FIGHTER_PROTOCOL, code, token: saved.code === code ? saved.token : undefined }
        : { action: 'join', version: FIGHTER_PROTOCOL, code: this.room?.code ?? code, token: this.token };
      const success = await this.request(request);
      if (success && generation === this.generation) initial = false;
    });
    socket.on('fighter:room', (room: FighterRoomState) => {
      if (this.room?.code === room.code && room.revision > this.room.revision) {
        this.room = room;
        this.onRoom(room);
      }
    });
    socket.on('fighter:frame', (frame: FighterFrame) => {
      if (frame.sequence <= this.frameSequence) return;
      this.frameSequence = frame.sequence;
      const events = frame.events.filter((event) => event.eventId > this.eventId);
      if (events.length) this.eventId = Math.max(...events.map((event) => event.eventId));
      const next = { ...frame, events };
      if (this.room) this.onFrame(next);
      else this.pendingFrame = next;
    });
    socket.on('disconnect', () => {
      this.mask = -1;
      this.status('Połączenie przerwane. Próba powrotu do pokoju…');
    });
    socket.on('connect_error', () =>
      this.status(
        'Online niedostępne. Sprawdź połączenie lub aktualizację serwera. Tryby offline są dostępne.',
      ),
    );
    socket.connect();
  }

  async request(request: FighterRequest): Promise<boolean> {
    const socket = this.socket;
    const generation = this.generation;
    if (!socket?.connected) {
      this.status('Brak połączenia z serwerem.');
      return false;
    }
    return new Promise((resolve) => {
      socket.timeout(5000).emit('fighter:request', request, (error: Error | null, reply: FighterReply) => {
        if (generation !== this.generation) {
          resolve(false);
          return;
        }
        if (error || !reply || 'error' in reply) {
          this.status(reply && 'error' in reply ? reply.error : 'Serwer nie odpowiedział. Spróbuj ponownie.');
          resolve(false);
          return;
        }
        this.seat = reply.seat;
        this.token = reply.token;
        this.room = reply.room;
        try {
          sessionStorage.setItem(
            'fighter-online-session',
            JSON.stringify({ code: this.room.code, token: this.token }),
          );
        } catch {
          /* Optional persistence. */
        }
        this.onRoom(this.room);
        if (this.pendingFrame) {
          this.onFrame(this.pendingFrame);
          this.pendingFrame = undefined;
        }
        resolve(true);
      });
    });
  }

  sendInput(mask: number): void {
    const now = performance.now();
    if (!this.socket?.connected || this.room?.phase !== 'fight') return;
    if (this.mask === mask && now - this.sentAt < 50) return;
    this.mask = mask;
    this.sentAt = now;
    this.socket.emit('fighter:input', { sequence: ++this.sequence, mask });
  }

  close(intentional = true): void {
    this.generation++;
    clearTimeout(this.helloTimer);
    if (intentional && this.socket?.connected && this.room)
      this.socket.emit('fighter:request', { action: 'leave' }, () => {});
    if (intentional && this.room) {
      try {
        sessionStorage.removeItem('fighter-online-session');
      } catch {
        /* Optional persistence. */
      }
    }
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
    this.room = null;
    this.pendingFrame = undefined;
    this.frameSequence = this.eventId = -1;
    this.sequence = 0;
    this.mask = -1;
    this.onRoom(null);
  }
}
