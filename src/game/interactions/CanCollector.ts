import type { FestivalPassport } from './FestivalPassport';
import {
  ecoPosition,
  ECO_OBJECT_COUNT,
  ECO_DURATION_SECONDS,
  ecoPickupKind,
  ecoPickupPoints,
  ecoWaveMultiplier,
  type EcoPoint,
} from './ecoChallenge';

export interface FestivalCan {
  generation?: number;
  id: string;
  label: string;
  position: [number, number, number]; // [x, y, z]
  collected: boolean;
  collectedAt?: number;
  isGolden?: boolean;
}

export interface DepositResult {
  success: boolean;
  depositedCount: number;
  totalDeposited: number;
  badgeAwarded: boolean;
  message: string;
}

export interface RecyclingCorral {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
}

export interface CanMapMarker {
  kind?: 'speed' | 'bundle' | 'trash';
  id: string;
  x: number;
  z: number;
  isGolden?: boolean;
  collected?: boolean;
}

export interface RushResult {
  totalCollected: number;
  totalDeposited: number;
  goldenCansFound: number;
  medal: 'gold' | 'silver' | 'bronze' | 'none';
  message: string;
}

export interface CanCollectorOptions {
  minigameOnly?: boolean;
  onCanRemoved?: (id: string) => void;
  passport?: FestivalPassport;
  storageKey?: string;
  enableRespawns?: boolean;
  respawnDelaySeconds?: number;
  goldenChance?: number;
  onCanCollected?: (can: FestivalCan, currentInventory: number) => void;
  onCansDeposited?: (depositedCount: number, totalDeposited: number) => void;
  onBadgeAwarded?: (badgeName: string) => void;
  onCanSpawned?: (can: FestivalCan) => void;
  onGoldenCanCollected?: (can: FestivalCan) => void;
  onRushFinished?: (result: RushResult) => void;
}

interface CanCollectorStorageSchema {
  version: 1;
  collectedCanIds: string[];
  inventoryCount: number;
  totalDeposited: number;
  badgeAwarded: boolean;
}

export const CAN_INTERACTION_RADIUS = 2.5; // metry
export const CORRAL_INTERACTION_RADIUS = 3.5; // metry
export const TOTAL_CANS_REQUIRED_FOR_BADGE = 10;
export const BADGE_NAME = 'Czyste Pole';

/** Eko Zagrody zdefiniowane w infrastrukturze festiwalu (festivalInfrastructure.ts) */
export const RECYCLING_CORRALS: readonly RecyclingCorral[] = [
  {
    id: 'trash_corral_market',
    label: 'Eko Zagroda Odpadów — Pasaż Handlowy / Obóz',
    x: 0,
    z: 16,
    radius: CORRAL_INTERACTION_RADIUS,
  },
  {
    id: 'trash_corral_field',
    label: 'Eko Zagroda Odpadów — Pole Koncertowe',
    x: 44,
    z: 4,
    radius: CORRAL_INTERACTION_RADIUS,
  },
] as const;

/** 10 początkowych puszek rozlokowanych deterministycznie na otwartych ciągach obozu i pasażu */
export const DEFAULT_FESTIVAL_CANS: readonly Omit<FestivalCan, 'collected' | 'collectedAt'>[] = [
  {
    id: 'can_01_camp_clearing',
    label: 'Puszka przy polanie ogniskowej',
    position: [0.0, 0, -2.5],
  },
  {
    id: 'can_02_north_fireroad',
    label: 'Puszka na północnej drodze pożarowej',
    position: [-5.0, 0, -6.0],
  },
  {
    id: 'can_03_east_fireroad',
    label: 'Puszka przy wschodniej drodze pożarowej',
    position: [5.0, 0, -6.0],
  },
  {
    id: 'can_04_south_path',
    label: 'Puszka na południowej ścieżce obozu',
    position: [0.0, 0, 7.6],
  },
  {
    id: 'can_05_toilet_approach',
    label: 'Puszka na dojściu do toalet',
    position: [-13.5, 0, -5.5],
  },
  {
    id: 'can_06_market_entrance',
    label: 'Puszka przy wejściu na pasaż handlowy',
    position: [-8.0, 0, -24.0],
  },
  {
    id: 'can_07_water_curtain',
    label: 'Puszka w rejonie kurtyny wodnej',
    position: [46.0, 0, -32.0],
  },
  {
    id: 'can_08_mud_pool_lane',
    label: 'Puszka przy basenie błotnym',
    position: [58.0, 0, -10.0],
  },
  {
    id: 'can_09_stage_plaza',
    label: 'Puszka na placu przed Dużą Sceną',
    position: [68.0, 0, 12.0],
  },
  {
    id: 'can_10_wheel_plaza',
    label: 'Puszka w pobliżu koła widokowego',
    position: [110.0, 0, -50.0],
  },
] as const;

