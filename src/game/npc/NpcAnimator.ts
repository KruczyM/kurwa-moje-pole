import * as THREE from 'three';
import { LocomotionClip, resolveCanonicalAnimationName } from '../animation/animationContract';
export const LOCOMOTION_ROOT_LIMIT = 4;

/** Usuwa tylko nadmierne przesunięcie Hips, zachowując pozostałe tracki animacji. */
export function stabilizeLocomotionRoot(root: THREE.Object3D, clip: THREE.AnimationClip) {
  let corrected = false;
  const tracks = clip.tracks.map((track) => {
    if (!(track instanceof THREE.VectorKeyframeTrack) || !track.name.endsWith('.position')) return track;
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    if (!parsed.nodeName?.toLocaleLowerCase().includes('hips')) return track;
    let hips = root.getObjectByName(parsed.nodeName);
    if (!hips)
      root.traverse((object) => {
        if (!hips && (object.name === parsed.nodeName || object.name.endsWith(`:${parsed.nodeName}`)))
          hips = object;
      });
    if (!hips) return track;
    const values = track.values;
    let excessive = false;
    for (let index = 0; index + 2 < values.length; index += 3) {
      const distance = Math.hypot(
        values[index] - hips.position.x,
        values[index + 1] - hips.position.y,
        values[index + 2] - hips.position.z,
      );
      if (distance > LOCOMOTION_ROOT_LIMIT) {
        excessive = true;
        break;
      }
    }
    if (!excessive) return track;
    const safe = track.clone();
    for (let index = 0; index + 2 < safe.values.length; index += 3) {
      safe.values[index] = hips.position.x;
      safe.values[index + 1] = hips.position.y;
      safe.values[index + 2] = hips.position.z;
    }
    corrected = true;
    return safe;
  });
  return corrected ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode) : clip;
}

export class NpcAnimator {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private walkTimeScale = 0.78;
  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      const canonical = resolveCanonicalAnimationName(clip.name);
      if (canonical) {
        // Wadliwy eksport Pierścienia ma nadmierny root motion także w klipie Idle.
        const safe = stabilizeLocomotionRoot(root, clip);
        this.actions.set(canonical, this.mixer.clipAction(safe));
      }
    }
    this.play('Idle', 0);
  }
  /** Dopasowuje tempo animacji chodu do prędkości NPC. */
  setWalkTimeScale(scale: number) {
    this.walkTimeScale = scale;
    const walk = this.actions.get('Walk');
    if (walk) walk.setEffectiveTimeScale(scale);
  }
  /** Płynnie przełącza aktywną akcję Idle/Walk/Run. */
  play(name: LocomotionClip, fade = 0.2) {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const previous = this.actions.get(this.current);
    previous?.fadeOut(fade);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    this.current = name;
  }
  /** Przesuwa mikser animacji o czas bieżącej klatki. */
  update(deltaTime: number) {
    this.mixer.update(deltaTime);
  }
  /** Zatrzymuje akcje i zwalnia ich lokalny rejestr. */
  dispose() {
    this.mixer.stopAllAction();
    this.actions.clear();
  }
}
