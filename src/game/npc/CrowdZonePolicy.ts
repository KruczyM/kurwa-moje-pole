/**
 * CrowdZonePolicy — Strefy aktywności i rozkład tłumu (#KURWAMOJEPOLE).
 *
 * Zadanie D1 z docs/attractions-plan.md:
 * - Strefy wyprowadzone ze stałych layoutu i scen (FESTIVAL_STAGE_SITES, MAIN_ASPHALT_ROAD, PRIMARY_CAMP_PLOT).
 * - Strefy: MAIN_STAGE, SMALL_STAGE, ASP_STAGE, PLAZA, CAMP, KRISHNA.
 * - Profile rozkładu: 'concert' (50-60% Duża Scena, 20-25% Pasaż, reszta Obozy i ASP) vs 'quiet' (równomierny).
 * - Deterministyczne próbkowanie celów z ziarnem (seed), omijanie konstrukcji scen i korytarzy ewakuacyjnych.
 * - Orientacja widowni: obliczanie kąta yaw skierowanego ku centrum sceny.
 * - 100% deterministyczny kod, zero zewnętrznych API.
 */

import { FESTIVAL_STAGE_SITES, stageBounds } from '../world/festivalStages';
import { MAIN_ASPHALT_ROAD, PRIMARY_CAMP_PLOT } from '../world/festivalLayout';

export type CrowdZoneId = 'MAIN_STAGE' | 'SMALL_STAGE' | 'ASP_STAGE' | 'PLAZA' | 'CAMP' | 'KRISHNA';

export const CROWD_ZONE_IDS: readonly CrowdZoneId[] = [
  'MAIN_STAGE',
  'SMALL_STAGE',
  'ASP_STAGE',
  'PLAZA',
  'CAMP',
  'KRISHNA',
] as const;

export interface ZoneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BoxExclusion {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label?: string;
}

export interface CorridorExclusion {
  axis: 'x' | 'z';
  min: number;
  max: number;
  clearMargin: number;
  label?: string;
}

export interface CrowdZoneDefinition {
  id: CrowdZoneId;
  label: string;
  bounds: ZoneBounds;
  stageCenter?: { x: number; z: number };
  focalPoint?: { x: number; z: number };
  capacity: number;
  stayDurationSeconds: [min: number, max: number];
  exclusions?: BoxExclusion[];
  corridors?: CorridorExclusion[];
  safeFallbackPoint: { x: number; z: number };
}

export interface AudienceTarget {
  x: number;
  z: number;
  facingYaw: number;
  zoneId: CrowdZoneId;
}

export type DistributionProfileName = 'concert' | 'quiet';

export type DistributionWeights = Record<CrowdZoneId, number>;

// Pobranie danych geometrycznych scen ze stałych layoutu
const mainStageSite = FESTIVAL_STAGE_SITES.find((s) => s.id === 'mainStage') ?? FESTIVAL_STAGE_SITES[0];

const smallStageSite = FESTIVAL_STAGE_SITES.find((s) => s.id === 'smallStage') ?? FESTIVAL_STAGE_SITES[1];

const mainStageStructureBounds = stageBounds(mainStageSite);
const smallStageStructureBounds = stageBounds(smallStageSite);

/**
 * Definicje stref tłumu wyprowadzone z geometrii świata festiwalu.
 */
