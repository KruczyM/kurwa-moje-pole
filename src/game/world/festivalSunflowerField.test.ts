import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  SUNFLOWER_FIELD_BOUNDS,
  sampleSunflowerFieldGrassMask,
  placeSunflowerField,
} from './festivalSunflowerField';

describe('festivalSunflowerField', () => {
  it('defines the correct sunflower field bounds along the southern avenue', () => {
    expect(SUNFLOWER_FIELD_BOUNDS.minX).toBe(44);
    expect(SUNFLOWER_FIELD_BOUNDS.maxX).toBe(108);
    expect(SUNFLOWER_FIELD_BOUNDS.minZ).toBe(80);
    expect(SUNFLOWER_FIELD_BOUNDS.maxZ).toBe(106);
  });

  it('samples grass mask correctly: suppressed inside, full grass outside', () => {
    // Center of sunflower field: x = 76, z = 93
    const inside = sampleSunflowerFieldGrassMask(76, 93);
    expect(inside).toBeLessThan(0.1);

    // Far outside the sunflower field: x = 0, z = 0
    const outside = sampleSunflowerFieldGrassMask(0, 0);
    expect(outside).toBe(1.0);
  });

  it('creates soil bed mesh even when model is not yet loaded', () => {
    const parent = new THREE.Group();
    const instance = placeSunflowerField(parent, null, () => 0.5);

    expect(parent.children.length).toBe(1);
    expect(instance.root.name).toBe('Festival_Sunflower_Field');
    expect(instance.soilMesh).not.toBeNull();
    expect(instance.instancedMeshes.length).toBe(0);

    instance.dispose();
    expect(instance.soilMesh).toBeNull();
    expect(parent.children.length).toBe(0);
  });

  it('creates instanced meshes for sunflower submeshes and disposes cleanly', () => {
    const parent = new THREE.Group();

    // Mock GLTF model with stem and flower head meshes
    const mockScene = new THREE.Group();
    const stemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x336622 }),
    );
    stemMesh.name = 'Sunflower_Stem_Mesh';
    mockScene.add(stemMesh);

    const headMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0xffcc00 }),
    );
    headMesh.name = 'Sunflower_Head_Mesh';
    mockScene.add(headMesh);

    const mockGltf = { scene: mockScene } as unknown as GLTF;

    const instance = placeSunflowerField(parent, mockGltf, () => 1.2);

    expect(instance.instancedMeshes.length).toBe(2);
    expect(instance.instancedMeshes[0].count).toBeGreaterThan(500);
    expect(instance.instancedMeshes[0].castShadow).toBe(true);
    expect(instance.instancedMeshes[0].receiveShadow).toBe(true);

    instance.dispose();
    expect(instance.instancedMeshes.length).toBe(0);
    expect(instance.soilMesh).toBeNull();
    expect(parent.children.length).toBe(0);
  });
});
