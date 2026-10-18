export const ECO_DURATION_SECONDS = 180;
export const ECO_OBJECT_COUNT = 48;
export function ecoPickupKind(index: number): 'speed' | 'bundle' | 'trash' {
  return index % 12 === 11 ? 'speed' : index % 12 === 5 ? 'bundle' : 'trash';
}
export function ecoWaveMultiplier(elapsedSeconds: number): number {
  return Math.max(0, elapsedSeconds) % 30 >= 20 ? 2 : 1;
}
export function ecoPickupPoints(index: number, elapsedSeconds: number): number {
  return (ecoPickupKind(index) === 'bundle' ? 3 : 1) * ecoWaveMultiplier(elapsedSeconds);
}
export type EcoPoint = { x: number; z: number };
export type EcoPlayer = { id: string; name: string; score: number };
export type EcoState = {
  id: string;
  hostId: string;
  phase: 'lobby' | 'playing' | 'finished';
  seed: number;
  pool: EcoPoint[];
  endsAt: number;
  serverNow: number;
  players: EcoPlayer[];
};

export function ecoPosition(
  seed: number,
  index: number,
  generation: number,
  pool: readonly EcoPoint[],
): EcoPoint {
  const hash = (i: number) => {
    let value = (seed ^ Math.imul(i + 1, 0x45d9f3b)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  };
  const ordered = pool.map((point, i) => ({ point, key: hash(i) })).sort((a, b) => a.key - b.key);
  return ordered[(index + generation * ECO_OBJECT_COUNT) % ordered.length].point;
}
