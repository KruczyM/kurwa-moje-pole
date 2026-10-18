import { describe, expect, it } from 'vitest';
import {
  sampleWheelSchedule,
  smootherstep,
  WHEEL_CYCLE_SECONDS,
  WHEEL_SCHEDULE_DURATIONS,
} from './wheelSchedule';

describe('wheelSchedule', () => {
  it('implements quintic smootherstep with zero derivatives at endpoints', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(-0.5)).toBe(0);
    expect(smootherstep(1.5)).toBe(1);

    // Monotoniczny wzrost
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const val = smootherstep(i / 100);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }

    // Płaskie końce (bardzo mały przyrost przy 0 i 1)
    expect(smootherstep(0.01)).toBeLessThan(0.0001);
    expect(1 - smootherstep(0.99)).toBeLessThan(0.0001);
  });

  it('correctly transitions through all 4 phases at exact boundary timestamps', () => {
    // 1. Dół [0, 12)
    const t0 = sampleWheelSchedule(0);
    expect(t0.phase).toBe('bottom');
    expect(t0.angle).toBe(0);
    expect(t0.stopped).toBe(true);
    expect(t0.secondsToPhaseEnd).toBe(3);

    const t11_9 = sampleWheelSchedule(2.9);
    expect(t11_9.phase).toBe('bottom');
    expect(t11_9.angle).toBe(0);
    expect(t11_9.stopped).toBe(true);
    expect(t11_9.secondsToPhaseEnd).toBeCloseTo(0.1, 4);

    // 2. Wjazd [12, 48)
    const t12 = sampleWheelSchedule(3);
    expect(t12.phase).toBe('ascending');
    expect(t12.angle).toBeCloseTo(0, 5);
    expect(t12.stopped).toBe(false);
    expect(t12.secondsToPhaseEnd).toBe(20);

    const t30 = sampleWheelSchedule(13); // środek wjazdu (u = 0.5 -> smootherstep = 0.5)
    expect(t30.phase).toBe('ascending');
    expect(t30.angle).toBeCloseTo(Math.PI * 0.5, 4);
    expect(t30.stopped).toBe(false);

    // 3. Góra [48, 53)
    const t48 = sampleWheelSchedule(23);
    expect(t48.phase).toBe('top');
    expect(t48.angle).toBeCloseTo(Math.PI, 4);
    expect(t48.stopped).toBe(true);
    expect(t48.secondsToPhaseEnd).toBe(3);

    const t50 = sampleWheelSchedule(24);
    expect(t50.phase).toBe('top');
    expect(t50.angle).toBeCloseTo(Math.PI, 4);
    expect(t50.stopped).toBe(true);
    expect(t50.secondsToPhaseEnd).toBeCloseTo(2, 4);

    // 4. Zjazd [53, 89)
    const t53 = sampleWheelSchedule(26);
    expect(t53.phase).toBe('descending');
    expect(t53.angle).toBeCloseTo(Math.PI, 4);
    expect(t53.stopped).toBe(false);
    expect(t53.secondsToPhaseEnd).toBe(20);

    const t71 = sampleWheelSchedule(36); // środek zjazdu (u = 0.5)
    expect(t71.phase).toBe('descending');
    expect(t71.angle).toBeCloseTo(Math.PI * 1.5, 4);
    expect(t71.stopped).toBe(false);
  });

  it('cycles smoothly across multiple full revolutions without angle leaps', () => {
    expect(WHEEL_CYCLE_SECONDS).toBe(46);

    for (let cycle = 0; cycle < 3; cycle++) {
      const baseTime = cycle * WHEEL_CYCLE_SECONDS;
      const atStart = sampleWheelSchedule(baseTime);
      expect(atStart.phase).toBe('bottom');
      expect(atStart.angle).toBeCloseTo(0, 4);
      expect(atStart.stopped).toBe(true);

      const atTop = sampleWheelSchedule(baseTime + 24);
      expect(atTop.phase).toBe('top');
      expect(atTop.angle).toBeCloseTo(Math.PI, 4);
      expect(atTop.stopped).toBe(true);

      // Kąt tuż przed końcem cyklu dąży do 2Pi
      const atEnd = sampleWheelSchedule(baseTime + 45.99);
      expect(atEnd.phase).toBe('descending');
      expect(atEnd.angle).toBeCloseTo(Math.PI * 2, 1);
    }
  });

  it('handles negative, NaN, and Infinity times safely', () => {
    for (const badTime of [-1, -100, NaN, Infinity, -Infinity]) {
      const sample = sampleWheelSchedule(badTime);
      expect(sample.phase).toBe('bottom');
      expect(sample.angle).toBe(0);
      expect(sample.stopped).toBe(true);
      expect(sample.secondsToPhaseEnd).toBe(WHEEL_SCHEDULE_DURATIONS.bottom);
    }
  });

  it('distinguishes top stop from bottom stop (only bottom allows boarding/exit)', () => {
    const bottom = sampleWheelSchedule(1);
    const top = sampleWheelSchedule(24);

    expect(bottom.stopped).toBe(true);
    expect(bottom.phase).toBe('bottom');

    expect(top.stopped).toBe(true);
    expect(top.phase).toBe('top');

    // Walidacja kontraktu: tylko phase === 'bottom' zezwala na wsiadanie/wysiadanie
    const canBoardAtBottom = bottom.phase === 'bottom' && bottom.stopped;
    const canBoardAtTop = top.phase === 'bottom' && top.stopped;

    expect(canBoardAtBottom).toBe(true);
    expect(canBoardAtTop).toBe(false);
  });
});