export const CROWD_ZONES: Record<CrowdZoneId, CrowdZoneDefinition> = {
  MAIN_STAGE: {
    id: 'MAIN_STAGE',
    label: 'Duża Scena — Pole Koncertowe & Widownia',
    // Pole widowni rozciąga się na zachód od sceny (x < 192, z w przedziale -12 do 48)
    bounds: {
      minX: 130,
      maxX: 190,
      minZ: -12,
      maxZ: 48,
    },
    stageCenter: {
      x: mainStageSite.x, // 216
      z: mainStageSite.z, // 18
    },
    focalPoint: {
      x: mainStageSite.x,
      z: mainStageSite.z,
    },
    capacity: 120,
    stayDurationSeconds: [60, 360],
    exclusions: [
      // Konstrukcja sceny (x: 194..238, z: -22..58) — bez wchodzenia na deski
      {
        minX: mainStageStructureBounds.minX - 1.0,
        maxX: mainStageStructureBounds.maxX + 1.0,
        minZ: mainStageStructureBounds.minZ - 1.0,
        maxZ: mainStageStructureBounds.maxZ + 1.0,
        label: 'Duża Scena — Podest i backstage',
      },
    ],
    corridors: [
      // Korytarz techniczny/ewakuacyjny łączący wieżę FOH i scenę (z = 18 +/- 1.5m)
      {
        axis: 'z',
        min: 16.5,
        max: 19.5,
        clearMargin: 0.8,
        label: 'Korytarz ewakuacyjny FOH — Scena',
      },
    ],
    safeFallbackPoint: { x: 160, z: 8 },
  },

  SMALL_STAGE: {
    id: 'SMALL_STAGE',
    label: 'Mała Scena — Polana Koncertowa',
    // Widownia przed Małą Sceną (wschód od namiotu)
    bounds: {
      minX: -36,
      maxX: -12,
      minZ: 82,
      maxZ: 112,
    },
    stageCenter: {
      x: smallStageSite.x, // -65
      z: smallStageSite.z, // 97
    },
    focalPoint: {
      x: smallStageSite.x,
      z: smallStageSite.z,
    },
    capacity: 35,
    stayDurationSeconds: [45, 240],
    exclusions: [
      {
        minX: smallStageStructureBounds.minX,
        maxX: smallStageStructureBounds.maxX,
        minZ: smallStageStructureBounds.minZ,
        maxZ: smallStageStructureBounds.maxZ,
        label: 'Mała Scena — Konstrukcja podestu',
      },
    ],
    corridors: [
      {
        axis: 'z',
        min: 95.5,
        max: 98.5,
        clearMargin: 0.6,
        label: 'Oś wejściowa Małej Sceny',
      },
    ],
    safeFallbackPoint: { x: -24, z: 90 },
  },

  ASP_STAGE: {
    id: 'ASP_STAGE',
    label: 'Namiot ASP — Warsztaty i Spotkania',
    // Strefa słuchaczy ASP (przednie wnętrze pawilonu i przedpole)
    bounds: {
      minX: -60,
      maxX: -40,
      minZ: 86,
      maxZ: 108,
    },
    stageCenter: {
      x: -65,
      z: 97,
    },
    focalPoint: {
      x: -65,
      z: 97,
    },
    capacity: 25,
    stayDurationSeconds: [40, 200],
    exclusions: [
      {
        minX: -66,
        maxX: -61,
        minZ: 92,
        maxZ: 102,
        label: 'Podest prelegentów ASP',
      },
    ],
    corridors: [
      {
        axis: 'z',
        min: 96.0,
        max: 98.0,
        clearMargin: 0.5,
        label: 'Korytarz centralny ASP',
      },
    ],
    safeFallbackPoint: { x: -50, z: 92 },
  },

  PLAZA: {
    id: 'PLAZA',
    label: 'Pasaż Handlowo-Gastronomiczny (Food Court)',
    // Wzdłuż drogi asfaltowej MAIN_ASPHALT_ROAD (z: -40 do -30) i stref gastronomicznych
    bounds: {
      minX: Math.max(-120, MAIN_ASPHALT_ROAD.minX + 10),
      maxX: Math.min(120, MAIN_ASPHALT_ROAD.maxX - 10),
      minZ: -38,
      maxZ: -24,
    },
    focalPoint: {
      x: 0,
      z: -31,
    },
    capacity: 60,
    stayDurationSeconds: [30, 150],
    exclusions: [
      // Zabudowa stoisk gastronomicznych i handlowych po stronie północnej
      {
        minX: -125,
        maxX: 125,
        minZ: -55,
        maxZ: -39,
        label: 'Zabudowa stoisk pasażu',
      },
    ],
    corridors: [
      // Ciąg pieszy wzdłuż głównej osi drogi
      {
        axis: 'z',
        min: -35.5,
        max: -33.5,
        clearMargin: 0.6,
        label: 'Główny trakt pieszy pasażu',
      },
    ],
    safeFallbackPoint: { x: 0, z: -27 },
  },

  CAMP: {
    id: 'CAMP',
    label: 'Główny Obóz #KURWAMOJEPOLE & Pole Namiotowe',
    // Oparty o PRIMARY_CAMP_PLOT (x: -18..18, z: -18..18)
    bounds: {
      minX: PRIMARY_CAMP_PLOT.minX - 4,
      maxX: PRIMARY_CAMP_PLOT.maxX + 4,
      minZ: PRIMARY_CAMP_PLOT.minZ - 4,
      maxZ: PRIMARY_CAMP_PLOT.maxZ + 4,
    },
    focalPoint: {
      x: 0,
      z: 0,
    },
    capacity: 45,
    stayDurationSeconds: [60, 300],
    exclusions: [
      // Palenisko ogniska i stół Mad Dog w centrum
      {
        minX: -1.8,
        maxX: 1.8,
        minZ: -1.8,
        maxZ: 1.8,
        label: 'Centrum obozu (palenisko)',
      },
    ],
    corridors: [],
    safeFallbackPoint: { x: 6, z: 6 },
  },

  KRISHNA: {
    id: 'KRISHNA',
    label: 'Pokojowa Wioska Kryszny — Kuchnia i Relaks',
    // Wokół namiotu Wioski Kryszny (x: -88, z: 28)
    bounds: {
      minX: -102,
      maxX: -74,
      minZ: 16,
      maxZ: 40,
    },
    focalPoint: {
      x: -88,
      z: 28,
    },
    capacity: 25,
    stayDurationSeconds: [45, 180],
    exclusions: [
      // Trzon namiotu krysznowego
      {
        minX: -93.5,
        maxX: -82.5,
        minZ: 24.5,
        maxZ: 31.5,
        label: 'Namiot Wioski Kryszny',
      },
    ],
    corridors: [],
    safeFallbackPoint: { x: -80, z: 20 },
  },
};

