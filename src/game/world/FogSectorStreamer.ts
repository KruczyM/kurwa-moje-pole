import * as THREE from 'three';
import { FOG_TRIAL_FAR, FOG_TRIAL_PREFETCH, FOG_TRIAL_RETAIN } from '../rendering/fogTrial';

export type FogSector = { id: string; path: string; bounds: [number[], number[]]; bytes: number };
export type FogSectorManifest = { schema: number; sourceSha256: string; sectors: FogSector[] };
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
  constructor(
    private scene: THREE.Object3D,
    private manifest: FogSectorManifest,
    private load: (sector: FogSector) => Promise<THREE.Object3D | null>,
    private release: (sector: FogSector, root: THREE.Object3D) => void,
    private warn: (message: string) => void,
  ) {
    if (manifest.schema !== 1) throw new Error('Nieobsługiwany manifest sektorów świata');
  }
  update(dt: number, viewer: THREE.Vector3): void {
    if (this.disposed) return;
    this.viewer.copy(viewer);
    this.elapsed += dt;
    if (this.elapsed < 0.25) return;
    this.elapsed = 0;
    for (const sector of this.manifest.sectors) {
      const root = this.loaded.get(sector.id);
      if (!root) continue;
      const distance = sectorDistance(sector, viewer);
      if (distance > FOG_TRIAL_RETAIN) {
        this.loaded.delete(sector.id);
        this.release(sector, root);
      } else root.visible = distance <= FOG_TRIAL_FAR;
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
          sectorDistance(s, this.viewer) <= FOG_TRIAL_PREFETCH,
      )
      .sort((a, b) => sectorDistance(a, this.viewer) - sectorDistance(b, this.viewer))[0];
    if (!sector || this.disposed) return;
    try {
      const root = await this.load(sector);
      if (!root) throw new Error('Nie udało się wczytać sektora');
      if (this.disposed || sectorDistance(sector, this.viewer) > FOG_TRIAL_RETAIN) {
        this.release(sector, root);
        return;
      }
      root.visible = sectorDistance(sector, this.viewer) <= FOG_TRIAL_FAR;
      this.scene.add(root);
      this.loaded.set(sector.id, root);
    } catch {
      this.failed.add(sector.id);
      if (!this.disposed) this.warn(`Nie wczytano sektora ${sector.id}. Odśwież grę, aby ponowić próbę.`);
    }
  }
  async prime(viewer: THREE.Vector3): Promise<void> {
    this.viewer.copy(viewer);
    while (
      !this.disposed &&
      this.manifest.sectors.some(
        (s) => !this.loaded.has(s.id) && !this.failed.has(s.id) && sectorDistance(s, viewer) <= 17,
      )
    )
      await this.pump();
  }
  dispose(): void {
    this.disposed = true;
    for (const sector of this.manifest.sectors) {
      const root = this.loaded.get(sector.id);
      if (root) this.release(sector, root);
    }
    this.loaded.clear();
  }
  get stats() {
    return { loaded: this.loaded.size, pending: Boolean(this.pending), failed: this.failed.size };
  }
}
