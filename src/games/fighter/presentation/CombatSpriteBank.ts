import aiLocomotion from '../../../../public/game-assets/2d/fighter/art-v3/locomotion.json';
import authoredMotion from '../../../../public/game-assets/2d/fighter/motion-v4/manifest.json';
import { cinematicTick, ultimateFrame } from './ultimateChoreography';
import { locomotionPose, type LocomotionPose } from './locomotion';
import type { FighterState } from '../simulation/CombatTypes';

interface Clip {
  file: string;
  frames: number;
  durationTicks: number;
  legacy?: boolean;
  powers?: boolean;
  locomotion?: boolean;
  size?: number;
  pivot?: [number, number];
  worldSize?: number;
  facing?: number;
  motion?: boolean;
}
interface Manifest {
  version: number;
  size: number;
  columns: number;
  pivot: [number, number];
  worldSize: number;
  facing: number;
  clips: Record<string, Clip>;
}
interface Entry {
  manifest?: Manifest;
  images: Map<string, HTMLImageElement>;
  abort: AbortController;
}

export function combatClip(fighter: FighterState): string {
  if (fighter.state === 'walk_fwd' || fighter.state === 'walk_back') return 'walk';
  if (fighter.state === 'crouch') return 'crouch';
  if (fighter.state === 'block_low') return 'block_low';
  if (fighter.state === 'attack') {
    switch (fighter.currentMove?.id) {
      case 'light_punch':
        return 'jab';
      case 'crouch_punch':
        return 'crouch_punch';
      case 'heavy_punch':
        return 'cross';
      case 'uppercut':
        return 'uppercut';
      case 'light_kick':
        return 'kick';
      case 'crouch_kick':
        return 'crouch_kick';
      case 'heavy_kick':
        return 'heavy_kick';
      case 'sweep':
        return 'sweep';
      case 'jump_kick':
        return 'air_kick';
      case 'jump_punch':
        return 'jump_punch';
      case 'special':
        return 'special';
      case 'ultimate':
        return 'ultimate';
      default:
        return 'hook';
    }
  }
  if (fighter.state === 'hit_stun') {
    if (fighter.isAirJuggle && !fighter.isGrounded) return 'launch_hit';
    return fighter.lastHitHeight === 'high' ? 'hit_head' : 'hit_body';
  }
  if (fighter.state === 'knockdown' || fighter.state === 'defeat') return 'fall';
  if (fighter.state === 'get_up') return 'get_up';
  if (fighter.state === 'block_high') return 'block';
  return 'idle';
}

/** Keep contact frames inside the active window; recovery really retracts the limb. */
export function combatFrame(fighter: FighterState, frames: number, durationTicks: number): number {
  const last = Math.max(0, frames - 1);
  let progress: number;
  if (fighter.state === 'hit_stun' && fighter.isAirJuggle && !fighter.isGrounded) {
    // Physics supplies elevation: the sprite only articulates recoil, ascent,
    // apex and descent. Holding a phase cannot loop back to the impact pose.
    const frame =
      fighter.stateTicks < 3
        ? 0
        : fighter.vy > 2
          ? fighter.stateTicks < 8
            ? 1
            : 2
          : fighter.vy >= -2
            ? 3
            : fighter.y > 35
              ? 4
              : 5;
    return Math.min(last, frame);
  }
  if (fighter.state === 'attack' && fighter.currentMove) {
    const move = fighter.currentMove;
    const tick = fighter.moveTick;
    // The resolver uses startup < tick <= startup + active. Each phase owns
    // two source frames, including its last tick; never anticipate contact.
    const phase = tick <= move.startup ? 0 : tick <= move.startup + move.active ? 1 : 2;
    const elapsed =
      phase === 0 ? tick : phase === 1 ? tick - move.startup - 1 : tick - move.startup - move.active - 1;
    const duration = phase === 0 ? move.startup + 1 : phase === 1 ? move.active : move.recovery;
    const local = Math.max(0, Math.min(0.999999, elapsed / Math.max(1, duration)));
    return Math.min(last, Math.floor(((phase + local) / 3) * frames));
  } else if (fighter.state === 'get_up') progress = fighter.stateTicks / 36;
  else if (fighter.state === 'knockdown' || fighter.state === 'defeat') progress = fighter.stateTicks / 24;
  else if (fighter.state === 'block_high' || fighter.state === 'block_low')
    // Held guard resets stateTicks in the simulation. Brace immediately rather
    // than waiting for a counter that only advances during blockstun.
    return Math.min(last, 2);
  else if (fighter.state === 'hit_stun')
    progress =
      1 / 3 + ((2 / 3) * fighter.stateTicks) / Math.max(1, fighter.stateTicks + (fighter.stunTicks ?? 0));
  else progress = (fighter.stateTicks % Math.max(1, durationTicks)) / Math.max(1, durationTicks);
  return Math.max(0, Math.min(last, Math.floor(progress * frames)));
}

/** Only the two active fighters own decoded combat images. */
export class CombatSpriteBank {
  private entries = new Map<string, Entry>();
  private locomotion = new Map<number, LocomotionPose>();

