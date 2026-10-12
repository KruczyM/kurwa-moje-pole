import * as THREE from 'three';
import { fogRanges, FOG_TRIAL_FAR } from '../rendering/fogTrial';
import type { SectorRanges } from './mobileWorldStreaming';

export type FogSector = { id: string; path: string; bounds: [number[], number[]]; bytes: number };
export type FogSectorManifest = {
  schema: number;
  sourceSha256: string;
  cellSize?: number;
  sectors: FogSector[];
};
// Group the exported 16 m cells into map areas, without loading neighbouring areas.
export const MOBILE_AREA_CELLS = 4;
export function mobileAreaAt(viewer: THREE.Vector3, cellSize = 16): string {
  const size = cellSize * MOBILE_AREA_CELLS;
  return `${Math.floor(viewer.x / size)}_${Math.floor(viewer.z / size)}`;
}
export function mobileSectorArea(sector: FogSector): string {
  const [x, z] = sector.id.split('_').map(Number);
  if (!/^-?\d+_-?\d+$/.test(sector.id)) throw new Error('Nieprawidłowa siatka sektorów');
  return `${Math.floor(x / MOBILE_AREA_CELLS)}_${Math.floor(z / MOBILE_AREA_CELLS)}`;
}
export function sectorDistance(sector: FogSector, viewer: THREE.Vector3): number {
  const [min, max] = sector.bounds;
  return Math.hypot(
    Math.max(min[0] - viewer.x, 0, viewer.x - max[0]),
    Math.max(min[2] - viewer.z, 0, viewer.z - max[2]),
  );
}

/** Delta-time scheduling inside Game; single in-flight sector, hysteresis and real eviction. */
export class FogSectorStreamer {
  private loaded = new Map<string, THREE.Object3D>();
  private failed = new Set<string>();
  private viewer = new THREE.Vector3();
  private elapsed = Infinity;
  private pending?: Promise<void>;
  private disposed = false;
  private ranges = fogRanges(FOG_TRIAL_FAR);
  private policy?: (sector: FogSector) => SectorRanges;
  /** Reuses the existing queue and ownership lifecycle with per-sector residence rules. */
  setStreamingPolicy(policy: (sector: FogSector) => SectorRanges): void {
    this.policy = policy;
    this.elapsed = Infinity;
  }
  /** Resolves either the legacy fog radius or the selective mobile policy. */
  private rangesFor(sector: FogSector): SectorRanges {
    return this.policy?.(sector) ?? this.ranges;
  }
  private area?: string;
  get activeArea(): string | undefined {
    return this.area;
  }
  areaAt(viewer: THREE.Vector3): string {
    return mobileAreaAt(viewer, this.manifest.cellSize);
  }
  setViewDistance(distance: number): void {
    this.policy = undefined;
    this.ranges = fogRanges(distance);
    this.elapsed = Infinity;
  }
  constructor(
    private scene: THREE.Object3D,
    private manifest: FogSectorManifest,
    private load: (sector: FogSector) => Promise<THREE.Object3D | null>,
    private release: (sector: FogSector, root: THREE.Object3D) => void,
    private warn: (message: string) => void,
    private mapTransitions = false,
  ) {
    if (manifest.schema !== 1) throw new Error('Nieobsługiwany manifest sektorów świata');
    if (mapTransitions) {
      if (!manifest.cellSize || !Number.isFinite(manifest.cellSize) || manifest.cellSize <= 0)
        throw new Error('Brak rozmiaru siatki sektorów');
      manifest.sectors.forEach(mobileSectorArea);
    }
  }
  update(dt: number, viewer: THREE.Vector3): void {
    if (this.disposed || this.mapTransitions) return;
    this.viewer.copy(viewer);
    this.elapsed += dt;
    if (this.elapsed < 0.25) return;
    this.elapsed = 0;
    for (const sector of this.manifest.sectors) {
      const root = this.loaded.get(sector.id);
      if (!root) continue;
      const distance = sectorDistance(sector, viewer);
      const ranges = this.rangesFor(sector);
      if (distance > ranges.retain) {
        this.loaded.delete(sector.id);
        this.release(sector, root);
      } else root.visible = distance <= ranges.far;
    }
    void this.pump();
  }
  private pump(): Promise<void> {
    if (!this.pending)
      this.pending = this.next().finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }
  private async next(): Promise<void> {
    const sector = this.manifest.sectors
      .filter(
        (s) =>
          !this.loaded.has(s.id) &&
          !this.failed.has(s.id) &&
          sectorDistance(s, this.viewer) <= this.rangesFor(s).prefetch,
      )
      .sort((a, b) => sectorDistance(a, this.viewer) - sectorDistance(b, this.viewer))[0];
    if (!sector || this.disposed) return;
    try {
      const root = await this.load(sector);
      if (!root) throw new Error('Nie udało się wczytać sektora');
      const ranges = this.rangesFor(sector);
      if (this.disposed || sectorDistance(sector, this.viewer) > ranges.retain) {
        this.release(sector, root);
        return;
      }
      root.visible = sectorDistance(sector, this.viewer) <= ranges.far;
      this.scene.add(root);
      this.loaded.set(sector.id, root);
    } catch {
      this.failed.add(sector.id);
      if (!this.disposed) this.warn(`Nie wczytano sektora ${sector.id}. Odśwież grę, aby ponowić próbę.`);
    }
  }
  async prime(viewer: THREE.Vector3): Promise<void> {
    if (this.mapTransitions) {
      await this.enterArea(this.areaAt(viewer));
      return;
    }
    this.viewer.copy(viewer);
    while (
      !this.disposed &&
      this.manifest.sectors.some(
        (s) =>
          !this.loaded.has(s.id) &&
          !this.failed.has(s.id) &&
          sectorDistance(s, viewer) <= this.rangesFor(s).prime,
      )
    )
      await this.pump();
  }
  /** Evict before loading to avoid holding two maps in phone memory. Failed areas can be retried. */
  async enterArea(area: string, progress?: (loaded: number, total: number) => void): Promise<void> {
    if (!this.mapTransitions || this.disposed || this.area === area) return;
    if (this.pending) throw new Error('Trwa już ładowanie sektora');
    this.evictArea();
    const sectors = this.manifest.sectors.filter((sector) => mobileSectorArea(sector) === area);
    const operation = async () => {
      progress?.(0, sectors.length);
      try {
        for (const sector of sectors) {
          if (this.disposed) return;
          const root = await this.load(sector);
          if (!root) throw new Error('Nie udało się wczytać sektora. Sprawdź połączenie i spróbuj ponownie.');
          if (this.disposed) {
            this.release(sector, root);
            return;
          }
          this.scene.add(root);
          this.loaded.set(sector.id, root);
          progress?.(this.loaded.size, sectors.length);
        }
        if (!this.disposed) this.area = area;
      } catch (error) {
        this.evictArea();
        throw error;
      }
    };
    this.pending = operation();
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
  private evictArea(): void {
    this.area = undefined;
    for (const sector of this.manifest.sectors) {
      const root = this.loaded.get(sector.id);
      if (root) this.release(sector, root);
    }
    this.loaded.clear();
  }
  dispose(): void {
    this.disposed = true;
    this.evictArea();
  }
  get stats() {
    return { loaded: this.loaded.size, pending: Boolean(this.pending), failed: this.failed.size };
  }
}
