import * as THREE from 'three';
import { NpcBehaviorState } from './NpcBehaviorScheduler';

export type WatchdogStuckReason = 'no_movement' | 'waypoint_oscillation' | 'decision_loop' | 'state_timeout';

export type WatchdogRecoveryAction = 'steer_nudge' | 'repath' | 'new_target' | 'teleport';

export type NpcWatchdogLogEntry = {
  npcName: string;
  position: { x: number; y: number; z: number };
  state: string;
  target: { x: number; y: number; z: number };
  reason: WatchdogStuckReason;
  action: WatchdogRecoveryAction;
  recoveryCount: number;
  message: string;
};

export type NpcWatchdogConfig = {
  noMovementLimitSeconds?: number;
  stateTimeoutSeconds?: number;
  flappingWindowSeconds?: number;
  flappingLimitCount?: number;
  oscillationWindowSeconds?: number;
  minProgressDistance?: number;
  logger?: (entry: NpcWatchdogLogEntry) => void;
};

export const NPC_WATCHDOG_DEFAULTS = {
  noMovementLimitSeconds: 2.0,
  stateTimeoutSeconds: 25.0,
  flappingWindowSeconds: 2.5,
  flappingLimitCount: 4,
  oscillationWindowSeconds: 3.5,
  minProgressDistance: 0.25,
} as const;

/**
 * Watchdog monitorujący ruch agenta NPC, postęp wzdłuż trasy oraz zmiany stanów decyzyjnych.
 * Wykrywa zablokowanie, pętle decyzyjne oraz oscylacje waypointów i uruchamia stopniowane odzyskiwanie.
 */
export class NpcStuckWatchdog {
  readonly config: Required<NpcWatchdogConfig>;

  // Metryki diagnostyczne
  timeWithoutProgress = 0;
  timeInCurrentState = 0;
  targetChangeCount = 0;
  repathCount = 0;
  stateTransitionCount = 0;
  recoveryCount = 0;
  lastRecoveryReason?: WatchdogStuckReason;
  lastRecoveryAction?: WatchdogRecoveryAction;

  // Stan wewnętrzny
  private recoveryStage = 0;
  private accumulatedProgress = 0;
  private readonly lastProgressPosition = new THREE.Vector3();
  private readonly lastSamplePosition = new THREE.Vector3();
  private currentState: NpcBehaviorState = 'idle';

  // Historia przejść i waypointów do wykrywania lawin i oscylacji
  private readonly stateHistory: { state: NpcBehaviorState; time: number }[] = [];
  private readonly targetHistory: { target: THREE.Vector3; time: number }[] = [];
  private readonly waypointHistory: { waypoint: THREE.Vector3; time: number }[] = [];
  private currentTime = 0;

  constructor(
    readonly npcName: string,
    initialPosition: THREE.Vector3,
    config?: NpcWatchdogConfig,
  ) {
    this.config = {
      noMovementLimitSeconds: config?.noMovementLimitSeconds ?? NPC_WATCHDOG_DEFAULTS.noMovementLimitSeconds,
      stateTimeoutSeconds: config?.stateTimeoutSeconds ?? NPC_WATCHDOG_DEFAULTS.stateTimeoutSeconds,
      flappingWindowSeconds: config?.flappingWindowSeconds ?? NPC_WATCHDOG_DEFAULTS.flappingWindowSeconds,
      flappingLimitCount: config?.flappingLimitCount ?? NPC_WATCHDOG_DEFAULTS.flappingLimitCount,
      oscillationWindowSeconds:
        config?.oscillationWindowSeconds ?? NPC_WATCHDOG_DEFAULTS.oscillationWindowSeconds,
      minProgressDistance: config?.minProgressDistance ?? NPC_WATCHDOG_DEFAULTS.minProgressDistance,
      logger: config?.logger ?? NpcStuckWatchdog.defaultLogger,
    };
    this.lastProgressPosition.copy(initialPosition);
    this.lastSamplePosition.copy(initialPosition);
  }

  static defaultLogger(entry: NpcWatchdogLogEntry) {
    console.warn(entry.message);
  }

