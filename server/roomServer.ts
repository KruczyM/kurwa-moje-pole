import http from 'http';
import { Server, Socket } from 'socket.io';
import { Room } from './Room.js';
import {
  type JoinRoomPayload,
  type ReserveCharacterPayload,
  type ConfirmCharacterPayload,
  type ReleaseCharacterPayload,
  PROTOCOL_VERSION,
} from '../src/game/network/networkProtocol.js';

export interface RoomServerOptions {
  port?: number;
  corsOrigin?: string | string[] | boolean;
}

export class RoomServer {
  readonly server: http.Server;
  readonly io: Server;
  readonly rooms = new Map<string, Room>();
  private readonly port: number;

  constructor(options: RoomServerOptions = {}) {
    this.port = options.port ?? 3001;
    this.server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', protocol: PROTOCOL_VERSION, rooms: this.rooms.size }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    this.io = new Server(this.server, {
      cors: {
        origin: options.corsOrigin ?? '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 10000,
      pingInterval: 5000,
    });

    this.setupSocketHandlers();
  }

  getOrCreateRoom(roomId = 'glowny-oboz'): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Room({
        roomId,
        onSlotChanged: () => {
          this.io.to(roomId).emit('room:state', room!.getPublicState());
        },
      });
      this.rooms.set(roomId, room);
    }
    return room;
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      let currentRoomId: string | undefined;

      socket.on('room:join', (payload: JoinRoomPayload = {}) => {
        const roomId = payload.roomId?.trim() || 'glowny-oboz';
        const room = this.getOrCreateRoom(roomId);
        currentRoomId = roomId;

        void socket.join(roomId);

        // Obsługa reconnect z sessionToken:
        let reconnectedChar;
        if (payload.sessionToken) {
          const reconnectRes = room.handleReconnect(payload.sessionToken, socket.id);
          if (reconnectRes.restored) {
            reconnectedChar = reconnectRes.character;
          }
        }

        socket.emit('room:joined', {
          roomId,
          state: room.getPublicState(),
          yourPlayerId: socket.id,
          reconnectedCharacter: reconnectedChar,
        });

        // Poinformuj pozostałych o aktualnym stanie:
        this.io.to(roomId).emit('room:state', room.getPublicState());
      });

      socket.on('character:reserve', (payload: ReserveCharacterPayload) => {
        if (!currentRoomId) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Nie dołączono do pokoju.' });
          return;
        }

        const room = this.getOrCreateRoom(currentRoomId);
        const sessionToken = payload.sessionToken || socket.id;
        const result = room.reserve(socket.id, payload.character, payload.nickname, sessionToken);

        if (!result.success) {
          socket.emit('error', { code: 'CHARACTER_OCCUPIED', message: result.error ?? 'Rezerwacja nieudana.' });
          return;
        }

        this.io.to(currentRoomId).emit('room:state', room.getPublicState());
      });

      socket.on('character:confirm', (payload: ConfirmCharacterPayload) => {
        if (!currentRoomId) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'Nie dołączono do pokoju.' });
          return;
        }

        const room = this.getOrCreateRoom(currentRoomId);
        const sessionToken = payload.sessionToken || socket.id;
        const result = room.confirm(socket.id, payload.character, sessionToken);

        if (!result.success) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: result.error ?? 'Potwierdzenie nieudane.' });
          return;
        }

        this.io.to(currentRoomId).emit('room:state', room.getPublicState());
      });

      socket.on('character:release', (payload: ReleaseCharacterPayload) => {
        if (!currentRoomId) return;

        const room = this.getOrCreateRoom(currentRoomId);
        const sessionToken = payload.sessionToken || socket.id;
        const result = room.release(socket.id, payload.character, sessionToken);

        if (result.success) {
          this.io.to(currentRoomId).emit('room:state', room.getPublicState());
        }
      });

      socket.on('disconnect', () => {
        if (currentRoomId) {
          const room = this.rooms.get(currentRoomId);
          if (room) {
            room.handleDisconnect(socket.id);
            this.io.to(currentRoomId).emit('room:state', room.getPublicState());
          }
        }
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`[RoomServer] Serwer pokojów uruchomiony na porcie ${this.port} (protokół ${PROTOCOL_VERSION})`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      for (const room of this.rooms.values()) room.dispose();
      this.rooms.clear();
      this.io.close();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

// Jeśli uruchamiany bezpośrednio przez CLI (np. tsx server/roomServer.ts):
const isMainModule = typeof process !== 'undefined' && process.argv[1]?.replace(/\\/g, '/').endsWith('roomServer.ts');
if (isMainModule) {
  const port = Number(process.env.PORT) || 3001;
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : '*';
  const instance = new RoomServer({ port, corsOrigin });
  void instance.start();

  const shutdown = async () => {
    console.log('[RoomServer] Zamykanie serwera...');
    await instance.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

