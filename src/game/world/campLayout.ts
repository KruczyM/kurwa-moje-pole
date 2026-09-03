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
    physicalSize: LARGE,
    fit: 'exact-source-correction',
    groundOffset: -0.87,
    collider: { type: 'box', size: LARGE_COLLIDER },
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
