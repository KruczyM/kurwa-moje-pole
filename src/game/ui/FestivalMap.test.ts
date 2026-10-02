import { describe, expect, it, vi } from 'vitest';
import {
  FestivalMap,
  FESTIVAL_MAP_BOUNDS,
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
    } as unknown as CanvasRenderingContext2D;

    const mockCanvas = {
      width: 800,
      height: 800,
      getContext: vi.fn().mockReturnValue(mockCtx),
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
});
