import { SpriteAnimator, type SpriteMetadata } from '../after/presentation/SpriteAnimator';
import type { Facing } from '../after/simulation/WorldState';

/** Presentation-only gait bridge across the simulation's 2–3 tick patrol cadence. */
export class PatrolAnimator {
  private readonly sprite: SpriteAnimator;
  private walkingFor = 0;

  constructor(metadata: SpriteMetadata) {
    this.sprite = new SpriteAnimator(metadata, { preservePhase: true, idleFps: 2, walkFps: 10 });
  }

  update(
    dt: number,
    facing: Facing,
    stepped: boolean,
    running = false,
    paused = false,
    trapped = false,
    continuous = false,
  ) {
    if (!paused) {
      const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      // A scheduled patrol step can be 0.6 s apart. Keep the gait through that dwell,
      // but return to idle when actually blocked; never change simulation movement.
      this.walkingFor = continuous
        ? stepped && !trapped
          ? 1
          : 0
        : trapped
          ? 0
          : stepped
            ? 0.65
            : Math.max(0, this.walkingFor - elapsed);
    }
    const walking = this.walkingFor > 0;
    return this.sprite.update(walking ? dt : dt * 0.25, facing, walking, running, paused);
  }
}
