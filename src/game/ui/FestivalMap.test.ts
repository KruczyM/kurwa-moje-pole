import { describe, expect, it, vi } from 'vitest';
import {
  FestivalMap,
  FESTIVAL_MAP_LANDMARKS,
  type PlayerMapState,
  type RemotePlayerMarker,
} from './FestivalMap';

describe('FestivalMap', () => {
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
    expect(ids).toContain('grzybek');
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
    } as unknown as CanvasRenderingContext2D;

    const mockCanvas = {
      width: 800,
      height: 800,
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
    expect(clamped.z).toBeGreaterThanOrEqual(-100);

    map.resetTentMarker();
    expect(map.getTentMarker().x).toBe(0);
    expect(map.getTentMarker().z).toBe(0);
  });
});