/**
 * Profile wag rozkładu tłumu wg specyfikacji D1:
 * - 'concert': 55% Duża Scena (w zakresie 50-60%), 22% Plaza (w zakresie 20-25%), 23% reszta stref.
 * - 'quiet': zrównoważony, równomierny podział po ~16.7% na każdą ze stref.
 */
export const DISTRIBUTION_PROFILES: Record<DistributionProfileName, DistributionWeights> = {
  concert: {
    MAIN_STAGE: 0.55,
    PLAZA: 0.22,
    SMALL_STAGE: 0.06,
    ASP_STAGE: 0.07,
    CAMP: 0.06,
    KRISHNA: 0.04,
  },
  quiet: {
    MAIN_STAGE: 1 / 6,
    SMALL_STAGE: 1 / 6,
    ASP_STAGE: 1 / 6,
    PLAZA: 1 / 6,
    CAMP: 1 / 6,
    KRISHNA: 1 / 6,
  },
};

/**
 * Deterministyczny generator liczb pseudolosowych Mulberry32.
 */
export function createMulberry32(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Deterministyczny hash FNV-1a dla stringów.
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Normalizuje ziarno do 32-bitowej liczby całkowitej.
 */
export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'string') {
    return hashString(seed);
  }
  return Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 0;
}

/**
 * Zwraca definicję danej strefy.
 */
export function getZoneDefinition(zoneId: CrowdZoneId): CrowdZoneDefinition {
  const zone = CROWD_ZONES[zoneId];
  if (!zone) {
    throw new Error(`Unknown crowd zone ID: ${zoneId}`);
  }
  return zone;
}

/**
 * Zwraca maksymalną pojemność danej strefy.
 */
export function getZoneCapacity(zoneId: CrowdZoneId): number {
  return getZoneDefinition(zoneId).capacity;
}

/**
 * Zwraca wagowy profil rozkładu tłumu.
 */
export function getDistributionProfile(profileName: DistributionProfileName): DistributionWeights {
  const profile = DISTRIBUTION_PROFILES[profileName];
  if (!profile) {
    throw new Error(`Unknown distribution profile: ${profileName}`);
  }
  return { ...profile };
}

/**
 * Oblicza kąt obrotu (yaw) widza w radianach, aby patrzył dokładnie na punkt docelowy (np. centrum sceny).
 *
 * Konwencja Three.js projektu: yaw = Math.atan2(dx, dz).
 */
export function calculateFacingYaw(
  targetPos: { x: number; z: number },
  stagePos: { x: number; z: number },
): number {
  const dx = stagePos.x - targetPos.x;
  const dz = stagePos.z - targetPos.z;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) {
    return 0;
  }
  return Math.atan2(dx, dz);
}

/**
 * Sprawdza, czy punkt leży wewnątrz granic strefy.
 */
export function isInsideZone(zoneId: CrowdZoneId, x: number, z: number, margin = 0): boolean {
  const { bounds } = getZoneDefinition(zoneId);
  return (
    x >= bounds.minX - margin &&
    x <= bounds.maxX + margin &&
    z >= bounds.minZ - margin &&
    z <= bounds.maxZ + margin
  );
}

/**
 * Sprawdza, czy punkt koliduje z wykluczeniami strefy (np. konstrukcją sceny lub paleniskiem).
 */
function isInsideExclusion(exclusions: readonly BoxExclusion[] | undefined, x: number, z: number): boolean {
  if (!exclusions || exclusions.length === 0) return false;
  for (const box of exclusions) {
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) {
      return true;
    }
  }
  return false;
}

/**
 * Koryguje współrzędne, aby nie blokować korytarzy komunikacyjnych.
 */
