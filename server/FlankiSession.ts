import type { FlankiLobbyPlayer, FlankiLobbyState } from '../src/game/network/flankiProtocol.js';

/** One pitch per room. Only authenticated, confirmed room players can enter. */
export class FlankiSession {
  private lobby: FlankiLobbyState | null = null;
  private finished = false;
  constructor(private readonly newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`) {}
  getState(): FlankiLobbyState | null {
    return this.lobby
      ? { ...this.lobby, runners: { ...this.lobby.runners }, players: this.lobby.players.map((player) => ({ ...player })) }
      : null;
  }
  join(player: Omit<FlankiLobbyPlayer, 'team'>): boolean {
    if (this.finished) {
      this.lobby = null;
      this.finished = false;
    }
    if (this.lobby?.phase === 'playing') return false;
    if (!this.lobby)
      this.lobby = { sessionId: this.newId(), hostId: player.id, phase: 'waiting', players: [] };
    if (this.lobby.players.some((entry) => entry.id === player.id)) return true;
    if (this.lobby.players.length >= 4) return false;
    const a = this.lobby.players.filter((entry) => entry.team === 'A').length;
    const b = this.lobby.players.length - a;
    this.lobby.players.push({ ...player, team: a <= b ? 'A' : 'B' });
    return true;
  }
  start(playerId: string): boolean {
    if (!this.lobby || this.lobby.phase !== 'waiting' || this.lobby.hostId !== playerId) return false;
    this.lobby.phase = 'playing';
    this.finished = false;
    return true;
  }
  selectRunner(playerId: string, team: unknown, id: unknown): boolean {
    if (!this.lobby || this.lobby.phase !== 'waiting' || this.lobby.hostId !== playerId ||
      (team !== 'A' && team !== 'B') || typeof id !== 'string') return false;
    const defaults = team === 'A' ? ['kobra', 'antena'] : ['dziaslo', 'pien', 'chlebak'];
    if (!defaults.includes(id) && !this.lobby.players.some(p => p.team === team && p.id === id)) return false;
    this.lobby.runners = { ...this.lobby.runners, [team]: id };
    return true;
  }
  leave(playerId: string): boolean {
    if (!this.lobby || !this.lobby.players.some((entry) => entry.id === playerId)) return false;
    if (this.lobby.phase === 'playing' || this.lobby.hostId === playerId) this.lobby = null;
    else {
      this.lobby.players = this.lobby.players.filter((entry) => entry.id !== playerId);
      for (const team of ['A', 'B'] as const)
        if (this.lobby.runners?.[team] === playerId) delete this.lobby.runners[team];
    }
    return true;
  }
  accepts(playerId: string, sessionId: unknown, hostOnly: boolean): boolean {
    return (
      !!this.lobby &&
      this.lobby.phase === 'playing' &&
      this.lobby.sessionId === sessionId &&
      (hostOnly ? this.lobby.hostId === playerId : this.lobby.players.some((entry) => entry.id === playerId))
    );
  }

  markFinished(playerId: string, sessionId: unknown): void {
    if (this.accepts(playerId, sessionId, true)) this.finished = true;
  }
}
