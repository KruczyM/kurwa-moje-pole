import type { AfterWorldState, Point } from '../simulation/WorldState';
import { AFTER_STEP_SECONDS } from '../simulation/WorldState';
import { SpriteAnimator, type SpriteFrame, type SpriteMetadata } from './SpriteAnimator';
import { CameraRig } from './CameraRig';

export interface PresentedPlayer {
  slotId: string;
  characterId: string;
  feet: Point;
  screenFeet: Point;
  frame: SpriteFrame;
}

/** Produces render instructions from isolated snapshots; host owns images, rendering and RAF. */
export class AfterPresentation {
  private animators = new Map<string, { characterId: string; animator: SpriteAnimator }>();

  /** Accepts the host's camera and cached atlas metadata resolver, without another asset loader. */
  constructor(
    private readonly camera: CameraRig,
    private readonly metadata: (characterId: string) => SpriteMetadata,
  ) {}

  /** Interpolates feet, animates actual displacement, follows local player and sorts by depth. */
  update(
    world: AfterWorldState,
    alpha: number,
    dt: number,
    localSlot: string,
    paused = false,
  ): PresentedPlayer[] {
    const blend = paused ? 1 : Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    const active = new Set(world.players.map((player) => player.slotId));
    for (const slot of this.animators.keys()) if (!active.has(slot)) this.animators.delete(slot);
    const players = world.players.map((player) => {
      let entry = this.animators.get(player.slotId);
      if (!entry || entry.characterId !== player.characterId) {
        entry = {
          characterId: player.characterId,
          animator: new SpriteAnimator(this.metadata(player.characterId)),
        };
        this.animators.set(player.slotId, entry);
      }
      const feet = {
        x: player.previousPosition.x + (player.position.x - player.previousPosition.x) * blend,
        y: player.previousPosition.y + (player.position.y - player.previousPosition.y) * blend,
      };
      const distance = Math.hypot(
        player.position.x - player.previousPosition.x,
        player.position.y - player.previousPosition.y,
      );
      return {
        slotId: player.slotId,
        characterId: player.characterId,
        feet,
        frame: entry.animator.update(
          dt,
          player.facing,
          distance > 1e-6,
          distance / AFTER_STEP_SECONDS > 3,
          paused,
        ),
      };
    });
    const local = players.find((player) => player.slotId === localSlot);
    if (local) this.camera.follow(local.feet, dt, paused);
    return players
      .map((player) => ({ ...player, screenFeet: this.camera.project(player.feet) }))
      .sort((a, b) => a.feet.y - b.feet.y || (a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : 0));
  }

  /** Releases per-slot presentation state when the host unmounts the module. */
  dispose(): void {
    this.animators.clear();
  }
}
