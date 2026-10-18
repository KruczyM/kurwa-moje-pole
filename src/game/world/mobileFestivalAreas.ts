import definition from './mobileFestivalAreas.json';

export const MOBILE_FESTIVAL_AREAS = definition.areas;
export type MobileFestivalAreaId = (typeof MOBILE_FESTIVAL_AREAS)[number]['id'];

/** Ordered, half-open regions: shared with the exporter; each position has one owner. */
export function festivalAreaAt(x: number, z: number): string {
  return (
    MOBILE_FESTIVAL_AREAS.find((area) =>
      area.regions.some(([minX, maxX, minZ, maxZ]) => x >= minX && x < maxX && z >= minZ && z < maxZ),
    )?.id ?? definition.fallback
  );
}

export function festivalAreaLabel(id: string): string {
  return MOBILE_FESTIVAL_AREAS.find((area) => area.id === id)?.label ?? id;
}

/** Human players take priority. Reuse character templates instead of downloading crowd packs. */
export function mobileBotBudget(areaId: string, remotePlayers: number, allowance = 5): number {
  const area = MOBILE_FESTIVAL_AREAS.find((entry) => entry.id === areaId);
  return Math.max(
    0,
    Math.min(area?.bots ?? 0, allowance, definition.actorBudget - 1 - Math.max(0, remotePlayers)),
  );
}

/** Measured frame time, not clamped simulation dt. Loading/tab-resume gaps are excluded. */
export class MobileBotAllowance {
  value = 5;
  private seconds = 0;
  private frames = 0;
  private fastSeconds = 0;
  update(frameSeconds: number): number {
    if (!Number.isFinite(frameSeconds) || frameSeconds <= 0 || frameSeconds > 1) return this.value;
    this.seconds += frameSeconds;
    this.frames++;
    if (this.seconds < 2) return this.value;
    const fps = this.frames / this.seconds;
    if (fps < 28) {
      this.value = Math.max(0, this.value - 1);
      this.fastSeconds = 0;
    } else if (fps > 45) {
      this.fastSeconds += this.seconds;
      if (this.fastSeconds >= 8) {
        this.value = Math.min(5, this.value + 1);
        this.fastSeconds = 0;
      }
    } else this.fastSeconds = 0;
    this.seconds = this.frames = 0;
    return this.value;
  }
}

export type FestivalBoundary = { a: string; b: string; x1: number; z1: number; x2: number; z2: number };
/** Shared edges only: no outer-world border and no duplicate lines. */
export function festivalBoundaries(): FestivalBoundary[] {
  const edges: FestivalBoundary[] = [];
  for (let i = 0; i < MOBILE_FESTIVAL_AREAS.length; i++) {
    const a = MOBILE_FESTIVAL_AREAS[i];
    const [ax, bx, az, bz] = a.regions[0];
    for (const b of MOBILE_FESTIVAL_AREAS.slice(i + 1)) {
      const [cx, dx, cz, dz] = b.regions[0];
      const minZ = Math.max(az, cz),
        maxZ = Math.min(bz, dz);
      const minX = Math.max(ax, cx),
        maxX = Math.min(bx, dx);
      if ((bx === cx || dx === ax) && minZ < maxZ) {
        const x = bx === cx ? bx : ax;
        edges.push({ a: a.id, b: b.id, x1: x, x2: x, z1: minZ, z2: maxZ });
      }
      if ((bz === cz || dz === az) && minX < maxX) {
        const z = bz === cz ? bz : az;
        edges.push({ a: a.id, b: b.id, x1: minX, x2: maxX, z1: z, z2: z });
      }
    }
  }
  return edges;
}
export const FESTIVAL_BOUNDARIES = festivalBoundaries();
export function nearestFestivalBoundary(x: number, z: number, area: string, target?: string) {
  return FESTIVAL_BOUNDARIES.filter(
    (edge) => (edge.a === area || edge.b === area) && (!target || edge.a === target || edge.b === target),
  )
    .map((edge) => {
      const px = Math.max(edge.x1, Math.min(edge.x2, x));
      const pz = Math.max(edge.z1, Math.min(edge.z2, z));
      return { edge, distance: Math.hypot(x - px, z - pz), target: edge.a === area ? edge.b : edge.a };
    })
    .sort((a, b) => a.distance - b.distance)[0];
}
