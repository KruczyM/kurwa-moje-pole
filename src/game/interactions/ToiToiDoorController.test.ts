import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ToiToiDoorController } from './ToiToiDoorController';

describe('ToiToiDoorController', () => {
  let controller: ToiToiDoorController;
  let dummyMesh: THREE.Object3D;
  let dummyDoorWing: THREE.Object3D;

  beforeEach(() => {
    controller = new ToiToiDoorController();
    dummyMesh = new THREE.Mesh();
    dummyDoorWing = new THREE.Object3D();
  });

  it('registers a door with closed state by default', () => {
    controller.registerDoor({
      id: 'toitoi_1',
      label: 'Drzwi TOI TOI',
      interactionMesh: dummyMesh,
      doorWing: dummyDoorWing,
    });

    const door = controller.getDoor('toitoi_1');
    expect(door).toBeDefined();
    expect(door?.isOpen).toBe(false);
    expect(door?.currentAngle).toBe(0);
    expect(controller.getAllRecords()).toHaveLength(1);
  });

  it('toggles door state from closed to open and back', () => {
    controller.registerDoor({
      id: 'toitoi_1',
      label: 'Drzwi TOI TOI',
      interactionMesh: dummyMesh,
      doorWing: dummyDoorWing,
      openAngle: Math.PI / 2,
    });

    const opened = controller.toggle('toitoi_1');
    expect(opened).toBe(true);
    expect(controller.getDoor('toitoi_1')?.isOpen).toBe(true);

    const closed = controller.toggle('toitoi_1');
    expect(closed).toBe(false);
    expect(controller.getDoor('toitoi_1')?.isOpen).toBe(false);
  });

  it('smoothly animates door angle over time with update()', () => {
    controller.registerDoor({
      id: 'toitoi_1',
      label: 'Drzwi TOI TOI',
      interactionMesh: dummyMesh,
      doorWing: dummyDoorWing,
      openAngle: 1.0,
    });

    controller.open('toitoi_1');
    expect(controller.getDoor('toitoi_1')?.targetAngle).toBe(1.0);
    expect(controller.getDoor('toitoi_1')?.currentAngle).toBe(0.0);

    controller.update(0.1);
    expect(controller.getDoor('toitoi_1')?.currentAngle).toBeGreaterThan(0.0);
    expect(dummyDoorWing.rotation.y).toBeGreaterThan(0.0);

    controller.update(0.5);
    expect(controller.getDoor('toitoi_1')?.currentAngle).toBeCloseTo(1.0, 3);
    expect(dummyDoorWing.rotation.y).toBeCloseTo(1.0, 3);
  });
});
