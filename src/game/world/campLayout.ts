export type TentModelId =
  'main' | 'small' | 'small2' | 'large' | 'big2' | 'white' | 'colorful' | 'blue' | 'blueOrange';

export type PhysicalSize = readonly [widthX: number, heightY: number, depthZ: number];
export type TentFit = 'uniform-height' | 'exact-source-correction';

export type TentConfig = {
  id: `T${number}`;
  label: string;
  model: Exclude<TentModelId, 'main'>;
  position: [number, number, number];
  rotationY: number;
  /** Docelowe wymiary świata w metrach: X (szerokość), Y (wysokość), Z (długość). */
  physicalSize: PhysicalSize;
  /** Skalowanie nierównomierne jest używane tylko dla modeli o błędnych proporcjach źródłowych. */
  fit: TentFit;
  /** Korekta styku z gruntem dla modeli zawierających geometrię poniżej właściwej podłogi namiotu. */
  groundOffset?: number;
  collider: {
    type: 'box';
    /** Szerokość X i długość Z uproszczonego proxy kolizji w metrach. */
    size: [number, number];
  };
};

export const CAMP_LAYOUT_SIZE = { width: 30, depth: 30 } as const;

/** Przelicza pozycję procentową ze szkicu (lewy górny róg) na metry świata Three.js. */
export function campPosition(xPercent: number, yPercent: number): [number, number, number] {
  return [
    (xPercent / 100 - 0.5) * CAMP_LAYOUT_SIZE.width,
    0,
    (yPercent / 100 - 0.5) * CAMP_LAYOUT_SIZE.depth,
  ];
}

const SMALL: PhysicalSize = [4.2, 2.8, 3.6];
const SMALL_COLLIDER: [number, number] = [4.2, 3.6];
/** Duże namioty: szerokość i długość bazowego 5.2 zwiększone o 15%, wysokość jak w małych namiotach. */
const LARGE: PhysicalSize = [4.1975, 2.8, 6.44];
const LARGE_COLLIDER: [number, number] = [4.1975, 6.44];

/** Deterministyczny układ mapy T01–T15; jedna jednostka świata odpowiada jednemu metrowi. */
export const tentLayout: readonly TentConfig[] = [
  {
    id: 'T01',
    label: 'Rodzinny namiot T01',
    model: 'big2',
    position: campPosition(24, 17),
    rotationY: Math.PI * 1.5,
    physicalSize: [7.56, 5.04, 11.592],
    fit: 'exact-source-correction',
    groundOffset: -2.2,
    // Collider obejmuje płótno namiotu, ale pomija linki i odciągi modelu.
    collider: { type: 'box', size: [5.2, 7.6] },
  },
  {
    id: 'T02',
    label: 'Namiot T02',
    model: 'small',
    position: campPosition(44, 16),
    rotationY: -0.052,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T03',
    label: 'Namiot T03',
    model: 'blue',
    position: campPosition(57, 16),
    rotationY: 0,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T04',
    label: 'Namiot T04',
    model: 'white',
    position: campPosition(71, 17),
    rotationY: 0.052,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    groundOffset: -0.45,
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T05',
    label: 'Namiot T05',
    model: 'small2',
    position: campPosition(88, 21),
    rotationY: 0.262,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T06',
    label: 'Namiot T06',
    model: 'small',
    position: campPosition(10, 40),
    rotationY: -0.052,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T07',
    label: 'Namiot T07',
    model: 'colorful',
    position: campPosition(83, 39),
    rotationY: 0,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T08',
    label: 'Namiot T08',
    model: 'blueOrange',
    position: campPosition(11, 62),
    rotationY: 0,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T09',
    label: 'Rodzinny namiot T09',
    model: 'large',
    position: campPosition(29, 64),
    rotationY: -0.105,
    physicalSize: LARGE,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: LARGE_COLLIDER },
  },
  {
    id: 'T10',
    label: 'Namiot T10',
    model: 'small',
    position: campPosition(45, 65),
    rotationY: -0.087,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T11',
    label: 'Namiot T11',
    model: 'blue',
    position: campPosition(63, 65),
    rotationY: -0.122,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T12',
    label: 'Namiot T12',
    model: 'colorful',
    position: campPosition(76, 62),
    rotationY: -0.105,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T13',
    label: 'Namiot T13',
    model: 'white',
    position: campPosition(22, 82),
    rotationY: -0.122,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    groundOffset: -0.45,
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
  {
    id: 'T14',
    label: 'Rodzinny namiot T14',
    model: 'large',
    position: campPosition(37, 83),
    rotationY: -0.087,
    physicalSize: LARGE,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: LARGE_COLLIDER },
  },
  {
    id: 'T15',
    label: 'Namiot T15',
    model: 'small2',
    position: campPosition(62, 83),
    rotationY: 0.052,
    physicalSize: SMALL,
    fit: 'exact-source-correction',
    collider: { type: 'box', size: SMALL_COLLIDER },
  },
] as const;

