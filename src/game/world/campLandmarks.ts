import { campPosition } from './campLayout';

export const MAD_DOG_CONFIG = {
  id: 'MadDog',
  position: campPosition(48, 37),
  /** Rozmiar po zmniejszeniu poprzedniej skali runtime o 30%. */
  physicalSize: [22.316, 9.576, 22.232] as const,
  fillLightIntensity: 1.45,
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
    rotationY: Math.atan2(-x, -z),
  };
});
