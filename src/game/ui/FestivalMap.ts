/**
 * FestivalMap — Interaktywny 2D HUD mapy festiwalu Pol'and'Rock (Czaplinek-Broczyno)
 * Wyświetla cały teren: Obóz #KurwaMojePole, Pasaże Gastro, Dużą Scenę z barierkami,
 * Namiot ASP, obozy, Pole Słoneczników oraz pozycje graczy.
 */

export interface MapLandmark {
  id: string;
  label: string;
  x: number;
  z: number;
  type: 'camp' | 'stage' | 'gastro' | 'asp' | 'sunflowers' | 'shop' | 'flanki' | 'guitar' | 'recycling';
  icon?: string;
  width?: number;
  depth?: number;
}

export interface RemotePlayerMarker {
  id: string;
  name: string;
  x: number;
  z: number;
  y?: number;
  yaw?: number;
  isSpeaking?: boolean;
}

export interface PlayerMapState {
  x: number;
  z: number;
  yaw: number;
  dirX?: number;
  dirZ?: number;
}

/** Oblicza kąt widzenia postaci na 2D Canvas (0 = wschód/+X/prawo, -PI/2 = północ/-Z/góra, +PI/2 = południe/+Z/dół, PI = zachód/-X/lewo) */
export function calculatePlayerLookAngle(yaw: number, dirX?: number, dirZ?: number): number {
  if (typeof dirX === 'number' && typeof dirZ === 'number' && (dirX !== 0 || dirZ !== 0)) {
    return Math.atan2(dirZ, dirX);
  }
  // W Three.js: yaw = 0 wskazuje -Z (północ). Obrót wokół osi Y ('YXZ') daje wektor:
  // forward vector: dx = -sin(yaw), dz = -cos(yaw).
  // Na Canvasie 2D: dx rośnie w prawo (+X), dz rośnie w dół (+Z).
  const dx = -Math.sin(yaw);
  const dz = -Math.cos(yaw);
  return Math.atan2(dz, dx);
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapScenery {
  id: string;
  category: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  points?: { x: number; z: number }[];
}

export interface TentMarker {
  x: number;
  z: number;
  label: string;
}

export interface CanMapMarker {
  kind?: 'speed' | 'bundle' | 'trash';
  id: string;
  x: number;
  z: number;
  isGolden?: boolean;
}

/** Oblicza kierunek geograficzny w układzie współrzędnych gry (+X wschód, -X zachód, -Z północ, +Z południe) */
export function calculateBearingText(fromX: number, fromZ: number, toX: number, toZ: number): string {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  // Kąt 0 = północ (-Z), Pi/2 = wschód (+X)
  const angle = Math.atan2(dx, -dz);
  const deg = ((angle * 180) / Math.PI + 360) % 360;

  if (deg >= 337.5 || deg < 22.5) return 'północ (N)';
  if (deg >= 22.5 && deg < 67.5) return 'północny-wschód (NE)';
  if (deg >= 67.5 && deg < 112.5) return 'wschód (E)';
  if (deg >= 112.5 && deg < 157.5) return 'południowy-wschód (SE)';
  if (deg >= 157.5 && deg < 202.5) return 'południe (S)';
  if (deg >= 202.5 && deg < 247.5) return 'południowy-zachód (SW)';
  if (deg >= 247.5 && deg < 292.5) return 'zachód (W)';
  return 'północny-zachód (NW)';
}

export const FESTIVAL_MAP_BOUNDS: MapBounds = {
  minX: -160,
  maxX: 280,
  minZ: -160,
  maxZ: 160,
};

export const FESTIVAL_MAP_LANDMARKS: readonly MapLandmark[] = [
  {
    id: 'camp',
    label: 'Obóz #KurwaMojePole',
    x: 0,
    z: 0,
    type: 'camp',
    icon: '⛺',
    width: 28,
    depth: 28,
  },
  {
    id: 'flanki',
    label: 'Boisko Flanki',
    x: 0,
    z: -26,
    type: 'flanki',
    icon: '🍺',
  },
  {
    id: 'guitar_campfire',
    label: 'Gitara przy Ognisku',
    x: 4.85,
    z: -2.4,
    type: 'guitar',
    icon: '🎸',
  },
  {
    id: 'recycling_corral',
    label: 'Eko-Zagroda / Eko-Rush',
    x: 0,
    z: 16,
    type: 'recycling',
    icon: '♻️',
  },
  {
    id: 'main_stage',
    label: 'Duża Scena',
    x: 216,
    z: 18,
    type: 'stage',
    icon: '🎸',
    width: 80,
    depth: 44,
  },
  {
    id: 'foh',
    label: 'Reżyserka FOH',
    x: 140,
    z: 18,
    type: 'stage',
    icon: '🎛️',
    width: 14,
    depth: 10,
  },
  {
    id: 'asp',
    label: 'ASP (Akademia Sztuk Przepięknych)',
    x: -65,
    z: 97,
    type: 'asp',
    icon: '🎪',
    width: 38,
    depth: 54,
  },
  {
    id: 'lidl',
    label: 'Lidl Rock Shop',
    x: -115,
    z: 88,
    type: 'shop',
    icon: '🛒',
    width: 24,
    depth: 18,
  },
  {
    id: 'sunflowers',
    label: 'Pole Słoneczników',
    x: 76,
    z: 93,
    type: 'sunflowers',
    icon: '🌻',
    width: 64,
    depth: 26,
  },
  {
    id: 'gastro_pomorze',
    label: 'Strefa Pomorze Zachodnie',
    x: -122,
    z: -44,
    type: 'gastro',
    icon: '🍔',
    width: 17,
    depth: 7,
  },
  {
    id: 'gastro_redbull',
    label: 'Strefa Red Bull',
    x: -47,
    z: -46,
    type: 'gastro',
    icon: '⚡',
    width: 12,
    depth: 10,
  },
  {
    id: 'gastro_iqos',
    label: 'Pasaż Gastro Wschód',
    x: 94,
    z: -44,
    type: 'gastro',
    icon: '🍟',
    width: 10,
    depth: 6,
  },
] as const;

export class FestivalMap {
  private topView: HTMLImageElement | null = null;
  private topViewBounds: MapBounds | null = null;
  private referenceRequest?: Promise<void>;

  /** Small exported Blender reference, also available before the world is loaded. */
  loadBlenderReference(): Promise<void> {
    return (this.referenceRequest ??= (async () => {
      const base = `${import.meta.env.BASE_URL}game-assets/world/festival/`;
      const response = await fetch(`${base}map-layout.json`);
      if (!response.ok) throw new Error('Brak aktualnego rzutu mapy z Blendera');
      const data = (await response.json()) as { bounds: MapBounds; scenery: MapScenery[] };
      const image = new Image();
      image.src = `${base}map-top.png`;
      await image.decode();
      this.topView = image;
      this.topViewBounds = data.bounds;
      if (!this.scenery.length) this.setAuthoredLayout(data.scenery);
      this.bounds = { ...data.bounds };
      this.requestRedraw();
    })());
  }
  private scenery: MapScenery[] = [];
  private landmarks: readonly MapLandmark[] = FESTIVAL_MAP_LANDMARKS;

  /** Footprints measured before static batching, matching edited Blender placements. */
  setAuthoredLayout(scenery: MapScenery[]): void {
    this.scenery = scenery.map((item) => ({ ...item }));
    const aliases: Record<string, string> = {
      main_stage: 'Main_Stage_Deck_Plinth',
      asp: 'smallStage',
      camp: 'CampFlag',
      sunflowers: 'Sunflower_bed',
      lidl: 'Lidl',
      foh: 'foh_tower_main',
      gastro_pomorze: 'pomorze',
      gastro_redbull: 'redBull_1',
      gastro_iqos: 'iqos',
    };
    this.landmarks = FESTIVAL_MAP_LANDMARKS.flatMap((lm) => {
      const item = scenery.find(
        (s) => s.id === aliases[lm.id] || (lm.id === 'main_stage' && s.id === 'mainStage'),
      );
      return item
        ? [{ ...lm, x: item.x, z: item.z, width: item.width, depth: item.depth }]
        : aliases[lm.id]
          ? []
          : [lm]; // Never label a deleted/missing model at its old TS coordinates.
    });
    const wheel = scenery.find((item) => item.id === 'AllegroWheel');
    if (wheel)
      this.landmarks = [
        ...this.landmarks,
        {
          id: 'allegro_wheel',
          label: 'Młyn Allegro',
          type: 'shop',
          icon: '🎡',
          x: wheel.x,
          z: wheel.z,
          width: wheel.width,
          depth: wheel.depth,
        },
      ];
    const siema = scenery.find((item) => item.id === 'Market_1');
    if (siema)
      this.landmarks = [
        ...this.landmarks,
        {
          id: 'siema_shop',
          label: 'Siema Shop',
          type: 'shop',
          icon: '🛍️',
          x: siema.x,
          z: siema.z,
        },
      ];
    for (const group of [
      {
        id: 'food_south',
        label: 'Jedzenie — przy słonecznikach',
        matches: (id: string) => /^food_tent_south_|^foodtruck_.*_south$/.test(id),
      },
      {
        id: 'food_pomorze',
        label: 'Jedzenie — naprzeciw Pomorza',
        matches: (id: string) =>
          ['food_tent_north_2', 'foodtruck_churros_north', 'foodtruck_makarun_north'].includes(id),
      },
    ]) {
      const items = scenery.filter((item) => group.matches(item.id));
      if (!items.length) continue;
      const minX = Math.min(...items.map((s) => s.x - s.width / 2)),
        maxX = Math.max(...items.map((s) => s.x + s.width / 2));
      const minZ = Math.min(...items.map((s) => s.z - s.depth / 2)),
        maxZ = Math.max(...items.map((s) => s.z + s.depth / 2));
      this.landmarks = [
        ...this.landmarks,
        {
          id: group.id,
          label: group.label,
          type: 'gastro',
          icon: '🍔',
          x: (minX + maxX) / 2,
          z: (minZ + maxZ) / 2,
        },
      ];
    }
    this.bounds = { ...FESTIVAL_MAP_BOUNDS };
    for (const item of scenery) {
      this.bounds.minX = Math.min(this.bounds.minX, item.x - item.width / 2 - 12);
      this.bounds.maxX = Math.max(this.bounds.maxX, item.x + item.width / 2 + 12);
      this.bounds.minZ = Math.min(this.bounds.minZ, item.z - item.depth / 2 - 12);
      this.bounds.maxZ = Math.max(this.bounds.maxZ, item.z + item.depth / 2 + 12);
    }
    if (this.topViewBounds) this.bounds = { ...this.topViewBounds };
    this.resetView();
  }
  private static readonly STORAGE_KEY = 'festival_my_tent_marker';
  getLandmarks(): readonly MapLandmark[] {
    return this.landmarks.map((item) => ({ ...item }));
  }
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private padding = 40;
  private bounds = FESTIVAL_MAP_BOUNDS;
  private tentMarker: TentMarker = { x: 0, z: 0, label: 'Mój Namiot' };

  private zoom = 1.0;
  private readonly minZoom = 1.0;
  private readonly maxZoom = 4.5;
  private panOffset = { x: 0, z: 0 };
  private isDragging = false;
  private dragStart = { screenX: 0, screenY: 0, panX: 0, panZ: 0 };
  private lastRenderArgs?: {
    player: PlayerMapState;
    remotePlayers: RemotePlayerMarker[];
    timestamp: number;
    canMarkers: CanMapMarker[];
  };

  constructor(canvas?: HTMLCanvasElement | null) {
    this.loadTentMarker();
    if (canvas) {
      this.attachCanvas(canvas);
    }
  }

  /** Zwraca aktualny poziom powiększenia (1.0 = cały festiwal, do 4.5) */
  getZoom(): number {
    return this.zoom;
  }

  /** Zwraca aktualne przesunięcie środka widoku mapy */
  getPanOffset(): { x: number; z: number } {
    return { ...this.panOffset };
  }

  /** Zwraca aktualny znacznik namiotu */
  getTentMarker(): TentMarker {
    return { ...this.tentMarker };
  }

  /** Ustawia i zapisuje znacznik namiotu gracza */
  setTentMarker(x: number, z: number, label = 'Mój Namiot'): void {
    // Ograniczamy do granic mapy
    const clampedX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, x));
    const clampedZ = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, z));
    this.tentMarker = { x: clampedX, z: clampedZ, label };
    this.saveTentMarker();
  }

  /** Resetuje znacznik namiotu do domyślnego głównego obozu (0, 0) */
  resetTentMarker(): void {
    this.tentMarker = { x: 0, z: 0, label: 'Główny Obóz' };
    this.saveTentMarker();
  }

  private loadTentMarker(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(FestivalMap.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (
            typeof parsed?.x === 'number' &&
            typeof parsed?.z === 'number' &&
            !Number.isNaN(parsed.x) &&
            !Number.isNaN(parsed.z)
          ) {
            this.tentMarker = {
              x: parsed.x,
              z: parsed.z,
              label: typeof parsed.label === 'string' ? parsed.label : 'Mój Namiot',
            };
          }
        }
      }
    } catch {
      // Ignorujemy błędy parsowania lub prywatnego trybu przeglądarki
    }
  }

  private saveTentMarker(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(FestivalMap.STORAGE_KEY, JSON.stringify(this.tentMarker));
      }
    } catch {
      // Bezpieczny fallback w przypadku odmowy zapisu w localStorage
    }
  }

  /**
   * Zwraca aktualny widoczny wycinek mapy (minX, maxX, minZ, maxZ)
   * uwzględniający powiększenie (zoom) oraz przesunięcie (panOffset).
   */
  getViewBounds(): MapBounds {
    const defaultSpanX = this.bounds.maxX - this.bounds.minX;
    const defaultSpanZ = this.bounds.maxZ - this.bounds.minZ;
    const defaultCenterX = (this.bounds.minX + this.bounds.maxX) / 2;
    const defaultCenterZ = (this.bounds.minZ + this.bounds.maxZ) / 2;

    const visibleSpanX = defaultSpanX / this.zoom;
    const visibleSpanZ = defaultSpanZ / this.zoom;

    const maxOffsetRangeX = Math.max(0, (defaultSpanX - visibleSpanX) / 2);
    const maxOffsetRangeZ = Math.max(0, (defaultSpanZ - visibleSpanZ) / 2);

    const clampedOffsetX = Math.max(-maxOffsetRangeX, Math.min(maxOffsetRangeX, this.panOffset.x));
    const clampedOffsetZ = Math.max(-maxOffsetRangeZ, Math.min(maxOffsetRangeZ, this.panOffset.z));

    const viewCenterX = defaultCenterX + clampedOffsetX;
    const viewCenterZ = defaultCenterZ + clampedOffsetZ;

    return {
      minX: viewCenterX - visibleSpanX / 2,
      maxX: viewCenterX + visibleSpanX / 2,
      minZ: viewCenterZ - visibleSpanZ / 2,
      maxZ: viewCenterZ + visibleSpanZ / 2,
    };
  }

  /**
   * Ustawia poziom powiększenia i opcjonalnie współrzędne środka w świecie.
   */
  setZoom(zoom: number, centerX?: number, centerZ?: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    if (this.zoom <= 1.0) {
      this.panOffset = { x: 0, z: 0 };
    } else if (centerX !== undefined && centerZ !== undefined) {
      const defaultCenterX = (this.bounds.minX + this.bounds.maxX) / 2;
      const defaultCenterZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
      this.panOffset.x = centerX - defaultCenterX;
      this.panOffset.z = centerZ - defaultCenterZ;
    }
    this.requestRedraw();
  }

  /** Zwiększa powiększenie mapy (zoom in) */
  zoomIn(factor = 1.25): void {
    if (!this.canvas) {
      this.setZoom(this.zoom * factor);
      return;
    }
    this.zoomAt(this.canvas.width / 2, this.canvas.height / 2, factor);
  }

  /** Zmniejsza powiększenie mapy (zoom out) */
  zoomOut(factor = 0.8): void {
    if (!this.canvas) {
      this.setZoom(this.zoom * factor);
      return;
    }
    this.zoomAt(this.canvas.width / 2, this.canvas.height / 2, factor);
  }

  /** Resetuje widok mapy do pełnego terenu 100% */
  resetView(): void {
    this.zoom = 1.0;
    this.panOffset = { x: 0, z: 0 };
    this.requestRedraw();
  }

  /** Wycentrowuje widok na pozycji gracza z odpowiednim powiększeniem */
  centerOnPlayer(playerX: number, playerZ: number): void {
    const defaultCenterX = (this.bounds.minX + this.bounds.maxX) / 2;
    const defaultCenterZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
    if (this.zoom <= 1.1) {
      this.zoom = 2.0;
    }
    this.panOffset.x = playerX - defaultCenterX;
    this.panOffset.z = playerZ - defaultCenterZ;
    this.requestRedraw();
  }

  /**
   * Zmienia powiększenie mapy względem punktu pod kursorem na Canvasie (zoom towards cursor).
   */
  zoomAt(canvasX: number, canvasY: number, factor: number): void {
    const oldZoom = this.zoom;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * factor));
    if (newZoom === oldZoom) return;

    const w = this.canvas?.width ?? 800;
    const h = this.canvas?.height ?? 800;
    const worldUnderCursor = this.canvasToWorld(canvasX, canvasY, w, h);

    const defaultSpanX = this.bounds.maxX - this.bounds.minX;
    const defaultSpanZ = this.bounds.maxZ - this.bounds.minZ;
    const defaultCenterX = (this.bounds.minX + this.bounds.maxX) / 2;
    const defaultCenterZ = (this.bounds.minZ + this.bounds.maxZ) / 2;

    const projection = this.projection(w, h);
    const normX = (canvasX - projection.left) / projection.width;
    const normZ = (canvasY - projection.top) / projection.height;

    this.zoom = newZoom;
    if (newZoom <= 1.0) {
      this.panOffset = { x: 0, z: 0 };
    } else {
      const newSpanX = defaultSpanX / newZoom;
      const newSpanZ = defaultSpanZ / newZoom;
      this.panOffset.x = worldUnderCursor.x - defaultCenterX - (normX - 0.5) * newSpanX;
      this.panOffset.z = worldUnderCursor.z - defaultCenterZ - (normZ - 0.5) * newSpanZ;
    }
    this.requestRedraw();
  }

  private requestRedraw(): void {
    if (this.lastRenderArgs) {
      this.render(
        this.lastRenderArgs.player,
        this.lastRenderArgs.remotePlayers,
        this.lastRenderArgs.timestamp,
        this.lastRenderArgs.canMarkers,
      );
    }
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (canvas.style) canvas.style.cursor = 'grab';

    // 1. Zoom na kółku myszy (Scroll Wheel):
    canvas.onwheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect
        ? canvas.getBoundingClientRect()
        : { width: canvas.width, height: canvas.height, left: 0, top: 0 };
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      this.zoomAt(canvasX, canvasY, factor);
    };

    // 2. Przeciąganie mapy (Pan/Drag); kliknięcie nie zmienia celu namiotu.
    canvas.onpointerdown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      this.dragStart = {
        screenX: e.clientX,
        screenY: e.clientY,
        panX: this.panOffset.x,
        panZ: this.panOffset.z,
      };
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch {}
      if (canvas.style) canvas.style.cursor = 'grabbing';
    };

    canvas.onpointermove = (e: PointerEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStart.screenX;
      const dy = e.clientY - this.dragStart.screenY;
      if (Math.hypot(dx, dy) > 4) {
        const rect = canvas.getBoundingClientRect
          ? canvas.getBoundingClientRect()
          : { width: canvas.width, height: canvas.height, left: 0, top: 0 };
        if (rect.width <= 0 || rect.height <= 0) return;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const canvasDx = dx * scaleX;
        const canvasDy = dy * scaleY;

        const projection = this.projection(canvas.width, canvas.height);
        const worldDx = canvasDx / projection.scale;
        const worldDz = canvasDy / projection.scale;

        this.panOffset.x = this.dragStart.panX - worldDx;
        this.panOffset.z = this.dragStart.panZ - worldDz;
        this.requestRedraw();
      }
    };

    const finishPointer = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (canvas.style) canvas.style.cursor = 'grab';
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {}
    };

    canvas.onpointerup = finishPointer;
    canvas.onpointercancel = finishPointer;
  }

  /**
   * Konwertuje współrzędne ze świata 3D (x, z) na piksele Canvas (px, py)
   * z uwzględnieniem bieżącego powiększenia i przesunięcia.
   */
  worldToCanvas(
    worldX: number,
    worldZ: number,
    width = this.canvas?.width ?? 800,
    height = this.canvas?.height ?? 800,
  ): { x: number; y: number } {
    const view = this.getViewBounds();
    const p = this.projection(width, height);
    return {
      x: p.left + (worldX - view.minX) * p.scale,
      y: p.top + (worldZ - view.minZ) * p.scale,
    };
  }

  private projection(width: number, height: number) {
    const view = this.getViewBounds();
    const scale = Math.min(
      (width - 2 * this.padding) / (view.maxX - view.minX),
      (height - 2 * this.padding) / (view.maxZ - view.minZ),
    );
    const w = (view.maxX - view.minX) * scale,
      h = (view.maxZ - view.minZ) * scale;
    return { scale, width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 };
  }

  /**
   * Odwrotna transformacja: z pikseli Canvas na współrzędne świata 3D
   * z uwzględnieniem bieżącego powiększenia i przesunięcia.
   */
  canvasToWorld(
    canvasX: number,
    canvasY: number,
    width = this.canvas?.width ?? 800,
    height = this.canvas?.height ?? 800,
  ): { x: number; z: number } {
    const view = this.getViewBounds();
    const p = this.projection(width, height);
    return {
      x: view.minX + (canvasX - p.left) / p.scale,
      z: view.minZ + (canvasY - p.top) / p.scale,
    };
  }

  /**
   * Rysuje całą mapę festiwalową na Canvasie.
   */
  render(
    player: PlayerMapState,
    remotePlayers: RemotePlayerMarker[] = [],
    timestamp = performance.now(),
    canMarkers: CanMapMarker[] = [],
  ): void {
    this.lastRenderArgs = { player, remotePlayers, timestamp, canMarkers };
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Tło mapy (stylizowany festiwalowy papier / ciemny motyw)
    ctx.fillStyle = '#172a28';
    ctx.fillRect(0, 0, w, h);
    if (this.referenceRequest && !this.topView && !this.scenery.length) {
      ctx.fillStyle = '#b2ff45';
      ctx.font = '18px monospace';
      ctx.fillText('Ładowanie rzutu festiwalu z Blendera…', 40, 60);
      return;
    }

    // 2. Siatka współrzędnych i subtelna tekstura terenu
    this.drawGridAndRunway(ctx, w, h);

    // 3. Rysowanie głównych stref i dróg
    this.drawFestivalZones(ctx, w, h);

    // 4. Punkty orientacyjne i etykiety
    this.drawLandmarks(ctx, w, h);

    // 4.6. Puszki do zbierania (Gra 5: Eko-Patrol / Czyste Pole)
    this.drawCanMarkers(ctx, canMarkers, w, h, timestamp);

    // 5. Zdalni gracze w sieci
    this.drawRemotePlayers(ctx, remotePlayers, w, h, timestamp);

    // 6. Gracz lokalny (pulsujący punkt + stożek patrzenia)
    this.drawPlayer(ctx, player, w, h, timestamp);

    // 7. Mini skala i współrzędne w narożniku
    this.drawHudOverlay(ctx, player, w, h, canMarkers);
  }

  private drawGridAndRunway(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.topView && this.topViewBounds) {
      const a = this.worldToCanvas(this.topViewBounds.minX, this.topViewBounds.minZ, w, h);
      const b = this.worldToCanvas(this.topViewBounds.maxX, this.topViewBounds.maxZ, w, h);
      ctx.drawImage(this.topView, a.x, a.y, b.x - a.x, b.y - a.y);
      return;
    }
    // Siatka
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridStep = 50;
    for (let x = Math.ceil(this.bounds.minX / gridStep) * gridStep; x <= this.bounds.maxX; x += gridStep) {
      const p1 = this.worldToCanvas(x, this.bounds.minZ, w, h);
      const p2 = this.worldToCanvas(x, this.bounds.maxZ, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let z = Math.ceil(this.bounds.minZ / gridStep) * gridStep; z <= this.bounds.maxZ; z += gridStep) {
      const p1 = this.worldToCanvas(this.bounds.minX, z, w, h);
      const p2 = this.worldToCanvas(this.bounds.maxX, z, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    if (this.scenery.length) {
      for (const item of this.scenery) {
        const a = this.worldToCanvas(item.x - item.width / 2, item.z - item.depth / 2, w, h);
        const b = this.worldToCanvas(item.x + item.width / 2, item.z + item.depth / 2, w, h);
        const road = item.category === 'Roads';
        ctx.fillStyle = road
          ? item.id.startsWith('Camp_path_')
            ? '#667b45'
            : '#88918f'
          : item.category === 'Camping'
            ? '#6b997f'
            : '#4d596e';
        if (item.points?.length) {
          ctx.beginPath();
          item.points.forEach((point, index) => {
            const p = this.worldToCanvas(point.x, point.z, w, h);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fill();
        } else ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        if (!road) {
          ctx.strokeStyle = 'rgba(178,255,69,.35)';
          ctx.lineWidth = 1;
          if (item.points?.length) ctx.stroke();
          else ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        }
      }
      return;
    }
    // Fallback for tests/previews without an authored world.
    const northStart = this.worldToCanvas(-150, -45, w, h);
    const northEnd = this.worldToCanvas(250, -45, w, h);
    ctx.strokeStyle = '#2b313d';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(northStart.x, northStart.y);
    ctx.lineTo(northEnd.x, northEnd.y);
    ctx.stroke();

    // 2. Pasaż Południowy (South Runway) — równoległy pas lotniska (Lidl, ASP, gastro, słoneczniki)
    const southStart = this.worldToCanvas(-140, 92, w, h);
    const southEnd = this.worldToCanvas(140, 92, w, h);
    ctx.strokeStyle = '#2b313d';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(southStart.x, southStart.y);
    ctx.lineTo(southEnd.x, southEnd.y);
    ctx.stroke();

    // Białe linie osiowe pasów (subtelne pasy lotniskowe)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(northStart.x, northStart.y);
    ctx.lineTo(northEnd.x, northEnd.y);
    ctx.moveTo(southStart.x, southStart.y);
    ctx.lineTo(southEnd.x, southEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawFestivalZones(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.topView) return; // The Blender reference already contains every zone.
    // Pole słoneczników (żółtawy obszar)
    const sf = this.landmarks.find((l) => l.id === 'sunflowers');
    if (sf && sf.width && sf.depth) {
      const pMin = this.worldToCanvas(sf.x - sf.width / 2, sf.z - sf.depth / 2, w, h);
      const pMax = this.worldToCanvas(sf.x + sf.width / 2, sf.z + sf.depth / 2, w, h);
      ctx.fillStyle = 'rgba(235, 185, 30, 0.2)';
      ctx.strokeStyle = 'rgba(235, 185, 30, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(pMin.x, pMin.y, pMax.x - pMin.x, pMax.y - pMin.y);
      ctx.strokeRect(pMin.x, pMin.y, pMax.x - pMin.x, pMax.y - pMin.y);
    }

    // Barierki Dużej Sceny i strefa pod sceną
    const stage = this.landmarks.find((l) => l.id === 'main_stage');
    if (stage && !this.scenery.length) {
      const stageP = this.worldToCanvas(stage.x, stage.z, w, h);
      ctx.strokeStyle = 'rgba(230, 60, 60, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(stageP.x - 30, stageP.y, 65, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();
    }
  }

  private drawLandmarks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const occupied: { x: number; y: number; width: number; height: number }[] = [];
    for (const lm of this.landmarks) {
      const p = this.worldToCanvas(lm.x, lm.z, w, h);

      // Kolor akcentu w zależności od typu
      let color = '#ffffff';
      let bgColor = 'rgba(255, 255, 255, 0.15)';
      switch (lm.type) {
        case 'camp':
          color = '#ffd152'; // złoty
          bgColor = 'rgba(255, 209, 82, 0.25)';
          break;
        case 'flanki':
          color = '#38bdf8'; // jasny błękit
          bgColor = 'rgba(56, 189, 248, 0.35)';
          break;
        case 'guitar':
          color = '#e879f9'; // fiolet
          bgColor = 'rgba(232, 121, 249, 0.35)';
          break;
        case 'recycling':
          color = '#4ade80'; // zieleń
          bgColor = 'rgba(74, 222, 128, 0.35)';
          break;
        case 'stage':
          color = '#ff4d4d'; // czerwony
          bgColor = 'rgba(255, 77, 77, 0.25)';
          break;
        case 'asp':
          color = '#9d65ff'; // fioletowy
          bgColor = 'rgba(157, 101, 255, 0.25)';
          break;
        case 'gastro':
        case 'shop':
          color = '#fb923c'; // pomarańczowy
          bgColor = 'rgba(251, 146, 60, 0.25)';
          break;
        case 'sunflowers':
          color = '#facc15';
          bgColor = 'rgba(250, 204, 21, 0.25)';
          break;
      }

      // Kształt prostokąta lub koła
      if (lm.width && lm.depth && !this.scenery.length) {
        const p1 = this.worldToCanvas(lm.x - lm.width / 2, lm.z - lm.depth / 2, w, h);
        const p2 = this.worldToCanvas(lm.x + lm.width / 2, lm.z + lm.depth / 2, w, h);
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      } else {
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Etykieta tekstowa z czytelnym tłem
      ctx.font = 'bold 11px system-ui, sans-serif';
      const labelText = lm.icon ? `${lm.icon} ${lm.label}` : lm.label;
      const textW = ctx.measureText ? ctx.measureText(labelText).width : labelText.length * 6;

      let textX = p.x;
      let textY = p.y - 12;
      let align: CanvasTextAlign = 'center';

      if (lm.id === 'camp' && lm.width && lm.depth) {
        const p1 = this.worldToCanvas(lm.x - lm.width / 2, lm.z - lm.depth / 2, w, h);
        textX = p1.x - 10;
        textY = p.y + 4;
        align = 'right';
      } else if (lm.id === 'flanki') {
        textX = p.x;
        textY = p.y - 14;
        align = 'center';
      } else if (lm.id === 'guitar_campfire') {
        textX = p.x + 14;
        textY = p.y + 4;
        align = 'left';
      } else if (lm.id === 'recycling_corral') {
        textX = p.x;
        textY = p.y + 20;
        align = 'center';
      } else if (lm.id === 'foh') {
        textX = p.x;
        textY = p.y + 18;
        align = 'center';
      } else if (lm.id === 'main_stage') {
        textX = p.x;
        textY = p.y - 28;
        align = 'center';
      } else if (lm.id === 'lidl') {
        textX = p.x;
        textY = p.y + 18;
        align = 'center';
      } else if (lm.id === 'asp') {
        textX = p.x;
        textY = p.y - 32;
        align = 'center';
      } else if (lm.id === 'sunflowers') {
        textX = p.x;
        textY = p.y + 22;
        align = 'center';
      } else if (lm.type === 'gastro') {
        textX = p.x;
        textY = p.y - 14;
        align = 'center';
      }

      // Tło pod napis dla maksymalnej czytelności bez zlewania
      ctx.fillStyle = 'rgba(12, 15, 22, 0.9)';
      const bgPadX = 6;
      const bgPadY = 3;
      let bgX = textX - bgPadX;
      if (align === 'center') {
        bgX = textX - textW / 2 - bgPadX;
      } else if (align === 'right') {
        bgX = textX - textW - bgPadX;
      }
      bgX = Math.max(4, Math.min(w - textW - bgPadX * 2 - 4, bgX));
      const textOffset =
        align === 'center' ? textW / 2 + bgPadX : align === 'right' ? textW + bgPadX : bgPadX;
      textX = bgX + textOffset;
      for (
        let tries = 0;
        tries < 20 &&
        occupied.some(
          (r) =>
            bgX < r.x + r.width && bgX + textW + 12 > r.x && textY - 14 < r.y + r.height && textY + 6 > r.y,
        );
        tries++
      )
        textY += 22;
      const bgY = Math.max(3, Math.min(h - 23, textY - 11 - bgPadY));
      textY = bgY + 14;
      occupied.push({ x: bgX, y: bgY, width: textW + 12, height: 20 });
      ctx.fillRect(bgX, bgY, textW + bgPadX * 2, 14 + bgPadY * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(bgX, bgY, textW + bgPadX * 2, 14 + bgPadY * 2);

      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(labelText, textX, textY);
    }
  }

  private drawRemotePlayers(
    ctx: CanvasRenderingContext2D,
    remotePlayers: RemotePlayerMarker[],
    w: number,
    h: number,
    timestamp: number,
  ): void {
    if (!remotePlayers || remotePlayers.length === 0) return;

    for (const rp of remotePlayers) {
      const p = this.worldToCanvas(rp.x, rp.z, w, h);

      // Pulsujący wskaźnik głosu, jeśli gracz mówi
      if (rp.isSpeaking) {
        const pulse = 12 + Math.sin(timestamp * 0.01) * 4;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Stożek widzenia innego gracza (jeśli znany jest yaw)
      if (typeof rp.yaw === 'number') {
        const angle = calculatePlayerLookAngle(rp.yaw);
        const fov = Math.PI / 4;
        ctx.fillStyle = rp.isSpeaking ? 'rgba(34, 197, 94, 0.25)' : 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, 20, angle - fov, angle + fov);
        ctx.closePath();
        ctx.fill();
      }

      // Pulsujący pierścień gracza
      const ring = 6.5 + Math.sin(timestamp * 0.005 + 1) * 1.5;
      ctx.strokeStyle = rp.isSpeaking ? '#22c55e' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ring, 0, Math.PI * 2);
      ctx.stroke();

      // Kropka gracza
      ctx.fillStyle = rp.isSpeaking ? '#22c55e' : '#0284c7';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Etykieta gracza z czytelnym tłem
      const displayName = `👤 ${rp.name || 'Gracz'}`;
      ctx.font = 'bold 10px system-ui, sans-serif';
      const textW = ctx.measureText ? ctx.measureText(displayName).width : displayName.length * 6;
      const textX = p.x;
      const textY = p.y - 12;

      ctx.fillStyle = 'rgba(10, 20, 35, 0.9)';
      ctx.fillRect(textX - textW / 2 - 5, textY - 10, textW + 10, 14);
      ctx.strokeStyle = rp.isSpeaking ? '#22c55e' : '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(textX - textW / 2 - 5, textY - 10, textW + 10, 14);

      ctx.fillStyle = rp.isSpeaking ? '#4ade80' : '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.fillText(displayName, textX, textY);
    }
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerMapState,
    w: number,
    h: number,
    timestamp: number,
  ): void {
    const p = this.worldToCanvas(player.x, player.z, w, h);

    // Stożek pola widzenia (FOV) - poprawny kąt wzroku w układzie Canvas 2D
    const coneLen = 32;
    const fovAngle = Math.PI / 4;
    const angle = calculatePlayerLookAngle(player.yaw, player.dirX, player.dirZ);

    ctx.save();
    const gradient = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, coneLen);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
    gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0.0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, coneLen, angle - fovAngle, angle + fovAngle);
    ctx.closePath();
    ctx.fill();

    // Wskaźnik osi wzroku (ostry promień)
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(angle) * (coneLen * 0.95), p.y + Math.sin(angle) * (coneLen * 0.95));
    ctx.stroke();
    ctx.restore();

    // Pulsujący pierścień gracza
    const ringRadius = 7 + Math.sin(timestamp * 0.005) * 2;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Centralna kropka
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Podpis z czytelnym tłem
    ctx.font = 'bold 11px system-ui, sans-serif';
    const label = '⭐ Ty';
    const textW = ctx.measureText ? ctx.measureText(label).width : 24;
    ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
    ctx.fillRect(p.x - textW / 2 - 4, p.y - 24, textW + 8, 14);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - textW / 2 - 4, p.y - 24, textW + 8, 14);

    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x, p.y - 13);
  }

  private drawCanMarkers(
    ctx: CanvasRenderingContext2D,
    canMarkers: CanMapMarker[],
    w: number,
    h: number,
    timestamp: number,
  ): void {
    if (!canMarkers || canMarkers.length === 0) return;

    for (const can of canMarkers) {
      const p = this.worldToCanvas(can.x, can.z, w, h);
      if (can.kind === 'speed' || can.kind === 'bundle') {
        ctx.fillStyle = can.kind === 'speed' ? '#b2ff45' : '#ffaa20';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#101810';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(can.kind === 'speed' ? 'S' : '3', p.x, p.y + 3);
        continue;
      }

      if (can.isGolden) {
        // Złota puszka – pulsujący złoty blask i aureola
        const pulse = 8 + Math.sin(timestamp * 0.008) * 3;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭐ Złota', p.x, p.y - 8);
      } else {
        // Standardowa puszka – czerwono-srebrny znacznik
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🥫', p.x, p.y - 6);
      }
    }
  }

  private drawHudOverlay(
    ctx: CanvasRenderingContext2D,
    player: PlayerMapState,
    w: number,
    h: number,
    canMarkers: CanMapMarker[] = [],
  ): void {
    const hudW = Math.min(w - 20, 620);
    const scaleStart = this.worldToCanvas(0, 0, w, h),
      scaleEnd = this.worldToCanvas(50, 0, w, h);
    const scaleWidth = scaleEnd.x - scaleStart.x;
    ctx.strokeStyle = '#b2ff45';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 25 - scaleWidth, h - 35);
    ctx.lineTo(w - 25, h - 35);
    ctx.stroke();
    ctx.fillStyle = '#b2ff45';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('50 m', w - 25, h - 42);
    const hudH = 50;
    ctx.fillStyle = 'rgba(10, 10, 18, 0.9)';
    ctx.fillRect(10, h - hudH - 10, hudW, hudH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, h - hudH - 10, hudW, hudH);

    ctx.fillStyle = '#9dff4e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Rzut festiwalu z góry', 20, h - hudH + 9);

    const zoomText = `🔍 ${(this.zoom * 100).toFixed(0)}%`;
    const canInfo = canMarkers.length > 0 ? ` | 🥫 Na polu: ${canMarkers.length}` : '';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px monospace';
    ctx.fillText(
      `Pozycja: X: ${player.x.toFixed(1)}m, Z: ${player.z.toFixed(1)}m${canInfo} | ${zoomText}`,
      20,
      h - hudH + 24,
    );

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText(`🖱️ Rolka myszy: powiększanie | Przeciągnij: przesuwanie mapy`, 20, h - hudH + 37);
  }
}
