export interface FlankiLobbyPlayer {
  id: string;
  name: string;
  character: string;
  team: 'A' | 'B';
}

export interface FlankiLobbyState {
  sessionId: string;
  hostId: string;
  phase: 'waiting' | 'playing';
  players: FlankiLobbyPlayer[];
  runners?: Partial<Record<'A' | 'B', string>>;
}

export interface FlankiNetworkEvent {
  action: string;
  sessionId: string;
  playerId: string;
  payload: Record<string, unknown>;
}
