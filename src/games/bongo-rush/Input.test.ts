import { describe, expect, it } from 'vitest';
import { GridInput, padDirection } from './Input';

describe('digital four-way pad', () => {
  it('accepts an arrow immediately, retains one short tap and never repeats it after release', () => {
    const input = new GridInput();
    expect(input.beginPad(1, 'up')).toBe(true);
    expect(input.direction()).toBe('up');
    input.endPad(1);
    expect(input.direction()).toBeUndefined();
    expect(input.consumeDirection()).toBe('up');
    expect(input.consumeDirection()).toBeUndefined();
  });
  it('holds and slides with stable corners, a stop centre and deliberate direction changes', () => {
    const input = new GridInput();
    input.beginPad(1, 'left');
    expect(input.consumeDirection()).toBe('left');
    input.movePad(1, -60, -57, 168);
    expect(input.consumeDirection()).toBe('left');
    input.movePad(1, -12, -70, 168);
    expect(input.consumeDirection()).toBe('up');
    input.movePad(1, 10, 6, 168);
    expect(input.consumeDirection()).toBeUndefined();
    input.movePad(1, 900, 40, 168);
    expect(input.consumeDirection()).toBe('right');
  });
  it('does not let another finger move, release or cancel the owner; overlays clear taps too', () => {
    const input = new GridInput();
    input.beginPad(1, 'down');
    expect(input.beginPad(2, 'up')).toBe(false);
    input.movePad(2, -100, 0, 168);
    input.endPad(2, true);
    expect(input.consumeDirection()).toBe('down');
    input.reset();
    expect(input.consumeDirection()).toBeUndefined();
    input.beginPad(3, 'up');
    input.endPad(3, true);
    expect(input.consumeDirection()).toBeUndefined();
  });
  it('allows correcting a tap before the tick and ignores ambiguous or invalid starts', () => {
    const input = new GridInput();
    input.beginPad(1, 'left');
    input.movePad(1, 0, -60, 168);
    input.endPad(1);
    expect(input.consumeDirection()).toBe('up');
    expect(padDirection(70, 70, 168)).toBeUndefined();
    expect(padDirection(NaN, 2, 168)).toBeUndefined();
    expect(padDirection(40, 2, 0)).toBeUndefined();
  });
});

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
  it('keeps captured movement far outside the visual base without increasing strength', () => {
    const input = new GridInput();
    input.joystick.begin(3);
    input.joystick.move(3, 800, -30, 35);
    expect(input.direction()).toBe('right');
    expect(Math.hypot(input.joystick.snapshot().x, input.joystick.snapshot().y)).toBeCloseTo(1);
    expect(Math.hypot(input.joystick.snapshot().knobX, input.joystick.snapshot().knobY)).toBeCloseTo(35);
    input.joystick.end(3);
    expect(input.direction()).toBeUndefined();
  });
});