  /** Informuje watchdog o zmianie stanu w schedulerze zachowania. */
  onStateChanged(newState: NpcBehaviorState) {
    if (this.currentState === newState) return;
    this.stateTransitionCount += 1;
    this.currentState = newState;
    this.timeInCurrentState = 0;
    this.stateHistory.push({ state: newState, time: this.currentTime });

    // Przycinanie historii
    const cutoff = this.currentTime - this.config.flappingWindowSeconds;
    while (this.stateHistory.length > 0 && this.stateHistory[0].time < cutoff) {
      this.stateHistory.shift();
    }
  }

  /** Informuje watchdog o przypisaniu nowego celu. */
  onTargetAssigned(target: THREE.Vector3) {
    this.targetChangeCount += 1;
    this.targetHistory.push({ target: target.clone(), time: this.currentTime });
    const cutoff = this.currentTime - this.config.oscillationWindowSeconds;
    while (this.targetHistory.length > 0 && this.targetHistory[0].time < cutoff) {
      this.targetHistory.shift();
    }
  }

  /** Informuje watchdog o przełączeniu aktywnego waypointa. */
  onWaypointChanged(waypoint: THREE.Vector3) {
    this.waypointHistory.push({ waypoint: waypoint.clone(), time: this.currentTime });
    const cutoff = this.currentTime - this.config.oscillationWindowSeconds;
    while (this.waypointHistory.length > 0 && this.waypointHistory[0].time < cutoff) {
      this.waypointHistory.shift();
    }
  }

  /** Resetuje liczniki utknięcia po wymuszonym przeniesieniu postaci. */
  resetPosition(position: THREE.Vector3) {
    this.lastProgressPosition.copy(position);
    this.lastSamplePosition.copy(position);
    this.timeWithoutProgress = 0;
    this.accumulatedProgress = 0;
    this.recoveryStage = 0;
  }

  /**
   * Sprawdza stan agenta w bieżącej klatce i zwraca akcję naprawczą, jeśli wykryto błąd.
   */
  update(
    deltaTime: number,
    currentPosition: THREE.Vector3,
    state: NpcBehaviorState,
    travelling: boolean,
    target: THREE.Vector3,
  ): WatchdogRecoveryAction | null {
    const dt = Math.max(0, deltaTime);
    this.currentTime += dt;

    if (this.currentState !== state) {
      this.onStateChanged(state);
    } else {
      this.timeInCurrentState += dt;
    }

    // Jeśli NPC nie podróżuje (stoi w zamierzonym Idle), nie mierzymy braku ruchu w podróży
    if (!travelling) {
      this.timeWithoutProgress = 0;
      this.lastProgressPosition.copy(currentPosition);
      this.lastSamplePosition.copy(currentPosition);
      return null;
    }

    // Pomiar postępu od ostatniej próbki
    const distanceSinceLastProgress = currentPosition.distanceTo(this.lastProgressPosition);
    if (distanceSinceLastProgress >= this.config.minProgressDistance) {
      this.timeWithoutProgress = 0;
      this.accumulatedProgress += distanceSinceLastProgress;
      this.lastProgressPosition.copy(currentPosition);

      // Po udanym, płynnym ruchu > 1.5 m resetujemy stopień eskalacji recovery
      if (this.accumulatedProgress >= 1.5) {
        this.recoveryStage = 0;
      }
    } else {
      this.timeWithoutProgress += dt;
    }

    this.lastSamplePosition.copy(currentPosition);

    // 1. Sprawdzanie lawiny decyzji (flapping / state avalanche)
    if (this.detectDecisionLoop()) {
      return this.triggerRecovery('decision_loop', currentPosition, state, target);
    }

    // 2. Sprawdzanie oscylacji waypointów lub celów
    if (this.detectWaypointOscillation()) {
      return this.triggerRecovery('waypoint_oscillation', currentPosition, state, target);
    }

    // 3. Sprawdzanie braku ruchu (fizyczne utknięcie)
    if (this.timeWithoutProgress >= this.config.noMovementLimitSeconds) {
      return this.triggerRecovery('no_movement', currentPosition, state, target);
    }

    // 4. Sprawdzanie przekroczenia maksymalnego czasu w jednym stanie podróży
    if (this.timeInCurrentState >= this.config.stateTimeoutSeconds) {
      return this.triggerRecovery('state_timeout', currentPosition, state, target);
    }

    return null;
  }

