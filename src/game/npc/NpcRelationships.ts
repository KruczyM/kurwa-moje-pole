/**
 * NpcRelationships - Pamięć relacji z bohaterami festiwalu (#KURWAMOJEPOLE).
 *
 * Zadanie C1 z docs/attractions-plan.md:
 * - 6-8 kluczowych postaci o stabilnych identyfikatorach.
 * - Poziomy relacji: 'obcy' -> 'kojarzy' -> 'znajomy' -> 'zaufany'.
 * - Śledzenie punktów (-100 do 100), poziomów, poznanych tematów (Set<string>),
 *   zrealizowanych przysług (Set<string>), znacznika czasu i cooldownu zapobiegającego farmieniu.
 * - Wersjonowany zapis w localStorage z migracjami i bezpiecznym fallbackiem in-memory.
 * - 100% deterministyczny kod, brak zewnętrznych API (Rule 2 AGENTS.md).
 */

export type RelationshipTier = 'obcy' | 'kojarzy' | 'znajomy' | 'zaufany';

export const RELATIONSHIP_TIERS: readonly RelationshipTier[] = [
  'obcy',
  'kojarzy',
  'znajomy',
  'zaufany',
] as const;

export const TIER_THRESHOLDS = {
  obcy: 0,
  kojarzy: 20,
  znajomy: 50,
  zaufany: 80,
} as const;

export const MIN_RELATIONSHIP_SCORE = -100;
export const MAX_RELATIONSHIP_SCORE = 100;
export const DEFAULT_INTERACTION_COOLDOWN_MS = 4000;
export const RELATIONSHIPS_STORAGE_KEY_V1 = 'kmp_npc_relationships_v1';
export const CURRENT_RELATIONSHIPS_SCHEMA_VERSION = 1;

export type CoreNpcId =
  | 'jurek'
  | 'woodstock_wieslaw'
  | 'pokojowy_patrol_ania'
  | 'krysznowiec_jan'
  | 'flanki_mistrz_mati'
  | 'eko_wolontariusz_kuba'
  | 'pien'
  | 'zawor';

export interface CoreNpcDefinition {
  id: CoreNpcId;
  name: string;
  role: string;
  description: string;
  defaultTier: RelationshipTier;
  defaultScore: number;
  initialTopics: string[];
  preferredTopics: string[];
  cooldownMs: number;
}

