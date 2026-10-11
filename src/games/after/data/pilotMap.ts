import type { MapDefinition } from '../simulation/WorldState';

/** Creates a small pilot campsite; only walls and tent bodies block feet, never ropes/decor. */
export function createPilotMap(): MapDefinition {
  const width = 24;
  const height = 18;
  const collision = Array<boolean>(width * height).fill(false);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const boundary = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const tent = x >= 9 && x <= 12 && y >= 5 && y <= 7;
      collision[y * width + x] = boundary || tent;
    }
  }
  return {
    id: 'after-pilot-camp',
    width,
    height,
    tileSize: 1,
    collision,
    spawns: [
      { x: 3.5, y: 14.5 },
      { x: 4.5, y: 14.5 },
      { x: 3.5, y: 13.5 },
      { x: 4.5, y: 13.5 },
    ],
    interactions: [
      {
        id: 'witness',
        position: { x: 6.5, y: 12.5 },
        radius: 1.5,
        priority: 10,
        prompt: 'Porozmawiaj ze świadkiem',
        once: true,
      },
      {
        id: 'flag',
        position: { x: 19.5, y: 4.5 },
        radius: 1.2,
        priority: 10,
        prompt: 'Odzyskaj flagę',
        once: true,
      },
      {
        id: 'radio',
        position: { x: 16.5, y: 12.5 },
        radius: 1.5,
        priority: 10,
        prompt: 'Sprawdź radio',
        once: true,
      },
      {
        id: 'tracks',
        position: { x: 18.5, y: 9.5 },
        radius: 1.2,
        priority: 10,
        prompt: 'Sprawdź ślady',
        once: true,
      },
      {
        id: 'friend',
        position: { x: 20.5, y: 7.5 },
        radius: 1.5,
        priority: 10,
        prompt: 'Odnajdź znajomego',
        once: true,
      },
      {
        id: 'cable',
        position: { x: 7.5, y: 4.5 },
        radius: 1.2,
        priority: 10,
        prompt: 'Podłącz kabel',
        once: true,
      },
      {
        id: 'power',
        position: { x: 14.5, y: 4.5 },
        radius: 1.2,
        priority: 10,
        prompt: 'Uruchom zasilanie',
        once: true,
      },
      {
        id: 'camp-return',
        position: { x: 5.5, y: 14.5 },
        radius: 1.5,
        priority: 0,
        prompt: 'Wróć do obozu',
        once: false,
      },
    ],
  };
}
