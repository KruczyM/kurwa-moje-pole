import { describe, expect, it } from 'vitest';
import { MatrixPhaseController } from './MatrixPhaseController';

describe('MatrixPhaseController', () => {
  it('respects off mode with zero alpha', () => {
    const controller = new MatrixPhaseController('off');
    const alpha = controller.update(1.0, true, 1.0, false);
    expect(alpha).toBe(0);
    expect(controller.currentState).toBe('inactive');
  });

  it('produces constant subtle alpha in always mode', () => {
    const controller = new MatrixPhaseController('always');
    const alpha = controller.update(0.1, false, 0.8, false);
    expect(alpha).toBeCloseTo(0.55 * 0.8, 2);
    expect(controller.currentState).toBe('active');

    // With reduceMotion
    const reducedAlpha = controller.update(0.1, false, 0.8, true);
    expect(reducedAlpha).toBeCloseTo(0.25 * 0.8, 2);
  });

  it('progresses through fadeIn -> active -> fadeOut in auto mode when triggered', () => {
    const controller = new MatrixPhaseController('auto', {
      fadeIn: 1.0,
      active: 2.0,
      fadeOut: 1.0,
      interval: 10.0,
    });

    controller.triggerPhase();
    expect(controller.currentState).toBe('fadeIn');

    // Mid fadeIn (0.5s)
    let alpha = controller.update(0.5, true, 1.0, false);
    expect(controller.currentState).toBe('fadeIn');
    expect(alpha).toBeCloseTo(0.5, 2);

    // End fadeIn, into active (0.5s more -> 1.0s total)
    alpha = controller.update(0.5, true, 1.0, false);
    expect(controller.currentState).toBe('active');
    expect(alpha).toBeCloseTo(1.0, 2);

    // Mid active (1.0s)
    alpha = controller.update(1.0, true, 1.0, false);
    expect(controller.currentState).toBe('active');
    expect(alpha).toBeCloseTo(1.0, 2);

    // End active, into fadeOut (1.0s more -> 2.0s active total)
    alpha = controller.update(1.0, true, 1.0, false);
    expect(controller.currentState).toBe('fadeOut');
    expect(alpha).toBeCloseTo(1.0, 2);

    // Mid fadeOut (0.5s)
    alpha = controller.update(0.5, true, 1.0, false);
    expect(controller.currentState).toBe('fadeOut');
    expect(alpha).toBeCloseTo(0.5, 2);

    // End fadeOut (0.5s)
    alpha = controller.update(0.5, true, 1.0, false);
    expect(controller.currentState).toBe('inactive');
    expect(alpha).toBe(0);
  });

  it('triggers automatically after interval when drug effect is active', () => {
    const controller = new MatrixPhaseController('auto', {
      fadeIn: 1.0,
      active: 2.0,
      fadeOut: 1.0,
      interval: 5.0,
    });

    // 4s of drug effect -> not yet triggered
    controller.update(4.0, true, 1.0, false);
    expect(controller.currentState).toBe('inactive');

    // 1.0s more -> exactly reaches interval (5.0s) -> triggers fadeIn
    controller.update(1.0, true, 1.0, false);
    expect(controller.currentState).toBe('fadeIn');
  });

  it('immediately transitions to fadeOut if drug effect ends while active', () => {
    const controller = new MatrixPhaseController('auto', {
      fadeIn: 1.0,
      active: 10.0,
      fadeOut: 1.0,
      interval: 1.0,
    });

    controller.triggerPhase();
    controller.update(1.0, true, 1.0, false); // now active
    expect(controller.currentState).toBe('active');

    // Drug effect ends
    controller.update(0.1, false, 1.0, false);
    expect(controller.currentState).toBe('fadeOut');
  });
});