/** Pula bezpiecznych punktów spawnu puszek na całym terenie festiwalu */
export const CAN_SPAWN_POOL: readonly [number, number, number][] = [
  [0.0, 0, -2.5],
  [-5.0, 0, -6.0],
  [5.0, 0, -6.0],
  [0.0, 0, 7.6],
  [-13.5, 0, -5.5],
  [-8.0, 0, -24.0],
  [46.0, 0, -32.0],
  [58.0, 0, -10.0],
  [68.0, 0, 12.0],
  [110.0, 0, -50.0],
  [-14.0, 0, -38.0],
  [18.0, 0, -14.0],
  [85.0, 0, -35.0],
  [135.0, 0, 16.0],
  [-25.0, 0, 12.0],
  [-3.0, 0, 18.0],
  [28.0, 0, 5.0],
  [95.0, 0, 20.0],
  [120.0, 0, -20.0],
  [35.0, 0, -45.0],
];

const DEFAULT_STORAGE_KEY = 'festival_can_collector_v1';

type PositionInput = [number, number, number] | [number, number] | { x: number; y?: number; z: number };

function extractXZ(pos: PositionInput): [number, number] {
  if (Array.isArray(pos)) {
    const x = pos[0];
    const z = pos.length > 2 ? (pos[2] ?? 0) : (pos[1] ?? 0);
    return [x, z];
  }
  return [pos.x, pos.z];
}

export class CanCollector {
  private readonly minigameOnly: boolean;
  private readonly onCanRemoved?: (id: string) => void;
  private clearRoundObjects(): void {
    for (const id of this.cans.keys()) this.onCanRemoved?.(id);
    this.cans.clear();
    this.respawnTimers.clear();
    this.ecoPickupAwards.clear();
    this.speedBoostTimer = 0;
    this.ecoRound = undefined;
  }
  private ecoPickupAwards = new Map<string, number>();
  getEcoWaveMultiplier(): number {
    return this.ecoRound && this.isRushRunning ? ecoWaveMultiplier(ECO_DURATION_SECONDS - this.rushTimer) : 1;
  }
  private ecoRound?: { seed: number; pool: readonly EcoPoint[] };
  startEcoRound(seed: number, pool: readonly EcoPoint[], durationSeconds = 180): void {
    if (pool.length < ECO_OBJECT_COUNT) throw new Error('Not enough walkable eco spawn points');
    this.ecoRound = { seed, pool };
    this.cans.clear();
    this.respawnTimers.clear();
    this.ecoPickupAwards.clear();
    this.inventoryCount = 0;
    this.speedBoostTimer = 0;
    for (let i = 0; i < ECO_OBJECT_COUNT; i++) {
      const point = ecoPosition(seed, i, 0, pool);
      const can: FestivalCan = {
        id: `eco_${i}`,
        label:
          ecoPickupKind(i) === 'speed'
            ? 'Eko-Sprint: lody, +35% szybkości na 12 s'
            : ecoPickupKind(i) === 'bundle'
              ? 'Burger Eko: 3 punkty'
              : i % 12 === 8
                ? 'Worek do recyklingu'
                : ['Puszka', 'Butelka', 'Papier'][i % 3],
        position: [point.x, 0, point.z],
        collected: false,
        generation: 0,
        isGolden: false,
      };
      this.cans.set(can.id, can);
      this.onCanSpawned?.({ ...can });
    }
    this.startRush(durationSeconds);
  }
  restoreRejectedPickup(id: string): void {
    const can = this.cans.get(id);
    if (!can?.collected) return;
    const award = this.ecoPickupAwards.get(id) ?? 1;
    can.collected = false;
    this.inventoryCount = Math.max(0, this.inventoryCount - award);
    this.rushCollectedCount = Math.max(0, this.rushCollectedCount - award);
    if (ecoPickupKind(Number(id.slice(4))) === 'speed') this.speedBoostTimer = 0;
    this.respawnTimers.delete(id);
    this.onCanSpawned?.({ ...can });
  }
  private readonly storageKey: string;
  private readonly passport?: FestivalPassport;
  private readonly enableRespawns: boolean;
  private readonly respawnDelaySeconds: number;
  private readonly goldenChance: number;
  private readonly onCanCollected?: (can: FestivalCan, currentInventory: number) => void;
  private readonly onCansDeposited?: (depositedCount: number, totalDeposited: number) => void;
  private readonly onBadgeAwarded?: (badgeName: string) => void;
  private readonly onCanSpawned?: (can: FestivalCan) => void;
  private readonly onGoldenCanCollected?: (can: FestivalCan) => void;
  private readonly onRushFinished?: (result: RushResult) => void;

