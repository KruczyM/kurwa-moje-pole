import * as THREE from 'three';
import { Npc, NpcManager } from './NpcManager';

export type NpcDebugLayer = 'colliders' | 'grid' | 'paths' | 'targets' | 'labels' | 'metrics';

export type NpcDebugMetricsSummary = {
  totalRepaths: number;
  totalStateTransitions: number;
  totalRecoveries: number;
  npcs: {
    name: string;
    state: string;
    clip: string;
    speed: number;
    timeWithoutProgress: number;
    repaths: number;
    stateTransitions: number;
    recoveries: number;
  }[];
};

export type NpcDebugOverlayOptions = {
  scene: THREE.Scene;
  world: { colliders: readonly ({ x: number; z: number; r: number } | { box: THREE.Box3 })[] };
  npcManager: NpcManager;
  container?: HTMLElement;
  initialVisible?: boolean;
};

const NPC_COLORS = [
  0x00ffff, // cyan
  0xff00ff, // magenta
  0xffff00, // yellow
  0x00ff66, // green
  0xff6600, // orange
  0x6699ff, // light blue
  0xff3366, // coral
  0xcc66ff, // violet
];

/** Sprawdza, czy overlay diagnostyczny jest dozwolony w bieżącym środowisku. */
export function isNpcDebugAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  const isDev = Boolean(import.meta.env?.DEV);
  const urlParam = new URLSearchParams(window.location.search).get('debugNpc');
  return isDev || urlParam === '1';
}

/**
 * Overlay diagnostyczny dla AI NPC.
 * Wizualizuje collidery, grid przechodniości, ścieżki waypointów, cele oraz etykiety
 * ze stanem animacji, prędkością i czasem bez postępu każdego agenta.
 */
export class NpcDebugOverlay {
  visible = false;
  showColliders = true;
  showGrid = true;
  showPaths = true;
  showTargets = true;
  showLabels = true;
  showMetrics = true;

  readonly rootGroup = new THREE.Group();
  private readonly collidersGroup = new THREE.Group();
  private readonly gridGroup = new THREE.Group();
  private readonly pathsGroup = new THREE.Group();
  private readonly targetsGroup = new THREE.Group();

  private domContainer: HTMLElement | null = null;
  private labelsContainer: HTMLElement | null = null;
  private metricsContainer: HTMLElement | null = null;
  private keydownHandler?: (e: KeyboardEvent) => void;

  private pathLines: THREE.Line[] = [];
  private targetMarkers: THREE.Mesh[] = [];
  private labelElements: Map<string, HTMLElement> = new Map();

  constructor(readonly options: NpcDebugOverlayOptions) {
    this.rootGroup.name = 'NpcDebugOverlay';
    this.rootGroup.add(this.collidersGroup);
    this.rootGroup.add(this.gridGroup);
    this.rootGroup.add(this.pathsGroup);
    this.rootGroup.add(this.targetsGroup);

    options.scene.add(this.rootGroup);

    this.buildColliders();
    this.buildGrid();
    this.buildPathsAndTargets();
    this.setupDOM(options.container);
    this.setupKeyboard();

    this.setVisible(options.initialVisible ?? false);
  }

  /** Przełącza widoczność wybranej warstwy lub całego overlayu. */
  toggle(layer: 'all' | NpcDebugLayer = 'all') {
    if (layer === 'all') {
      this.setVisible(!this.visible);
      return;
    }
    switch (layer) {
      case 'colliders':
        this.showColliders = !this.showColliders;
        this.collidersGroup.visible = this.showColliders && this.visible;
        break;
      case 'grid':
        this.showGrid = !this.showGrid;
        this.gridGroup.visible = this.showGrid && this.visible;
        break;
      case 'paths':
        this.showPaths = !this.showPaths;
        this.pathsGroup.visible = this.showPaths && this.visible;
        break;
      case 'targets':
        this.showTargets = !this.showTargets;
        this.targetsGroup.visible = this.showTargets && this.visible;
        break;
      case 'labels':
        this.showLabels = !this.showLabels;
        if (this.labelsContainer) {
          this.labelsContainer.style.display = this.showLabels && this.visible ? 'block' : 'none';
        }
        break;
      case 'metrics':
        this.showMetrics = !this.showMetrics;
        if (this.metricsContainer) {
          this.metricsContainer.style.display = this.showMetrics && this.visible ? 'block' : 'none';
        }
        break;
    }
  }

