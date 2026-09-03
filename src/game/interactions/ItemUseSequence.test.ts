import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import {
  canAnimateUseSequence,
  chooseUseSequenceCamera,
  createProceduralUseClip,
  ItemUseSequence,
} from './ItemUseSequence';

/** Buduje minimalny model o kanonicznych nazwach kości potrzebny do testów sekwencji. */
function characterFixture() {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.5), new THREE.MeshStandardMaterial()));
  const arm = new THREE.Object3D();
  arm.name = 'mixamorig:RightArm';
  const forearm = new THREE.Object3D();
  forearm.name = 'mixamorig:RightForeArm';
  const hand = new THREE.Object3D();
  hand.name = 'mixamorig:RightHand';
  arm.add(forearm);
  forearm.add(hand);
  scene.add(arm);
  return {
    scene,
    animations: [new THREE.AnimationClip('Idle', 1, [])],
  } as unknown as GLTF;
}

describe('ItemUseSequence', () => {
  it('selects a collision-free side camera when the direct path is blocked', () => {
    const origin = new THREE.Vector3(0, 1.9, 0);
    const camera = chooseUseSequenceCamera(origin, 0, (x, z) => !(Math.abs(x) < 0.15 && z < -0.4));

    expect(Math.abs(camera.x)).toBeGreaterThan(1);
    expect(camera.y).toBeCloseTo(1.65);
  });

  it('creates a one-shot additive motion on the canonical Mixamo arm', () => {
    const character = characterFixture();
    const clip = createProceduralUseClip(character.scene, 'Joint');

    expect(clip?.name).toBe('UseJoint');
    expect(clip?.blendMode).toBe(THREE.AdditiveAnimationBlendMode);
    expect(clip?.tracks).toHaveLength(3);
    expect(canAnimateUseSequence(character)).toBe(true);
    expect(canAnimateUseSequence(undefined)).toBe(false);
  });

  it('rejects an incomplete arm instead of exposing a T-pose', () => {
    const incomplete = characterFixture();
    incomplete.scene.getObjectByName('mixamorig:RightForeArm')?.removeFromParent();

    expect(createProceduralUseClip(incomplete.scene, 'MDMA')).toBeUndefined();
    expect(canAnimateUseSequence(incomplete)).toBe(false);
  });

  it('fires the effect once and restores the exact FPS camera after completion', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    camera.position.set(2, 1.9, 4);
    camera.rotation.set(0.1, 0.4, 0, 'YXZ');
    const originalPosition = camera.position.clone();
    const originalQuaternion = camera.quaternion.clone();
    const prop = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.2), new THREE.MeshStandardMaterial());
    const sequence = new ItemUseSequence(
      scene,
      camera,
      characterFixture(),
      new Map([['joint', prop]]),
      () => true,
    );

    expect(sequence.start('Joint', 0.4)).toBe(true);
    expect(sequence.start('Joint', 0.4)).toBe(false);
    let markerCount = 0;
    let completed = false;
    for (let step = 0; step < 80 && !completed; step++) {
      const event = sequence.update(0.05);
      markerCount += Number(event.activateEffect);
      completed = event.complete;
    }

    expect(markerCount).toBe(1);
    expect(completed).toBe(true);
    expect(sequence.active).toBe(false);
    expect(camera.position.distanceTo(originalPosition)).toBeLessThan(1e-7);
    expect(camera.quaternion.angleTo(originalQuaternion)).toBeLessThan(1e-7);
    expect(scene.getObjectByName('PlayerUseSequence')).toBeUndefined();
  });

  it('can be interrupted before the marker without leaving a model or changed camera', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    camera.position.set(-1, 1.9, 3);
    const original = camera.position.clone();
    const sequence = new ItemUseSequence(scene, camera, undefined, new Map(), () => false);

    sequence.start('LSD', 0);
    sequence.update(0.2);
    expect(sequence.cancel()).toBe(true);
    expect(sequence.cancel()).toBe(false);

    expect(sequence.active).toBe(false);
    expect(camera.position.distanceTo(original)).toBeLessThan(1e-7);
    expect(scene.getObjectByName('PlayerUseSequence')).toBeUndefined();
  });
});
