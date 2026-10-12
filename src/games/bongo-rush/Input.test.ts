import { describe, expect, it } from 'vitest';
import { GridInput } from './Input';

describe('cardinal joystick and keyboard', () => {
  it('selects the latest held key and resets all input', () => {
    const input = new GridInput();
    input.keys.add('KeyW');
    input.keys.add('KeyD');
    expect(input.direction()).toBe('right');
    input.keys.delete('KeyD');
    expect(input.direction()).toBe('up');
    input.reset();
    expect(input.direction()).toBeUndefined();
  });
  it('has a deadzone, suppresses diagonal jitter and switches after a deliberate turn', () => {
    const input = new GridInput();
    input.joystick.begin(1);
    input.joystick.move(1, 1, 1, 40);
    expect(input.direction()).toBeUndefined();
    input.joystick.move(1, 30, 27, 40);
    expect(input.direction()).toBe('right');
    input.joystick.move(1, 27, 30, 40);
    expect(input.direction()).toBe('right');
    input.joystick.move(1, 2, 35, 40);
    expect(input.direction()).toBe('down');
    input.joystick.end(1);
    expect(input.direction()).toBeUndefined();
  });
  it('ignores a second finger and releases on cancel/reset', () => {
    const input = new GridInput();
    expect(input.joystick.begin(1)).toBe(true);
    expect(input.joystick.begin(2)).toBe(false);
    input.joystick.move(1, -30, 0, 40);
    expect(input.direction()).toBe('left');
    input.joystick.move(2, 30, 0, 40);
    expect(input.direction()).toBe('left');
    input.joystick.end(2);
    expect(input.direction()).toBe('left');
    input.reset();
    expect(input.direction()).toBeUndefined();
  });
  it('never emits a horizontal move for a purely vertical low-strength turn', () => {
    const input = new GridInput();
    input.joystick.begin(1);
    input.joystick.move(1, 35, 0, 40);
    expect(input.direction()).toBe('right');
    input.joystick.move(1, 0, 12, 40);
    expect(input.direction()).toBe('down');
  });
});
