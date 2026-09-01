import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from './PlayerController';

/** Tworzy zdarzenie myszy działające w środowisku testowym bez prawdziwego DOM. */
function mouseMove(clientX: number, clientY: number, movementX = 0, movementY = 0) {
  return Object.assign(new Event('mousemove'), { clientX, clientY, movementX, movementY });
}

/** Tworzy zdarzenie klawiatury z klawiszem potrzebnym kontrolerowi ruchu. */
function keyEvent(type: 'keydown' | 'keyup', key: string) {
  return Object.assign(new Event(type), { key });
}

describe('PlayerController mouse look', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('obraca kamerę bez dodatkowego kliknięcia, gdy Pointer Lock został utracony', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const controller = new PlayerController(new THREE.PerspectiveCamera(), canvas, () => true);
    controller.enabled = true;
    windowTarget.dispatchEvent(mouseMove(300, 200));
    windowTarget.dispatchEvent(mouseMove(340, 220));

    expect(controller.yaw).toBeCloseTo(-0.096);
    expect(controller.pitch).toBeCloseTo(-0.04);
    controller.dispose();
  });

  it('czyści wciśnięte klawisze po otwarciu modala lub pauzy', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const controller = new PlayerController(new THREE.PerspectiveCamera(), canvas, () => true);
    windowTarget.dispatchEvent(keyEvent('keydown', 'w'));
    windowTarget.dispatchEvent(keyEvent('keydown', 'Shift'));
    expect(controller.keys).toEqual(new Set(['w', 'shift']));

    controller.stop();
    expect(controller.keys.size).toBe(0);
    controller.dispose();
  });
});
