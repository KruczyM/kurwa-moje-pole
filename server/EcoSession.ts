import {
  ECO_DURATION_SECONDS,
  ECO_OBJECT_COUNT,
  ecoPosition,
  ecoPickupPoints,
  type EcoState,
  type EcoPoint,
} from '../src/game/interactions/ecoChallenge.js';

export class EcoSession {
  private state: EcoState | null = null;
  private pickups = new Map<string, { generation: number; at: number }>();
  constructor(private now = Date.now) {}
  getState(): EcoState | null {
    if (this.state?.phase === 'playing' && this.now() >= this.state.endsAt) this.state.phase = 'finished';
    return this.state ? { ...structuredClone(this.state), serverNow: this.now() } : null;
  }
  create(id: string, name: string, pool: unknown): boolean {
    if (this.getState()?.phase === 'playing' || this.state?.phase === 'lobby') return false;
    if (
      !Array.isArray(pool) ||
      pool.length < 48 ||
      pool.length > 240 ||
      pool.some(
        (p) =>
          !p || !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x) > 290 || Math.abs(p.z) > 170,
      )
    )
      return false;
    if (new Set(pool.map((p) => `${p.x},${p.z}`)).size !== pool.length) return false;
    this.pickups.clear();
    this.state = {
      id: `eco-${this.now()}`,
      hostId: id,
      phase: 'lobby',
      seed: Math.floor(Math.random() * 0xffffffff),
      pool: pool.map((p: EcoPoint) => ({ x: p.x, z: p.z })),
      endsAt: 0,
      serverNow: this.now(),
      players: [{ id, name, score: 0 }],
    };
    return true;
  }
  join(id: string, name: string): boolean {
    if (!this.state || this.state.phase !== 'lobby' || this.state.players.length >= 16) return false;
    if (!this.state.players.some((p) => p.id === id)) this.state.players.push({ id, name, score: 0 });
    return true;
  }
  start(id: string): boolean {
    if (
      !this.state ||
      this.state.phase !== 'lobby' ||
      this.state.hostId !== id ||
      this.state.players.length < 2
    )
      return false;
    this.state.phase = 'playing';
    this.state.endsAt = this.now() + ECO_DURATION_SECONDS * 1000;
    return true;
  }
  leave(id: string): void {
    if (!this.state) return;
    this.state.players = this.state.players.filter((p) => p.id !== id);
    if (!this.state.players.length) this.state = null;
    else if (this.state.hostId === id) this.state.hostId = this.state.players[0].id;
  }
  collect(
    id: string,
    request: { roundId?: unknown; canId?: unknown; generation?: unknown },
    position?: readonly number[],
  ): boolean {
    const state = this.getState(),
      player = this.state?.players.find((p) => p.id === id);
    if (!state || state.phase !== 'playing' || request.roundId !== state.id || !player || !position)
      return false;
    const match = typeof request.canId === 'string' ? /^eco_(\d+)$/.exec(request.canId) : null;
    const generation = request.generation;
    if (
      !match ||
      Number(match[1]) >= ECO_OBJECT_COUNT ||
      !Number.isInteger(generation) ||
      Number(generation) < 0
    )
      return false;
    const key = `${id}:${request.canId}`,
      previous = this.pickups.get(key);
    if (
      Number(generation) !== (previous ? previous.generation + 1 : 0) ||
      (previous && this.now() - previous.at < 3900)
    )
      return false;
    const point = ecoPosition(state.seed, Number(match[1]), Number(generation), state.pool);
    if (
      !Number.isFinite(position[0]) ||
      !Number.isFinite(position[2]) ||
      Math.hypot(position[0] - point.x, position[2] - point.z) > 3.5
    )
      return false;
    this.pickups.set(key, { generation: Number(generation), at: this.now() });
    player.score+=ecoPickupPoints(Number(match[1]),(this.now()-(state.endsAt-ECO_DURATION_SECONDS*1000))/1000);
    return true;
  }
}
