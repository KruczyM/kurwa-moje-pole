import http from 'http';
import { Server, Socket } from 'socket.io';
import { Room } from './Room.js';
import { FlankiSession } from './FlankiSession.js';
import { EcoSession } from './EcoSession.js';
import { RateLimiter } from './RateLimiter.js';
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
  private readonly flankiSessions = new Map<string, FlankiSession>();
  private readonly ecoSessions = new Map<string,EcoSession>();
  private lastEcoBroadcast=0;
  private readonly emptyRoomSince = new Map<string, number>();
  private readonly rateLimiter = new RateLimiter();
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
        gracePeriodMs: 5000,
        onSlotChanged: () => {
          this.io.to(roomId).emit('room:state', room!.getPublicState());
        },
      });
      this.rooms.set(roomId, room);
      this.flankiSessions.set(roomId, new FlankiSession());
      this.ecoSessions.set(roomId,new EcoSession());
    }
    return room;
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      let currentRoomId: string | undefined;

      socket.on('room:join', (payload: JoinRoomPayload = {}) => {
        const roomId = payload.roomId?.trim() || 'glowny-oboz';
        const room = this.getOrCreateRoom(roomId);

        // Jeśli pokój jest pełny i gracz nie ma ważnego sessionToken (reconnect), emituj błąd z kodem 'ROOM_FULL':
        const existingSlot = payload.sessionToken
          ? room.findSlotBySessionToken(payload.sessionToken)
          : undefined;
        const hasValidSession = Boolean(existingSlot && existingSlot.status !== 'free');
        if (room.isFull && !hasValidSession) {
          socket.emit('error', { code: 'ROOM_FULL', message: 'Pokój jest pełny.' });
          return;
        }

        currentRoomId = roomId;
        socket.emit('eco:state',this.ecoSessions.get(roomId)?.getState() ?? null);

        void socket.join(roomId);

        // Obsługa reconnect z sessionToken:
        let reconnectedChar;
        if (payload.sessionToken) {
          const previousSocketId = room.findSlotBySessionToken(payload.sessionToken)?.playerId;
          const reconnectRes = room.handleReconnect(payload.sessionToken, socket.id);
          if (reconnectRes.restored) {
            reconnectedChar = reconnectRes.character;
            if (previousSocketId && previousSocketId !== socket.id) {
              const previousSocket = this.io.sockets.sockets.get(previousSocketId);
              previousSocket?.emit('error', { code: 'UNAUTHORIZED', message: 'Sesja została wznowiona w innym połączeniu. Stare połączenie zostało zamknięte.' });
              previousSocket?.disconnect(true);
            }
          }
        }

        socket.emit('room:joined', {
          roomId,
          state: room.getPublicState(),
          yourPlayerId: socket.id,
          reconnectedCharacter: reconnectedChar,
        });
        socket.emit('flanki:lobby', this.flankiSessions.get(roomId)?.getState() ?? null);

        // Poinformuj pozostałych o aktualnym stanie oraz nowym peerze czatu głosowego:
        this.io.to(roomId).emit('room:state', room.getPublicState());
        socket.to(roomId).emit('voice:peer-joined', { peerId: socket.id });
      });

      socket.on('character:reserve', (payload: ReserveCharacterPayload) => {
        if (!currentRoomId) {
          currentRoomId = 'glowny-oboz';
          void socket.join(currentRoomId);
        }

        const room = this.getOrCreateRoom(currentRoomId);
        const sessionToken = payload.sessionToken || socket.id;

        const existingSlot =
          (payload.sessionToken ? room.findSlotBySessionToken(payload.sessionToken) : undefined) ??
          room.findSlotByPlayerId(socket.id);
        const hasValidSession = Boolean(existingSlot && existingSlot.status !== 'free');
        if (room.isFull && !hasValidSession) {
          socket.emit('error', { code: 'ROOM_FULL', message: 'Pokój jest pełny.' });
          return;
        }

        const result = room.reserve(socket.id, payload.character, payload.nickname, sessionToken);

        if (!result.success) {
          socket.emit('error', {
            code: 'CHARACTER_OCCUPIED',
            message: result.error ?? 'Rezerwacja nieudana.',
          });
          return;
        }

        this.io.to(currentRoomId).emit('room:state', room.getPublicState());
      });

      socket.on('character:confirm', (payload: ConfirmCharacterPayload) => {
        if (!currentRoomId) {
          currentRoomId = 'glowny-oboz';
          void socket.join(currentRoomId);
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

      socket.on('player:update', (payload: { transform: unknown }) => {
        if (!currentRoomId) return;
        const room = this.rooms.get(currentRoomId);
        if (room && payload && payload.transform) {
          room.updatePlayerTransform(socket.id, payload.transform);
        }
      });

      socket.on('action:trigger', (payload: { action: string }) => {
        if (!currentRoomId || !payload || !payload.action) return;
        if (!this.rateLimiter.consume(socket.id, 'action')) return;
        const room = this.rooms.get(currentRoomId);
        if (!room) return;
        const slot = room.findSlotByPlayerId(socket.id);
        if (!slot) return;
        this.io.to(currentRoomId).emit('action:trigger', {
          playerId: socket.id,
          character: slot.character,
          action: payload.action,
          timestamp: Date.now(),
        });
      });

      socket.on('flanki:lobby_request', (request: { operation?: unknown; team?: unknown; runnerId?: unknown } = {}, acknowledge?: (accepted: boolean) => void) => {
        const reject = (message: string) => {
          socket.emit('flanki:rejected', { message });
          acknowledge?.(false);
        };
        if (!currentRoomId) { reject('Nie dołączono do pokoju gry. Połącz się ponownie i wybierz postać.'); return; }
        if (!this.rateLimiter.consume(socket.id, 'event')) { reject('Zbyt wiele żądań. Spróbuj ponownie za chwilę.'); return; }
        const slot = this.rooms.get(currentRoomId)?.findSlotByPlayerId(socket.id);
        const session = this.flankiSessions.get(currentRoomId);
        if (!slot || slot.status !== 'occupied') {
          reject('Twoja postać nie jest potwierdzona na tym serwerze. Wybierz wolną, inną postać i wejdź na pole; w drugiej karcie użyj osobnej sesji przeglądarki.'); return;
        }
        if (!session) { reject('Brak sesji Flanek dla tego pokoju. Uruchom ponownie serwer gry.'); return; }
        let accepted = false;
        if (request.operation === 'join')
          accepted = session.join({
            id: socket.id,
            name: slot.nickname ?? slot.character,
            character: slot.character,
          });
        else if (request.operation === 'start') accepted = session.start(socket.id);
        else if (request.operation === 'leave') accepted = session.leave(socket.id);
        else if (request.operation === 'runner') accepted = session.selectRunner(socket.id, request.team, request.runnerId);
        if (!accepted) {
          reject('Nie można wykonać tej operacji: mecz mógł już wystartować lub skład jest pełny. Biegaczy i start zatwierdza gospodarz przed rozpoczęciem.');
          return;
        }
        this.io.to(currentRoomId).emit('flanki:lobby', session.getState());
        acknowledge?.(true);
      });

      socket.on(
        'flanki:action',
        (request: { action?: unknown; sessionId?: unknown; payload?: unknown } = {}) => {
          if (!currentRoomId || typeof request.action !== 'string') return;
          const session = this.flankiSessions.get(currentRoomId);
          const slot = this.rooms.get(currentRoomId)?.findSlotByPlayerId(socket.id);
          const hostOnly = request.action === 'flanki:snapshot';
          if (
            !slot ||
            slot.status !== 'occupied' ||
            !session?.accepts(socket.id, request.sessionId, hostOnly)
          )
            return;
          if (!['flanki:snapshot', 'flanki:throw', 'flanki:drink', 'flanki:runner_move', 'flanki:pickup'].includes(request.action)) return;
          if (!this.rateLimiter.consume(socket.id, hostOnly || request.action === 'flanki:runner_move' || request.action === 'flanki:drink' ? 'movement' : 'action')) return;
          if (!request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload))
            return;
          if (JSON.stringify(request.payload).length > 6000) return;
          if (hostOnly && (request.payload as Record<string, unknown>).phase === 'game_over')
            session.markFinished(socket.id, request.sessionId);
          socket.to(currentRoomId).emit('flanki:action', {
            action: request.action,
            sessionId: request.sessionId,
            playerId: socket.id,
            payload: request.payload,
          });
        },
      );

      socket.on('eco:request',(request={operation:'',roundId:undefined,canId:undefined,generation:undefined,pool:undefined},ack?: (accepted:boolean)=>void)=>{
        if(typeof ack!=='function') ack=undefined;
        if(!request||typeof request!=='object') { ack?.(false);return; }
        const room=currentRoomId ? this.rooms.get(currentRoomId) : undefined;
        const session=currentRoomId ? this.ecoSessions.get(currentRoomId) : undefined;
        const slot=room?.findSlotByPlayerId(socket.id);
        if (!room||!session||!slot||slot.status!=='occupied'||!this.rateLimiter.consume(socket.id,'action')) { ack?.(false);return; }
        const name=slot.nickname ?? slot.character;
        let accepted=false;
        if(request.operation==='create') accepted=session.create(socket.id,name,request.pool);
        else if(request.operation==='join') accepted=session.join(socket.id,name);
        else if(request.operation==='start') accepted=session.start(socket.id);
        else if(request.operation==='leave') { session.leave(socket.id);accepted=true; }
        else if(request.operation==='collect') accepted=session.collect(socket.id,request,
          room.getWorldSnapshot().players.find(p=>p.playerId===socket.id)?.transform.position);
        if(accepted) this.io.to(currentRoomId!).emit('eco:state',session.getState());
        ack?.(accepted);
      });
      socket.on('character:release', (payload: ReleaseCharacterPayload) => {
        if (!currentRoomId) return;

        const room = this.getOrCreateRoom(currentRoomId);
        const sessionToken = payload.sessionToken || socket.id;
        const result = room.release(socket.id, payload.character, sessionToken);

        if (result.success) {
          this.ecoSessions.get(currentRoomId)?.leave(socket.id);
          this.io.to(currentRoomId).emit('eco:state',this.ecoSessions.get(currentRoomId)?.getState()??null);
          if (this.flankiSessions.get(currentRoomId)?.leave(socket.id))
            this.io
              .to(currentRoomId)
              .emit('flanki:lobby', this.flankiSessions.get(currentRoomId)?.getState() ?? null);
          this.io.to(currentRoomId).emit('room:state', room.getPublicState());
        }
      });

      // Sygnalizacja WebRTC dla przestrzennego czatu głosowego:
      socket.on('voice:signal', (payload: { targetPeerId: string; signal: unknown }) => {
        if (!currentRoomId || !payload || !payload.targetPeerId || !payload.signal) return;
        this.io.to(payload.targetPeerId).emit('voice:signal', {
          senderPeerId: socket.id,
          signal: payload.signal,
        });
      });

      socket.on('voice:mute', (payload: { isMuted: boolean }) => {
        if (!currentRoomId) return;
        socket.to(currentRoomId).emit('voice:peer-mute', {
          peerId: socket.id,
          isMuted: Boolean(payload?.isMuted),
        });
      });

      socket.on('disconnect', () => {
        if(currentRoomId) {
          this.ecoSessions.get(currentRoomId)?.leave(socket.id);
          this.io.to(currentRoomId).emit('eco:state',this.ecoSessions.get(currentRoomId)?.getState()??null);
        }
        this.rateLimiter.remove(socket.id);
        if (currentRoomId) {
          if (this.flankiSessions.get(currentRoomId)?.leave(socket.id))
            this.io
              .to(currentRoomId)
              .emit('flanki:lobby', this.flankiSessions.get(currentRoomId)?.getState() ?? null);
          socket.to(currentRoomId).emit('voice:peer-left', { peerId: socket.id });
          const room = this.rooms.get(currentRoomId);
          if (room) {
            room.handleDisconnect(socket.id);
            this.io.to(currentRoomId).emit('room:state', room.getPublicState());
            this.io.to(currentRoomId).emit('world:snapshot', room.getWorldSnapshot());
          }
        }
      });
    });
  }

  private tickTimer?: NodeJS.Timeout;

  private startTickLoop(): void {
    // 20 Hz (co 50 ms):
    this.tickTimer = setInterval(() => {
      const broadcastEco=Date.now()-this.lastEcoBroadcast>=1000;
      if(broadcastEco) this.lastEcoBroadcast=Date.now();
      for (const [roomId, room] of this.rooms) {
        if (!this.io.sockets.adapter.rooms.get(roomId)?.size && room.getPublicState().playerCount === 0) {
          const since = this.emptyRoomSince.get(roomId) ?? Date.now();
          this.emptyRoomSince.set(roomId, since);
          // Let an in-flight connection join a newly-created room before retiring it.
          if (Date.now() - since >= 5000) {
            room.dispose();
            this.rooms.delete(roomId);
            this.flankiSessions.delete(roomId);
            this.ecoSessions.delete(roomId);
            this.emptyRoomSince.delete(roomId);
            continue;
          }
        } else this.emptyRoomSince.delete(roomId);
        const snapshot = room.getWorldSnapshot();
        if(broadcastEco) this.io.to(roomId).emit('eco:state',this.ecoSessions.get(roomId)?.getState()??null);
        if (this.io.sockets.adapter.rooms.get(roomId)?.size) {
          this.io.to(roomId).emit('world:snapshot', snapshot);
        }
      }
    }, 50);
  }

  async start(): Promise<void> {
    this.startTickLoop();
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(
          `[RoomServer] Serwer pokojów uruchomiony na porcie ${this.port} (protokół ${PROTOCOL_VERSION})`,
        );
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    return new Promise((resolve, reject) => {
      for (const room of this.rooms.values()) room.dispose();
      this.rooms.clear();
      this.flankiSessions.clear();
      this.ecoSessions.clear();
      this.emptyRoomSince.clear();
      this.rateLimiter.clear();
      this.io.close();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

// Jeśli uruchamiany bezpośrednio przez CLI (np. tsx server/roomServer.ts):
const isMainModule =
  typeof process !== 'undefined' && process.argv[1]?.replace(/\\/g, '/').endsWith('roomServer.ts');
if (isMainModule) {
  const port = Number(process.env.PORT) || 3001;
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : '*';
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
