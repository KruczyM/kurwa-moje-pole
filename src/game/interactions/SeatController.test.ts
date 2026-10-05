import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { findSittingClip, seatCameraPosition, SeatController } from './SeatController';
import { alignChairPelvis } from './chairPose';

describe('SeatController helpers', () => {
  it('prefers the chair pose and keeps animated pelvis placement stable under a rotated seat', () => {
    const chair = new THREE.AnimationClip('MaleSittingPose', 1);
    expect(findSittingClip([new THREE.AnimationClip('SittingIdle', 1), chair])).toBe(chair);
    const root = new THREE.Group();
    root.position.set(8, 2, 9);
    root.rotation.y = 0.7;
    const visual = new THREE.Group();
    visual.scale.setScalar(2);
    root.add(visual);
    const hips = new THREE.Bone();
    hips.name = 'mixamorig:Hips';
    hips.position.set(0, 1, 0.4);
    visual.add(hips);
    for (let i = 0; i < 3; i++) {
      hips.position.y += 0.2;
      expect(alignChairPelvis(root, visual)).toBe(true);
      const pelvis = root.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
      expect(pelvis.y).toBeCloseTo(0.65);
      expect(pelvis.z).toBeCloseTo(-0.1);
    }
  });
  it('finishes the get-up transition before returning control after rest', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()));
    const character = {
      scene: model,
      animations: ['Idle', 'LieDown', 'LayingIdle', 'StandUpFromLaying', 'Waving'].map(
        (name) => new THREE.AnimationClip(name, 1, []),
      ),
    } as GLTF;
    const controller = new SeatController(scene, camera, character);
    const pose = { seatId: 'preview', position: [0, 0, 0] as [number, number, number], rotationY: 0 };
    expect(controller.start(pose, 'LayingIdle')).toBe(true);
    controller.update(1.01);
    controller.requestStop();
    controller.update(0.01);
    expect(controller.finished).toBe(false);
    controller.update(1.01);
    expect(controller.finished).toBe(true);
    controller.stop();
    expect(controller.start(pose, 'Waving')).toBe(true);
    controller.requestStop();
    expect(controller.finished).toBe(true);
    controller.dispose();
  });
  it('selects the canonical sitting animation', () => {
    const idle = new THREE.AnimationClip('Idle', 1);
    const sitting = new THREE.AnimationClip('SittingLaughing', 2);
    expect(findSittingClip([idle, sitting])).toBe(sitting);
  });

  it('places the third-person camera in front of and above the seat', () => {
    const seat = new THREE.Vector3(2, 0, 3);
    const camera = seatCameraPosition(seat, 0);
    expect(camera.y).toBeGreaterThan(seat.y);
    expect(camera.z).toBeGreaterThan(seat.z);
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

  it('orients the character toward the chair front and lowers into the seat cavity', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
    const character = {
      scene: model,
      animations: [new THREE.AnimationClip('SittingLaughing', 2)],
    } as GLTF;
    const controller = new SeatController(scene, camera, character);

    expect(controller.start({ seatId: 'S01', position: [10, 0, 10], rotationY: 0 })).toBe(true);
    const seatedRoot = scene.getObjectByName('SeatedPlayer_S01') as THREE.Group;
    expect(seatedRoot).toBeDefined();
    const visual = seatedRoot.children[0];
    expect(visual.rotation.y).toBeCloseTo(Math.PI);
    expect(visual.position.z).toBeCloseTo(-0.52);
    // Model postaci w układzie krzesła jest uniesiony na wysokość +0.16m, aby biodra spoczywały na płótnie krzesła
    const visualBounds = new THREE.Box3().setFromObject(visual);
    expect(visualBounds.min.y).toBeCloseTo(-0.2);

    // Domyślne krzesło przy rotationY = 0 ma przód w -Z.
    // Kamera powinna stanąć przed siedzącą postacią (w stronę -Z) i patrzeć w stronę postaci.
    expect(camera.position.z).toBeLessThan(10);
    controller.stop();
  });

  it('reuses the pooled character model across multiple seated sessions without re-cloning', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
    const character = {
      scene: model,
      animations: [new THREE.AnimationClip('SittingLaughing', 2)],
    } as GLTF;
    const controller = new SeatController(scene, camera, character);

    expect(controller.start({ seatId: 'S01', position: [0, 0, 0], rotationY: 0 })).toBe(true);
    const firstVisual = scene.getObjectByName('SeatedPlayer_S01')?.children[0];
    expect(firstVisual).toBeDefined();
    controller.stop();

    expect(controller.start({ seatId: 'S02', position: [5, 0, 5], rotationY: 1 })).toBe(true);
    const secondVisual = scene.getObjectByName('SeatedPlayer_S02')?.children[0];
    expect(secondVisual).toBe(firstVisual);
    controller.stop();

    controller.dispose();
  });
});
