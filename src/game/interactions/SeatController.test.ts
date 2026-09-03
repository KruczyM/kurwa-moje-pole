import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { findSittingClip, seatCameraPosition, SeatController } from './SeatController';

describe('SeatController helpers', () => {
  it('selects the canonical sitting animation', () => {
    const idle = new THREE.AnimationClip('Idle', 1);
    const sitting = new THREE.AnimationClip('SittingLaughing', 2);
    expect(findSittingClip([idle, sitting])).toBe(sitting);
  });

  it('places the third-person camera behind and above the seat', () => {
    const seat = new THREE.Vector3(2, 0, 3);
    const camera = seatCameraPosition(seat, 0);
    expect(camera.y).toBeGreaterThan(seat.y);
    expect(camera.z).toBeLessThan(seat.z);
    expect(camera.distanceTo(seat)).toBeGreaterThan(3);
  });

  it('restores the exact camera after leaving a seat', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    camera.position.set(4, 1.9, 7);
    camera.rotation.y = 0.4;
    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
    const character = {
      scene: model,
      animations: [new THREE.AnimationClip('SittingLaughing', 2)],
    } as GLTF;
    const controller = new SeatController(scene, camera, character);

    expect(controller.start({ seatId: 'S01', position: [0, 0, 0], rotationY: 0 })).toBe(true);
    expect(controller.active).toBe(true);
    expect(camera.position).not.toEqual(position);
    controller.update(0.5);
    expect(controller.stop()).toBe(true);
    expect(camera.position).toEqual(position);
    expect(camera.quaternion.angleTo(quaternion)).toBeCloseTo(0);
    expect(camera.fov).toBe(65);
    expect(controller.active).toBe(false);
  });
});
