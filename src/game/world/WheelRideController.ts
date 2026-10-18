import * as THREE from 'three';
import { EventScope } from '../lifecycle/EventScope';
import type { PlayerController } from '../player/PlayerController';
import { FESTIVAL_WHEEL_SITE } from './festivalWheel';
import { terrainHeight } from './terrainHeight';
import type { WheelSchedulePhase, WheelScheduleSample } from './wheelSchedule';

export type WheelRideState = 'idle' | 'boarding' | 'riding' | 'exiting';

export interface WheelRideSnapshot {
  cameraPosition: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
  fov: number;
  near: number;
  far: number;
  yaw: number;
  pitch: number;
  movementLocked: boolean;
}

export interface WheelRideTarget {
  root?: THREE.Object3D;
  getScheduleSample(): WheelScheduleSample;
  getScheduleTime(): number;
  getAngle(): number;
  getGondola?(index: number): THREE.Object3D | undefined;
  getRotor?(): THREE.Object3D;
  getCabinEyePosition?(index: number, target: THREE.Vector3): THREE.Vector3 | undefined;
}

export interface WheelRideOptions {
  /** Indeks gondoli pasażerskiej (domyślnie: 12 dla dolnej gondoli MVP) */
  gondolaIndex?: number;
  /** Offset punktu oka w układzie gondoli (domyślnie: (0, 1.15, 0)) */
  eyeOffset?: THREE.Vector3;
  /** Punkt wejścia/wyjścia na ziemi (domyślnie: x = 107.5, z = -59.0) */
  boardingTarget?: { x: number; z: number };
  /** Wysokość oczu stojącego gracza nad gruntem (domyślnie: 1.9 m) */
  standingEyeHeight?: number;
  /** Czas trwania animacji zaciemnienia ekranu (fade) w sekundach (domyślnie: 0.25 s = 250 ms) */
  fadeDurationSeconds?: number;
  /** Wartość near kamery wewnątrz kabiny (domyślnie: 0.1 m, chroni przed obcinaniem barierek) */
  cabinNear?: number;
  /** Funkcja pobierania wysokości terenu (domyślnie: terrainHeight) */
  getGroundHeight?: (x: number, z: number) => number;
  /** Czy wyjście ma nastąpić automatycznie po zakończeniu pełnego cyklu (domyślnie: true) */
  autoExitOnCycleComplete?: boolean;
  /** Czy przywracać kąty yaw/pitch ze snapshotu po opuszczeniu kabiny (domyślnie: false) */
  restoreOrientationOnExit?: boolean;
  /** Callback do włączania/wyłączania nakładki fade */
  onFade?: (showing: boolean) => void;
  /** Callback zmiany stanu przejażdżki */
  onStateChange?: (state: WheelRideState) => void;
  /** Callback zmiany zakolejkowania wyjścia */
  onExitQueued?: (queued: boolean) => void;
}

export const MVP_CABIN_INDEX = 12;
export const CABIN_EYE_OFFSET = new THREE.Vector3(0, 1.15, 0);
export const WHEEL_BOARDING_TARGET = {
  x: FESTIVAL_WHEEL_SITE.x - 8.5, // 107.5
  z: FESTIVAL_WHEEL_SITE.z, // -59.0
} as const;
export const DEFAULT_FADE_DURATION = 0.25; // 250 ms
export const DEFAULT_CABIN_NEAR = 0.1;
export const DEFAULT_STANDING_EYE_HEIGHT = 1.9;
export const INITIAL_LOOK_YAW = Math.PI / 2; // Patrzenie na zachód (-X) w stronę Dużej Sceny

/**
 * Kontroler przejażdżki pasażerskiej diabelskim młynem (Ferris Wheel Ride Controller — A2).
 * Koordynuje wsiadanie, przejazd w gondoli 12, swobodne rozglądanie, stabilny horyzont i bezpieczne wysiadanie na ziemię.
 */
export class WheelRideController {
  private state: WheelRideState = 'idle';
  private exitQueued = false;
  private hasAscended = false;
  private fadeTimer = 0;
  private snapshot?: WheelRideSnapshot;
  private yaw = INITIAL_LOOK_YAW;
  private pitch = 0;
  private events = new EventScope();
  private disposed = false;
  private boardingRequested = false;
  private readonly tempVec = new THREE.Vector3();
  private readonly eyeOffset: THREE.Vector3;
  private readonly gondolaIndex: number;
  private readonly fadeDuration: number;
  private readonly cabinNear: number;
  private readonly standingEyeHeight: number;
  private readonly getGroundHeight: (x: number, z: number) => number;
  private readonly boardingTarget: { x: number; z: number };
  private prevSchedulePhase?: WheelSchedulePhase;

