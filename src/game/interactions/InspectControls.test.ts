import { describe, expect, it } from 'vitest';
import { InspectControls } from './InspectControls';

class FakeCanvas extends EventTarget {
  captures: number[] = [];
  releases: number[] = [];

  setPointerCapture(pointerId: number) {
    this.captures.push(pointerId);
  }

  releasePointerCapture(pointerId: number) {
    this.releases.push(pointerId);
  }
}

/** Tworzy zdarzenie wskaźnika możliwe do użycia także w środowisku testowym Node. */
function pointerEvent(type: string, pointerId: number, clientX: number, clientY: number) {
  const event = new Event(type, { cancelable: true }) as PointerEvent;
  Object.assign(event, { pointerId, clientX, clientY });
  return event;
}

/** Tworzy zdarzenie kółka bez zależności od przeglądarkowego konstruktora WheelEvent. */
function wheelEvent(deltaY: number) {
  const event = new Event('wheel', { cancelable: true }) as WheelEvent;
  Object.assign(event, { deltaY });
  return event;
}

describe('InspectControls', () => {
  it('rotates around the preview centre and clamps vertical movement', () => {
    const canvas = new FakeCanvas();
    const controls = new InspectControls(canvas);
    canvas.dispatchEvent(pointerEvent('pointerdown', 7, 10, 10));
    canvas.dispatchEvent(pointerEvent('pointermove', 7, 110, 1000));

    expect(controls.yaw).toBeCloseTo(0.8);
    expect(controls.pitch).toBe(0.55);
    expect(canvas.captures).toEqual([7]);

    canvas.dispatchEvent(pointerEvent('pointerup', 7, 110, 1000));
    expect(canvas.releases).toEqual([7]);
  });

  it('keeps zoom in a safe range and resets every new inspection', () => {
    const canvas = new FakeCanvas();
    const controls = new InspectControls(canvas);
    canvas.dispatchEvent(wheelEvent(-10000));
    expect(controls.distanceScale).toBe(0.88);
    canvas.dispatchEvent(wheelEvent(10000));
    expect(controls.distanceScale).toBe(1.65);

    controls.reset();
    expect(controls.distanceScale).toBe(1);
    expect(controls.yaw).toBe(0);
    expect(controls.pitch).toBe(0);
  });

  it('reuses one listener set and removes it on dispose', () => {
    const canvas = new FakeCanvas();
    const controls = new InspectControls(canvas);
    controls.reset();
    controls.reset();
    controls.dispose();
    canvas.dispatchEvent(pointerEvent('pointerdown', 2, 0, 0));
    canvas.dispatchEvent(pointerEvent('pointermove', 2, 100, 100));

    expect(controls.yaw).toBe(0);
    expect(canvas.captures).toEqual([]);
  });
});