  /** Włącza lub wyłącza cały overlay diagnostyczny. */
  setVisible(visible: boolean) {
    this.visible = visible;
    this.rootGroup.visible = visible;
    this.collidersGroup.visible = visible && this.showColliders;
    this.gridGroup.visible = visible && this.showGrid;
    this.pathsGroup.visible = visible && this.showPaths;
    this.targetsGroup.visible = visible && this.showTargets;

    if (this.domContainer) {
      this.domContainer.style.display = visible ? 'block' : 'none';
    }
    if (this.labelsContainer) {
      this.labelsContainer.style.display = visible && this.showLabels ? 'block' : 'none';
    }
    if (this.metricsContainer) {
      this.metricsContainer.style.display = visible && this.showMetrics ? 'block' : 'none';
    }
  }

  /** Buduje wireframe colliderów ze świata i obiektów obozu. */
  private buildColliders() {
    const boxMaterial = new THREE.LineBasicMaterial({ color: 0xff3344, linewidth: 1 });
    const circleMaterial = new THREE.LineBasicMaterial({ color: 0xff9900, linewidth: 1 });

    for (const collider of this.options.world.colliders) {
      if ('box' in collider) {
        const size = collider.box.getSize(new THREE.Vector3());
        const center = collider.box.getCenter(new THREE.Vector3());
        const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z);
        const edges = new THREE.EdgesGeometry(boxGeom);
        const line = new THREE.LineSegments(edges, boxMaterial);
        line.position.copy(center);
        this.collidersGroup.add(line);
      } else if ('r' in collider) {
        const segments = 16;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(theta) * collider.r, 0.2, Math.sin(theta) * collider.r));
        }
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const circle = new THREE.Line(geom, circleMaterial);
        circle.position.set(collider.x, 0, collider.z);
        this.collidersGroup.add(circle);
      }
    }
  }

  /** Buduje siatkę komórek nawigacyjnych (przechodnich / zablokowanych). */
  private buildGrid() {
    const nav = this.options.npcManager.navigation;
    const { minX, maxX, minZ, maxZ } = nav.bounds;
    const step = nav.cellSize;

    const blockedPoints: number[] = [];
    const perimeterPoints: number[] = [];

    // Granice siatki
    perimeterPoints.push(
      minX,
      0.1,
      minZ,
      maxX,
      0.1,
      minZ,
      maxX,
      0.1,
      minZ,
      maxX,
      0.1,
      maxZ,
      maxX,
      0.1,
      maxZ,
      minX,
      0.1,
      maxZ,
      minX,
      0.1,
      maxZ,
      minX,
      0.1,
      minZ,
    );

    // Próbkowanie komórek siatki w obozie (-25 do 25 m dla oszczędności wydajności)
    const scanMinX = Math.max(minX, -26);
    const scanMaxX = Math.min(maxX, 26);
    const scanMinZ = Math.max(minZ, -26);
    const scanMaxZ = Math.min(maxZ, 26);

    for (let x = scanMinX; x <= scanMaxX; x += step) {
      for (let z = scanMinZ; z <= scanMaxZ; z += step) {
        if (!nav.canStandAt(x, z)) {
          // Rysuj mały krzyżyk na zablokowanej komórce
          const h = step * 0.4;
          blockedPoints.push(x - h, 0.15, z - h, x + h, 0.15, z + h, x - h, 0.15, z + h, x + h, 0.15, z - h);
        }
      }
    }

    const perimeterGeom = new THREE.BufferGeometry();
    perimeterGeom.setAttribute('position', new THREE.Float32BufferAttribute(perimeterPoints, 3));
    const perimeterLine = new THREE.LineSegments(
      perimeterGeom,
      new THREE.LineBasicMaterial({ color: 0x44ff44 }),
    );
    this.gridGroup.add(perimeterLine);

    if (blockedPoints.length > 0) {
      const blockedGeom = new THREE.BufferGeometry();
      blockedGeom.setAttribute('position', new THREE.Float32BufferAttribute(blockedPoints, 3));
      const blockedLine = new THREE.LineSegments(
        blockedGeom,
        new THREE.LineBasicMaterial({ color: 0xff2222, opacity: 0.6, transparent: true }),
      );
      this.gridGroup.add(blockedLine);
    }
  }

  /** Inicjalizuje dynamiczne obiekty 3D dla ścieżek i celów postaci. */
  private buildPathsAndTargets() {
    const npcs = this.options.npcManager.npcs;
    const targetGeom = new THREE.ConeGeometry(0.25, 0.6, 6);
    targetGeom.rotateX(Math.PI); // stożek skierowany w dół jak pinezka

    npcs.forEach((npc, index) => {
      const color = NPC_COLORS[index % NPC_COLORS.length];

      // Linia ścieżki
      const lineGeom = new THREE.BufferGeometry();
      const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
      this.pathLines.push(line);
      this.pathsGroup.add(line);

      // Marker celu
      const marker = new THREE.Mesh(targetGeom, new THREE.MeshBasicMaterial({ color }));
      marker.position.set(0, 0.5, 0);
      this.targetMarkers.push(marker);
      this.targetsGroup.add(marker);
    });
  }

  /** Konfiguruje kontener DOM i panele informacyjne. */
  private setupDOM(customContainer?: HTMLElement) {
    if (typeof document === 'undefined') return;

    this.domContainer = document.createElement('div');
    this.domContainer.id = 'npc-debug-overlay';
    this.domContainer.style.cssText =
      'position: fixed; inset: 0; pointer-events: none; z-index: 9999; font-family: monospace; display: none;';

    // Kontener na etykiety nad postaciami
    this.labelsContainer = document.createElement('div');
    this.labelsContainer.id = 'npc-debug-labels';
    this.labelsContainer.style.cssText = 'position: absolute; inset: 0; pointer-events: none;';
    this.domContainer.appendChild(this.labelsContainer);

    // Etykieta dla każdego NPC
    this.options.npcManager.npcs.forEach((npc) => {
      const el = document.createElement('div');
      el.className = 'npc-debug-label';
      el.style.cssText =
        'position: absolute; transform: translate(-50%, -100%); background: rgba(10, 15, 20, 0.82); ' +
        'color: #e0f0ff; padding: 4px 8px; border-radius: 4px; font-size: 11px; line-height: 1.35; ' +
        'border: 1px solid #3399cc; pointer-events: none; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.5);';
      this.labelsContainer?.appendChild(el);
      this.labelElements.set(npc.name, el);
    });

    // Panel telemetryczny
    this.metricsContainer = document.createElement('div');
    this.metricsContainer.id = 'npc-debug-metrics';
    this.metricsContainer.style.cssText =
      'position: absolute; top: 12px; right: 12px; background: rgba(8, 12, 18, 0.88); color: #00ffcc; ' +
      'padding: 10px 14px; border-radius: 6px; font-size: 12px; line-height: 1.4; border: 1px solid #00ccaa; ' +
      'box-shadow: 0 4px 14px rgba(0,0,0,0.6); pointer-events: auto; max-width: 380px;';
    this.domContainer.appendChild(this.metricsContainer);

    const parent = customContainer ?? document.body;
    parent.appendChild(this.domContainer);
  }

  /** Nasłuchuje klawisza F2 lub Digit9 do przełączania overlayu. */
  private setupKeyboard() {
    if (typeof window === 'undefined') return;
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.toggle('all');
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Zwraca zagregowane metryki diagnostyczne ze wszystkich agentów NPC.
   */
  getMetricsSummary(): NpcDebugMetricsSummary {
    const npcs = this.options.npcManager.npcs;
    let totalRepaths = 0;
    let totalStateTransitions = 0;
    let totalRecoveries = 0;

    const details = npcs.map((npc) => {
      const diag = npc.animator?.getDiagnostics();
      totalRepaths += npc.watchdog.repathCount;
      totalStateTransitions += npc.watchdog.stateTransitionCount;
      totalRecoveries += npc.watchdog.recoveryCount;

      return {
        name: npc.name,
        state: npc.behavior.state,
        clip: diag?.currentClip ?? 'None',
        speed: npc.speed,
        timeWithoutProgress: npc.watchdog.timeWithoutProgress,
        repaths: npc.watchdog.repathCount,
        stateTransitions: npc.watchdog.stateTransitionCount,
        recoveries: npc.watchdog.recoveryCount,
      };
    });

    return {
      totalRepaths,
      totalStateTransitions,
      totalRecoveries,
      npcs: details,
    };
  }

  /** Formatuje treść etykiety nad pojedynczym NPC. */
  formatLabelContent(npc: Npc): string {
    const diag = npc.animator?.getDiagnostics();
    const clip = diag?.currentClip ?? 'None';
    const normTime = diag?.normalizedTime?.toFixed(2) ?? '0.00';
    const speed = npc.speed.toFixed(2);
    const stuck = npc.watchdog.timeWithoutProgress.toFixed(1);

    return (
      `<strong>${npc.name}</strong> [${npc.behavior.state}]<br/>` +
      `Klip: <em>${clip}</em> (${normTime})<br/>` +
      `Prędkość: ${speed} m/s | Utknięcie: ${stuck}s<br/>` +
      `Recovery: #${npc.watchdog.recoveryCount} (Repath: ${npc.watchdog.repathCount})`
    );
  }

  /**
   * Aktualizuje pozycje ścieżek, znaczników celów oraz etykiet 2D w rzucie kamery.
   */
  update(camera?: THREE.Camera) {
    if (!this.visible) return;

    const npcs = this.options.npcManager.npcs;
    const width = typeof window !== 'undefined' ? window.innerWidth : 800;
    const height = typeof window !== 'undefined' ? window.innerHeight : 600;

    // 1. Aktualizacja linii ścieżek i celów
    npcs.forEach((npc, index) => {
      const pathLine = this.pathLines[index];
      const targetMarker = this.targetMarkers[index];

      if (pathLine && this.showPaths) {
        const points: THREE.Vector3[] = [npc.root.position.clone().add(new THREE.Vector3(0, 0.15, 0))];
        if (npc.waypoints.length > 0) {
          npc.waypoints.forEach((wp) => points.push(wp.clone().add(new THREE.Vector3(0, 0.15, 0))));
        } else if (npc.target) {
          points.push(npc.target.clone().add(new THREE.Vector3(0, 0.15, 0)));
        }
        pathLine.geometry.dispose();
        pathLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
        pathLine.visible = true;
      } else if (pathLine) {
        pathLine.visible = false;
      }

      if (targetMarker && this.showTargets) {
        targetMarker.position.copy(npc.target).setY(0.6);
        targetMarker.visible = !npc.stationary;
      } else if (targetMarker) {
        targetMarker.visible = false;
      }

      // 2. Aktualizacja etykiet 2D
      const labelEl = this.labelElements.get(npc.name);
      if (labelEl && this.showLabels && camera) {
        // Pozycja nad głową postaci (+2.65 m)
        const worldPos = npc.root.position.clone().setY(npc.root.position.y + 2.65);
        const projected = worldPos.project(camera);

        // Sprawdź czy punkt jest przed kamerą (projected.z < 1)
        if (projected.z < 1) {
          const screenX = ((projected.x + 1) * width) / 2;
          const screenY = ((-projected.y + 1) * height) / 2;
          labelEl.style.left = `${screenX.toFixed(0)}px`;
          labelEl.style.top = `${screenY.toFixed(0)}px`;
          labelEl.style.display = 'block';
          labelEl.innerHTML = this.formatLabelContent(npc);
        } else {
          labelEl.style.display = 'none';
        }
      } else if (labelEl) {
        labelEl.style.display = 'none';
      }
    });

    // 3. Aktualizacja panelu telemetrycznego
    if (this.metricsContainer && this.showMetrics) {
      const summary = this.getMetricsSummary();
      let html =
        `<strong>NPC AI TELEMETRY [F2]</strong><br/>` +
        `Repaths: <strong>${summary.totalRepaths}</strong> | ` +
        `Transitions: <strong>${summary.totalStateTransitions}</strong> | ` +
        `Recoveries: <strong>${summary.totalRecoveries}</strong><hr style="border:0;border-top:1px solid #00aa88;margin:6px 0;"/>`;

      summary.npcs.forEach((n) => {
        const warn = n.timeWithoutProgress > 1.0 ? 'color:#ff5566;' : '';
        html +=
          `<div style="font-size:11px;margin-bottom:2px;${warn}">` +
          `<strong>${n.name}</strong>: ${n.state} (${n.clip}) ` +
          `v=${n.speed.toFixed(1)}m/s ` +
          `stuck=${n.timeWithoutProgress.toFixed(1)}s ` +
          `rec=#${n.recoveries}` +
          `</div>`;
      });
      this.metricsContainer.innerHTML = html;
    }
  }

  /** Zwalnia obiekty Three.js i elementy DOM. */
  dispose() {
    this.setVisible(false);

    if (this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
    }

    if (this.domContainer && this.domContainer.parentElement) {
      this.domContainer.parentElement.removeChild(this.domContainer);
    }

    this.pathLines.forEach((l) => {
      l.geometry.dispose();
      (l.material as THREE.Material).dispose();
    });
    this.targetMarkers.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });

    this.collidersGroup.traverse((obj) => {
      const line = obj as THREE.LineSegments | THREE.Line;
      if (line.geometry) line.geometry.dispose();
      if (line.material) {
        if (Array.isArray(line.material)) line.material.forEach((m) => m.dispose());
        else line.material.dispose();
      }
    });

    this.gridGroup.traverse((obj) => {
      const line = obj as THREE.LineSegments | THREE.Line;
      if (line.geometry) line.geometry.dispose();
      if (line.material) {
        if (Array.isArray(line.material)) line.material.forEach((m) => m.dispose());
        else line.material.dispose();
      }
    });

    this.rootGroup.removeFromParent();
    this.labelElements.clear();
  }
}
