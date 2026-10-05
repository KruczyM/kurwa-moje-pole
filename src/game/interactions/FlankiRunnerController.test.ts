import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { FlankiRunnerController } from './FlankiRunnerController';

describe('FlankiRunnerController', () => {
  it('initializes in idle state at base position', () => {
    const runner = new FlankiRunnerController({
      id: 'runner_a',
      name: 'Kobra',
      team: 'A',
      baseLineZ: -20,
      basePosition: new THREE.Vector3(1.5, 0, -20.5),
    });

    expect(runner.getState()).toBe('idle_at_base');
    expect(runner.currentPosition.x).toBe(1.5);
    expect(runner.currentPosition.z).toBe(-20.5);
  });

  it('runs to can, rights it after delay, and runs back across base line to shout STOP', () => {
    const onCanRighted = vi.fn();
    const onStopCalled = vi.fn();

    const runner = new FlankiRunnerController({
      id: 'runner_b',
      name: 'Dziąsło',
      team: 'B',
      baseLineZ: -32,
      basePosition: new THREE.Vector3(1.5, 0, -32.5),
      runSpeed: 6.0,
      rightingDuration: 0.3,
      onCanRighted,
      onStopCalled,
    });

    // Start run towards can at (0, 0, -26)
    const canPos = new THREE.Vector3(0, 0, -26);
    runner.startRun(canPos);
    expect(runner.getState()).toBe('running_to_can');

    // Distance from (1.5, 0, -32.5) to (0, 0, -26) is sqrt(1.5^2 + 6.5^2) = ~6.67m
    // At 6m/s, takes ~1.11s. Update by 0.5s -> still running
    runner.update(0.5);
    expect(runner.getState()).toBe('running_to_can');

    // Update by 0.7s -> reaches can, transitions to righting_can
    runner.update(0.7);
    expect(runner.getState()).toBe('righting_can');

    // Righting delay is 0.3s. Update by 0.35s -> triggers callback and runs back
    runner.update(0.35);
    expect(onCanRighted).toHaveBeenCalledTimes(1);
    expect(runner.getState()).toBe('running_back');

    // Running back to base at Z = -32.5. Distance is ~6.67m. Update by 1.2s -> crosses line
    runner.update(1.2);
    expect(runner.getState()).toBe('crossed_line');
    expect(onStopCalled).toHaveBeenCalledWith('Dziąsło');
  });
});