export const CORE_FESTIVAL_NPCS: Record<CoreNpcId, CoreNpcDefinition> = {
  jurek: {
    id: 'jurek',
    name: 'Jurek Owsiak',
    role: 'Główny Dyrygent Festiwalu',
    description:
      'Czerwone spodnie, żółta koszula i niegasnąca energia. Twórca Najpiękniejszego Festiwalu Świata.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['duza_scena', 'wosp'],
    preferredTopics: ['duza_scena', 'wosp', 'pokojowy_patrol', 'wolontariat', 'muzyka_pokoju'],
    cooldownMs: 5000,
  },
  woodstock_wieslaw: {
    id: 'woodstock_wieslaw',
    name: 'Wiesław',
    role: 'Festiwalowy Weteran',
    description: 'Weteran w wysłużonej katanie z naszywkami Jarocina i pierwszych edycji w Żarach.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['woodstock_88', 'glany'],
    preferredTopics: ['woodstock_88', 'glany', 'jarocin', 'stara_gwardia', 'zimne_piwo'],
    cooldownMs: 4000,
  },
  pokojowy_patrol_ania: {
    id: 'pokojowy_patrol_ania',
    name: 'Ania z Patrolu',
    role: 'Koordynatorka Pokojowego Patrolu',
    description: 'Czerwona koszulka Pokojowego Patrolu, krótkofalówka i czujne, opiekuńcze spojrzenie.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['bezpieczenstwo', 'punkt_medyczny'],
    preferredTopics: ['bezpieczenstwo', 'punkt_medyczny', 'pierwsza_pomoc', 'zguby', 'patrol_szkolenie'],
    cooldownMs: 3000,
  },
  krysznowiec_jan: {
    id: 'krysznowiec_jan',
    name: 'Jan z Kuchni Kryszny',
    role: 'Kucharz Pokojowej Kuchni',
    description: 'Złociste szaty, wielka chochla i zapach ciepłego kuminu oraz ryżu z dhalem.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['prasadam', 'dhal'],
    preferredTopics: ['prasadam', 'dhal', 'pokojowa_kuchnia', 'wegetarianizm', 'przyprawy'],
    cooldownMs: 3000,
  },
  flanki_mistrz_mati: {
    id: 'flanki_mistrz_mati',
    name: 'Mati Mistrz Flanek',
    role: 'Mistrz Pola Namiotowego',
    description: 'Puszka w dłoni, sokoli wzrok i niekwestionowany król rzutów w puszkę na pasie startowym.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['zasady_flanek', 'technika_rzutu'],
    preferredTopics: ['zasady_flanek', 'technika_rzutu', 'puszka_stalowa', 'mistrzostwa_obozu', 'pils'],
    cooldownMs: 3500,
  },
  eko_wolontariusz_kuba: {
    id: 'eko_wolontariusz_kuba',
    name: 'Kuba Eko',
    role: 'Koordynator Eko Patrolu',
    description: 'Żółte rękawice, rolka zielonych worków na śmieci i misja zachowania czystego pola.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['czyste_pole', 'recykling'],
    preferredTopics: ['czyste_pole', 'recykling', 'worki_na_smieci', 'las_czaplinek', 'eko_warsztaty'],
    cooldownMs: 3000,
  },
  pien: {
    id: 'pien',
    name: 'Pień aka Peposz',
    role: 'Gospodarz Pola',
    description: 'Władca obozu "Kurwa Moje Pole". Pilnuje granic i flagi na maszcie.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['moje_pole', 'zasady_obozu'],
    preferredTopics: ['moje_pole', 'zasady_obozu', 'maszt_flagowy', 'kradziez_flagi', 'piwo_w_cieniu'],
    cooldownMs: 4000,
  },
  zawor: {
    id: 'zawor',
    name: 'Zawór',
    role: 'Strażnik Wygódek',
    description: 'Zawsze wie, która kabina toi-toi ma papier i gdzie jest najczystszy kącik.',
    defaultTier: 'obcy',
    defaultScore: 0,
    initialTopics: ['toi_toi', 'papier_toaletowy'],
    preferredTopics: ['toi_toi', 'papier_toaletowy', 'porzadek_w_rogu', 'awaria_zamka', 'czystosc'],
    cooldownMs: 3000,
  },
};

export interface NpcRelationship {
  npcId: string;
  name: string;
  score: number;
  tier: RelationshipTier;
  knownTopics: Set<string>;
  favorsCompleted: Set<string>;
  lastInteractionTimestamp: number;
  interactionCooldownMs: number;
}

export interface SerializedNpcRelationship {
  npcId: string;
  name?: string;
  score: number;
  tier: RelationshipTier;
  knownTopics: string[];
  favorsCompleted: string[];
  lastInteractionTimestamp: number;
  interactionCooldownMs?: number;
}

export interface SerializedRelationshipsStateV1 {
  version: 1;
  savedAt: number;
  relationships: Record<string, SerializedNpcRelationship>;
}

export interface RecordInteractionOptions {
  now?: number;
  force?: boolean;
}

export interface InteractionResult {
  success: boolean;
  appliedScore: number;
  cooldownActive: boolean;
  cooldownRemainingMs: number;
  reason?: 'cooldown_active' | 'npc_not_found';
  relationship: NpcRelationship;
  tierChanged: boolean;
  previousTier: RelationshipTier;
  currentTier: RelationshipTier;
  newTopicLearned?: string;
}

export interface CompleteFavorOptions {
  rewardScore?: number;
  topic?: string;
  now?: number;
}

export interface CompleteFavorResult {
  alreadyCompleted: boolean;
  favorId: string;
  scoreAwarded: number;
  tierChanged: boolean;
  previousTier: RelationshipTier;
  currentTier: RelationshipTier;
  relationship: NpcRelationship;
}

export interface NpcRelationshipsOptions {
  storage?: Storage | null;
  storageKey?: string;
  autoSave?: boolean;
}

/**
 * Oblicza poziom relacji na podstawie punktów zaufania.
 */
export function calculateTier(score: number): RelationshipTier {
  if (score >= TIER_THRESHOLDS.zaufany) return 'zaufany';
  if (score >= TIER_THRESHOLDS.znajomy) return 'znajomy';
  if (score >= TIER_THRESHOLDS.kojarzy) return 'kojarzy';
  return 'obcy';
}

/**
 * Ogranicza wynik do przedziału [-100, 100].
 */
export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(MIN_RELATIONSHIP_SCORE, Math.min(MAX_RELATIONSHIP_SCORE, Math.round(score)));
}

