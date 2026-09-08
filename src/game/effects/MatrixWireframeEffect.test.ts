import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MatrixWireframeEffect } from './MatrixWireframeEffect';

describe('MatrixWireframeEffect', () => {
  it('replaces meshes with green wireframe at alpha >= 0.35 and restores on exit', () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    scene.add(mesh);

    const effect = new MatrixWireframeEffect(scene);

    // Alpha below 0.35 -> inactive
    effect.update(true, 0.2, false);
    expect(effect.isWireframeVisible).toBe(false);
    expect(mesh.material).toBe(material);

    // Alpha >= 0.35 -> active
    effect.update(true, 0.6, false);
    expect(effect.isWireframeVisible).toBe(true);
    expect(mesh.material).not.toBe(material);
    expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
    expect((mesh.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('00ff77');

    // Deactivate -> exact restore
    effect.update(false, 0, false);
    expect(effect.isWireframeVisible).toBe(false);
    expect(mesh.material).toBe(material);

    effect.dispose();
    mesh.geometry.dispose();
    material.dispose();
  });

  it('respects excluded meshes and reduceMotion', () => {
    const scene = new THREE.Scene();
    const mat1 = new THREE.MeshBasicMaterial();
    const mat2 = new THREE.MeshBasicMaterial();
    const allowed = new THREE.Mesh(new THREE.BoxGeometry(), mat1);
    const excluded = new THREE.Mesh(new THREE.PlaneGeometry(), mat2);
    excluded.userData.excludeMatrixWireframe = true;
    scene.add(allowed, excluded);

    const effect = new MatrixWireframeEffect(scene);

    // Active with reduceMotion = false
    effect.update(true, 0.8, false);
    expect(allowed.material).not.toBe(mat1);
    expect(excluded.material).toBe(mat2);

    // Active with reduceMotion = true -> should not show wireframe
    effect.update(true, 0.8, true);
    expect(allowed.material).toBe(mat1);
    expect(excluded.material).toBe(mat2);

    effect.dispose();
    allowed.geometry.dispose();
    excluded.geometry.dispose();
    mat1.dispose();
    mat2.dispose();
  });

  it('restores materials on dispose', () => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    scene.add(mesh);

    const effect = new MatrixWireframeEffect(scene);
    effect.update(true, 0.7, false);
    expect(mesh.material).not.toBe(material);

    effect.dispose();
    expect(mesh.material).toBe(material);
    expect(effect.isWireframeVisible).toBe(false);

    mesh.geometry.dispose();
    material.dispose();
  });
});