  /** Wykrywa nadmierną częstotliwość zmian stanu w zadanym oknie czasowym. */
  private detectDecisionLoop(): boolean {
    const cutoff = this.currentTime - this.config.flappingWindowSeconds;
    const recentChanges = this.stateHistory.filter((entry) => entry.time >= cutoff);
    return recentChanges.length >= this.config.flappingLimitCount;
  }

  /** Wykrywa oscylację pomiędzy dwoma waypointami lub celami w krótkim oknie czasu. */
  private detectWaypointOscillation(): boolean {
    // Sprawdzanie ostatnich waypointów (A -> B -> A)
    if (this.waypointHistory.length >= 3) {
      const len = this.waypointHistory.length;
      const w0 = this.waypointHistory[len - 1].waypoint;
      const w1 = this.waypointHistory[len - 2].waypoint;
      const w2 = this.waypointHistory[len - 3].waypoint;
      // w0 i w2 są blisko siebie (< 0.5m), a w1 jest odległy (> 0.8m)
      if (w0.distanceToSquared(w2) < 0.25 && w0.distanceToSquared(w1) > 0.64) {
        return true;
      }
    }

    // Sprawdzanie ostatnich celów (T1 -> T2 -> T1)
    if (this.targetHistory.length >= 3) {
      const len = this.targetHistory.length;
      const t0 = this.targetHistory[len - 1].target;
      const t1 = this.targetHistory[len - 2].target;
      const t2 = this.targetHistory[len - 3].target;
      if (t0.distanceToSquared(t2) < 0.25 && t0.distanceToSquared(t1) > 0.64) {
        return true;
      }
    }

    return false;
  }

  /** Stopniowane odzyskiwanie (graded recovery) z emisją logu i eskalacją. */
  private triggerRecovery(
    reason: WatchdogStuckReason,
    position: THREE.Vector3,
    state: NpcBehaviorState,
    target: THREE.Vector3,
  ): WatchdogRecoveryAction {
    this.recoveryCount += 1;
    this.lastRecoveryReason = reason;

    // Eskalacja poziomu odzyskiwania:
    // 1: steer_nudge -> 2: repath -> 3: new_target -> 4: teleport
    // Wyjątek: w przypadku decision_loop lub waypoint_oscillation steering_nudge nie pomoże,
    // więc eskalujemy od razu do co najmniej repath lub new_target.
    if (reason === 'decision_loop') {
      this.recoveryStage = Math.max(this.recoveryStage + 1, 3);
    } else if (reason === 'waypoint_oscillation') {
      this.recoveryStage = Math.max(this.recoveryStage + 1, 2);
    } else {
      this.recoveryStage = Math.min(4, this.recoveryStage + 1);
    }

    let action: WatchdogRecoveryAction;
    switch (this.recoveryStage) {
      case 1:
        action = 'steer_nudge';
        break;
      case 2:
        action = 'repath';
        break;
      case 3:
        action = 'new_target';
        break;
      default:
        action = 'teleport';
        break;
    }

    this.lastRecoveryAction = action;

    // Reset timera braku postępu oraz czasu w stanie, aby dać czas akcji na wykonanie
    this.timeWithoutProgress = 0;
    this.timeInCurrentState = 0;
    this.accumulatedProgress = 0;
    this.lastProgressPosition.copy(position);
    this.lastSamplePosition.copy(position);

    // Czyszczenie historii przy zapętleniach, aby nie wywoływać lawiny kolejnych recovery
    if (reason === 'decision_loop') {
      this.stateHistory.length = 0;
    }
    if (reason === 'waypoint_oscillation') {
      this.waypointHistory.length = 0;
      this.targetHistory.length = 0;
    }

    // Ustrukturyzowany log
    const entry: NpcWatchdogLogEntry = {
      npcName: this.npcName,
      position: { x: position.x, y: position.y, z: position.z },
      state,
      target: { x: target.x, y: target.y, z: target.z },
      reason,
      action,
      recoveryCount: this.recoveryCount,
      message:
        `[NpcWatchdog] NPC: ${this.npcName} | Pos: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) ` +
        `| State: ${state} | Target: (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)}) ` +
        `| Reason: ${reason} | Action: ${action} | Recovery: #${this.recoveryCount}`,
    };

    this.config.logger(entry);
    return action;
  }
}
