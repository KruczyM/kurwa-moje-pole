import { describe, it, expect, beforeEach } from 'vitest';
import {
  NpcRelationships,
  calculateTier,
  clampScore,
  CORE_FESTIVAL_NPCS,
  RELATIONSHIP_TIERS,
  CoreNpcId,
} from './NpcRelationships';

class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

class FaultyStorage extends MockStorage {
  override setItem(): void {
    throw new Error('QuotaExceededError: Storage quota exceeded');
  }

  override getItem(): string | null {
    throw new Error('SecurityError: Access denied');
  }
}

describe('NpcRelationships (C1)', () => {
  let mockStorage: MockStorage;
  let relationships: NpcRelationships;

  beforeEach(() => {
    mockStorage = new MockStorage();
    relationships = new NpcRelationships({ storage: mockStorage, autoSave: true });
  });

  describe('Core Festival NPCs initialization', () => {
    it('initializes all 8 core festival NPCs with stable IDs and default states', () => {
      const coreIds: CoreNpcId[] = [
        'jurek',
        'woodstock_wieslaw',
        'pokojowy_patrol_ania',
        'krysznowiec_jan',
        'flanki_mistrz_mati',
        'eko_wolontariusz_kuba',
        'pien',
        'zawor',
      ];

      for (const id of coreIds) {
        const rel = relationships.getRelationship(id);
        const def = CORE_FESTIVAL_NPCS[id];

        expect(rel).toBeDefined();
        expect(rel.npcId).toBe(id);
        expect(rel.name).toBe(def.name);
        expect(rel.score).toBe(0);
        expect(rel.tier).toBe('obcy');
        expect(rel.favorsCompleted.size).toBe(0);
        expect(rel.lastInteractionTimestamp).toBe(0);
        expect(rel.interactionCooldownMs).toBe(def.cooldownMs);

        for (const topic of def.initialTopics) {
          expect(rel.knownTopics.has(topic)).toBe(true);
        }
      }
    });

    it('creates on-demand record for any custom or unregistered NPC', () => {
      const customRel = relationships.getRelationship('nieznany_autostopowicz');
      expect(customRel).toBeDefined();
      expect(customRel.npcId).toBe('nieznany_autostopowicz');
      expect(customRel.tier).toBe('obcy');
      expect(customRel.score).toBe(0);
    });
  });

  describe('Tier and Score progression', () => {
    it('calculates tier transitions accurately based on thresholds', () => {
      expect(calculateTier(-50)).toBe('obcy');
      expect(calculateTier(0)).toBe('obcy');
      expect(calculateTier(19)).toBe('obcy');

      expect(calculateTier(20)).toBe('kojarzy');
      expect(calculateTier(49)).toBe('kojarzy');

      expect(calculateTier(50)).toBe('znajomy');
      expect(calculateTier(79)).toBe('znajomy');

      expect(calculateTier(80)).toBe('zaufany');
      expect(calculateTier(100)).toBe('zaufany');
    });

    it('clamps scores within [-100, 100]', () => {
      expect(clampScore(150)).toBe(100);
      expect(clampScore(-150)).toBe(-100);
      expect(clampScore(45.6)).toBe(46);
      expect(clampScore(NaN)).toBe(0);
    });

    it('exposes all relationship tiers in order', () => {
      expect(RELATIONSHIP_TIERS).toEqual(['obcy', 'kojarzy', 'znajomy', 'zaufany']);
    });
  });

  describe('Cooldown and Anti-farming Protection', () => {
    it('applies score for the first interaction and starts cooldown', () => {
      const now = 1_000_000;
      const res = relationships.recordInteraction('woodstock_wieslaw', 'talk', 15, 'stara_gwardia', { now });

      expect(res.success).toBe(true);
      expect(res.appliedScore).toBe(15);
      expect(res.relationship.score).toBe(15);
      expect(res.relationship.tier).toBe('obcy');
      expect(res.newTopicLearned).toBe('stara_gwardia');
      expect(res.relationship.lastInteractionTimestamp).toBe(now);
    });

    it('blocks positive score increases during cooldown window to prevent farming', () => {
      const startTime = 1_000_000;
      relationships.recordInteraction('woodstock_wieslaw', 'talk', 15, undefined, { now: startTime });

      // Immediate attempt 1 second later (Wiesław has 4000ms cooldown)
      const spamTime = startTime + 1000;
      const spamRes = relationships.recordInteraction('woodstock_wieslaw', 'talk', 15, undefined, {
        now: spamTime,
      });

      expect(spamRes.success).toBe(false);
      expect(spamRes.reason).toBe('cooldown_active');
      expect(spamRes.appliedScore).toBe(0);
      expect(spamRes.cooldownActive).toBe(true);
      expect(spamRes.cooldownRemainingMs).toBe(3000);
      expect(relationships.getScore('woodstock_wieslaw')).toBe(15); // Unchanged!
    });

    it('allows topic learning during cooldown without increasing score', () => {
      const t1 = 1_000_000;
      relationships.recordInteraction('jurek', 'cheer', 10, 'scena_mala', { now: t1 });

      const t2 = t1 + 1000;
      const res2 = relationships.recordInteraction('jurek', 'cheer', 10, 'scena_asp', { now: t2 });

      expect(res2.success).toBe(false);
      expect(res2.appliedScore).toBe(0);
      expect(res2.newTopicLearned).toBe('scena_asp');
      expect(relationships.hasTopic('jurek', 'scena_asp')).toBe(true);
      expect(relationships.getScore('jurek')).toBe(10);
    });

    it('allows negative score penalties regardless of cooldown', () => {
      const t1 = 1_000_000;
      relationships.recordInteraction('pokojowy_patrol_ania', 'talk', 10, undefined, { now: t1 });

      const t2 = t1 + 500;
      const penaltyRes = relationships.recordInteraction('pokojowy_patrol_ania', 'insult', -25, undefined, {
        now: t2,
      });

      expect(penaltyRes.success).toBe(true);
      expect(penaltyRes.appliedScore).toBe(-25);
      expect(relationships.getScore('pokojowy_patrol_ania')).toBe(-15);
    });

    it('allows subsequent positive interaction once cooldown has expired', () => {
      const t1 = 1_000_000;
      relationships.recordInteraction('flanki_mistrz_mati', 'play_flanki', 15, undefined, { now: t1 });

      // Mati cooldown is 3500ms
      const t2 = t1 + 3600;
      const res2 = relationships.recordInteraction('flanki_mistrz_mati', 'praise', 10, undefined, {
        now: t2,
      });

      expect(res2.success).toBe(true);
      expect(res2.appliedScore).toBe(10);
      expect(relationships.getScore('flanki_mistrz_mati')).toBe(25);
      expect(relationships.getTier('flanki_mistrz_mati')).toBe('kojarzy');
    });

    it('allows overriding cooldown when force option is true', () => {
      const t1 = 1_000_000;
      relationships.recordInteraction('pien', 'greet', 10, undefined, { now: t1 });

      const t2 = t1 + 200;
      const resForced = relationships.recordInteraction('pien', 'quest_step', 20, undefined, {
        now: t2,
        force: true,
      });

      expect(resForced.success).toBe(true);
      expect(resForced.appliedScore).toBe(20);
      expect(relationships.getScore('pien')).toBe(30);
    });
  });

  describe('Favors completion and duplicate reward prevention', () => {
    it('awards points and marks favor as completed on first completion', () => {
      const favorId = 'wieslaw_znajdz_bandane';
      const result = relationships.completeFavor('woodstock_wieslaw', favorId, 30);

      expect(result.alreadyCompleted).toBe(false);
      expect(result.favorId).toBe(favorId);
      expect(result.scoreAwarded).toBe(30);
      expect(result.tierChanged).toBe(true);
      expect(result.currentTier).toBe('kojarzy');
      expect(relationships.hasCompletedFavor('woodstock_wieslaw', favorId)).toBe(true);
      expect(relationships.getScore('woodstock_wieslaw')).toBe(30);
    });

    it('strictly prevents duplicate rewards when completing the same favor multiple times', () => {
      const favorId = 'kuba_worek_puszek';

      const firstTry = relationships.completeFavor('eko_wolontariusz_kuba', favorId, 25);
      expect(firstTry.alreadyCompleted).toBe(false);
      expect(firstTry.scoreAwarded).toBe(25);
      expect(relationships.getScore('eko_wolontariusz_kuba')).toBe(25);

      // Repeat the same favor
      const secondTry = relationships.completeFavor('eko_wolontariusz_kuba', favorId, 25);
      expect(secondTry.alreadyCompleted).toBe(true);
      expect(secondTry.scoreAwarded).toBe(0);
      expect(relationships.getScore('eko_wolontariusz_kuba')).toBe(25); // Still 25, no double reward!
    });
  });

  describe('Storage persistence and migrations', () => {
    it('saves state into storage and restores it accurately', () => {
      relationships.recordInteraction('krysznowiec_jan', 'eat_dhal', 25, 'przyprawy_sekretne', {
        now: 5000,
      });
      relationships.completeFavor('krysznowiec_jan', 'jan_przynies_wode', 35);

      // Create new instance pointing to same storage
      const restored = new NpcRelationships({ storage: mockStorage });
      expect(restored.getScore('krysznowiec_jan')).toBe(60);
      expect(restored.getTier('krysznowiec_jan')).toBe('znajomy');
      expect(restored.hasTopic('krysznowiec_jan', 'przyprawy_sekretne')).toBe(true);
      expect(restored.hasCompletedFavor('krysznowiec_jan', 'jan_przynies_wode')).toBe(true);
    });

    it('gracefully handles corrupted JSON in storage without throwing', () => {
      mockStorage.setItem('kmp_npc_relationships_v1', '{ invalid json [[]] ...');

      const safeInstance = new NpcRelationships({ storage: mockStorage });
      expect(safeInstance.getScore('jurek')).toBe(0);
      expect(safeInstance.getTier('jurek')).toBe('obcy');
    });

    it('gracefully handles faulty storage exceptions (SecurityError / QuotaExceeded)', () => {
      const faultyStorage = new FaultyStorage();
      const faultyInstance = new NpcRelationships({ storage: faultyStorage });

      // Should not throw
      const res = faultyInstance.recordInteraction('zawor', 'check_paper', 10);
      expect(res.success).toBe(true);
      expect(faultyInstance.getScore('zawor')).toBe(10);
    });

    it('migrates legacy v0 schema data to v1 schema', () => {
      const legacyData = {
        woodstock_wieslaw: {
          score: 55,
          knownTopics: ['jarocin', 'woodstock_88'],
          favorsCompleted: ['stare_wspominki'],
        },
      };
      mockStorage.setItem('kmp_npc_relationships_v1', JSON.stringify(legacyData));

      const migrated = new NpcRelationships({ storage: mockStorage });
      expect(migrated.getScore('woodstock_wieslaw')).toBe(55);
      expect(migrated.getTier('woodstock_wieslaw')).toBe('znajomy');
      expect(migrated.hasTopic('woodstock_wieslaw', 'jarocin')).toBe(true);
      expect(migrated.hasCompletedFavor('woodstock_wieslaw', 'stare_wspominki')).toBe(true);
    });
  });

  describe('Reset capabilities', () => {
    it('resets a single NPC back to initial core definition', () => {
      relationships.recordInteraction('pien', 'flaga', 60);
      expect(relationships.getScore('pien')).toBe(60);

      relationships.resetNpc('pien');
      expect(relationships.getScore('pien')).toBe(0);
      expect(relationships.getTier('pien')).toBe('obcy');
      expect(relationships.hasTopic('pien', 'moje_pole')).toBe(true);
    });

    it('resets all relationships and clears persisted storage', () => {
      relationships.recordInteraction('jurek', 'cheer', 50);
      relationships.recordInteraction('woodstock_wieslaw', 'beer', 50);
      relationships.save();

      relationships.resetAll();

      expect(relationships.getScore('jurek')).toBe(0);
      expect(relationships.getScore('woodstock_wieslaw')).toBe(0);
      expect(mockStorage.getItem('kmp_npc_relationships_v1')).toBeNull();
    });
  });
});