  private readonly cans: Map<string, FestivalCan> = new Map();
  private readonly respawnTimers: Map<string, number> = new Map();
  private inventoryCount = 0;
  private totalDeposited = 0;
  private badgeAwarded = false;

  // Eko-Rush Challenge State
  private isRushRunning = false;
  private rushTimer = 0;
  private rushCollectedCount = 0;
  private rushGoldenCount = 0;

  // Speed Boost State (Złota Puszka bonus)
  private speedBoostTimer = 0;

  constructor(options?: CanCollectorOptions) {
    this.minigameOnly = options?.minigameOnly ?? false;
    this.onCanRemoved = options?.onCanRemoved;
    this.storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;
    this.passport = options?.passport;
    this.enableRespawns = options?.enableRespawns ?? true;
    this.respawnDelaySeconds = options?.respawnDelaySeconds ?? 20.0;
    this.goldenChance = options?.goldenChance ?? 0.15;
    this.onCanCollected = options?.onCanCollected;
    this.onCansDeposited = options?.onCansDeposited;
    this.onBadgeAwarded = options?.onBadgeAwarded;
    this.onCanSpawned = options?.onCanSpawned;
    this.onGoldenCanCollected = options?.onGoldenCanCollected;
    this.onRushFinished = options?.onRushFinished;

    for (const def of this.minigameOnly ? [] : DEFAULT_FESTIVAL_CANS) {
      this.cans.set(def.id, {
        ...def,
        collected: false,
        isGolden: false,
      });
    }

    this.loadFromStorage();
  }

  /**
   * Zwraca listę puszek aktualnie dostępnych do podniesienia na mapie (jeszcze niezebranych).
   */
  getAvailableCans(): FestivalCan[] {
    return Array.from(this.cans.values())
      .filter((can) => !can.collected)
      .map((can) => ({ ...can }));
  }

  /**
   * Zwraca listę wszystkich puszek wraz ze statusem zebrania.
   */
  getAllCans(): FestivalCan[] {
    return Array.from(this.cans.values()).map((can) => ({ ...can }));
  }

  /**
   * Zwraca markery puszek na 2D mapie festiwalu i HUD kompasie.
   */
  getActiveCanMarkers(): CanMapMarker[] {
    return Array.from(this.cans.values())
      .filter((can) => !can.collected)
      .map((can) => ({
        kind: can.id.startsWith('eco_') ? ecoPickupKind(Number(can.id.slice(4))) : undefined,
        id: can.id,
        x: can.position[0],
        z: can.position[2],
        isGolden: !!can.isGolden,
        collected: false,
      }));
  }

