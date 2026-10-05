import { describe, expect, it, vi } from 'vitest';
import {
  FestivalMap,
  FESTIVAL_MAP_LANDMARKS,
  type PlayerMapState,
  type RemotePlayerMarker,
} from './FestivalMap';

describe('FestivalMap', () => {
  it('does not create or move a tent marker on click or pointer cancellation', () => {
    const map = new FestivalMap();
    const canvas = {
      width: 800,
      height: 600,
      style: {},
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    map.attachCanvas(canvas);
    const before = map.getTentMarker();
    const event = {
      button: 0,
      clientX: 200,
      clientY: 150,
      pointerId: 1,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent;
    canvas.onpointerdown!(event);
    canvas.onpointerup!(event);
    expect(map.getTentMarker()).toEqual(before);
    canvas.onpointerdown!(event);
    canvas.onpointercancel!(event);
    expect(map.getTentMarker()).toEqual(before);
  });
  it('labels Siema Shop and both food areas at their measured Blender positions', () => {
    const map = new FestivalMap();
    const item = (id: string, x: number, z: number) => ({
      id,
      x,
      z,
      width: 10,
      depth: 6,
      category: 'Infrastructure',
    });
    map.setAuthoredLayout([
      item('Market_1', 75, -50),
      item('food_tent_south_1', -22, 94),
      item('food_tent_south_2', 16, 94),
      item('food_tent_north_2', -114, -12),
    ]);
    const labels = map.getLandmarks();
    expect(labels.find((l) => l.id === 'siema_shop')).toMatchObject({ label: 'Siema Shop', x: 75, z: -50 });
    expect(labels.find((l) => l.id === 'food_south')).toMatchObject({ x: -3, z: 94 });
    expect(labels.find((l) => l.id === 'food_pomorze')).toMatchObject({ x: -114, z: -12 });
    map.setAuthoredLayout([]);
    expect(map.getLandmarks().some((l) => l.id === 'food_south')).toBe(false);
  });
  it('loads the Blender reference once and preserves its metric registration after runtime binding', async () => {
    const bounds = { minX: -170, maxX: 290, minZ: -172.5, maxZ: 172.5 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bounds,
        scenery: [{ id: 'Main_Stage_Deck_Plinth', category: 'Stages', x: 220, z: 20, width: 30, depth: 35 }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode() {
          return Promise.resolve();
        }
      },
    );
    try {
      const map = new FestivalMap();
      await Promise.all([map.loadBlenderReference(), map.loadBlenderReference()]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(map.getViewBounds()).toEqual(bounds);
      map.setAuthoredLayout([{ id: 'T01', category: 'Camping', x: 0, z: 0, width: 4, depth: 4 }]);
      expect(map.getViewBounds()).toEqual(bounds);
      const a = map.worldToCanvas(-170, -172.5, 800, 600),
        b = map.worldToCanvas(290, 172.5, 800, 600);
      expect((b.x - a.x) / (b.y - a.y)).toBeCloseTo(4 / 3, 8);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('uses the same metres-to-pixels scale on both axes at every zoom', () => {
    const map = new FestivalMap();
    for (const zoom of [1, 2.5, 4.5]) {
      map.setZoom(zoom, 30, 10);
      const a = map.worldToCanvas(0, 0, 1200, 450),
        b = map.worldToCanvas(20, 0, 1200, 450),
        c = map.worldToCanvas(0, 20, 1200, 450);
      expect(b.x - a.x).toBeCloseTo(c.y - a.y, 8);
    }
  });
  it('includes northern and manually moved camps in the authored overview', () => {
    const map = new FestivalMap();
    map.setAuthoredLayout([{ id: 'T01', category: 'Camping', x: -120, z: -190, width: 10, depth: 8 }]);
    expect(map.getViewBounds().minZ).toBeLessThan(-194);
    const point = map.worldToCanvas(-120, -190, 800, 600);
    expect(point.y).toBeGreaterThan(0);
    expect(point.y).toBeLessThan(600);
  });
  it('converts world coordinates to canvas coordinates within boundaries', () => {
    const map = new FestivalMap();
    const width = 800;
    const height = 800;

    // Obóz w (0, 0) powinien być mniej więcej pośrodku mapy
    const campPoint = map.worldToCanvas(0, 0, width, height);
    expect(campPoint.x).toBeGreaterThan(0);
    expect(campPoint.x).toBeLessThan(width);
    expect(campPoint.y).toBeGreaterThan(0);
    expect(campPoint.y).toBeLessThan(height);

    // Duża Scena (216, 18) jest na wschód od obozu (większy X)
    const stagePoint = map.worldToCanvas(216, 18, width, height);
    expect(stagePoint.x).toBeGreaterThan(campPoint.x);

    // Mała Scena ASP (-65, 97) jest na zachód i południe (mniejszy X, większy Z)
    const aspPoint = map.worldToCanvas(-65, 97, width, height);
    expect(aspPoint.x).toBeLessThan(campPoint.x);
    expect(aspPoint.y).toBeGreaterThan(campPoint.y);
  });

  it('accurately round-trips coordinates via canvasToWorld and worldToCanvas', () => {
    const map = new FestivalMap();
    const width = 800;
    const height = 600;

    const testPoints = [
      { x: 0, z: 0 },
      { x: 216, z: 18 },
      { x: -65, z: 97 },
      { x: 160, z: -8 },
      { x: 76, z: 93 },
    ];

    for (const pt of testPoints) {
      const canvasPt = map.worldToCanvas(pt.x, pt.z, width, height);
      const restored = map.canvasToWorld(canvasPt.x, canvasPt.y, width, height);
      expect(restored.x).toBeCloseTo(pt.x, 3);
      expect(restored.z).toBeCloseTo(pt.z, 3);
    }
  });

  it('contains all required festival landmark points', () => {
    const ids = FESTIVAL_MAP_LANDMARKS.map((l) => l.id);
    expect(ids).toContain('camp');
    expect(ids).toContain('main_stage');
    expect(ids).toContain('asp');
    expect(ids).not.toContain('grzybek');
    expect(ids).toContain('sunflowers');
    expect(ids).toContain('gastro_pomorze');
  });

  it('renders without error when canvas and 2D context are available', () => {
    const map = new FestivalMap();

    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      lineCap: '',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
    } as unknown as CanvasRenderingContext2D;

    const mockCanvas = {
      width: 800,
      height: 800,
      style: { cursor: '' },
      getContext: vi.fn().mockReturnValue(mockCtx),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 800, height: 800, left: 0, top: 0 }),
    } as unknown as HTMLCanvasElement;

    map.attachCanvas(mockCanvas);

    const player: PlayerMapState = { x: 5, z: -2, yaw: Math.PI / 4 };
    const remote: RemotePlayerMarker[] = [
      { id: 'p1', name: 'Kobra', x: 20, z: 10, isSpeaking: true },
      { id: 'p2', name: 'Peposz', x: -10, z: 5, isSpeaking: false },
    ];

    expect(() => map.render(player, remote, 1234)).not.toThrow();
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
    expect(
      vi.mocked(mockCtx.fillText).mock.calls.some((args) => String(args[0]).includes('Mój Namiot')),
    ).toBe(false);
  });

  it('correctly calculates cardinal directions (calculateBearingText)', async () => {
    const { calculateBearingText } = await import('./FestivalMap');
    // North is -Z
    expect(calculateBearingText(0, 0, 0, -50)).toContain('N');
    // East is +X
    expect(calculateBearingText(0, 0, 50, 0)).toContain('E');
    // South is +Z
    expect(calculateBearingText(0, 0, 0, 50)).toContain('S');
    // West is -X
    expect(calculateBearingText(0, 0, -50, 0)).toContain('W');
    // Northeast is +X, -Z
    expect(calculateBearingText(0, 0, 50, -50)).toContain('NE');
    // Southwest is -X, +Z
    expect(calculateBearingText(0, 0, -50, 50)).toContain('SW');
  });

  it('manages personal tent marker position and bounds clamping', () => {
    const map = new FestivalMap();
    expect(map.getTentMarker().label).toBeTruthy();

    map.setTentMarker(42, -15, 'Mój Zielony Namiot');
    const marker = map.getTentMarker();
    expect(marker.x).toBe(42);
    expect(marker.z).toBe(-15);
    expect(marker.label).toBe('Mój Zielony Namiot');

    // Clamps out of bounds
    map.setTentMarker(9999, -9999);
    const clamped = map.getTentMarker();
    expect(clamped.x).toBeLessThanOrEqual(280);
    expect(clamped.z).toBeGreaterThanOrEqual(-160);

    map.resetTentMarker();
    expect(map.getTentMarker().x).toBe(0);
    expect(map.getTentMarker().z).toBe(0);
  });

  it('renders can markers including golden cans without errors', () => {
    const map = new FestivalMap();
    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      lineCap: '',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
    } as unknown as CanvasRenderingContext2D;

    const mockCanvas = {
      width: 800,
      height: 800,
      style: { cursor: '' },
      getContext: vi.fn().mockReturnValue(mockCtx),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 800, height: 800, left: 0, top: 0 }),
    } as unknown as HTMLCanvasElement;

    map.attachCanvas(mockCanvas);

    const player: PlayerMapState = { x: 0, z: 0, yaw: 0 };
    const canMarkers = [
      { id: 'can_1', x: 10, z: 5, isGolden: false },
      { id: 'can_gold', x: 50, z: -20, isGolden: true },
    ];

    expect(() => map.render(player, [], 1000, canMarkers)).not.toThrow();
    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('correctly maps 3D camera orientations to 2D canvas look angles (calculatePlayerLookAngle)', async () => {
    const { calculatePlayerLookAngle } = await import('./FestivalMap');

    // 1. Patrzenie na północ (-Z, góra mapy): yaw = 0 -> kąt -PI/2 (-90°)
    const northAngle = calculatePlayerLookAngle(0);
    expect(northAngle).toBeCloseTo(-Math.PI / 2, 4);

    // 2. Patrzenie na wschód (+X, Duża Scena, prawo na mapie): yaw = -PI/2 -> kąt 0 (0°)
    const eastAngle = calculatePlayerLookAngle(-Math.PI / 2);
    expect(eastAngle).toBeCloseTo(0, 4);

    // 3. Patrzenie na południe (+Z, dół mapy): yaw = PI -> kąt +PI/2 (+90°)
    const southAngle = calculatePlayerLookAngle(Math.PI);
    expect(southAngle).toBeCloseTo(Math.PI / 2, 4);

    // 4. Patrzenie na zachód (-X, ASP / Lidl, lewo na mapie): yaw = PI/2 -> kąt PI (+180°)
    const westAngle = calculatePlayerLookAngle(Math.PI / 2);
    expect(Math.abs(westAngle)).toBeCloseTo(Math.PI, 4);

    // 5. Z jawnie przekazanym wektorem dirX, dirZ (np. z camera.getWorldDirection):
    expect(calculatePlayerLookAngle(0, 1, 0)).toBeCloseTo(0, 4); // East (+X)
    expect(calculatePlayerLookAngle(0, 0, -1)).toBeCloseTo(-Math.PI / 2, 4); // North (-Z)
    expect(calculatePlayerLookAngle(0, 0, 1)).toBeCloseTo(Math.PI / 2, 4); // South (+Z)
    expect(Math.abs(calculatePlayerLookAngle(0, -1, 0))).toBeCloseTo(Math.PI, 4); // West (-X)
  });

  it('supports smooth zoom in, zoom out, resetView, and centerOnPlayer', () => {
    const map = new FestivalMap();
    expect(map.getZoom()).toBe(1.0);

    // Zoom in
    map.zoomIn();
    expect(map.getZoom()).toBeGreaterThan(1.0);

    // Zoom out
    map.zoomOut();
    expect(map.getZoom()).toBeLessThanOrEqual(1.0);

    // Zoom clamp to max
    map.setZoom(10);
    expect(map.getZoom()).toBe(4.5);

    // Center on player adjusts pan
    map.centerOnPlayer(216, 18); // Duża Scena
    const pan = map.getPanOffset();
    expect(pan.x).toBeGreaterThan(0);

    // Reset view
    map.resetView();
    expect(map.getZoom()).toBe(1.0);
    expect(map.getPanOffset().x).toBe(0);
    expect(map.getPanOffset().z).toBe(0);
  });

  it('accurately round-trips coordinates with zoom and pan active', () => {
    const map = new FestivalMap();
    const width = 800;
    const height = 600;

    map.setZoom(2.5, 50, 20);

    const testPoints = [
      { x: 0, z: 0 },
      { x: 216, z: 18 },
      { x: -65, z: 97 },
      { x: 160, z: -8 },
    ];

    for (const pt of testPoints) {
      const canvasPt = map.worldToCanvas(pt.x, pt.z, width, height);
      const restored = map.canvasToWorld(canvasPt.x, canvasPt.y, width, height);
      expect(restored.x).toBeCloseTo(pt.x, 2);
      expect(restored.z).toBeCloseTo(pt.z, 2);
    }
  });
});