function resolveStorage(customStorage?: Storage | null): Storage | null {
  if (customStorage !== undefined) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as unknown as { localStorage?: Storage }).localStorage
    ) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    // Ochrona przed SecurityError (np. iframe lub private mode)
  }
  return null;
}

/**
 * Zarządca relacji z NPC.
 */
export class NpcRelationships {
  private relationships = new Map<string, NpcRelationship>();
  private storage: Storage | null;
  private storageKey: string;
  private autoSave: boolean;

  constructor(options: NpcRelationshipsOptions = {}) {
    this.storage = resolveStorage(options.storage);
    this.storageKey = options.storageKey ?? RELATIONSHIPS_STORAGE_KEY_V1;
    this.autoSave = options.autoSave ?? true;

    this.initializeCoreRelationships();
    this.load();
  }

  /**
   * Przywraca domyślny stan relacji z podstawowymi postaciami.
   */
  private initializeCoreRelationships(): void {
    for (const [id, def] of Object.entries(CORE_FESTIVAL_NPCS) as [CoreNpcId, CoreNpcDefinition][]) {
      this.relationships.set(id, {
        npcId: id,
        name: def.name,
        score: def.defaultScore,
        tier: def.defaultTier,
        knownTopics: new Set(def.initialTopics),
        favorsCompleted: new Set(),
        lastInteractionTimestamp: 0,
        interactionCooldownMs: def.cooldownMs,
      });
    }
  }

  /**
   * Zwraca relację dla danego NPC. Tworzy wpis, jeśli nie istnieje.
   */
  public getRelationship(npcId: string): NpcRelationship {
    const existing = this.relationships.get(npcId);
    if (existing) {
      return existing;
    }

    const coreDef = CORE_FESTIVAL_NPCS[npcId as CoreNpcId];
    const newRel: NpcRelationship = {
      npcId,
      name: coreDef ? coreDef.name : npcId,
      score: coreDef ? coreDef.defaultScore : 0,
      tier: coreDef ? coreDef.defaultTier : 'obcy',
      knownTopics: new Set(coreDef ? coreDef.initialTopics : []),
      favorsCompleted: new Set(),
      lastInteractionTimestamp: 0,
      interactionCooldownMs: coreDef ? coreDef.cooldownMs : DEFAULT_INTERACTION_COOLDOWN_MS,
    };

    this.relationships.set(npcId, newRel);
    if (this.autoSave) {
      this.save();
    }
    return newRel;
  }

  /**
   * Zwraca aktualny poziom relacji ('obcy' | 'kojarzy' | 'znajomy' | 'zaufany').
   */
  public getTier(npcId: string): RelationshipTier {
    return this.getRelationship(npcId).tier;
  }

  /**
   * Zwraca aktualne punkty relacji (-100 do 100).
   */
  public getScore(npcId: string): number {
    return this.getRelationship(npcId).score;
  }

  /**
   * Sprawdza, czy gracz ukończył już przysługę dla danego NPC.
   */
  public hasCompletedFavor(npcId: string, favorId: string): boolean {
    const rel = this.relationships.get(npcId);
    return rel ? rel.favorsCompleted.has(favorId) : false;
  }

  /**
   * Sprawdza, czy gracz odblokował dany temat z NPC.
   */
  public hasTopic(npcId: string, topic: string): boolean {
    const rel = this.relationships.get(npcId);
    return rel ? rel.knownTopics.has(topic) : false;
  }

  /**
   * Sprawdza, czy dla danego NPC aktywny jest cooldown zapobiegający farmieniu punktów.
   */
  public isCooldownActive(npcId: string, now: number = Date.now()): boolean {
    const rel = this.getRelationship(npcId);
    const elapsed = now - rel.lastInteractionTimestamp;
    return elapsed < rel.interactionCooldownMs;
  }

  /**
   * Zwraca pozostały czas cooldownu w ms.
   */
  public getCooldownRemainingMs(npcId: string, now: number = Date.now()): number {
    const rel = this.getRelationship(npcId);
    const elapsed = now - rel.lastInteractionTimestamp;
    return Math.max(0, rel.interactionCooldownMs - elapsed);
  }

