export type TentModelId =
  'main' | 'small' | 'small2' | 'large' | 'big2' | 'white' | 'colorful' | 'classic' | 'blue' | 'blueOrange';

export type TentConfig = {
  id: `T${number}`;
  label: string;
  model: TentModelId;
  position: [number, number, number];
  rotationY: number;
  /** Docelowa wysokość modelu w metrach po normalizacji źródłowego GLB. */
  scale: number;
  collider: {
    type: 'box';
    /** Szerokość i głębokość uproszczonego proxy kolizji w metrach. */
    size: [number, number];
  };
};

/**
 * Stabilny układ T01–T15 odwzorowujący roboczą mapę obozu.
 * Kolejność i warianty są celowo jawne, dzięki czemu „losowy” zestaw namiotów
 * nie zmienia się między uruchomieniami i może później dostać właścicieli.
 */
export const tentLayout: readonly TentConfig[] = [
  {
    id: 'T01',
    label: 'Namiot T01',
    model: 'big2',
    position: [-11, 0, -9],
    rotationY: 0.08,
    scale: 1.8,
    collider: { type: 'box', size: [4.8, 2.6] },
  },
  {
    id: 'T02',
    label: 'Namiot T02',
    model: 'small',
    position: [-5.2, 0, -8.6],
    rotationY: -0.08,
    scale: 1.55,
    collider: { type: 'box', size: [2.45, 2.4] },
  },
  {
    id: 'T03',
    label: 'Namiot T03',
    model: 'blue',
    position: [0, 0, -8.7],
    rotationY: 0.04,
    scale: 1.5,
    collider: { type: 'box', size: [2.65, 2.55] },
  },
  {
    id: 'T04',
    label: 'Namiot T04',
    model: 'white',
    position: [5.2, 0, -8.6],
    rotationY: -0.06,
    scale: 1.5,
    collider: { type: 'box', size: [2.3, 2.2] },
  },
  {
    id: 'T05',
    label: 'Namiot T05',
    model: 'small2',
    position: [10.5, 0, -7.5],
    rotationY: -0.35,
    scale: 1.55,
    collider: { type: 'box', size: [2.35, 2.1] },
  },
  {
    id: 'T06',
    label: 'Namiot T06',
    model: 'classic',
    position: [10.2, 0, -1.7],
    rotationY: 0.04,
    scale: 1.65,
    collider: { type: 'box', size: [2.8, 3.1] },
  },
  {
    id: 'T07',
    label: 'Namiot T07',
    model: 'colorful',
    position: [-11, 0, -2.4],
    rotationY: 0.03,
    scale: 1.55,
    collider: { type: 'box', size: [2.5, 3.1] },
  },
  {
    id: 'T08',
    label: 'Namiot T08',
    model: 'blueOrange',
    position: [-11, 0, 3.4],
    rotationY: -0.04,
    scale: 1.5,
    collider: { type: 'box', size: [2.55, 2.45] },
  },
  {
    id: 'T09',
    label: 'Namiot T09',
    model: 'small2',
    position: [-7, 0, 6.4],
    rotationY: -0.08,
    scale: 1.5,
    collider: { type: 'box', size: [2.2, 2.5] },
  },
  {
    id: 'T10',
    label: 'Duży namiot T10',
    model: 'large',
    position: [-2.7, 0, 8.6],
    rotationY: -0.1,
    scale: 1.72,
    collider: { type: 'box', size: [2.6, 3.75] },
  },
  {
    id: 'T11',
    label: 'Duży namiot T11',
    model: 'main',
    position: [2.7, 0, 8.3],
    rotationY: 0.08,
    scale: 1.8,
    collider: { type: 'box', size: [4.2, 4.2] },
  },
  {
    id: 'T12',
    label: 'Namiot T12',
    model: 'classic',
    position: [7.5, 0, 7.3],
    rotationY: -0.12,
    scale: 1.65,
    collider: { type: 'box', size: [2.8, 3.35] },
  },
  {
    id: 'T13',
    label: 'Namiot T13',
    model: 'white',
    position: [9.3, 0, 12.2],
    rotationY: 0.08,
    scale: 1.48,
    collider: { type: 'box', size: [2.3, 2.2] },
  },
  {
    id: 'T14',
    label: 'Namiot T14',
    model: 'big2',
    position: [-8.2, 0, 12.3],
    rotationY: -0.08,
    scale: 1.7,
    collider: { type: 'box', size: [3, 2.8] },
  },
  {
    id: 'T15',
    label: 'Duży namiot T15',
    model: 'large',
    position: [-3.2, 0, 14],
    rotationY: 0.08,
    scale: 1.72,
    collider: { type: 'box', size: [2.6, 3.75] },
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
