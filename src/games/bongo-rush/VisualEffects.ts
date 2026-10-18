import type { Point, SoundEvent, World } from './types';

interface Chip extends Point {
  vx: number;
  vy: number;
  life: number;
  kind: 'dig' | 'impact';
}

/** Presentation-only bounded debris receives observations, never changes physics or puzzle timing. */
export class VisualEffects {
  readonly chips: Chip[] = [];
  private falling = new Map<number, Point>();

  /** Emits digging debris and dust where a previously falling object has landed. */
  observe(world: World, sounds: readonly SoundEvent[]): void {
    if (sounds.includes('dig')) this.emit(world.player, 6, 'dig');
    if (sounds.includes('impact')) {
      for (const body of world.objects) {
        if (this.falling.has(body.id) && !body.falling) this.emit(body, 8);
      }
    }
    this.falling.clear();
    for (const body of world.objects) if (body.falling) this.falling.set(body.id, { x: body.x, y: body.y });
  }

  /** Uses a reproducible fan of trajectories, capped even during simultaneous cave-ins. */
  emit(point: Point, count: number, kind: 'dig' | 'impact' = 'impact'): void {
    for (let i = 0; i < Math.min(count, 32); i++) {
      if (this.chips.length >= 32) this.chips.shift();
      this.chips.push({
        x: point.x + 0.5,
        y: point.y + 0.65,
        vx: ((i % 5) - 2) * 0.65,
        vy: -1.8 - (i % 3) * 0.3,
        kind,
        life: kind === 'dig' ? 0.28 : 0.42,
      });
    }
  }

  /** Paused or reduced-motion runs freeze or suppress debris without retaining an unbounded queue. */
  update(dt: number, paused: boolean, reducedMotion: boolean): void {
    if (reducedMotion) this.clear();
    if (paused) return;
    for (const chip of this.chips) {
      chip.life -= dt;
      chip.x += chip.vx * dt;
      chip.y += chip.vy * dt;
      chip.vy += 8 * dt;
    }
    for (let i = this.chips.length - 1; i >= 0; i--) if (this.chips[i].life <= 0) this.chips.splice(i, 1);
  }

  /** Restarts and level swaps cannot carry dust from a previous cave. */
  clear(): void {
    this.chips.length = 0;
    this.falling.clear();
  }
}
