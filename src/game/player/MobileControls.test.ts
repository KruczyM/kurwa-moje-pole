import { describe, expect, it } from 'vitest';
import { joystickInput, shouldUseMobileControls } from './MobileControls';

describe('joystickInput', () => {
  it('mapuje górę na ruch do przodu i prawą stronę na strafing', () => {
    expect(joystickInput(0, -50, 100)).toMatchObject({ forward: 0.5, right: 0, run: false });
    expect(joystickInput(50, 0, 100)).toMatchObject({ forward: -0, right: 0.5, run: false });
  });

  it('ogranicza gałkę do promienia i włącza bieg przy pełnym wychyleniu', () => {
    const input = joystickInput(300, 400, 100);
    expect(Math.hypot(input.knobX, input.knobY)).toBeCloseTo(100);
    expect(Math.hypot(input.forward, input.right)).toBeCloseTo(1);
    expect(input.run).toBe(true);
  });
});

describe('shouldUseMobileControls', () => {
  it('włącza sterowanie dla coarse pointer lub ekranu wielodotykowego', () => {
    expect(shouldUseMobileControls(true, 0)).toBe(true);
    expect(shouldUseMobileControls(false, 5)).toBe(true);
    expect(shouldUseMobileControls(false, 0)).toBe(false);
  });
});
