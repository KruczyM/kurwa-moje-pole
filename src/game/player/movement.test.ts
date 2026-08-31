import { describe, it, expect } from 'vitest';
import { calculateLocalMove } from './movement';
const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 8);
describe('calculateLocalMove', () => {
  it('moves W forward at yaw 0', () => {
    const v = calculateLocalMove(0, { forward: 1, right: 0 });
    close(v.x, 0);
    close(v.z, -1);
  });
  it('rotates forward with yaw', () => {
    const v = calculateLocalMove(Math.PI / 2, { forward: 1, right: 0 });
    close(v.x, -1);
    close(v.z, 0);
  });
  it('moves S backwards', () => {
    const v = calculateLocalMove(0, { forward: -1, right: 0 });
    close(v.x, 0);
    close(v.z, 1);
  });
  it('strafes in local left/right directions', () => {
    const l = calculateLocalMove(Math.PI / 2, { forward: 0, right: -1 }),
      r = calculateLocalMove(Math.PI / 2, { forward: 0, right: 1 });
    close(l.x, 0);
    close(l.z, 1);
    close(r.x, 0);
    close(r.z, -1);
  });
  it('normalizes diagonal movement', () => {
    const v = calculateLocalMove(0, { forward: 1, right: 1 });
    close(Math.hypot(v.x, v.z), 1);
  });
  it('is independent from camera pitch by design', () => {
    expect(calculateLocalMove(0.7, { forward: 1, right: 0 })).toEqual(
      calculateLocalMove(0.7, { forward: 1, right: 0 }),
    );
  });
});
