import { describe, expect, it } from 'vitest';
import { validatePlayerTransform, MAP_POSITION_LIMIT } from './networkProtocol';
import { WORLD_LIMIT } from '../world/festivalLayout';

describe('network bounds match the expanded festival', () => {
  it('accepts stage and lower passage positions and still rejects out-of-world positions', () => {
    expect(MAP_POSITION_LIMIT).toBe(WORLD_LIMIT);
    for (const position of [
      [216, 0, 22],
      [66, 0, 72],
      [-WORLD_LIMIT, 0, WORLD_LIMIT],
    ]) {
      expect(validatePlayerTransform({ position, yaw: 0, locomotion: 'Idle', speed: 0 }).valid).toBe(true);
    }
    expect(validatePlayerTransform({ position: [WORLD_LIMIT + 1, 0, 0], yaw: 0 }).valid).toBe(false);
  });
});
