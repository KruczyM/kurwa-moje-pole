import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { PlayerController } from '../player/PlayerController';
import { FESTIVAL_WHEEL_SITE, placeFestivalWheel } from './festivalWheel';
import { terrainHeight } from './terrainHeight';
import { WheelRideController, type WheelRideTarget } from './WheelRideController';
import { sampleWheelSchedule, WHEEL_CYCLE_SECONDS, type WheelScheduleSample } from './wheelSchedule';

class MockWheel implements WheelRideTarget {
  time = 0;
  gondola12 = new THREE.Object3D();
  root = new THREE.Object3D();

  constructor() {
    this.root.name = 'Mock_Festival_Wheel';
    this.gondola12.name = 'Gondola_12';
    this.gondola12.userData.wheelPart = 'gondola';
    this.root.add(this.gondola12);
    this.root.position.set(FESTIVAL_WHEEL_SITE.x, 0.025, FESTIVAL_WHEEL_SITE.z);
    this.updateGondolaTransform();
  }

  getScheduleSample(): WheelScheduleSample {
    return sampleWheelSchedule(this.time);
  }

  getScheduleTime(): number {
    return this.time;
  }

  getAngle(): number {
    return this.getScheduleSample().angle;
  }

  getGondola(index: number): THREE.Object3D | undefined {
    return index === 12 ? this.gondola12 : undefined;
  }

  update(dt: number) {
    this.time += dt;
    this.updateGondolaTransform();
  }

  setTime(t: number) {
    this.time = t;
    this.updateGondolaTransform();
  }

  private updateGondolaTransform() {
    const angle = this.getAngle();
    const relX = 15.0 * Math.sin(angle);
    const relY = -15.0 * Math.cos(angle);
    this.gondola12.position.set(relX, 18.0 + relY, 0);
    this.gondola12.updateMatrixWorld(true);
  }
}

const loadGlb = async () => {
  const data = readFileSync(
    new URL(`../../../public/game-assets/${catalog.environment.allegroWheel}`, import.meta.url),
  );
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
};