  resetMotion(): void {
    this.locomotion.clear();
  }

  retain(ids: string[]): void {
    this.locomotion.clear();
    for (const [id, entry] of this.entries) {
      if (ids.includes(id)) continue;
      entry.abort.abort();
      for (const image of entry.images.values()) image.removeAttribute('src');
      this.entries.delete(id);
    }
    for (const id of ids) this.load(id);
  }

  private load(id: string): void {
    if (this.entries.has(id)) return;
    const entry: Entry = { images: new Map(), abort: new AbortController() };
    this.entries.set(id, entry);
    const root = `${import.meta.env.BASE_URL}game-assets/2d/fighter/`;
    const legacyBase = `${root}combat/${encodeURIComponent(id)}/`;
    let base = `${root}combat-illustrated-v1/${encodeURIComponent(id)}/`;
    void fetch(`${base}manifest.json`, { signal: entry.abort.signal })
      .then(async (response) => {
        if (!response.ok) {
          base = legacyBase;
          response = await fetch(`${base}manifest.json`, { signal: entry.abort.signal });
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const manifest = (await response.json()) as Manifest;
        if (entry.abort.signal.aborted) return;
        if (manifest.version !== 1 || manifest.size <= 0 || manifest.columns > 12 || !manifest.clips?.idle)
          throw new Error('Invalid combat atlas');
        const aiClips = aiLocomotion.fighters as unknown as Record<string, Record<string, Clip>>;
        const newClips = authoredMotion.fighters as unknown as Record<string, Record<string, Clip>>;
        manifest.clips = { ...manifest.clips, ...aiClips[id], ...newClips[id] };
        entry.manifest = manifest;
        for (const [name, clip] of Object.entries(manifest.clips)) {
          if (!/^[a-z_]+\.png$/.test(clip.file)) throw new Error('Invalid atlas path');
          const image = new Image();
          const clipBase = clip.motion
            ? `${root}motion-v4/${encodeURIComponent(id)}/`
            : clip.locomotion
              ? `${root}art-v3/locomotion/${encodeURIComponent(id)}/`
              : clip.powers
                ? `${root}combat-powers-v2/${encodeURIComponent(id)}/`
                : clip.legacy
                  ? legacyBase
                  : base;
          image.src = `${clipBase}${clip.file}`;
          entry.images.set(name, image);
        }
      })
      .catch((error) => {
        if (!entry.abort.signal.aborted) console.warn(`Combat animation unavailable: ${id}`, error);
      });
  }

  draw(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    tick = fighter.stateTicks,
    slot = 1,
    frozen = false,
  ): boolean {
    const entry = this.entries.get(fighter.id);
    const manifest = entry?.manifest;
    let clipId = combatClip(fighter);
    const pose = locomotionPose(this.locomotion.get(slot), fighter, tick, frozen);
    this.locomotion.set(slot, pose);
    if ((clipId === 'walk' || clipId === 'idle') && manifest?.clips.walk_start) clipId = pose.clip;
    if (manifest && !manifest.clips[clipId]) {
      const legacyClips: Record<string, string> = {
        block_low: 'crouch',
        crouch_punch: 'jab',
        crouch_kick: 'kick',
        sweep: 'heavy_kick',
        jump_punch: 'elbow',
        special: 'hook',
        ultimate: 'hook',
        launch_hit: 'hit_head',
      };
      clipId = legacyClips[clipId] ?? clipId;
    }
    const clip = manifest?.clips[clipId];
    const image = entry?.images.get(clipId);
    if (!manifest || !clip || !image?.complete || !image.naturalWidth) return false;
    let frame =
      clip.locomotion && clipId.startsWith('walk')
        ? clipId === 'walk'
          ? Math.floor((pose.phase / 12) * clip.frames) % clip.frames
          : Math.min(clip.frames - 1, Math.floor((pose.elapsed / 8) * clip.frames))
        : combatFrame(fighter, clip.frames, clip.durationTicks);
    if (clip.motion && clipId === 'ultimate') frame = ultimateFrame(fighter.id, cinematicTick(fighter));
    if (fighter.id === 'szerszen' && clipId === 'ultimate' && fighter.currentMove) {
      const move = fighter.currentMove;
      frame =
        fighter.moveTick <= move.startup
          ? Math.min(3, Math.floor(fighter.moveTick / Math.max(1, move.startup * 0.15)))
          : fighter.moveTick <= move.startup + move.active
            ? 4
            : 5;
    }
    const size = clip.worldSize ?? manifest.worldSize;
    const cellSize = clip.size ?? manifest.size;
    const pivot = clip.pivot ?? manifest.pivot;
    ctx.save();
    ctx.scale(clip.facing ?? manifest.facing, 1);
    ctx.drawImage(
      image,
      frame * cellSize,
      0,
      cellSize,
      cellSize,
      -size * pivot[0],
      -size * pivot[1],
      size,
      size,
    );
    ctx.restore();
    return true;
  }
}
