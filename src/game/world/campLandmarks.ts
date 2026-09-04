import { campPosition } from './campLayout';

export const TOILET_CONFIG = {
  position: campPosition(8, 18),
} as const;

const toiletEntranceSpawn: readonly [number, number] = [
  TOILET_CONFIG.position[0],
  TOILET_CONFIG.position[2] + 2.8,
];

export const PLAYER_SPAWN_CONFIG = {
  /** Pozycja X/Z przed wejściem do toi-toia, poza colliderem kabiny i namiotu T01. */
  position: toiletEntranceSpawn,
  /** Kamera jest początkowo skierowana od toi-toia w stronę środka obozu. */
  yaw: Math.atan2(toiletEntranceSpawn[0], toiletEntranceSpawn[1]),
} as const;

export const MAD_DOG_CONFIG = {
  id: 'MadDog',
  position: campPosition(48, 37),
  /** Rozmiar po zmniejszeniu poprzedniej skali runtime o 30%. */
  physicalSize: [22.316, 6.576, 22.232] as const,
  ambientFillIntensity: 0.85,
  localFillIntensity: 20,
  localFillDistance: 14,
  localFillHeight: 3.2,
};

export const FLAG_CONFIG = {
  id: 'CampFlag',
  position: campPosition(52, 52),
  height: 16.4,
  colliderRadius: 0.28,
};

export type SeatConfig = {
  id: `S${number}`;
  position: [number, number, number];
  rotationY: number;
};

/** Tworzy osiem stabilnych miejsc w elipsie pod otwartym zadaszeniem. */
export const seatLayout: readonly SeatConfig[] = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  const x = Math.cos(angle) * 3.15;
  const z = Math.sin(angle) * 2.35;
  return {
    id: `S${String(index + 1).padStart(2, '0')}` as `S${number}`,
    position: [x, 0, z],
    rotationY: Math.atan2(-x, -z) + Math.PI,
  };
});
