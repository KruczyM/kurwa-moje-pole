export const MIN_TRUST = -3;
export const MAX_TRUST = 3;

/** Small shared trust scale; no time-based decay, randomness or character-specific progression locks. */
export class Relationships {
  private readonly trust = new Map<string, number>();

  /** Registers the finite authored NPC roster at zero trust. */
  constructor(npcIds: readonly string[]) {
    for (const npcId of npcIds) this.trust.set(npcId, 0);
  }

  /** Reads trust without creating entries for misspelled or unknown NPC IDs. */
  get(npcId: string): number {
    return this.trust.get(npcId) ?? 0;
  }

  /** Applies a validated authored effect and clamps the small visible trust scale. */
  change(npcId: string, delta: number): void {
    if (!this.trust.has(npcId) || !Number.isInteger(delta) || Math.abs(delta) > MAX_TRUST)
      throw new Error('Invalid After trust effect');
    this.trust.set(npcId, Math.max(MIN_TRUST, Math.min(MAX_TRUST, this.get(npcId) + delta)));
  }

  /** Provides detached, serializable relation data in stable roster order. */
  snapshot(): { npcId: string; trust: number }[] {
    return Array.from(this.trust, ([npcId, trust]) => ({ npcId, trust }));
  }
}
