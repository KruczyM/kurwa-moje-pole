import { io, Socket } from 'socket.io-client';
import {
  type CharacterName,
  type RoomState,
  type NetworkErrorPayload,
  type PlayerTransform,
  type WorldSnapshotPayload,
  validateAndSanitizeNickname,
} from './networkProtocol';

export type NetworkConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface NetworkClientOptions {
  serverUrl?: string;
  roomId?: string;
  autoConnect?: boolean;
}

const SESSION_TOKEN_KEY = 'camp-session-token';
const NICKNAME_KEY = 'camp-player-nickname';
const DEFAULT_SERVER_URL =
  typeof location !== 'undefined' && location.hostname === 'localhost' ? 'http://localhost:3001' : undefined;

/**
 * Automatycznie wyznacza adres serwera pokojow:
 * 1. Parametr URL `?server=https://...`
 * 2. Zmienna srodowiskowa Vite `VITE_SERVER_URL`
 * 3. Fallback: `http://localhost:3001` (na localhost / 127.0.0.1)
 */
export function resolveServerUrl(customUrl?: string): string | undefined {
  if (customUrl) return customUrl;

  if (typeof location !== 'undefined') {
    const param = new URLSearchParams(location.search).get('server');
    if (param && param.trim().length > 0) return param.trim();

    const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return envUrl.trim();
    }

    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
  }

  return undefined;
}

export class NetworkClient {
  private socket?: Socket;
  private status: NetworkConnectionStatus = 'disconnected';
  private currentState?: RoomState;
  private latestSnapshot?: WorldSnapshotPayload;
  private myPlayerId?: string;
  private sessionToken: string;
  private nickname: string;
  private roomId: string;
  private serverUrl?: string;

  private stateListeners = new Set<(state: RoomState) => void>();
  private snapshotListeners = new Set<(snapshot: WorldSnapshotPayload) => void>();
  private errorListeners = new Set<(error: NetworkErrorPayload) => void>();
  private statusListeners = new Set<(status: NetworkConnectionStatus) => void>();

  constructor(options: NetworkClientOptions = {}) {
    this.serverUrl = options.serverUrl ?? DEFAULT_SERVER_URL;
    this.serverUrl = resolveServerUrl(options.serverUrl);
    this.roomId = options.roomId ?? 'glowny-oboz';
    this.sessionToken = this.loadOrGenerateSessionToken();
    this.nickname = this.loadNickname();

    if (options.autoConnect && this.serverUrl) {
      this.connect();
    }
  }

  private loadOrGenerateSessionToken(): string {
    if (typeof sessionStorage === 'undefined') {
      return `session-${Math.random().toString(36).slice(2, 10)}`;
    }
    let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      token = `session-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
  }

  private loadNickname(): string {
    if (typeof localStorage === 'undefined') return 'Gracz';
    return localStorage.getItem(NICKNAME_KEY) || 'Gracz';
  }

  setNickname(nick: string): { valid: boolean; sanitized: string; error?: string } {
    const result = validateAndSanitizeNickname(nick);
    if (result.valid) {
      this.nickname = result.sanitized;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(NICKNAME_KEY, this.nickname);
      }
    }
    return result;
  }

  getNickname(): string {
    return this.nickname;
  }

  getSessionToken(): string {
    return this.sessionToken;
  }

  getStatus(): NetworkConnectionStatus {
    return this.status;
  }

  getState(): RoomState | undefined {
    return this.currentState;
  }

  getMyPlayerId(): string | undefined {
    return this.myPlayerId;
  }

  isOnline(): boolean {
    return this.status === 'connected';
  }

  connect(serverUrl?: string, roomId?: string): void {
    if (serverUrl) this.serverUrl = serverUrl;
    if (roomId) this.roomId = roomId;

    if (!this.serverUrl) {
      this.setStatus('disconnected');
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }

    this.setStatus('connecting');

    try {
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        this.myPlayerId = this.socket?.id;
        this.setStatus('connected');
        this.socket?.emit('room:join', {
          roomId: this.roomId,
          sessionToken: this.sessionToken,
        });
      });

      this.socket.on('room:joined', (data: { state: RoomState; yourPlayerId: string }) => {
        this.myPlayerId = data.yourPlayerId;
        this.currentState = data.state;
        this.notifyStateListeners(data.state);
      });

      this.socket.on('room:state', (state: RoomState) => {
        this.currentState = state;
        this.notifyStateListeners(state);
      });

      this.socket.on('world:snapshot', (snapshot: WorldSnapshotPayload) => {
        this.latestSnapshot = snapshot;
        this.notifySnapshotListeners(snapshot);
      });

      this.socket.on('error', (err: NetworkErrorPayload) => {
        this.notifyErrorListeners(err);
      });

      this.socket.on('disconnect', () => {
        this.setStatus('disconnected');
      });

      this.socket.on('connect_error', () => {
        this.setStatus('error');
      });
    } catch {
      this.setStatus('error');
    }
  }

  sendPlayerUpdate(transform: PlayerTransform): void {
    if (!this.socket || this.status !== 'connected') return;
    this.socket.emit('player:update', { transform });
  }

  getLatestSnapshot(): WorldSnapshotPayload | undefined {
    return this.latestSnapshot;
  }

  onWorldSnapshot(listener: (snapshot: WorldSnapshotPayload) => void): () => void {
    this.snapshotListeners.add(listener);
    if (this.latestSnapshot) listener(this.latestSnapshot);
    return () => this.snapshotListeners.delete(listener);
  }

  reserveCharacter(character: CharacterName, nickname?: string): boolean {
    if (nickname) {
      const valid = this.setNickname(nickname);
      if (!valid.valid) return false;
    }

    if (!this.socket || this.status !== 'connected') {
      return false;
    }

    this.socket.emit('character:reserve', {
      character,
      nickname: this.nickname,
      sessionToken: this.sessionToken,
    });
    return true;
  }

  confirmCharacter(character: CharacterName): boolean {
    if (!this.socket || this.status !== 'connected') {
      return false;
    }

    this.socket.emit('character:confirm', {
      character,
      sessionToken: this.sessionToken,
    });
    return true;
  }

  releaseCharacter(character: CharacterName): void {
    if (!this.socket || this.status !== 'connected') return;

    this.socket.emit('character:release', {
      character,
      sessionToken: this.sessionToken,
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
    this.setStatus('disconnected');
  }

  onStateChange(listener: (state: RoomState) => void): () => void {
    this.stateListeners.add(listener);
    if (this.currentState) listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  onError(listener: (error: NetworkErrorPayload) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onStatusChange(listener: (status: NetworkConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: NetworkConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private notifyStateListeners(state: RoomState): void {
    for (const listener of this.stateListeners) listener(state);
  }

  private notifySnapshotListeners(snapshot: WorldSnapshotPayload): void {
    for (const listener of this.snapshotListeners) listener(snapshot);
  }

  private notifyErrorListeners(error: NetworkErrorPayload): void {
    for (const listener of this.errorListeners) listener(error);
  }
}
