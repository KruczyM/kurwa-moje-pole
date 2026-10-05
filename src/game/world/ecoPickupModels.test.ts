import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createEcoPickupModel, ecoModelName } from './ecoPickupModels';

describe('Blender Eko models', () => {
  it('maps every type to a real model and uses grounded shared geometry with isolated highlights', async () => {
    const bytes = readFileSync(
      new URL('../../../public/game-assets/world/festival/eco-pickups.glb', import.meta.url),
    );
    expect(bytes.byteLength).toBeLessThan(700000);
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    for (const id of ['eco_0', 'eco_1', 'eco_2', 'eco_8', 'eco_11', 'eco_5']) {
      const a = createEcoPickupModel(gltf.scene, id)!,
        b = createEcoPickupModel(gltf.scene, id)!;
      expect(a.userData.ecoModel).toBe(ecoModelName(id));
      const bounds = new THREE.Box3().setFromObject(a);
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(bounds.max.y).toBeGreaterThan(0.1);
      const meshA = a.children[0] as THREE.Mesh,
        meshB = b.children[0] as THREE.Mesh;
      expect(meshA.geometry).toBe(meshB.geometry);
      expect(meshA.material).not.toBe(meshB.material);
      expect(meshA.geometry.getAttribute('color')).toBeDefined();
      expect(Array.isArray(meshA.material)).toBe(false);
      expect((meshA.material as THREE.MeshStandardMaterial).map).toBeNull();
      expect(meshA.geometry.index!.count / 3).toBeLessThan(6500);
      (meshA.material as THREE.MeshStandardMaterial).emissive.setHex(0x112233);
      expect((meshB.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0);
    }
  });
  it('fails gracefully when the optional pack is unavailable', () => {
    expect(createEcoPickupModel(undefined, 'eco_0')).toBeUndefined();
  });
});