function adjustForCorridors(
  corridors: readonly CorridorExclusion[] | undefined,
  x: number,
  z: number,
  bounds: ZoneBounds,
): { x: number; z: number } {
  if (!corridors || corridors.length === 0) return { x, z };

  let adjX = x;
  let adjZ = z;

  for (const corr of corridors) {
    if (corr.axis === 'z') {
      if (adjZ >= corr.min && adjZ <= corr.max) {
        const mid = (corr.min + corr.max) / 2;
        if (adjZ >= mid) {
          adjZ = Math.min(bounds.maxZ, corr.max + corr.clearMargin);
        } else {
          adjZ = Math.max(bounds.minZ, corr.min - corr.clearMargin);
        }
      }
    } else if (corr.axis === 'x') {
      if (adjX >= corr.min && adjX <= corr.max) {
        const mid = (corr.min + corr.max) / 2;
        if (adjX >= mid) {
          adjX = Math.min(bounds.maxX, corr.max + corr.clearMargin);
        } else {
          adjX = Math.max(bounds.minX, corr.min - corr.clearMargin);
        }
      }
    }
  }

  return { x: adjX, z: adjZ };
}

/**
 * Losuje deterministyczny punkt dla widza wewnątrz danej strefy,
 * z zachowaniem marginesów od konstrukcji scen i drożności korytarzy.
 *
 * Widzowie w strefach scen automatycznie otrzymują yaw skierowany w stronę centrum sceny.
 */
export function sampleAudienceTarget(zoneId: CrowdZoneId, seed: number | string): AudienceTarget {
  const zone = getZoneDefinition(zoneId);
  const prng = createMulberry32(normalizeSeed(seed));
  const { bounds } = zone;

  let targetX = zone.safeFallbackPoint.x;
  let targetZ = zone.safeFallbackPoint.z;
  let foundValid = false;

  for (let attempt = 0; attempt < 16; attempt++) {
    const rawX = bounds.minX + prng() * (bounds.maxX - bounds.minX);
    const rawZ = bounds.minZ + prng() * (bounds.maxZ - bounds.minZ);

    const adjusted = adjustForCorridors(zone.corridors, rawX, rawZ, bounds);

    if (!isInsideExclusion(zone.exclusions, adjusted.x, adjusted.z)) {
      targetX = adjusted.x;
      targetZ = adjusted.z;
      foundValid = true;
      break;
    }
  }

  if (!foundValid) {
    targetX = zone.safeFallbackPoint.x;
    targetZ = zone.safeFallbackPoint.z;
  }

  const focal = zone.stageCenter ?? zone.focalPoint ?? { x: 0, z: 0 };
  const facingYaw = calculateFacingYaw({ x: targetX, z: targetZ }, focal);

  return {
    x: targetX,
    z: targetZ,
    facingYaw,
    zoneId,
  };
}

/**
 * Deterministycznie losuje strefę docelową według zadanego profilu rozkładu.
 */
export function sampleZoneForProfile(
  profileOrWeights: DistributionProfileName | DistributionWeights,
  seed: number | string,
): CrowdZoneId {
  const weights =
    typeof profileOrWeights === 'string' ? getDistributionProfile(profileOrWeights) : profileOrWeights;

  const prng = createMulberry32(normalizeSeed(seed));
  const roll = prng();

  let totalWeight = 0;
  for (const id of CROWD_ZONE_IDS) {
    totalWeight += weights[id] ?? 0;
  }

  if (totalWeight <= 0) {
    return 'MAIN_STAGE';
  }

  let cumulative = 0;
  for (const id of CROWD_ZONE_IDS) {
    const normalizedWeight = (weights[id] ?? 0) / totalWeight;
    cumulative += normalizedWeight;
    if (roll < cumulative) {
      return id;
    }
  }

  return CROWD_ZONE_IDS[CROWD_ZONE_IDS.length - 1];
}

/**
 * Mapuje rolę NPC i bieżący stan festiwalu na preferowaną strefę aktywności.
 */
export function getZoneForRole(
  role: string,
  state: 'concert' | 'quiet' | string = 'quiet',
  seed: number | string = 0,
): CrowdZoneId {
  const isConcert =
    state === 'concert' ||
    state === 'playing' ||
    state === 'intro' ||
    state === 'cheering' ||
    state === 'applause' ||
    state === 'encore';

  const prng = createMulberry32(normalizeSeed(seed));

  switch (role) {
    case 'stage_dancer':
      return 'MAIN_STAGE';

    case 'asp_listener':
      return 'ASP_STAGE';

    case 'food_queue':
      return 'PLAZA';

    case 'chiller':
      if (isConcert) {
        const r = prng();
        if (r < 0.4) return 'MAIN_STAGE';
        if (r < 0.7) return 'CAMP';
        return 'KRISHNA';
      }
      return prng() < 0.6 ? 'CAMP' : 'KRISHNA';

    case 'walker':
    default:
      return sampleZoneForProfile(isConcert ? 'concert' : 'quiet', seed);
  }
}