  /**
   * Rejestruje interakcję z NPC.
   * Blokuje przyrost punktów, gdy cooldown jest aktywny (zapobieganie farmieniu).
   * Kary punktowe (deltaScore < 0) są nakładane zawsze.
   */
  public recordInteraction(
    npcId: string,
    type: string,
    deltaScore: number,
    topic?: string,
    optionsOrNow?: number | RecordInteractionOptions,
  ): InteractionResult {
    const rel = this.getRelationship(npcId);
    const previousTier = rel.tier;

    let now = Date.now();
    let force = false;

    if (typeof optionsOrNow === 'number') {
      now = optionsOrNow;
    } else if (optionsOrNow && typeof optionsOrNow === 'object') {
      if (optionsOrNow.now !== undefined) now = optionsOrNow.now;
      if (optionsOrNow.force !== undefined) force = optionsOrNow.force;
    }

    const elapsed = now - rel.lastInteractionTimestamp;
    const cooldownActive = elapsed < rel.interactionCooldownMs;
    const cooldownRemainingMs = Math.max(0, rel.interactionCooldownMs - elapsed);

    let newTopicLearned: string | undefined;
    if (topic && !rel.knownTopics.has(topic)) {
      rel.knownTopics.add(topic);
      newTopicLearned = topic;
    }

    // Blokada farmienia: jeśli cooldown jest aktywny i delta > 0, ignorujemy dodanie punktów
    if (cooldownActive && deltaScore > 0 && !force) {
      if (newTopicLearned && this.autoSave) {
        this.save();
      }
      return {
        success: false,
        appliedScore: 0,
        cooldownActive: true,
        cooldownRemainingMs,
        reason: 'cooldown_active',
        relationship: rel,
        tierChanged: false,
        previousTier,
        currentTier: rel.tier,
        newTopicLearned,
      };
    }

    // Dodanie punktów i aktualizacja poziomu
    const newScore = clampScore(rel.score + deltaScore);
    rel.score = newScore;
    rel.tier = calculateTier(newScore);
    rel.lastInteractionTimestamp = now;

    const tierChanged = rel.tier !== previousTier;

    if (this.autoSave) {
      this.save();
    }

    return {
      success: true,
      appliedScore: deltaScore,
      cooldownActive: false,
      cooldownRemainingMs: rel.interactionCooldownMs,
      relationship: rel,
      tierChanged,
      previousTier,
      currentTier: rel.tier,
      newTopicLearned,
    };
  }

  /**
   * Zalicza przysługę (favor) dla NPC.
   * Idempotentna operacja: ponowne wywołanie nie przyznaje podwójnych punktów.
   */
  public completeFavor(
    npcId: string,
    favorId: string,
    rewardScoreOrOptions?: number | CompleteFavorOptions,
    maybeNow?: number,
  ): CompleteFavorResult {
    const rel = this.getRelationship(npcId);
    const previousTier = rel.tier;

    let rewardScore = 20;
    let topic: string | undefined;
    let now = Date.now();

    if (typeof rewardScoreOrOptions === 'number') {
      rewardScore = rewardScoreOrOptions;
      if (maybeNow !== undefined) now = maybeNow;
    } else if (rewardScoreOrOptions && typeof rewardScoreOrOptions === 'object') {
      if (rewardScoreOrOptions.rewardScore !== undefined) rewardScore = rewardScoreOrOptions.rewardScore;
      if (rewardScoreOrOptions.topic !== undefined) topic = rewardScoreOrOptions.topic;
      if (rewardScoreOrOptions.now !== undefined) now = rewardScoreOrOptions.now;
    }

    // Ochrona przed duplikatem nagrody
    if (rel.favorsCompleted.has(favorId)) {
      return {
        alreadyCompleted: true,
        favorId,
        scoreAwarded: 0,
        tierChanged: false,
        previousTier,
        currentTier: rel.tier,
        relationship: rel,
      };
    }

    rel.favorsCompleted.add(favorId);
    if (topic && !rel.knownTopics.has(topic)) {
      rel.knownTopics.add(topic);
    }

    rel.score = clampScore(rel.score + rewardScore);
    rel.tier = calculateTier(rel.score);
    rel.lastInteractionTimestamp = now;

    const tierChanged = rel.tier !== previousTier;

    if (this.autoSave) {
      this.save();
    }

    return {
      alreadyCompleted: false,
      favorId,
      scoreAwarded: rewardScore,
      tierChanged,
      previousTier,
      currentTier: rel.tier,
      relationship: rel,
    };
  }