/** Oblicza osiowy collider obróconego namiotu używany przez gracza, NPC i testy tras. */
export function tentColliderBounds(tent: TentConfig) {
  const [width, depth] = tent.collider.size;
  const cosine = Math.abs(Math.cos(tent.rotationY));
  const sine = Math.abs(Math.sin(tent.rotationY));
  const halfX = (width * cosine + depth * sine) / 2;
  const halfZ = (width * sine + depth * cosine) / 2;
  return {
    minX: tent.position[0] - halfX,
    maxX: tent.position[0] + halfX,
    minZ: tent.position[2] - halfZ,
    maxZ: tent.position[2] + halfZ,
  };
}

/** Sprawdza punkt drogi z marginesem kapsuły gracza/NPC względem wszystkich namiotów. */
export function isOutsideTentColliders(x: number, z: number, radius = 0.34) {
  return tentLayout.every((tent) => {
    const bounds = tentColliderBounds(tent);
    return (
      x <= bounds.minX - radius ||
      x >= bounds.maxX + radius ||
      z <= bounds.minZ - radius ||
      z >= bounds.maxZ + radius
    );
  });
}

export type SectorRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type RoadSegment = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/** Sektory namiotowe obozu, w których rośnie gęsta trawa. */
export const CAMP_SECTORS: readonly SectorRect[] = [
  // Sektor Północny - parcela zachodnia (T01, T02)
  { minX: -14.2, maxX: -0.6, minZ: -14.2, maxZ: -7.0 },
  // Sektor Północny - parcela wschodnia (T03, T04, T05)
  { minX: 0.8, maxX: 14.2, minZ: -14.2, maxZ: -7.0 },

  // Sektor Południowo-Zachodni - górny (T08, T09, T10)
  { minX: -14.2, maxX: -0.6, minZ: 2.8, maxZ: 7.0 },
  // Sektor Południowo-Zachodni - dolny (T13, T14)
  { minX: -14.2, maxX: -0.6, minZ: 8.2, maxZ: 14.2 },

  // Sektor Południowo-Wschodni - górny (T11, T12)
  { minX: 0.8, maxX: 14.2, minZ: 2.8, maxZ: 7.0 },
  // Sektor Południowo-Wschodni - dolny (T15)
  { minX: 0.8, maxX: 14.2, minZ: 8.2, maxZ: 14.2 },

  // Parcele boczne przy namiotach T06 i T07
  { minX: -14.2, maxX: -9.2, minZ: -6.0, maxZ: 1.8 },
  { minX: 7.2, maxX: 14.2, minZ: -6.0, maxZ: 1.8 },
];

/** Główne wydeptane drogi pożarowe i arterie komunikacyjne obozu. */
export const FIRE_ROADS: readonly RoadSegment[] = [
  // Północna droga pożarowa Wschód-Zachód (między sektorem północnym a centrum)
  { minX: -16.0, maxX: 16.0, minZ: -7.0, maxZ: -4.8 },

  // Południowa droga pożarowa Wschód-Zachód (między centrum a sektorem południowym)
  { minX: -16.0, maxX: 16.0, minZ: 1.2, maxZ: 2.8 },

  // Droga pożarowa między rzędami południowymi
  { minX: -16.0, maxX: 16.0, minZ: 7.0, maxZ: 8.2 },

  // Główna aleja Północ-Południe przecinająca obóz
  { minX: -0.6, maxX: 0.8, minZ: -16.0, maxZ: 16.0 },

  // Wydeptana droga dojazdowa i dojście do toi-toia wcTron (-12.6, -9.6)
  { minX: -14.8, maxX: -10.4, minZ: -11.2, maxZ: -6.0 },

  // Obwodnica pożarowa wokół głównego obozu (pas ochronny)
  { minX: -17.0, maxX: -14.2, minZ: -17.0, maxZ: 17.0 },
  { minX: 14.2, maxX: 17.0, minZ: -17.0, maxZ: 17.0 },
  { minX: -17.0, maxX: 17.0, minZ: -17.0, maxZ: -14.2 },
  { minX: -17.0, maxX: 17.0, minZ: 14.2, maxZ: 17.0 },
];

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

/**
 * Oblicza pokrycie trawą [0.0 - 1.0] dla zadanego punktu terenu (x, z).
 * - 1.0: gęsta trawa na kwadratowych/prostokątnych połaciach kempingowych (w tym pojedyncza duża parcela obejmująca cały obóz).
 * - 0.0: w pełni wydeptana droga pożarowa / szlak komunikacyjny z widoczną teksturą gleby.
 */
export function sampleCampGrassCoverage(x: number, z: number): number {
  const period = 35.0;
  const halfParcel = 15.5;

  const modX = Math.abs(((((x + 35000.0 + 17.5) % period) + period) % period) - 17.5);
  const modZ = Math.abs(((((z + 35000.0 + 17.5) % period) + period) % period) - 17.5);

  if (modX > halfParcel || modZ > halfParcel) {
    return 0.0;
  }

  const distToEdgeX = halfParcel - modX;
  const distToEdgeZ = halfParcel - modZ;
  const distToEdge = Math.min(distToEdgeX, distToEdgeZ);

  return 0.4 + 0.6 * smoothstep(0.0, 0.6, distToEdge);
}