  constructor(
    readonly wheel: WheelRideTarget,
    readonly camera: THREE.PerspectiveCamera,
    readonly player?: PlayerController,
    readonly options: WheelRideOptions = {},
  ) {
    this.gondolaIndex = options.gondolaIndex ?? MVP_CABIN_INDEX;
    this.eyeOffset = options.eyeOffset ? options.eyeOffset.clone() : CABIN_EYE_OFFSET.clone();
    this.fadeDuration = Math.max(0, options.fadeDurationSeconds ?? DEFAULT_FADE_DURATION);
    this.cabinNear = options.cabinNear ?? DEFAULT_CABIN_NEAR;
    this.standingEyeHeight = options.standingEyeHeight ?? DEFAULT_STANDING_EYE_HEIGHT;
    this.getGroundHeight = options.getGroundHeight ?? terrainHeight;
    this.boardingTarget =
      options.boardingTarget ?? wheel.root?.userData.boardingTarget ?? WHEEL_BOARDING_TARGET;

    if (player) {
      this.yaw = player.yaw;
      this.pitch = player.pitch;
    }

    if (typeof window !== 'undefined') {
      this.events.listen(window, 'keydown', (event) => {
        const e = event as KeyboardEvent;
        if (e.key.toLowerCase() === 'e') {
          const target = e.target as HTMLElement | null;
          if (
            target &&
            (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
          ) {
            return;
          }
          if (this.state === 'riding') {
            this.queueExit();
          }
        }
      });
    }
  }

  /** Zwraca aktualny stan przejażdżki ('idle' | 'boarding' | 'riding' | 'exiting'). */
  getState(): WheelRideState {
    return this.state;
  }

  isIdle(): boolean {
    return this.state === 'idle';
  }

  /** Explicitly requested rides may move; reduced-motion still stops the idle attraction. */
  shouldReduceMotion(preference: boolean): boolean {
    return preference && this.isIdle() && !this.boardingRequested;
  }

  /** Queue entry at the next safe bottom stop instead of silently rejecting E. */
  requestBoarding(reduceMotion = false): boolean {
    if (this.disposed || reduceMotion || !this.isIdle()) return false;
    if (!this.startBoarding(false)) this.boardingRequested = true;
    return true;
  }

  isBoarding(): boolean {
    return this.state === 'boarding';
  }

  isRiding(): boolean {
    return this.state === 'riding';
  }

  isExiting(): boolean {
    return this.state === 'exiting';
  }

  isExitQueued(): boolean {
    return this.exitQueued;
  }

  /**
   * Rozpoczyna proces wsiadania do gondoli MVP (indeks 12).
   * Wsiadanie jest dozwolone wyłącznie w fazie dolnej ('bottom') przy zatrzymanym kole.
   * Działanie idempotentne.
   */
  startBoarding(reduceMotion = false): boolean {
    if (this.disposed || reduceMotion) return false;
    if (this.state !== 'idle') return false;

    const sample = this.wheel.getScheduleSample();
    if (sample.phase !== 'bottom' || !sample.stopped) {
      return false;
    }

    this.snapshot = {
      cameraPosition: this.camera.position.clone(),
      cameraQuaternion: this.camera.quaternion.clone(),
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far,
      yaw: this.getYaw(),
      pitch: this.getPitch(),
      movementLocked: this.player?.movementLocked ?? false,
    };

    this.state = 'boarding';
    this.exitQueued = false;
    this.hasAscended = false;
    this.fadeTimer = 0;
    this.options.onFade?.(true);
    this.options.onStateChange?.('boarding');

    if (this.fadeDuration <= 0) {
      this.completeBoarding();
    }

    return true;
  }

  startRide(reduceMotion = false): boolean {
    return this.startBoarding(reduceMotion);
  }

  /**
   * Kończy fade wsiadania i weryfikuje, czy koło nadal znajduje się w dolnej fazie postoju.
   * Jeśli postój dobiegł końca, anuluje wsiadanie bez teleportowania gracza w powietrze.
   */
  private completeBoarding(): void {
    if (this.state !== 'boarding') return;

    const sample = this.wheel.getScheduleSample();
    if (sample.phase !== 'bottom') {
      this.cancelToGround();
      return;
    }

    this.state = 'riding';
    this.hasAscended = false;
    this.exitQueued = false;

    if (this.player) {
      this.player.setMovementLocked(true);
    }

    this.camera.near = this.cabinNear;
    this.camera.updateProjectionMatrix();

    this.camera.position.copy(this.getEyeWorldPosition(this.tempVec));
    this.camera.rotation.set(this.getPitch(), this.getYaw(), 0, 'YXZ');

    this.options.onFade?.(false);
    this.options.onStateChange?.('riding');
  }

  /**
   * Kolejkuje bezpieczne wyjście z gondoli.
   * W trakcie jazdy nie wyrzuca gracza w powietrze, lecz oczekuje na dolną fazę ('bottom').
   */
  queueExit(): boolean {
    if (this.disposed || this.state === 'idle') return false;
    if (this.state === 'exiting') return true;

    if (this.state === 'boarding') {
      this.cancelToGround();
      return true;
    }

    this.exitQueued = true;
    this.options.onExitQueued?.(true);

    if (this.state === 'riding' && this.isAtBottomStation()) {
      this.beginExiting();
    }

    return true;
  }

  isAtBottomStation(): boolean {
    const sample = this.wheel.getScheduleSample();
    return sample.phase === 'bottom' && sample.stopped;
  }

  private beginExiting(): void {
    if (this.state !== 'riding') return;
    this.state = 'exiting';
    this.fadeTimer = 0;
    this.options.onFade?.(true);
    this.options.onStateChange?.('exiting');

    if (this.fadeDuration <= 0) {
      this.finishExit();
    }
  }

  private finishExit(): void {
    if (this.state !== 'exiting') return;

    if (this.snapshot) {
      this.camera.fov = this.snapshot.fov;
      this.camera.near = this.snapshot.near;
      this.camera.far = this.snapshot.far;
      this.camera.updateProjectionMatrix();
    }

    const groundY = this.getGroundHeight(this.boardingTarget.x, this.boardingTarget.z);
    this.camera.position.set(this.boardingTarget.x, groundY + this.standingEyeHeight, this.boardingTarget.z);

    if (this.player) {
      this.player.setMovementLocked(false);
      this.player.stop();
      if (this.options.restoreOrientationOnExit && this.snapshot) {
        this.player.yaw = this.snapshot.yaw;
        this.player.pitch = this.snapshot.pitch;
      }
    }

    this.camera.rotation.set(this.getPitch(), this.getYaw(), 0, 'YXZ');

    this.options.onFade?.(false);
    this.state = 'idle';
    this.exitQueued = false;
    this.snapshot = undefined;
    this.options.onStateChange?.('idle');
  }

  /**
   * Bezpiecznie anuluje przejażdżkę w dowolnym momencie (np. menu, błąd, rozłączenie, reduceMotion).
   * Natychmiast umieszcza gracza na ziemi przy punkcie wejścia (107.5, groundY, -59.0) i przywraca stan kamery.
   */
  cancelToGround(): void {
    this.boardingRequested = false;
    if (this.disposed) return;

    this.options.onFade?.(false);

    if (this.snapshot) {
      this.camera.fov = this.snapshot.fov;
      this.camera.near = this.snapshot.near;
      this.camera.far = this.snapshot.far;
      this.camera.updateProjectionMatrix();
    }

    const groundY = this.getGroundHeight(this.boardingTarget.x, this.boardingTarget.z);
    this.camera.position.set(this.boardingTarget.x, groundY + this.standingEyeHeight, this.boardingTarget.z);

    if (this.player) {
      this.player.setMovementLocked(false);
      this.player.stop();
      if (this.options.restoreOrientationOnExit && this.snapshot) {
        this.player.yaw = this.snapshot.yaw;
        this.player.pitch = this.snapshot.pitch;
      }
    }

    this.camera.rotation.set(this.getPitch(), this.getYaw(), 0, 'YXZ');

    this.state = 'idle';
    this.exitQueued = false;
    this.hasAscended = false;
    this.snapshot = undefined;
    this.fadeTimer = 0;
    this.options.onStateChange?.('idle');
  }

  /**
   * Główna funkcja aktualizująca stan przejażdżki w klatce renderera.
   * Kopiuje pozycję gondoli do kamery, zachowując całkowicie płaski horyzont (roll = 0)
   * oraz swobodne rozglądanie się gracza.
   */
  update(deltaSeconds: number, reduceMotion = false): void {
    if (this.disposed) return;
    if (reduceMotion) this.boardingRequested = false;
    if (
      this.boardingRequested &&
      Math.hypot(
        this.camera.position.x - this.boardingTarget.x,
        this.camera.position.z - this.boardingTarget.z,
      ) > 5
    )
      this.boardingRequested = false;
    if (this.boardingRequested && !reduceMotion && this.startBoarding(false)) {
      this.boardingRequested = false;
    }

    if (reduceMotion) {
      if (this.state !== 'idle') {
        this.cancelToGround();
      }
      return;
    }

    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    const sample = this.wheel.getScheduleSample();
    const currentPhase = sample.phase;

    if (currentPhase === 'ascending' || currentPhase === 'top' || currentPhase === 'descending') {
      this.hasAscended = true;
    }

    const enteredBottomFromDescent = this.prevSchedulePhase === 'descending' && currentPhase === 'bottom';
    this.prevSchedulePhase = currentPhase;

    switch (this.state) {
      case 'boarding': {
        this.fadeTimer += deltaSeconds;
        if (this.fadeTimer >= this.fadeDuration) {
          this.completeBoarding();
        }
        break;
      }

      case 'riding': {
        this.camera.position.copy(this.getEyeWorldPosition(this.tempVec));
        this.camera.rotation.set(this.getPitch(), this.getYaw(), 0, 'YXZ');

        const autoExit = (this.options.autoExitOnCycleComplete ?? true) && this.hasAscended;
        const shouldExitAtBottom = this.exitQueued || autoExit;

        if (shouldExitAtBottom) {
          if (sample.phase === 'bottom' || enteredBottomFromDescent) {
            this.beginExiting();
          }
        }
        break;
      }

      case 'exiting': {
        this.camera.position.copy(this.getEyeWorldPosition(this.tempVec));
        this.camera.rotation.set(this.getPitch(), this.getYaw(), 0, 'YXZ');

        this.fadeTimer += deltaSeconds;
        if (this.fadeTimer >= this.fadeDuration) {
          this.finishExit();
        }
        break;
      }

      case 'idle':
      default:
        break;
    }
  }

  private getGondolaObject(): THREE.Object3D | undefined {
    if (this.wheel.getGondola) {
      const gondola = this.wheel.getGondola(this.gondolaIndex);
      if (gondola) return gondola;
    }
    if (this.wheel.root) {
      const byName = this.wheel.root.getObjectByName(`Gondola_${this.gondolaIndex}`);
      if (byName) return byName;
      let found: THREE.Object3D | undefined;
      let count = 0;
      this.wheel.root.traverse((obj) => {
        if (obj.userData.wheelPart === 'gondola') {
          if (count === this.gondolaIndex) found = obj;
          count++;
        }
      });
      return found;
    }
    return undefined;
  }

  /** Zwraca współrzędną światową punktu widokowego (eye anchor) w kabinie pasażerskiej. */
  getEyeWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    if (!this.options.eyeOffset) {
      const cabinEye = this.wheel.getCabinEyePosition?.(this.gondolaIndex, target);
      if (cabinEye) return cabinEye;
    }
    const gondola = this.getGondolaObject();
    if (gondola) {
      gondola.updateWorldMatrix(true, false);
      gondola.getWorldPosition(target);
      target.add(this.eyeOffset);
      return target;
    }
    return this.calculateMathematicalEyePosition(target);
  }

