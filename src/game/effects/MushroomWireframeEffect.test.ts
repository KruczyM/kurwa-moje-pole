import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MushroomWireframeEffect, mushroomWireframePulseAt } from './MushroomWireframeEffect';

describe('mushroom wireframe pulse', () => {
  it('appears in short windows instead of staying continuous', () => {
    expect(mushroomWireframePulseAt(0.2)).toBe(false);
    expect(mushroomWireframePulseAt(0.6)).toBe(true);
    expect(mushroomWireframePulseAt(1.1)).toBe(false);
    expect(mushroomWireframePulseAt(2.3)).toBe(true);
    expect(mushroomWireframePulseAt(3)).toBe(false);
    expect(mushroomWireframePulseAt(4)).toBe(true);
    expect(mushroomWireframePulseAt(4.4)).toBe(false);
  });

  it('loops without changing the pulse pattern', () => {
    expect(mushroomWireframePulseAt(0.6 + 4.8)).toBe(true);
    expect(mushroomWireframePulseAt(1.1 + 4.8)).toBe(false);
  });

  it('replaces object materials, excludes ground and restores originals', () => {
    const scene = new THREE.Scene();
    const objectMaterial = new THREE.MeshStandardMaterial();
    const groundMaterial = new THREE.MeshStandardMaterial();
    const object = new THREE.Mesh(new THREE.BoxGeometry(), objectMaterial);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(), groundMaterial);
    ground.userData.excludeMushroomWireframe = true;
    scene.add(object, ground);
    const effect = new MushroomWireframeEffect(scene);

    effect.update(true, 0.6, 1, false);
    expect(object.material).not.toBe(objectMaterial);
    expect((object.material as unknown as { wireframe: boolean }).wireframe).toBe(true);
    expect(ground.material).toBe(groundMaterial);

    effect.update(false, 0, 0, false);
    expect(object.material).toBe(objectMaterial);
    effect.dispose();
    object.geometry.dispose();
    ground.geometry.dispose();
    objectMaterial.dispose();
    groundMaterial.dispose();
  });

  it('restores exact materials when paused or reduced motion is enabled', () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial();
    const object = new THREE.Mesh(new THREE.BoxGeometry(), material);
    scene.add(object);
    const effect = new MushroomWireframeEffect(scene);

    effect.update(true, 0.6, 1, false);
    expect(object.material).not.toBe(material);
    effect.update(false, 0, 0, false);
    expect(object.material).toBe(material);

    effect.update(true, 0.6, 1, true);
    expect(object.material).toBe(material);
    effect.dispose();
    object.geometry.dispose();
    material.dispose();
  });
});
