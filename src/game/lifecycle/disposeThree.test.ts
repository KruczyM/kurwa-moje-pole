import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { cloneDisposableModel, disposeObjectTree } from './disposeThree';

describe('disposable Three.js models', () => {
  it('releases only resources owned by the inspection clone', () => {
    const sourceTexture = new THREE.Texture();
    const sourceGeometry = new THREE.BoxGeometry();
    const sourceMaterial = new THREE.MeshStandardMaterial({ map: sourceTexture });
    const source = new THREE.Group();
    source.add(new THREE.Mesh(sourceGeometry, sourceMaterial));

    const clone = cloneDisposableModel(source);
    const cloneMesh = clone.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const geometryDispose = vi.spyOn(cloneMesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(cloneMesh.material, 'dispose');
    const textureDispose = vi.spyOn(cloneMesh.material.map!, 'dispose');
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, 'dispose');
    const sourceMaterialDispose = vi.spyOn(sourceMaterial, 'dispose');
    const sourceTextureDispose = vi.spyOn(sourceTexture, 'dispose');

    disposeObjectTree(clone);
    disposeObjectTree(clone);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
    expect(sourceMaterialDispose).not.toHaveBeenCalled();
    expect(sourceTextureDispose).not.toHaveBeenCalled();
  });
});
