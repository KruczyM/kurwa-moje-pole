export const MAD_DOG_CONFIG = {
  id: 'MadDog',
  size: [8.8, 6.6] as const,
  height: 3.35,
  poleRadius: 0.09,
  fillLightIntensity: 1.45,
};

export const FLAG_CONFIG = {
  id: 'CampFlag',
  position: [0, 0, 4.8] as const,
  mastHeight: 8.4,
  mastRadius: 0.09,
  flagHeight: 1.9,
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

/** Wspólna, spokojna fala wiatru dla płachty Mad Dog i flagi. */
export function fabricWind(time: number, x: number, z: number) {
  return Math.sin(time * 1.15 + x * 0.72 + z * 0.34) * 0.045 + Math.sin(time * 0.63 + z) * 0.018;
}