  /** Matematyczna kalkulacja pozycji oka według geometrycznego kontraktu A0. */
  calculateMathematicalEyePosition(target = new THREE.Vector3()): THREE.Vector3 {
    const groundY = this.getGroundHeight(FESTIVAL_WHEEL_SITE.x, FESTIVAL_WHEEL_SITE.z);
    const rootX = FESTIVAL_WHEEL_SITE.x;
    const rootY = groundY + 0.025;
    const rootZ = FESTIVAL_WHEEL_SITE.z;

    const angle = this.wheel.getAngle();
    const relRotorX = 15.0 * Math.sin(angle);
    const relRotorY = -15.0 * Math.cos(angle);

    target.set(
      rootX + relRotorX + this.eyeOffset.x,
      rootY + 18.0 + relRotorY + this.eyeOffset.y,
      rootZ + this.eyeOffset.z,
    );
    return target;
  }

  /** Zwraca koordynaty naziemnego punktu zbiórki / wysiadania (107.5, groundY, -59.0). */
  getBoardingPoint(includeEyeHeight = false): THREE.Vector3 {
    const groundY = this.getGroundHeight(this.boardingTarget.x, this.boardingTarget.z);
    return new THREE.Vector3(
      this.boardingTarget.x,
      groundY + (includeEyeHeight ? this.standingEyeHeight : 0),
      this.boardingTarget.z,
    );
  }

  lookBy(dx: number, dy: number): void {
    if (this.player) {
      this.player.lookBy(dx, dy);
      this.yaw = this.player.yaw;
      this.pitch = this.player.pitch;
    } else {
      this.yaw -= dx * 0.0024;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.002, -1.18, 1.18);
    }
  }

  getYaw(): number {
    return this.player ? this.player.yaw : this.yaw;
  }

  getPitch(): number {
    return this.player ? this.player.pitch : this.pitch;
  }

  setLook(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = THREE.MathUtils.clamp(pitch, -1.18, 1.18);
    if (this.player) {
      this.player.yaw = this.yaw;
      this.player.pitch = this.pitch;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelToGround();
    this.events.dispose();
  }
}