describe('WheelRideController (Ferris Wheel A2)', () => {
  it('allows an explicitly requested ride without changing the reduced-motion preference', () => {
    const wheel = new MockWheel();
    wheel.root.userData.boardingTarget = { x: 10, z: 20 };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 1.9, 20);
    const ride = new WheelRideController(wheel, camera);
    expect(ride.shouldReduceMotion(true)).toBe(true);
    wheel.setTime(25);
    expect(ride.requestBoarding(false)).toBe(true);
    expect(ride.shouldReduceMotion(true)).toBe(false);
    wheel.setTime(WHEEL_CYCLE_SECONDS + 1);
    ride.update(0.3, ride.shouldReduceMotion(true));
    expect(ride.isIdle()).toBe(false);
    expect(ride.shouldReduceMotion(true)).toBe(false);
    ride.cancelToGround();
    expect(ride.shouldReduceMotion(true)).toBe(true);
    ride.dispose();
  });
  it('queues boarding while moving and enters on the next bottom stop', () => {
    const wheel = new MockWheel();
    wheel.root.userData.boardingTarget = { x: 10, z: 20 };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 1.9, 20);
    const ride = new WheelRideController(wheel, camera);
    wheel.setTime(25);
    expect(ride.requestBoarding()).toBe(true);
    expect(ride.isIdle()).toBe(true);
    wheel.setTime(WHEEL_CYCLE_SECONDS + 1);
    ride.update(0.3);
    expect(ride.isIdle()).toBe(false);
    expect(ride.getBoardingPoint(false).x).toBe(10);
    ride.dispose();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('zgodność z kontraktem geometrii A0: pozycja oka w gondoli 12 i punkt wejścia na ziemi', () => {
    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(mockWheel, camera);

    // Punkt wejścia na ziemi: (107.5, groundY, -59.0)
    const boardingPoint = controller.getBoardingPoint(false);
    expect(boardingPoint.x).toBeCloseTo(107.5, 4);
    expect(boardingPoint.z).toBeCloseTo(-59.0, 4);
    expect(boardingPoint.y).toBeCloseTo(terrainHeight(107.5, -59.0), 4);

    // Boarding target z wysokością stania gracza (1.9m)
    const playerStandingPoint = controller.getBoardingPoint(true);
    expect(playerStandingPoint.y).toBeCloseTo(1.9, 4);

    // Przy kącie zerowym (postój dolny) oko w gondoli 12 znajduje się na dole (Y ≈ 4.175 m)
    const eyeBottom = controller.getEyeWorldPosition();
    expect(eyeBottom.x).toBeCloseTo(116.0, 4);
    expect(eyeBottom.z).toBeCloseTo(-59.0, 4);
    expect(eyeBottom.y).toBeCloseTo(0.025 + 18.0 - 15.0 + 1.15, 4); // 4.175 m

    // Na szczycie koła (kąt Pi rad) oko w gondoli 12 znajduje się na samej górze (Y ≈ 34.175 m)
    mockWheel.setTime(24); // Faza 'top'
    const eyeTop = controller.getEyeWorldPosition();
    expect(eyeTop.x).toBeCloseTo(116.0, 4);
    expect(eyeTop.z).toBeCloseTo(-59.0, 4);
    expect(eyeTop.y).toBeCloseTo(0.025 + 18.0 + 15.0 + 1.15, 4); // 34.175 m

    controller.dispose();
  });

  it('stabilny horyzont: roll kamery jest ZAWSZE równy 0 bez względu na obrót rotora koła', () => {
    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(mockWheel, camera, undefined, { fadeDurationSeconds: 0 });

    controller.startBoarding();
    expect(controller.getState()).toBe('riding');

    // Sprawdzamy wiele punktów wzdłuż pełnego obrotu rotora młyna
    for (let t = 0; t <= WHEEL_CYCLE_SECONDS; t += 2) {
      mockWheel.setTime(t);
      controller.update(0.1);

      // Kąt roll kamery (trzeci element w Eulerze YXZ) musi pozostać dokładnie 0
      expect(camera.rotation.z).toBe(0);
      expect(camera.rotation.order).toBe('YXZ');
    }

    controller.dispose();
  });

  it('wsiadanie jest dozwolone wyłącznie w fazie dolnej ("bottom") i odrzucane w ruchu', () => {
    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(mockWheel, camera);

    // Próba wsiadania podczas jazdy na górę (t = 20s, faza 'ascending')
    mockWheel.setTime(20);
    expect(mockWheel.getScheduleSample().phase).toBe('ascending');
    expect(controller.startBoarding()).toBe(false);
    expect(controller.getState()).toBe('idle');

    // Próba wsiadania na szczycie (t = 50s, faza 'top', koło stoi ale to nie stacja!)
    mockWheel.setTime(24);
    expect(mockWheel.getScheduleSample().phase).toBe('top');
    expect(mockWheel.getScheduleSample().stopped).toBe(true);
    expect(controller.startBoarding()).toBe(false);
    expect(controller.getState()).toBe('idle');

    // Wsiadanie na dole (t = 5s, faza 'bottom', postój na stacji)
    mockWheel.setTime(1);
    expect(mockWheel.getScheduleSample().phase).toBe('bottom');
    expect(controller.startBoarding()).toBe(true);
    expect(controller.getState()).toBe('boarding');

    controller.dispose();
  });

  it('anuluje wsiadanie, gdy dolny postój zakończył się w trakcie animacji fade (brak teleportacji w powietrze)', () => {
    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    camera.position.set(107.5, 1.9, -59.0);

    const controller = new WheelRideController(mockWheel, camera, undefined, {
      fadeDurationSeconds: 0.25,
    });

    // Gracz rozpoczyna wsiadanie tuż przed końcem fazy dolnej (np. t = 11.9 s, faza kończy się w 12.0 s)
    mockWheel.setTime(2.9);
    expect(controller.startBoarding()).toBe(true);
    expect(controller.getState()).toBe('boarding');

    // W trakcie fade upływa 0.25 s -> koło przesuwa się na t = 12.15 s (faza 'ascending')
    mockWheel.update(0.25);
    expect(mockWheel.getScheduleSample().phase).toBe('ascending');

    // Kontroler aktualizuje się po upływie fade
    controller.update(0.25);

    // Wsiadanie zostało bezpiecznie anulowane bez wrzucenia gracza do ruszającej gondoli
    expect(controller.getState()).toBe('idle');
    expect(camera.position.x).toBeCloseTo(107.5, 3);
    expect(camera.position.z).toBeCloseTo(-59.0, 3);
    expect(camera.position.y).toBeLessThan(3.0); // Na poziomie ziemi, nie 4m ani 10m w górze

    controller.dispose();
  });

  it('zamraża fizykę ruchu gracza (movementLocked) w trakcie jazdy, zachowując swobodne rozglądanie (lookBy)', () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { pointerLockElement: null });
    const canvas = Object.assign(new EventTarget(), {
      tabIndex: 0,
      focus: vi.fn(),
      requestPointerLock: vi.fn(() => Promise.resolve()),
    }) as unknown as HTMLCanvasElement;
    vi.stubGlobal('window', windowTarget);
    vi.stubGlobal('document', documentTarget);

    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const player = new PlayerController(camera, canvas, () => true, false, {
      position: [107.5, -59.0],
      yaw: 0,
    });
    player.enabled = true;

    const controller = new WheelRideController(mockWheel, camera, player, { fadeDurationSeconds: 0 });

    // Przed jazdą gracz chodzi
    expect(player.movementLocked).toBe(false);

    // Wejście do kabiny
    mockWheel.setTime(2);
    controller.startBoarding();
    expect(controller.getState()).toBe('riding');
    expect(player.movementLocked).toBe(true);

    const eyeWorld = controller.getEyeWorldPosition();
    expect(camera.position.x).toBeCloseTo(eyeWorld.x, 3);
    expect(camera.position.y).toBeCloseTo(eyeWorld.y, 3);
    expect(camera.position.z).toBeCloseTo(eyeWorld.z, 3);

    // Próba chodzenia klawiszami W/S nie przesuwa gracza (ruch pieszy zamrożony)
    player.keys.add('w');
    player.setMobileMove(1, 0, true);
    player.update(0.1, { speed: 1, sway: 0, shake: 0, bob: 1 });
    // Kamera pasażera nadal trzyma się gondoli
    expect(camera.position.x).toBeCloseTo(eyeWorld.x, 3);
    expect(camera.position.y).toBeCloseTo(eyeWorld.y, 3);

    // Rozglądanie dotykiem lub myszą lookBy działa w 360°
    controller.lookBy(50, -25);
    expect(player.yaw).toBeCloseTo(-0.12);
    expect(player.pitch).toBeCloseTo(0.05);

    controller.update(0.016);
    expect(camera.rotation.y).toBeCloseTo(player.yaw);
    expect(camera.rotation.x).toBeCloseTo(player.pitch);
    expect(camera.rotation.z).toBe(0); // Zero roll!

    // Wyjście z kabiny przywraca ruch
    controller.cancelToGround();
    expect(player.movementLocked).toBe(false);

    controller.dispose();
    player.dispose();
  });

  it('naciśnięcie E w locie kolejkuje wyjście na dole i NIE wyrzuca gracza w powietrze', () => {
    const windowTarget = new EventTarget();
    vi.stubGlobal('window', windowTarget);

    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(mockWheel, camera, undefined, { fadeDurationSeconds: 0 });

    mockWheel.setTime(0);
    controller.startBoarding();
    expect(controller.getState()).toBe('riding');

    // Koło wjeżdża do góry (t = 30s)
    mockWheel.setTime(30);
    controller.update(0.1);
    expect(camera.position.y).toBeGreaterThan(15);

    // Gracz naciska klawisz 'e' na dużej wysokości
    windowTarget.dispatchEvent(Object.assign(new Event('keydown'), { key: 'e' }));
    expect(controller.isExitQueued()).toBe(true);

    // Gracz nadal bezpiecznie jedzie w gondoli (stan 'riding'), nie został wyrzucony!
    expect(controller.getState()).toBe('riding');
    expect(camera.position.y).toBeGreaterThan(15);

    // Koło osiąga szczyt (t = 50s)
    mockWheel.setTime(24);
    controller.update(0.1);
    expect(controller.getState()).toBe('riding');
    expect(camera.position.y).toBeGreaterThan(30);

    // Koło zjeżdża i dociera na dolny postój (t = 88.9s -> 0.5s kolejnego cyklu)
    mockWheel.setTime(WHEEL_CYCLE_SECONDS + 1); // t = 90s -> faza 'bottom'
    controller.update(0.1);

    // Zakolejkowane wyjście wykonało się na dolnej stacji!
    expect(controller.getState()).toBe('idle');
    expect(camera.position.x).toBeCloseTo(107.5, 3);
    expect(camera.position.z).toBeCloseTo(-59.0, 3);
    expect(camera.position.y).toBeCloseTo(1.9, 3); // Na bezpiecznym gruncie

    controller.dispose();
  });

  it('duże dt nie gubi okna dolnego postoju przy zakolejkowanym wyjściu', () => {
    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(mockWheel, camera, undefined, { fadeDurationSeconds: 0 });

    mockWheel.setTime(0);
    controller.startBoarding();
    mockWheel.setTime(18); // Faza wznoszenia
    controller.update(0.1);
    controller.queueExit();
    expect(controller.isExitQueued()).toBe(true);

    // Zjazd pod koniec cyklu (t = 88s)
    mockWheel.setTime(45);
    controller.update(0.1);
    expect(controller.getState()).toBe('riding');

    // Nagły skok klatki (dt = 3.0s), przechodzący z końca zjazdu w środek dolnego postoju (t = 91s)
    mockWheel.setTime(WHEEL_CYCLE_SECONDS + 2);
    controller.update(3.0);

    // Wyjście zostało prawidłowo zrealizowane
    expect(controller.getState()).toBe('idle');
    expect(camera.position.x).toBeCloseTo(107.5, 3);

    controller.dispose();
  });

  it('cancelToGround() natychmiast przywraca gracza bezpiecznie na ziemię i odtwarza kamerę', () => {
    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.3, 1000);
    camera.position.set(100, 1.9, -50);

    const onFade = vi.fn();
    const controller = new WheelRideController(mockWheel, camera, undefined, {
      onFade,
      cabinNear: 0.08,
      fadeDurationSeconds: 0.25,
    });

    mockWheel.setTime(2);
    controller.startBoarding();
    controller.update(0.3); // Kończy fade, gracz jest w gondoli
    expect(controller.getState()).toBe('riding');
    expect(camera.near).toBe(0.08); // Zastosowany cabinNear

    // Przenosimy koło na sam szczyt
    mockWheel.setTime(24);
    controller.update(0.1);
    expect(camera.position.y).toBeGreaterThan(30);

    // Występuje błąd / wyjście do menu / włączenie reduceMotion
    controller.cancelToGround();

    // Gracz natychmiast bezpiecznie stoi na ziemi
    expect(controller.getState()).toBe('idle');
    expect(camera.position.x).toBeCloseTo(107.5, 3);
    expect(camera.position.z).toBeCloseTo(-59.0, 3);
    expect(camera.position.y).toBeCloseTo(1.9, 3);
    expect(camera.near).toBe(0.3); // Przywrócony pierwotny near ze snapshotu
    expect(camera.fov).toBe(60); // Przywrócony pierwotny fov
    expect(onFade).toHaveBeenLastCalledWith(false);

    controller.dispose();
  });

  it('włączenie reduceMotion w trakcie jazdy bezpiecznie sprowadza gracza na ziemię', () => {
    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(mockWheel, camera, undefined, { fadeDurationSeconds: 0 });

    mockWheel.setTime(2);
    controller.startBoarding();
    mockWheel.setTime(30);
    controller.update(0.1);
    expect(controller.getState()).toBe('riding');

    // Zmiana ustawień dostępności na reduceMotion = true podczas jazdy
    controller.update(0.1, true);

    expect(controller.getState()).toBe('idle');
    expect(camera.position.x).toBeCloseTo(107.5, 3);
    expect(camera.position.y).toBeCloseTo(1.9, 3);

    controller.dispose();
  });

  it('20 powtórzeń cyklu wsiadania/jazdy/wyjścia bez wycieku listenerów ani kumulacji stanu', () => {
    const windowTarget = new EventTarget();
    vi.stubGlobal('window', windowTarget);

    const mockWheel = new MockWheel();
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(mockWheel, camera, undefined, { fadeDurationSeconds: 0 });

    for (let cycle = 0; cycle < 20; cycle++) {
      mockWheel.setTime(0);
      expect(controller.startBoarding()).toBe(true);
      expect(controller.getState()).toBe('riding');

      // Wznoszenie
      mockWheel.setTime(20);
      controller.update(0.1);
      expect(controller.getState()).toBe('riding');

      // Kolejka wyjścia
      controller.queueExit();
      expect(controller.isExitQueued()).toBe(true);

      // Zjazd i dolny postój
      mockWheel.setTime(WHEEL_CYCLE_SECONDS + 1);
      controller.update(0.1);
      expect(controller.getState()).toBe('idle');
      expect(controller.isExitQueued()).toBe(false);
      expect(camera.position.x).toBeCloseTo(107.5, 3);
      expect(camera.position.y).toBeCloseTo(1.9, 3);
    }

    controller.dispose();
    // Powtórne dispose jest idempotentne
    controller.dispose();
  });

  it('integracja z rzeczywistym modelem allegroWheel.glb i FestivalWheel', async () => {
    const gltf = await loadGlb();
    const parent = new THREE.Group();
    const wheel = placeFestivalWheel(parent, gltf, terrainHeight)!;
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.5, 1000);
    const controller = new WheelRideController(wheel, camera, undefined, { fadeDurationSeconds: 0 });

    try {
      wheel.setScheduleTime(0);
      parent.updateMatrixWorld(true);

      // Sprawdzenie pozycji oka z rzeczywistego drzewa węzłów GLTF
      const eyeWorld = controller.getEyeWorldPosition();
      expect(eyeWorld.x).toBeCloseTo(116.0, 2);
      expect(eyeWorld.z).toBeCloseTo(-59.0, 2);
      const bounds = new THREE.Box3().setFromObject(wheel.getGondola(12)!);
      expect(bounds.containsPoint(eyeWorld)).toBe(true);
      expect(eyeWorld.y - bounds.min.y).toBeCloseTo(1.05, 2);

      // Start jazdy
      expect(controller.startBoarding()).toBe(true);
      expect(controller.getState()).toBe('riding');

      // Przejazd do szczytu (50s)
      wheel.setScheduleTime(24);
      parent.updateMatrixWorld(true);
      controller.update(0.1);

      expect(camera.position.y).toBeGreaterThan(31.0);
      expect(new THREE.Box3().setFromObject(wheel.getGondola(12)!).containsPoint(camera.position)).toBe(true);
      expect(camera.rotation.z).toBe(0); // Płaski horyzont na szczycie

      // Bezpieczny powrót na ziemię
      controller.cancelToGround();
      expect(controller.getState()).toBe('idle');
      expect(camera.position.x).toBeCloseTo(107.5, 3);
      expect(camera.position.z).toBeCloseTo(-59.0, 3);
    } finally {
      controller.dispose();
      wheel.dispose();
      disposeObjectTree(parent);
    }
  });
});
