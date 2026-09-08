import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NpcManager } from './NpcManager';
import { NpcNavigationGrid } from './NpcNavigationGrid';

/** Tworzy realistyczną siatkę nawigacyjną z centralnym obozem i przeszkodami namiotów. */
function createCampNavigation() {
  const tents = [
    { x: -6, z: -4, r: 2.2 },
    { x: 5, z: -5, r: 2.0 },
    { x: -5, z: 6, r: 2.2 },
    { x: 6, z: 5, r: 2.0 },
    { x: 0, z: 0, r: 1.5 }, // stół i maszt
  ];

  return new NpcNavigationGrid({ minX: -28, maxX: 28, minZ: -28, maxZ: 28 }, 1, (x, z) => {
    // Wyklucz obiekty obozu
    return !tents.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 0.34);
  });
}

/**
 * Obserwator sesji soak śledzący metryki ciągłości i anomalie decyzyjne.
 */
export class NpcSoakObserver {
  maxStuckTimeObserved = 0;
  totalFlapDetections = 0;
  totalStuckDetections = 0;
  totalClipRestartDetections = 0;

  private readonly visitedSectors = new Map<string, Set<number>>();
  private readonly lastClips = new Map<string, string>();
  private readonly clipRestartCounts = new Map<string, number>();

  constructor(private readonly npcs: NpcManager['npcs']) {
    npcs.forEach((npc) => {
      this.visitedSectors.set(npc.name, new Set());
      this.clipRestartCounts.set(npc.name, 0);
    });
  }

  /** Aktualizuje próbkę obserwatora po każdym kroku symulacji. */
  sample(dt: number) {
    for (const npc of this.npcs) {
      // 1. Monitorowanie utknięcia
      if (npc.watchdog.timeWithoutProgress > this.maxStuckTimeObserved) {
        this.maxStuckTimeObserved = npc.watchdog.timeWithoutProgress;
      }
      if (npc.watchdog.timeWithoutProgress >= 4.0) {
        this.totalStuckDetections += 1;
      }

      // 2. Śledzenie odwiedzanych sektorów
      const col = Math.min(2, Math.max(0, Math.floor((npc.root.position.x + 28) / (56 / 3))));
      const row = Math.min(2, Math.max(0, Math.floor((npc.root.position.z + 28) / (56 / 3))));
      const sector = row * 3 + col;
      this.visitedSectors.get(npc.name)?.add(sector);

      // 3. Monitorowanie zapętleń decyzyjnych (decision loops)
      if (npc.watchdog.lastRecoveryReason === 'decision_loop') {
        this.totalFlapDetections += 1;
      }

      // 4. Monitorowanie restartów animacji
      const diag = npc.animator?.getDiagnostics();
      if (diag) {
        const lastClip = this.lastClips.get(npc.name);
        if (lastClip === diag.currentClip && diag.normalizedTime < 0.05 && dt > 0) {
          // Restart tego samego klipu w krótkim czasie
          const currentCount = (this.clipRestartCounts.get(npc.name) ?? 0) + 1;
          this.clipRestartCounts.set(npc.name, currentCount);
        }
        this.lastClips.set(npc.name, diag.currentClip);
      }
    }
  }

  getVisitedSectorCount(npcName: string) {
    return this.visitedSectors.get(npcName)?.size ?? 0;
  }
}

describe('NpcSoakSession (Issue #21)', () => {
  it('detects an injected stuck anomaly during soak monitoring', () => {
    const nav = createCampNavigation();
    const manager = new NpcManager(new THREE.Scene(), new Map(), null, nav);
    const observer = new NpcSoakObserver(manager.npcs);

    const targetNpc = manager.npcs[0];
    targetNpc.behavior.travelling = true;
    targetNpc.stationary = false;

    // Wstrzyknięcie sztucznego utknięcia (agent zablokowany powyżej dopuszczalnego limitu)
    targetNpc.watchdog.timeWithoutProgress = 4.5;
    observer.sample(0.1);

    expect(observer.totalStuckDetections).toBeGreaterThanOrEqual(1);
    expect(observer.maxStuckTimeObserved).toBeGreaterThanOrEqual(4.5);
    manager.dispose();
  });

  it('detects an injected decision loop anomaly during soak monitoring', () => {
    const nav = createCampNavigation();
    const manager = new NpcManager(new THREE.Scene(), new Map(), null, nav);
    const observer = new NpcSoakObserver(manager.npcs);

    const targetNpc = manager.npcs[1];
    targetNpc.watchdog.lastRecoveryReason = 'decision_loop';
    observer.sample(0.1);

    expect(observer.totalFlapDetections).toBeGreaterThanOrEqual(1);
    manager.dispose();
  });

  it('runs a deterministic 30-minute soak of 8 NPCs without permanent stuckness or runaway flapping', () => {
    const scene = new THREE.Scene();
    const nav = createCampNavigation();
    const manager = new NpcManager(scene, new Map(), null, nav);
    const observer = new NpcSoakObserver(manager.npcs);

    // 30 minut = 1800 sekund w krokach dt = 0.1s (18 000 kroków symulacji)
    const SIMULATION_SECONDS = 1800;
    const DT = 0.1;
    const TOTAL_STEPS = SIMULATION_SECONDS / DT;

    for (let step = 0; step < TOTAL_STEPS; step++) {
      const virtualTime = step * DT;
      manager.update(DT, virtualTime);
      observer.sample(DT);
    }

    // Kryterium 1: Żaden agent nie utknął trwale na dłużej niż limit naprawy (< 3.0s)
    expect(observer.maxStuckTimeObserved).toBeLessThan(3.0);
    expect(observer.totalStuckDetections).toBe(0);

    // Kryterium 2: W sesji odbiorowej brak stale zablokowanych agentów i brak lawin decyzji
    expect(observer.totalFlapDetections).toBe(0);

    // Kryterium 3: Każdy z ośmiu agentów eksploruje pole (odwiedza co najmniej 3 różne sektory z 9)
    for (const npc of manager.npcs) {
      const visited = observer.getVisitedSectorCount(npc.name);
      expect(visited).toBeGreaterThanOrEqual(3);

      // Pozycja nie uciekła poza granice świata i nie zawiera NaN
      expect(Number.isNaN(npc.root.position.x)).toBe(false);
      expect(Number.isNaN(npc.root.position.z)).toBe(false);
      expect(Math.abs(npc.root.position.x)).toBeLessThan(28);
      expect(Math.abs(npc.root.position.z)).toBeLessThan(28);

      // Liczba przejść stanu jest w zdrowym zakresie (średnio co kilkanaście sekund, a nie co ułamek sekundy)
      expect(npc.watchdog.stateTransitionCount).toBeGreaterThan(15);
      expect(npc.watchdog.stateTransitionCount).toBeLessThan(600);
    }

    manager.dispose();
  });
});
