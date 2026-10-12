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