  /**
   * Eksportuje stan do struktury zdatnej do serializacji.
   */
  public exportState(): SerializedRelationshipsStateV1 {
    const serializedRelationships: Record<string, SerializedNpcRelationship> = {};

    for (const [id, rel] of this.relationships.entries()) {
      serializedRelationships[id] = {
        npcId: rel.npcId,
        name: rel.name,
        score: rel.score,
        tier: rel.tier,
        knownTopics: Array.from(rel.knownTopics),
        favorsCompleted: Array.from(rel.favorsCompleted),
        lastInteractionTimestamp: rel.lastInteractionTimestamp,
        interactionCooldownMs: rel.interactionCooldownMs,
      };
    }

    return {
      version: 1,
      savedAt: Date.now(),
      relationships: serializedRelationships,
    };
  }

  /**
   * Importuje stan z serializowanego formatu z migracjami.
   */
  public importState(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    try {
      const raw = data as Record<string, unknown>;
      let version = typeof raw.version === 'number' ? raw.version : 0;
      let recordMap: Record<string, unknown> = {};

      if (version === 1 && raw.relationships && typeof raw.relationships === 'object') {
        recordMap = raw.relationships as Record<string, unknown>;
      } else if (version === 0) {
        // Migracja z formatu v0: bezpośrednia mapa relacji lub starsza struktura
        recordMap = (raw.relationships as Record<string, unknown>) ?? raw;
        version = 1;
      }

      for (const [id, val] of Object.entries(recordMap)) {
        if (!val || typeof val !== 'object') continue;
        const entry = val as Record<string, unknown>;
        const rawScore = typeof entry.score === 'number' ? entry.score : 0;
        const score = clampScore(rawScore);
        const tier = calculateTier(score);

        const knownTopics = new Set<string>(
          Array.isArray(entry.knownTopics)
            ? entry.knownTopics.filter((t): t is string => typeof t === 'string')
            : [],
        );

        const favorsCompleted = new Set<string>(
          Array.isArray(entry.favorsCompleted)
            ? entry.favorsCompleted.filter((f): f is string => typeof f === 'string')
            : [],
        );

        const coreDef = CORE_FESTIVAL_NPCS[id as CoreNpcId];
        const cooldownMs =
          typeof entry.interactionCooldownMs === 'number'
            ? entry.interactionCooldownMs
            : coreDef
              ? coreDef.cooldownMs
              : DEFAULT_INTERACTION_COOLDOWN_MS;

        const name = typeof entry.name === 'string' ? entry.name : coreDef ? coreDef.name : id;

        this.relationships.set(id, {
          npcId: id,
          name,
          score,
          tier,
          knownTopics,
          favorsCompleted,
          lastInteractionTimestamp:
            typeof entry.lastInteractionTimestamp === 'number' ? entry.lastInteractionTimestamp : 0,
          interactionCooldownMs: cooldownMs,
        });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Zapisuje stan relacji do storage.
   */
  public save(): boolean {
    if (!this.storage) return false;
    try {
      const serialized = JSON.stringify(this.exportState());
      this.storage.setItem(this.storageKey, serialized);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wczytuje stan relacji ze storage.
   */
  public load(): boolean {
    if (!this.storage) return false;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return this.importState(parsed);
    } catch {
      // Graceful fallback: zachowaj domyślny stan in-memory
      return false;
    }
  }

  /**
   * Resetuje relację z pojedynczym NPC do stanu początkowego.
   */
  public resetNpc(npcId: string): void {
    const coreDef = CORE_FESTIVAL_NPCS[npcId as CoreNpcId];
    if (coreDef) {
      this.relationships.set(npcId, {
        npcId,
        name: coreDef.name,
        score: coreDef.defaultScore,
        tier: coreDef.defaultTier,
        knownTopics: new Set(coreDef.initialTopics),
        favorsCompleted: new Set(),
        lastInteractionTimestamp: 0,
        interactionCooldownMs: coreDef.cooldownMs,
      });
    } else {
      this.relationships.delete(npcId);
    }

    if (this.autoSave) {
      this.save();
    }
  }

  /**
   * Resetuje wszystkie relacje do wartości domyślnych i czyści storage.
   */
  public resetAll(): void {
    this.relationships.clear();
    this.initializeCoreRelationships();
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {}
    }
  }

  /**
   * Zwraca listę wszystkich zarejestrowanych identyfikatorów postaci.
   */
  public getAllNpcIds(): string[] {
    return Array.from(this.relationships.keys());
  }

  /**
   * Zwraca metadane rdzennego NPC.
   */
  public static getCoreNpcDefinition(id: CoreNpcId): CoreNpcDefinition | undefined {
    return CORE_FESTIVAL_NPCS[id];
  }
}
