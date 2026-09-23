import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { environmentAssets } from '../assets/assetManifest';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { allTentLayout, tentColliderBounds } from './campLayout';
import { placeRockShop, ROCK_SHOP_SITE, sampleRockShopGrassMask } from './festivalLandmarks';
import { terrainHeight } from './terrainHeight';

const blob = () =>
  readFileSync(new URL(`../../../public/game-assets/${catalog.environment.lidlRockShop}`, import.meta.url));
async function load() {
  const data = blob();
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}

describe('Rock Shop exterior prototype', () => {
  it('registers a portable, bounded GLB with PBR fabric and an explicit provenance note', async () => {
    expect(environmentAssets.lidlRockShop).toContain('game-assets/world/festival/lidlRockShop.glb');
    const data = blob();
    expect(data.length).toBeLessThan(750_000);
    const json = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
    expect(json.buffers).toHaveLength(1);
    expect(json.buffers[0].uri).toBeUndefined();
    for (const image of json.images) expect(image.uri).toBeUndefined();
    const gltf = await load();
    try {
      const root = gltf.scene.getObjectByName('Lidl_Rock_Shop')!;
      expect(root.userData.festivalLandmark).toBe('lidlRockShop');
      expect(root.userData.referenceStatus).toContain('estimated dimensions');
      const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(24.15, 2);
      expect(size.y).toBeGreaterThan(7);
      expect(size.y).toBeLessThan(7.1);
      expect(size.z).toBeCloseTo(19.075, 2);
      let triangles = 0,
        meshes = 0;
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes++;
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
        const material = object.material as THREE.MeshStandardMaterial;
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        if (material.name === 'Hall_PVC_White' || material.name === 'RockShop_Blue_Fascia') {
          expect(material.map).toBeTruthy();
          expect(material.normalMap).toBeTruthy();
          expect(material.roughnessMap).toBeTruthy();
          expect(material.metalness).toBe(0);
        }
      });
      expect(meshes).toBeLessThanOrEqual(12);
      expect(triangles).toBeLessThan(15000);
    } finally {
      disposeObjectTree(gltf.scene);
    }
  });

  it('keeps front entrance geometry clear and lettering in front of the emblem', async () => {
    const gltf = await load();
    try {
      gltf.scene.updateMatrixWorld(true);
      for (const x of [-4.5, 4.5]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 1.5, 10.5), new THREE.Vector3(0, 0, -1), 0, 2);
        expect(ray.intersectObject(gltf.scene, true)).toHaveLength(0);
      }
      const blue = gltf.scene.getObjectByName('Batched_Sign_Blue')!;
      const yellow = gltf.scene.getObjectByName('Batched_Sign_Yellow')!;
      expect(new THREE.Box3().setFromObject(blue).max.z).toBeGreaterThan(
        new THREE.Box3().setFromObject(yellow).max.z,
      );
    } finally {
      disposeObjectTree(gltf.scene);
    }
  });

  it('clones at metre scale, clears terrain and grass, and does not overlap tents', async () => {
    const gltf = await load();
    const parent = new THREE.Group();
    const originalBounds = new THREE.Box3().setFromObject(gltf.scene);
    try {
      const collider = placeRockShop(parent, gltf, terrainHeight)!;
      const root = parent.children[0];
      expect(root.userData.exteriorOnly).toBe(true);
      expect(root.scale.toArray()).toEqual([1, 1, 1]);
      const floor = new THREE.Box3().setFromObject(root.getObjectByName('Batched_RockShop_Floor')!);
      for (let x = floor.min.x; x <= floor.max.x; x += 0.25) {
        for (let z = floor.min.z; z <= floor.max.z; z += 0.25) {
          expect(floor.min.y - terrainHeight(x, z)).toBeGreaterThan(0.015);
          expect(sampleRockShopGrassMask(x, z)).toBe(0);
        }
      }
      for (const t of allTentLayout) {
        const b = tentColliderBounds(t);
        expect(
          collider.max.x > b.minX &&
            collider.min.x < b.maxX &&
            collider.max.z > b.minZ &&
            collider.min.z < b.maxZ,
          t.id,
        ).toBe(false);
      }
      expect(new THREE.Box3().setFromObject(gltf.scene).equals(originalBounds)).toBe(true);
      const originalMesh = gltf.scene.getObjectByName('Batched_RockShop_Floor') as THREE.Mesh;
      const clonedMesh = root.getObjectByName(originalMesh.name) as THREE.Mesh;
      expect(clonedMesh.geometry).toBe(originalMesh.geometry);
      expect(clonedMesh.material).toBe(originalMesh.material);
      const geometryDispose = vi.spyOn(originalMesh.geometry, 'dispose');
      parent.add(gltf.scene);
      disposeObjectTree(parent);
      expect(geometryDispose).toHaveBeenCalledTimes(1);
    } finally {
      parent.clear();
    }
  });

  it('has a feathered apron mask and no ghost collider when the model is missing', () => {
    const s = ROCK_SHOP_SITE;
    expect(sampleRockShopGrassMask(s.x, s.z)).toBe(0);
    expect(sampleRockShopGrassMask(s.x, s.z + s.halfDepth + s.frontApron)).toBe(0);
    expect(sampleRockShopGrassMask(s.x + s.halfWidth + 0.15, s.z)).toBeCloseTo(0.5);
    expect(sampleRockShopGrassMask(s.x + s.halfWidth + 1, s.z)).toBe(1);
    const parent = new THREE.Group();
    expect(placeRockShop(parent, null, terrainHeight)).toBeNull();
    expect(parent.children).toHaveLength(0);
  });
});
