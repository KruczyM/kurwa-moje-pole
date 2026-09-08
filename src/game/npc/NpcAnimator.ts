import * as THREE from 'three';
import {
  CanonicalAnimationClip,
  LocomotionClip,
  locomotionClipNames,
  resolveCanonicalAnimationName,
} from '../animation/animationContract';
import {
  LOCOMOTION_CYCLE_METERS,
  referenceSpeedForCycle,
  timeScaleForWorldSpeed,
} from './locomotionCalibration';

export const LOCOMOTION_ROOT_LIMIT = 4;

const DEFAULT_FADE_SECONDS = 0.24;
const DEFAULT_MINIMUM_STATE_SECONDS: Record<LocomotionClip, number> = {
  Idle: 0.32,
  Walk: 0.38,
  Run: 0.38,
};

export type NpcAnimationTransition = {
  from: CanonicalAnimationClip | null;
  to: CanonicalAnimationClip;
  duration: number;
  mixerTime: number;
};

export type NpcAnimationDiagnostics = {
  locomotionState: LocomotionClip;
  requestedLocomotion: LocomotionClip;
  pendingLocomotion: LocomotionClip | null;
  currentClip: CanonicalAnimationClip;
  normalizedTime: number;
  stateElapsed: number;
  worldSpeed: number;
  effectiveTimeScale: number;
  referenceMetersPerSecond: number;
  cycleMeters: number;
  oneShot: CanonicalAnimationClip | null;
  queuedOneShots: number;
  transitionCount: number;
  lastTransition: NpcAnimationTransition | null;
};

