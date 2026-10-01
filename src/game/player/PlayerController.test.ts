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

  it('łączy analogowy joystick i gest dotykowy z ruchem kamery', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const camera = new THREE.PerspectiveCamera();
    const controller = new PlayerController(camera, canvas, () => true, false);
    controller.enabled = true;
    controller.setMobileMove(1, 0, false);
    controller.lookBy(25, -10);
    controller.update(0.1, { speed: 1, sway: 0, shake: 0, bob: 1 });

    expect(camera.position.z).toBeLessThan(15);
    expect(controller.yaw).toBeCloseTo(-0.06);
    expect(controller.pitch).toBeCloseTo(0.02);
    expect(canvas.requestPointerLock).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('ustawia przekazany punkt i kierunek początkowego spawnu', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const camera = new THREE.PerspectiveCamera();
    const controller = new PlayerController(
      camera,
      canvas,
      () => true,
      false,
      {
        position: [-12.6, -6.8],
        yaw: -2.06,
      },
      () => 0,
    );

    expect(camera.position.toArray()).toEqual([-12.6, 1.9, -6.8]);
    expect(controller.yaw).toBeCloseTo(-2.06);
    expect(camera.rotation.y).toBeCloseTo(-2.06);
    controller.dispose();
  });

  it('dopasowuje wysokość kamery do rzeźby terenu', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const camera = new THREE.PerspectiveCamera();
    const controller = new PlayerController(
      camera,
      canvas,
      () => true,
      false,
      {
        position: [10, 20],
        yaw: 0,
      },
      (x, z) => x * 0.01 + z * 0.02,
    );
    expect(camera.position.y).toBeCloseTo(2.4);
    controller.dispose();
  });

  it('obsługuje tryb swobodnej kamery z lotem 3D i regulacją prędkości', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const camera = new THREE.PerspectiveCamera();
    const controller = new PlayerController(camera, canvas, () => false, false, {
      position: [0, 10],
      yaw: 0,
    });
    controller.enabled = true;

    expect(controller.isFreeCamera()).toBe(false);
    controller.setFreeCamera(true, 15);
    expect(controller.isFreeCamera()).toBe(true);
    expect(camera.position.y).toBe(15);

    // Klawisz W leci w przód w 3D (dla yaw=0: w stronę ujemnego Z)
    windowTarget.dispatchEvent(keyEvent('keydown', 'w'));
    controller.update(0.1, { speed: 1, sway: 0, shake: 0, bob: 0 });
    expect(camera.position.z).toBeLessThan(10);

    // Klawisz Space / Spacja unosi w górę
    windowTarget.dispatchEvent(keyEvent('keyup', 'w'));
    windowTarget.dispatchEvent(keyEvent('keydown', ' '));
    controller.update(0.1, { speed: 1, sway: 0, shake: 0, bob: 0 });
    expect(camera.position.y).toBeGreaterThan(15);

    // Klawisz C obniża w dół
    windowTarget.dispatchEvent(keyEvent('keyup', ' '));
    windowTarget.dispatchEvent(keyEvent('keydown', 'c'));
    const heightBefore = camera.position.y;
    controller.update(0.1, { speed: 1, sway: 0, shake: 0, bob: 0 });
    expect(camera.position.y).toBeLessThan(heightBefore);

    // Rolka myszy zmienia prędkość
    const wheelEvent = Object.assign(new Event('wheel'), { deltaY: -100 });
    windowTarget.dispatchEvent(wheelEvent);
    expect(controller.freeCamSpeed).toBe(25);

    // Transform sieciowy w free camera
    const transform = controller.getTransform();
    expect(transform.locomotion).toBe('Idle');
    expect(transform.speed).toBe(0);

    controller.dispose();
  });

  it('umożliwia ślizganie się wzdłuż przeszkody (axis-separated sliding), gdy ruch po przekątnej jest zablokowany', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const camera = new THREE.PerspectiveCamera();
    // Ściana blokująca Z >= 5, ale X jest wolne
    const controller = new PlayerController(
      camera,
      canvas,
      (x, z) => z < 5,
      false,
      { position: [0, 4.9], yaw: 0 },
      () => 0,
    );
    controller.enabled = true;

    // Próba ruchu w tył (w kierunku dodatniego Z) i w prawo (w kierunku dodatniego X)
    controller.setMobileMove(-1, 1, false); // ruch w stronę Z >= 5 (zablokowany) i X > 0 (wolny)
    controller.update(0.1, { speed: 1, sway: 0, shake: 0, bob: 0 });

    // Pozycja X powinna przesunąć się w prawo (ślizg), a Z nie powinno przekroczyć 5
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.z).toBeLessThan(5);

    controller.dispose();
  });
});
