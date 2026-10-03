/**
 * FestivalMap — Interaktywny 2D HUD mapy festiwalu Pol'and'Rock (Czaplinek-Broczyno)
 * Wyświetla cały teren: Obóz #KurwaMojePole, Pasaże Gastro, Dużą Scenę z barierkami,
 * Namiot ASP, Grzybek Wodny, Pole Słoneczników oraz pozycje graczy.
 */

export interface MapLandmark {
  id: string;
  label: string;
  x: number;
  z: number;
  type: 'camp' | 'stage' | 'gastro' | 'asp' | 'grzybek' | 'sunflowers' | 'shop';
  icon?: string;
  width?: number;
  depth?: number;
}

export interface RemotePlayerMarker {
  id: string;
  name: string;
  x: number;
  z: number;
  isSpeaking?: boolean;
}

export interface PlayerMapState {
  x: number;
  z: number;
  yaw: number;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TentMarker {
  x: number;
  z: number;
  label: string;
}

/** Oblicza kierunek geograficzny w układzie współrzędnych gry (+X wschód, -X zachód, -Z północ, +Z południe) */
export function calculateBearingText(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): string {
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
  minZ: -100,
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
    label: 'Namiot ASP (Akademia Sztuk Przepięknych)',
    x: -65,
    z: 97,
    type: 'asp',
    icon: '🎪',
    width: 38,
    depth: 54,
  },
  {
    id: 'grzybek',
    label: 'Grzybek Wodny',
    x: 160,
    z: -8,
    type: 'grzybek',
    icon: '💧',
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
  private static readonly STORAGE_KEY = 'festival_my_tent_marker';
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private padding = 40;
  private bounds = FESTIVAL_MAP_BOUNDS;
  private tentMarker: TentMarker = { x: 0, z: 0, label: 'Mój Namiot' };

  constructor(canvas?: HTMLCanvasElement | null) {
    this.loadTentMarker();
    if (canvas) {
      this.attachCanvas(canvas);
    }
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
        window.localStorage.setItem(
          FestivalMap.STORAGE_KEY,
          JSON.stringify(this.tentMarker),
        );
      }
    } catch {
      // Bezpieczny fallback w przypadku odmowy zapisu w localStorage
    }
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Obsługa kliknięcia lub dotknięcia na mapie do przestawienia znacznika własnego namiotu
    canvas.onclick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      const world = this.canvasToWorld(canvasX, canvasY);
      this.setTentMarker(world.x, world.z);
    };
  }

  /**
   * Konwertuje współrzędne ze świata 3D (x, z) na piksele Canvas (px, py).
   */
  worldToCanvas(
    worldX: number,
    worldZ: number,
    width = this.canvas?.width ?? 800,
    height = this.canvas?.height ?? 800,
  ): { x: number; y: number } {
    const usableW = width - 2 * this.padding;
    const usableH = height - 2 * this.padding;

    const spanX = this.bounds.maxX - this.bounds.minX;
    const spanZ = this.bounds.maxZ - this.bounds.minZ;

    const normX = (worldX - this.bounds.minX) / spanX;
    const normZ = (worldZ - this.bounds.minZ) / spanZ;

    return {
      x: this.padding + normX * usableW,
      y: this.padding + normZ * usableH,
    };
  }

  /**
   * Odwrotna transformacja: z pikseli Canvas na współrzędne świata 3D.
   */
  canvasToWorld(
    canvasX: number,
    canvasY: number,
    width = this.canvas?.width ?? 800,
    height = this.canvas?.height ?? 800,
  ): { x: number; z: number } {
    const usableW = width - 2 * this.padding;
    const usableH = height - 2 * this.padding;

    const normX = (canvasX - this.padding) / usableW;
    const normZ = (canvasY - this.padding) / usableH;

    const spanX = this.bounds.maxX - this.bounds.minX;
    const spanZ = this.bounds.maxZ - this.bounds.minZ;

    return {
      x: this.bounds.minX + normX * spanX,
      z: this.bounds.minZ + normZ * spanZ,
    };
  }

  /**
   * Rysuje całą mapę festiwalową na Canvasie.
   */
  render(
    player: PlayerMapState,
    remotePlayers: RemotePlayerMarker[] = [],
    timestamp = performance.now(),
  ): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Tło mapy (stylizowany festiwalowy papier / ciemny motyw)
    ctx.fillStyle = '#14181f';
    ctx.fillRect(0, 0, w, h);

    // 2. Siatka współrzędnych i subtelna tekstura terenu
    this.drawGridAndRunway(ctx, w, h);

    // 3. Rysowanie głównych stref i dróg
    this.drawFestivalZones(ctx, w, h);

    // 4. Punkty orientacyjne i etykiety
    this.drawLandmarks(ctx, w, h);

    // 4.5. Znacznik własnego namiotu gracza („Gdzie jest mój namiot?” - B8)
    this.drawTentMarker(ctx, player, w, h, timestamp);

    // 5. Zdalni gracze w sieci
    this.drawRemotePlayers(ctx, remotePlayers, w, h, timestamp);

    // 6. Gracz lokalny (pulsujący punkt + stożek patrzenia)
    this.drawPlayer(ctx, player, w, h, timestamp);

    // 7. Mini skala, kompas do namiotu i współrzędne w narożniku
    this.drawHudOverlay(ctx, player, w, h);
  }

  private drawGridAndRunway(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Siatka
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridStep = 50;
    for (let x = -150; x <= 250; x += gridStep) {
      const p1 = this.worldToCanvas(x, this.bounds.minZ, w, h);
      const p2 = this.worldToCanvas(x, this.bounds.maxZ, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let z = -100; z <= 150; z += gridStep) {
      const p1 = this.worldToCanvas(this.bounds.minX, z, w, h);
      const p2 = this.worldToCanvas(this.bounds.maxX, z, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Główny pas startowy / aleja festiwalowa (asfalt)
    const roadStart = this.worldToCanvas(-150, -45, w, h);
    const roadEnd = this.worldToCanvas(250, -45, w, h);
    ctx.strokeStyle = '#2b313d';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(roadStart.x, roadStart.y);
    ctx.lineTo(roadEnd.x, roadEnd.y);
    ctx.stroke();

    // Droga poprzeczna ku Dużej Scenie
    const stageRoadStart = this.worldToCanvas(150, -45, w, h);
    const stageRoadEnd = this.worldToCanvas(150, 60, w, h);
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(stageRoadStart.x, stageRoadStart.y);
    ctx.lineTo(stageRoadEnd.x, stageRoadEnd.y);
    ctx.stroke();
  }

  private drawFestivalZones(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Pole słoneczników (żółtawy obszar)
    const sf = FESTIVAL_MAP_LANDMARKS.find((l) => l.id === 'sunflowers');
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
    const stage = FESTIVAL_MAP_LANDMARKS.find((l) => l.id === 'main_stage');
    if (stage) {
      const stageP = this.worldToCanvas(stage.x, stage.z, w, h);
      ctx.strokeStyle = 'rgba(230, 60, 60, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(stageP.x - 30, stageP.y, 65, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();
    }
  }

  private drawLandmarks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const lm of FESTIVAL_MAP_LANDMARKS) {
      const p = this.worldToCanvas(lm.x, lm.z, w, h);

      // Kolor akcentu w zależności od typu
      let color = '#ffffff';
      let bgColor = 'rgba(255, 255, 255, 0.15)';
      switch (lm.type) {
        case 'camp':
          color = '#ffd152'; // złoty
          bgColor = 'rgba(255, 209, 82, 0.25)';
          break;
        case 'stage':
          color = '#ff4d4d'; // czerwony
          bgColor = 'rgba(255, 77, 77, 0.25)';
          break;
        case 'asp':
          color = '#9d65ff'; // fioletowy
          bgColor = 'rgba(157, 101, 255, 0.25)';
          break;
        case 'grzybek':
          color = '#38bdf8'; // błękitny
          bgColor = 'rgba(56, 189, 248, 0.25)';
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
      if (lm.width && lm.depth) {
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

      // Etykieta tekstowa
      ctx.fillStyle = color;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const labelText = lm.icon ? `${lm.icon} ${lm.label}` : lm.label;
      ctx.fillText(labelText, p.x, p.y - 10);
    }
  }

  private drawRemotePlayers(
    ctx: CanvasRenderingContext2D,
    remotePlayers: RemotePlayerMarker[],
    w: number,
    h: number,
    timestamp: number,
  ): void {
    for (const rp of remotePlayers) {
      const p = this.worldToCanvas(rp.x, rp.z, w, h);

      // Pulsujący wskaźnik głosu, jeśli gracz mówi
      if (rp.isSpeaking) {
        const pulse = 10 + Math.sin(timestamp * 0.01) * 3;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Kropka gracza
      ctx.fillStyle = rp.isSpeaking ? '#22c55e' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Imię nad graczem
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rp.name, p.x, p.y + 14);
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

    // Stożek pola widzenia (FOV)
    const coneLen = 28;
    const fovAngle = Math.PI / 4;
    // W Three.js kąt yaw: 0 wskazuje -Z, Math.PI/2 wskazuje +X
    // Na Canvasie: X rośnie w prawo (+X), Y rośnie w dół (+Z)
    // Kąt w płaszczyźnie X-Z: dx = sin(yaw), dz = cos(yaw)
    const angle = Math.atan2(Math.sin(player.yaw), -Math.cos(player.yaw));

    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, coneLen, angle - fovAngle, angle + fovAngle);
    ctx.closePath();
    ctx.fill();

    // Pulsujący pierścień gracza
    const ringRadius = 7 + Math.sin(timestamp * 0.005) * 2;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Centralna kropka
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Podpis
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ty', p.x, p.y - 12);
  }

  private drawTentMarker(
    ctx: CanvasRenderingContext2D,
    player: PlayerMapState,
    w: number,
    h: number,
    timestamp: number,
  ): void {
    const p = this.worldToCanvas(player.x, player.z, w, h);
    const t = this.worldToCanvas(this.tentMarker.x, this.tentMarker.z, w, h);

    // Linia prowadząca od gracza do namiotu (subtelna przerywana neonowo-żółta linia)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 230, 80, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.restore();

    // Pulsujący okrąg wokół namiotu
    const pulse = 10 + Math.sin(timestamp * 0.006) * 3;
    ctx.strokeStyle = 'rgba(157, 255, 78, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Centralny punkt namiotu
    ctx.fillStyle = '#9dff4e';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Ikona i etykieta namiotu z odległością
    const dist = Math.hypot(this.tentMarker.x - player.x, this.tentMarker.z - player.z);
    ctx.fillStyle = '#9dff4e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⛺ ${this.tentMarker.label} (${dist.toFixed(0)}m)`, t.x, t.y - 12);
  }

  private drawHudOverlay(
    ctx: CanvasRenderingContext2D,
    player: PlayerMapState,
    w: number,
    h: number,
  ): void {
    const dist = Math.hypot(this.tentMarker.x - player.x, this.tentMarker.z - player.z);
    const bearing = calculateBearingText(player.x, player.z, this.tentMarker.x, this.tentMarker.z);

    const hudW = Math.min(w - 20, 520);
    const hudH = 46;
    ctx.fillStyle = 'rgba(10, 10, 18, 0.85)';
    ctx.fillRect(10, h - hudH - 10, hudW, hudH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, h - hudH - 10, hudW, hudH);

    ctx.fillStyle = '#9dff4e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `⛺ Cel: ${this.tentMarker.label} — ${dist.toFixed(0)} m na ${bearing}`,
      20,
      h - hudH + 8,
    );

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px monospace';
    ctx.fillText(
      `Pozycja: X: ${player.x.toFixed(1)}m, Z: ${player.z.toFixed(1)}m | Kliknij na mapie, by zmienić cel`,
      20,
      h - 18,
    );
  }
}
