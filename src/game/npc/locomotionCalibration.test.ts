import { describe, expect, it } from 'vitest';
import {
  NPC_MOTION,
  approachSpeed,
  brakingSpeed,
  locomotionForSpeed,
  referenceSpeedForCycle,
  timeScaleForWorldSpeed,
} from './locomotionCalibration';

describe('locomotion calibration', () => {
  it('measures reference speed from cycle distance and actual clip duration', () => {
    expect(referenceSpeedForCycle('Walk', 2)).toBeCloseTo(0.725);
    expect(referenceSpeedForCycle('Run', 1.6)).toBeCloseTo(2);
  });

  it('keeps world distance per animation cycle stable when clip duration changes', () => {
    const speed = 0.95;
    const shortClipScale = timeScaleForWorldSpeed('Walk', speed, 1);
    const longClipScale = timeScaleForWorldSpeed('Walk', speed, 2);

    expect(shortClipScale).toBeCloseTo(speed / 1.45);
    expect(longClipScale).toBeCloseTo((speed * 2) / 1.45);
    expect(shortClipScale / 1).toBeCloseTo(longClipScale / 2);
  });

  it('accelerates and brakes with bounded changes', () => {
    expect(approachSpeed(0, 2, 0.25, 2, 4)).toBeCloseTo(0.5);
    expect(approachSpeed(2, 0, 0.25, 2, 4)).toBeCloseTo(1);
    expect(approachSpeed(0.9, 1, 1, 2, 4)).toBe(1);
  });

  it('reduces speed along the physical braking distance', () => {
    expect(brakingSpeed(10, NPC_MOTION.walkSpeed)).toBe(NPC_MOTION.walkSpeed);
    expect(brakingSpeed(NPC_MOTION.arrivalRadius, NPC_MOTION.walkSpeed)).toBe(0);
  });

  it('selects locomotion from actual speed without switching normal walkers to Run', () => {
    expect(locomotionForSpeed(0.01, false)).toBe('Idle');
    expect(locomotionForSpeed(0.8, false)).toBe('Walk');
    expect(locomotionForSpeed(2, false)).toBe('Walk');
    expect(locomotionForSpeed(2, true)).toBe('Run');
  });
});