  /**
   * Próbuje zebrać puszkę przez gracza.
   * Wymaga obecności gracza w promieniu 2.5m od puszki.
   * Zwraca true jeśli puszka została pomyślnie podniesiona.
   */
  collectCan(canId: string, playerPos: PositionInput): boolean {
    if (!canId || typeof canId !== 'string') return false;

    const can = this.cans.get(canId.trim());
    if (!can || can.collected) {
      return false;
    }

    const [px, pz] = extractXZ(playerPos);
    const [cx, , cz] = can.position;
    const distance = Math.hypot(px - cx, pz - cz);

    if (distance > CAN_INTERACTION_RADIUS) {
      return false;
    }

    can.collected = true;
    can.collectedAt = Date.now();

    const isGolden = !!can.isGolden;
    if (this.ecoRound) {
      const index = Number(canId.slice(4));
      const award = this.isRushRunning ? ecoPickupPoints(index, ECO_DURATION_SECONDS - this.rushTimer) : 1;
      this.ecoPickupAwards.set(canId, award);
      this.inventoryCount += award;
      if (this.isRushRunning) {
        this.rushCollectedCount += award;
        if (ecoPickupKind(index) === 'speed') this.speedBoostTimer = 12;
      }
    } else if (isGolden) {
      this.inventoryCount += 5; // Złota puszka ma wartość 5 puszek!
      this.speedBoostTimer = 15.0; // 15 sekund boosta do prędkości
      if (this.isRushRunning) {
        this.rushGoldenCount++;
        this.rushCollectedCount += 5;
      }
      this.onGoldenCanCollected?.({ ...can });
    } else {
      this.inventoryCount += 1;
      if (this.isRushRunning) {
        this.rushCollectedCount += 1;
      }
    }

    // Ustawienie timera respawnu puszki w nowym miejscu
    if (this.enableRespawns) {
      const delay = this.isRushRunning ? 4.0 : this.respawnDelaySeconds;
      this.respawnTimers.set(canId, delay);
    }

    this.saveToStorage();

    if (this.onCanCollected) {
      try {
        this.onCanCollected({ ...can }, this.inventoryCount);
      } catch {
        // Callback nie może przerwać działania
      }
    }

    return true;
  }

  /**
   * Oddaje zebrane puszki do eko-zagrody recyklingowej.
   * Jeśli podano pozycję gracza, weryfikuje zasięg do najbliższej zagrody recyklingowej.
   * Oddanie 10 puszek przyznaje odznakę „Czyste Pole” i wywołuje zdarzenie paszportu.
   */
  depositCans(playerPos?: PositionInput): DepositResult {
    if (this.inventoryCount <= 0) {
      return {
        success: false,
        depositedCount: 0,
        totalDeposited: this.totalDeposited,
        badgeAwarded: this.badgeAwarded,
        message: 'Brak puszek w ekwipunku do oddania.',
      };
    }

    if (playerPos) {
      const [px, pz] = extractXZ(playerPos);
      const isNearCorral = RECYCLING_CORRALS.some((corral) => {
        const dist = Math.hypot(px - corral.x, pz - corral.z);
        return dist <= corral.radius;
      });

      if (!isNearCorral) {
        return {
          success: false,
          depositedCount: 0,
          totalDeposited: this.totalDeposited,
          badgeAwarded: this.badgeAwarded,
          message: 'Puszki można oddać tylko w Eko Zagrodzie Odpadów.',
        };
      }
    }

    const countToDeposit = this.inventoryCount;
    this.inventoryCount = 0;
    this.totalDeposited += countToDeposit;

    let justAwardedBadge = false;
    if (this.totalDeposited >= TOTAL_CANS_REQUIRED_FOR_BADGE && !this.badgeAwarded) {
      this.badgeAwarded = true;
      justAwardedBadge = true;

      if (this.passport) {
        try {
          this.passport.recordEvent('clean_field');
        } catch {
          // Błąd paszportu nie przerywa recyklingu
        }
      }

      if (this.onBadgeAwarded) {
        try {
          this.onBadgeAwarded(BADGE_NAME);
        } catch {
          // Błąd callbacku nie przerywa działania
        }
      }
    }

    this.saveToStorage();

    if (this.onCansDeposited) {
      try {
        this.onCansDeposited(countToDeposit, this.totalDeposited);
      } catch {
        // Błąd callbacku nie przerywa działania
      }
    }

    const message = justAwardedBadge
      ? `Oddano ${countToDeposit} puszek! Gratulacje, zdobywasz odznakę „${BADGE_NAME}”! ♻️`
      : `Oddano ${countToDeposit} puszek do recyklingu (łącznie: ${this.totalDeposited}/${TOTAL_CANS_REQUIRED_FOR_BADGE}).`;

    return {
      success: true,
      depositedCount: countToDeposit,
      totalDeposited: this.totalDeposited,
      badgeAwarded: this.badgeAwarded,
      message,
    };
  }

