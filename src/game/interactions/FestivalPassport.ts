export interface FestivalStamp {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface PassportProgress {
  collected: number;
  total: number;
  percentage: number;
}

export interface FestivalPassportOptions {
  storageKey?: string;
  onStampAwarded?: (stamp: FestivalStamp) => void;
}

interface PassportStorageSchema {
  version: 1;
  stamps: Record<string, { unlocked: boolean; unlockedAt?: number }>;
}

export const DEFAULT_STAMPS: readonly Omit<FestivalStamp, 'unlocked' | 'unlockedAt'>[] = [
  {
    id: 'ferris_wheel',
    title: 'Wysokie Loty',
    description: 'Przejażdżka kołem widokowym nad festiwalowym polem.',
    icon: '🎡',
  },
  {
    id: 'clean_field',
    title: 'Czyste Pole',
    description: 'Zebrano i oddano 10 puszek do eko-zagrody recyklingowej.',
    icon: '♻️',
  },
  {
    id: 'patrol_quiz',
    title: 'Egzamin Patrolu',
    description: 'Pomyślnie rozwiązano quiz wiedzy i bezpieczeństwa Pokojowego Patrolu.',
    icon: '🦺',
  },
  {
    id: 'bingo_win',
    title: 'Festiwalowe Bingo',
    description: 'Ukończono zwycięską linię w festiwalowym Bingo 3x3.',
    icon: '🎯',
  },
  {
    id: 'water_refill',
    title: 'Festiwalowe Nawodnienie',
    description: 'Ugaszono pragnienie przy ujęciu wody lub orzeźwiającym grzybku.',
    icon: '💧',
  },
  {
    id: 'mud_bath',
    title: 'Kąpiel Błotna',
    description: 'Tradycyjna festiwalowa ochłoda w basenie błotnym.',
    icon: '🐗',
  },
  {
    id: 'flanki_player',
    title: 'Mistrz Flanek',
    description: 'Rozegrano emocjonujący mecz w polskiej tradycji flanek.',
    icon: '🍺',
  },
  {
    id: 'main_stage',
    title: 'Pod Dużą Sceną',
    description: 'Wizyta w sercu festiwalu pod legendarną Dużą Sceną.',
    icon: '🎸',
  },
  {
    id: 'tent_builder',
    title: 'Własne M2',
    description: 'Zlokalizowano lub rozbito własny namiot na festiwalowym polu.',
    icon: '⛺',
  },
  {
    id: 'campfire_guitar',
    title: 'Bard Ogniska',
    description: 'Zagrano festiwalowy hymn na gitarze akustycznej przy ognisku.',
    icon: '🪕',
  },
] as const;

export const EVENT_TO_STAMP_MAP: Record<string, string> = {
  campfire_guitar: 'campfire_guitar',
  guitar_played: 'campfire_guitar',
  // Ferris Wheel
  ferris_wheel: 'ferris_wheel',
  ferris_wheel_ride: 'ferris_wheel',
  wheel_ride_completed: 'ferris_wheel',
  mlyn: 'ferris_wheel',

  // Clean Field / Can Collection
  clean_field: 'clean_field',
  clean_field_completed: 'clean_field',
  cans_deposited: 'clean_field',
  puszki: 'clean_field',

  // Patrol Quiz
  patrol_quiz: 'patrol_quiz',
  patrol_quiz_completed: 'patrol_quiz',
  quiz_completed: 'patrol_quiz',
  quiz: 'patrol_quiz',

  // Festival Bingo
  bingo_win: 'bingo_win',
  bingo_completed: 'bingo_win',
  bingo: 'bingo_win',

  // Water
  water_refill: 'water_refill',
  water_refilled: 'water_refill',
  drank_water: 'water_refill',
  grzybek_visit: 'water_refill',
  woda: 'water_refill',

  // Mud Bath
  mud_bath: 'mud_bath',
  mud_bath_visited: 'mud_bath',
  bloto: 'mud_bath',

  // Flanki
  flanki_player: 'flanki_player',
  flanki_match_completed: 'flanki_player',
  flanki: 'flanki_player',

  // Main Stage
  main_stage: 'main_stage',
  main_stage_visited: 'main_stage',
  scena: 'main_stage',

  // Tent
  tent_builder: 'tent_builder',
  tent_placed: 'tent_builder',
  namiot: 'tent_builder',
};

const DEFAULT_STORAGE_KEY = 'festival_passport_v1';

export class FestivalPassport {
  private readonly storageKey: string;
  private readonly stamps: Map<string, FestivalStamp> = new Map();
  private readonly onStampAwarded?: (stamp: FestivalStamp) => void;

  constructor(options?: FestivalPassportOptions) {
    this.storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;
    this.onStampAwarded = options?.onStampAwarded;

    // Inicjalizacja domyślnych pieczątek
    for (const def of DEFAULT_STAMPS) {
      this.stamps.set(def.id, {
        ...def,
        unlocked: false,
      });
    }

    this.loadFromStorage();
  }

  /**
   * Rejestruje zdarzenie festiwalowe. Jeśli zdarzenie odpowiada pieczątce
   * i nie została ona jeszcze odblokowana, pieczątka zostaje przyznana.
   * Operacja jest w pełni idempotentna.
   */
  recordEvent(eventId: string): FestivalStamp | null {
    if (!eventId || typeof eventId !== 'string') return null;

    const stampId = EVENT_TO_STAMP_MAP[eventId.toLowerCase().trim()] ?? eventId.trim();
    const stamp = this.stamps.get(stampId);

    if (!stamp) return null;

    if (stamp.unlocked) {
      return { ...stamp };
    }

    stamp.unlocked = true;
    stamp.unlockedAt = Date.now();

    this.saveToStorage();

    if (this.onStampAwarded) {
      try {
        this.onStampAwarded({ ...stamp });
      } catch {
        // Callback nie może przerwać działania paszportu
      }
    }

    return { ...stamp };
  }

  /** Alias dla recordEvent ułatwiający bezpośrednie nadanie pieczątki. */
  awardStamp(stampId: string): FestivalStamp | null {
    return this.recordEvent(stampId);
  }

  /** Sprawdza czy gracz posiada określoną pieczątkę. */
  hasStamp(stampId: string): boolean {
    const stamp = this.stamps.get(stampId);
    return Boolean(stamp?.unlocked);
  }

  /** Pobiera szczegóły danej pieczątki. */
  getStamp(stampId: string): FestivalStamp | undefined {
    const stamp = this.stamps.get(stampId);
    return stamp ? { ...stamp } : undefined;
  }

  /** Zwraca listę wszystkich pieczątek. */
  getStamps(): FestivalStamp[] {
    return Array.from(this.stamps.values()).map((s) => ({ ...s }));
  }

  /** Zwraca liczbę zdobytych pieczątek. */
  getStampCount(): number {
    let count = 0;
    for (const stamp of this.stamps.values()) {
      if (stamp.unlocked) count++;
    }
    return count;
  }

  /** Zwraca łączną liczbę dostępnych pieczątek. */
  getTotalCount(): number {
    return this.stamps.size;
  }

  /** Zwraca całościowy postęp paszportu. */
  getProgress(): PassportProgress {
    const collected = this.getStampCount();
    const total = this.getTotalCount();
    const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;
    return { collected, total, percentage };
  }

  /** Czyści wszystkie pieczątki i resetuje zapis. */
  reset(): void {
    for (const stamp of this.stamps.values()) {
      stamp.unlocked = false;
      delete stamp.unlockedAt;
    }
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidSchema(parsed)) return;

      for (const [id, data] of Object.entries(parsed.stamps)) {
        const stamp = this.stamps.get(id);
        if (stamp && data.unlocked) {
          stamp.unlocked = true;
          stamp.unlockedAt = typeof data.unlockedAt === 'number' ? data.unlockedAt : Date.now();
        }
      }
    } catch {
      // Bezpieczny fallback przy błędzie odczytu storage
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const stampsRecord: Record<string, { unlocked: boolean; unlockedAt?: number }> = {};
      for (const [id, stamp] of this.stamps.entries()) {
        stampsRecord[id] = {
          unlocked: stamp.unlocked,
          unlockedAt: stamp.unlockedAt,
        };
      }

      const payload: PassportStorageSchema = {
        version: 1,
        stamps: stampsRecord,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Bezpieczny fallback przy przekroczeniu quota lub braku uprawnień
    }
  }

  private isValidSchema(obj: unknown): obj is PassportStorageSchema {
    if (typeof obj !== 'object' || obj === null) return false;
    const candidate = obj as Record<string, unknown>;
    if (candidate.version !== 1) return false;
    if (typeof candidate.stamps !== 'object' || candidate.stamps === null) return false;
    return true;
  }
}