export type NpcAnimatorOptions = {
  fadeSeconds?: number;
  minimumStateSeconds?: Partial<Record<LocomotionClip, number>>;
};

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
  private actions = new Map<CanonicalAnimationClip, THREE.AnimationAction>();
  private locomotionState: LocomotionClip = 'Idle';
  private requestedLocomotion: LocomotionClip = 'Idle';
  private pendingLocomotion: LocomotionClip | null = null;
  private currentClip: CanonicalAnimationClip = 'Idle';
  private activeOneShot: CanonicalAnimationClip | null = null;
  private oneShotQueue: CanonicalAnimationClip[] = [];
  private stateElapsed = 0;
  private transitionCount = 0;
  private lastTransition: NpcAnimationTransition | null = null;
  private movementSpeed = 0;
  private crossfadeUntil = 0;
  private readonly fadeSeconds: number;
  private readonly minimumStateSeconds: Record<LocomotionClip, number>;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[], options: NpcAnimatorOptions = {}) {
    this.mixer = new THREE.AnimationMixer(root);
    this.fadeSeconds = Math.max(0, options.fadeSeconds ?? DEFAULT_FADE_SECONDS);
    this.minimumStateSeconds = {
      ...DEFAULT_MINIMUM_STATE_SECONDS,
      ...options.minimumStateSeconds,
    };
    for (const clip of clips) {
      const canonical = resolveCanonicalAnimationName(clip.name);
      if (canonical) {
        const safe = stabilizeLocomotionRoot(root, clip);
        this.actions.set(canonical, this.mixer.clipAction(safe));
      }
    }
    this.mixer.addEventListener('finished', this.handleFinished);
    this.startInitialLocomotion();
  }

  /** Uruchamia pierwszy dostępny klip locomotion bez tworzenia sztucznego przejścia. */
  private startInitialLocomotion() {
    const initial = locomotionClipNames.find((name) => this.actions.has(name));
    if (!initial) return;
    this.locomotionState = initial;
    this.requestedLocomotion = initial;
    this.currentClip = initial;
    const action = this.actions.get(initial)!;
    action.reset().setEffectiveTimeScale(this.timeScaleFor(initial)).setEffectiveWeight(1).play();
  }

  /** Zwraca tempo właściwe dla klipu, zachowując dopasowanie chodu do prędkości świata. */
  private timeScaleFor(name: CanonicalAnimationClip) {
    if (name !== 'Walk' && name !== 'Run') return 1;
    const duration = this.actions.get(name)?.getClip().duration ?? 0;
    return timeScaleForWorldSpeed(name, this.movementSpeed, duration);
  }

  /** Oblicza fazę aktywnego klipu w zakresie 0..1 na potrzeby diagnostyki i synchronizacji kroków. */
  private normalizedTime(action = this.actions.get(this.currentClip)) {
    const duration = action?.getClip().duration ?? 0;
    if (!action || duration <= 0) return 0;
    return THREE.MathUtils.euclideanModulo(action.time, duration) / duration;
  }

  /** Wykonuje jedno rzeczywiste przejście między klipami z płynnym warpingiem czasu. */
  private transitionTo(name: CanonicalAnimationClip, fade: number, preservePhase: boolean) {
    const next = this.actions.get(name);
    if (!next || name === this.currentClip) return false;
    const previousName = this.currentClip;
    const previous = this.actions.get(previousName);
    const phase = preservePhase ? this.normalizedTime(previous) : 0;

    next.reset();
    next.enabled = true;
    next.clampWhenFinished = false;
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.setEffectiveTimeScale(this.timeScaleFor(name)).setEffectiveWeight(1);
    if (preservePhase && next.getClip().duration > 0) next.time = phase * next.getClip().duration;
    next.play();
    if (previous && fade > 0) {
      next.crossFadeFrom(previous, fade, true);
      this.crossfadeUntil = Math.max(this.crossfadeUntil, this.mixer.time + fade);
    } else previous?.stop();

    this.currentClip = name;
    this.transitionCount += 1;
    this.lastTransition = {
      from: previousName,
      to: name,
      duration: fade,
      mixerTime: this.mixer.time,
    };
    return true;
  }

  /** Wchodzi w nowy stan locomotion po przejściu histerezy albo po zakończeniu one-shotu. */
  private enterLocomotion(name: LocomotionClip, fade = this.fadeSeconds) {
    if (!this.actions.has(name)) return false;
    if (name !== this.locomotionState) {
      this.transitionTo(name, fade, true);
      this.locomotionState = name;
      this.stateElapsed = 0;
    } else if (this.currentClip !== name) {
      this.transitionTo(name, fade, true);
    }
    this.pendingLocomotion = null;
    return true;
  }

  /** Uruchamia pierwszą oczekującą akcję jednorazową i wygasza aktualny klip. */
  private startNextOneShot() {
    const name = this.oneShotQueue.shift();
    if (!name) {
      this.activeOneShot = null;
      this.enterLocomotion(this.requestedLocomotion);
      return;
    }
    const next = this.actions.get(name);
    if (!next) {
      this.startNextOneShot();
      return;
    }
    const previousName = this.currentClip;
    const previous = this.actions.get(previousName);
    next.reset();
    next.enabled = true;
    next.clampWhenFinished = true;
    next.setLoop(THREE.LoopOnce, 1);
    next.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (previous && this.fadeSeconds > 0) {
      next.crossFadeFrom(previous, this.fadeSeconds, true);
      this.crossfadeUntil = Math.max(this.crossfadeUntil, this.mixer.time + this.fadeSeconds);
    } else previous?.stop();
    this.activeOneShot = name;
    this.currentClip = name;
    this.transitionCount += 1;
    this.lastTransition = {
      from: previousName,
      to: name,
      duration: this.fadeSeconds,
      mixerTime: this.mixer.time,
    };
  }

  /** Po zdarzeniu finished uruchamia kolejny one-shot albo wraca do bieżącego locomotion. */
  private handleFinished = (event: THREE.AnimationMixerEventMap['finished']) => {
    if (!this.activeOneShot || event.action !== this.actions.get(this.activeOneShot)) return;
    this.activeOneShot = null;
    this.startNextOneShot();
  };

  /** Nakłada obliczone skale czasu po zakończeniu warpingowego okna crossfade. */
  private applyMovementTimeScales() {
    for (const name of ['Walk', 'Run'] as const) {
      const action = this.actions.get(name);
      if (action) action.setEffectiveTimeScale(this.timeScaleFor(name));
    }
  }

  /** Synchronizuje Walk i Run z prędkością świata bez przerywania trwającego warpingu przejścia. */
  setMovementSpeed(worldSpeed: number) {
    this.movementSpeed = Math.max(0, worldSpeed);
    if (this.mixer.time >= this.crossfadeUntil) this.applyMovementTimeScales();
  }

  /** Żąda stanu Idle/Walk/Run; krótkie oscylacje są odkładane zamiast restartować klip. */
  play(name: LocomotionClip, fade = this.fadeSeconds) {
    this.requestedLocomotion = name;
    if (this.activeOneShot) return;
    if (name === this.locomotionState) {
      this.pendingLocomotion = null;
      return;
    }
    if (!this.actions.has(name)) return;
    if (this.stateElapsed < this.minimumStateSeconds[this.locomotionState]) {
      this.pendingLocomotion = name;
      return;
    }
    this.enterLocomotion(name, Math.max(0, fade));
  }

  /** Dodaje nie-lokomocyjną animację jednorazową; kolejne akcje wykonują się w kolejności FIFO. */
  queueOneShot(name: CanonicalAnimationClip) {
    if (locomotionClipNames.includes(name as LocomotionClip) || !this.actions.has(name)) return false;
    this.oneShotQueue.push(name);
    if (!this.activeOneShot) this.startNextOneShot();
    return true;
  }

  /** Udostępnia stabilny zrzut stanu dla overlayu diagnostycznego i testów. */
  getDiagnostics(): NpcAnimationDiagnostics {
    const action = this.actions.get(this.currentClip);
    const locomotion = this.currentClip === 'Walk' || this.currentClip === 'Run' ? this.currentClip : null;
    const duration = action?.getClip().duration ?? 0;
    return {
      locomotionState: this.locomotionState,
      requestedLocomotion: this.requestedLocomotion,
      pendingLocomotion: this.pendingLocomotion,
      currentClip: this.currentClip,
      normalizedTime: this.normalizedTime(),
      stateElapsed: this.stateElapsed,
      worldSpeed: this.movementSpeed,
      effectiveTimeScale: action?.getEffectiveTimeScale() ?? 0,
      referenceMetersPerSecond: locomotion ? referenceSpeedForCycle(locomotion, duration) : 0,
      cycleMeters: locomotion ? LOCOMOTION_CYCLE_METERS[locomotion] : 0,
      oneShot: this.activeOneShot,
      queuedOneShots: this.oneShotQueue.length,
      transitionCount: this.transitionCount,
      lastTransition: this.lastTransition ? { ...this.lastTransition } : null,
    };
  }

  /** Przesuwa mikser i zatwierdza odłożony stan, gdy minie minimalny czas histerezy. */
  update(deltaTime: number) {
    const safeDelta = Math.max(0, deltaTime);
    const wasCrossfading = this.mixer.time < this.crossfadeUntil;
    this.stateElapsed += safeDelta;
    this.mixer.update(safeDelta);
    if (wasCrossfading && this.mixer.time >= this.crossfadeUntil) this.applyMovementTimeScales();
    if (
      !this.activeOneShot &&
      this.pendingLocomotion &&
      this.stateElapsed >= this.minimumStateSeconds[this.locomotionState]
    ) {
      this.enterLocomotion(this.pendingLocomotion);
    }
  }

  /** Zatrzymuje akcje, odłącza listener i zwalnia lokalny rejestr. */
  dispose() {
    this.mixer.removeEventListener('finished', this.handleFinished);
    this.mixer.stopAllAction();
    this.oneShotQueue.length = 0;
    this.actions.clear();
  }
}