  /**
   * Uruchamia tryb czasowy Eko-Rush Challenge (np. 90 sekund)
   */
  startRush(durationSeconds = 90.0): void {
    this.isRushRunning = true;
    this.rushTimer = durationSeconds;
    this.rushCollectedCount = 0;
    this.rushGoldenCount = 0;
  }

  stopRush(): void {
    this.isRushRunning = false;
    this.rushTimer = 0;
    if (this.ecoRound || this.minigameOnly) this.clearRoundObjects();
  }

  isRushActive(): boolean {
    return this.isRushRunning;
  }

  getRushTimeRemaining(): number {
    return Math.max(0, Math.ceil(this.rushTimer));
  }

  getRushStats(): { timeRemaining: number; cansCollected: number; goldenCans: number } {
    return {
      timeRemaining: Math.max(0, Math.ceil(this.rushTimer)),
      cansCollected: this.rushCollectedCount,
      goldenCans: this.rushGoldenCount,
    };
  }

  /**
   * Zwraca mnożnik prędkości gracza wynikający z zebrania złotej puszki
   */
  getSpeedBoostMultiplier(): number {
    return this.speedBoostTimer > 0 ? 1.35 : 1.0;
  }

  getSpeedBoostRemaining(): number {
    return Math.max(0, this.speedBoostTimer);
  }

  /**
   * Główna pętla aktualizacji respawnów i trybu Rush
   */
  update(dt: number): void {
    // 1. Licznik bonusu prędkości ze złotej puszki
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
    }

    // 2. Licznik wyzwania Eko-Rush
    if (this.isRushRunning) {
      this.rushTimer -= dt;
      if (this.rushTimer <= 0) {
        this.isRushRunning = false;
        this.rushTimer = 0;

        let medal: RushResult['medal'] = 'none';
        if (this.rushCollectedCount >= 20) medal = 'gold';
        else if (this.rushCollectedCount >= 12) medal = 'silver';
        else if (this.rushCollectedCount >= 5) medal = 'bronze';

        const result: RushResult = {
          totalCollected: this.rushCollectedCount,
          totalDeposited: this.totalDeposited,
          goldenCansFound: this.rushGoldenCount,
          medal,
          message:
            medal !== 'none'
              ? `🏆 Wyzwanie Eko-Rush zakończone! Zdobyto medal ${medal.toUpperCase()} (${this.rushCollectedCount} puszek)!`
              : `Koniec wyzwania Eko-Rush. Zebrano ${this.rushCollectedCount} puszek. Spróbuj pobić rekord!`,
        };

        if (this.ecoRound || this.minigameOnly) this.clearRoundObjects();
        this.onRushFinished?.(result);
      }
    }

