import type { Enemy, Point } from './types';
import { same } from './types';

/** Presentation bridge for the existing 2–3 tick patrol cadence. Never changes collision state. */
export class PatrolMotion {
  private readonly tracks = new Map<number, { from: Point; to: Point; tick: number; period: number }>();

  position(enemy: Enemy, tick: number, alpha: number): Point {
    let track = this.tracks.get(enemy.id);
    if (!track) {
      track = {
        from: { ...enemy.previous },
        to: { x: enemy.x, y: enemy.y },
        tick,
        period: enemy.kind === 'red' || enemy.kind === 'boss' ? 3 : 2,
      };
      this.tracks.set(enemy.id, track);
    } else if (!same(track.to, enemy)) {
      track.from = { ...track.to };
      track.to = { x: enemy.x, y: enemy.y };
      track.tick = tick;
    }
    const blend = Math.max(0, Math.min(1, (tick - track.tick + alpha) / track.period));
    return {
      x: track.from.x + (track.to.x - track.from.x) * blend,
      y: track.from.y + (track.to.y - track.from.y) * blend,
    };
  }

  retain(enemies: readonly Enemy[]): void {
    const ids = new Set(enemies.map((e) => e.id));
    for (const id of this.tracks.keys()) if (!ids.has(id)) this.tracks.delete(id);
  }

  clear(): void {
    this.tracks.clear();
  }
}