    // 3. Dynamiczny respawn puszek
    if (this.enableRespawns && this.respawnTimers.size > 0) {
      for (const [canId, timer] of Array.from(this.respawnTimers.entries())) {
        const remaining = timer - dt;
        if (remaining <= 0) {
          this.respawnTimers.delete(canId);
          this.respawnCan(canId);
        } else {
          this.respawnTimers.set(canId, remaining);
        }
      }
    }
  }

  private respawnCan(canId: string): void {
    const can = this.cans.get(canId);
    if (!can) return;
    if (this.ecoRound) {
      const generation = (can.generation ?? 0) + 1;
      const point = ecoPosition(this.ecoRound.seed, Number(canId.slice(4)), generation, this.ecoRound.pool);
      can.position = [point.x, 0, point.z];
      can.generation = generation;
      can.collected = false;
      can.isGolden = false;
      delete can.collectedAt;
      this.onCanSpawned?.({ ...can });
      return;
    }

    // Losujemy punkt ze spawn poola
    const poolIndex = Math.floor(Math.random() * CAN_SPAWN_POOL.length);
    const spawnPos = CAN_SPAWN_POOL[poolIndex];

    const isGolden = Math.random() < this.goldenChance;
    can.position = [spawnPos[0], spawnPos[1], spawnPos[2]];
    can.collected = false;
    delete can.collectedAt;
    can.isGolden = isGolden;
    can.label = isGolden
      ? 'Złota Puszka Woodstock 1995 (5x Wartość + Boost Prędkości!)'
      : `Puszka piwa (${can.id})`;

    this.onCanSpawned?.({ ...can });
  }

  /** Zwraca liczbę puszek niesionych obecnie w plecaku gracza. */
  getInventoryCount(): number {
    return this.inventoryCount;
  }

  /** Zwraca łączną liczbę puszek oddanych dotąd do eko-zagrody. */
  getTotalDeposited(): number {
    return this.totalDeposited;
  }

  /** Czy akcja Czyste Pole została zrealizowana (10 puszek oddanych i przyznana odznaka). */
  isRecyclingCompleted(): boolean {
    return this.badgeAwarded;
  }

  /** Resetuje stan puszek na mapie, ekwipunek i odznakę. */
  reset(): void {
    for (const can of this.cans.values()) {
      can.collected = false;
      can.isGolden = false;
      delete can.collectedAt;
    }
    this.respawnTimers.clear();
    this.inventoryCount = 0;
    this.totalDeposited = 0;
    this.badgeAwarded = false;
    this.isRushRunning = false;
    this.rushTimer = 0;
    this.speedBoostTimer = 0;
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidSchema(parsed)) return;

      this.inventoryCount = parsed.inventoryCount;
      this.totalDeposited = parsed.totalDeposited;
      this.badgeAwarded = parsed.badgeAwarded;

      for (const id of parsed.collectedCanIds) {
        const can = this.cans.get(id);
        if (can) {
          can.collected = true;
        }
      }
    } catch {
      // Bezpieczny fallback przy błędzie odczytu storage
    }
  }

  private saveToStorage(): void {
    if (this.ecoRound) return;
    if (typeof localStorage === 'undefined') return;

    try {
      const collectedCanIds: string[] = [];
      for (const [id, can] of this.cans.entries()) {
        if (can.collected) {
          collectedCanIds.push(id);
        }
      }

      const payload: CanCollectorStorageSchema = {
        version: 1,
        collectedCanIds,
        inventoryCount: this.inventoryCount,
        totalDeposited: this.totalDeposited,
        badgeAwarded: this.badgeAwarded,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Bezpieczny fallback przy błędzie zapisu
    }
  }

  private isValidSchema(obj: unknown): obj is CanCollectorStorageSchema {
    if (typeof obj !== 'object' || obj === null) return false;
    const candidate = obj as Record<string, unknown>;
    if (candidate.version !== 1) return false;
    if (!Array.isArray(candidate.collectedCanIds)) return false;
    if (typeof candidate.inventoryCount !== 'number') return false;
    if (typeof candidate.totalDeposited !== 'number') return false;
    if (typeof candidate.badgeAwarded !== 'boolean') return false;
    return true;
  }
}
