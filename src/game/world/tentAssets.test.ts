import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { attachTentLod, TENT_LOW_DETAIL_DISTANCE, TENT_LOD_HYSTERESIS } from './tentLod';
import catalog from '../assets/assetCatalog.json';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { physicalScale, terrainHeight } from './CampWorld';
import {
  allTentLayout,
  isOutsideTentColliders,
  prototypeTentLayout,
  festivalTentLayout,
  sampleTentGrassMask,
  tentColliderBounds,
  tentLayout,
} from './campLayout';
import { tentTerrainOffset } from './festivalCamping';

const originals = {
  main: 'main',
  small: 'small',
  small2: 'small2',
  large: 'dużynamiot',
  big2: 'big2',
  white: 'biały',
  colorful: 'kolorwy',
  blue: 'niebieski',
  blueOrange: 'niebppom',
};

function bytes(path: string) {
  return readFileSync(new URL(`../../../public/game-assets/${path}`, import.meta.url));
}

async function load(path: string) {
  const data = bytes(path);
  const loader = new GLTFLoader();
  // Exercise the real GLTF parser, geometry and materials; Node has no image decoder.
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return (await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), ''))
    .scene;
}

function triangles(root: THREE.Object3D) {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      count += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    }
  });
  return count;
}

describe('upgraded tent asset contract', () => {
  it.each(Object.entries(originals))(
    '%s preserves bounds, source colour and portable PBR',
    async (id, name) => {
      const path = catalog.tents[id as keyof typeof catalog.tents];
      expect(path).toBe(`world/tents/upgraded/${id}.glb`);
      const sourcePath = `world/tents/${name}.glb`;
      const source = await load(sourcePath);
      const upgraded = await load(path);
      try {
        for (const precise of [false, true]) {
          const before = new THREE.Box3().setFromObject(source, precise);
          const after = new THREE.Box3().setFromObject(upgraded, precise);
          expect(after.min.distanceTo(before.min)).toBeLessThan(0.0001);
          expect(after.max.distanceTo(before.max)).toBeLessThan(0.0001);
        }
        expect(triangles(upgraded)).toBeLessThanOrEqual(triangles(source) + 2000);
        expect(bytes(path).length).toBeLessThan(bytes(sourcePath).length * 1.25);
        let fabricCount = 0;
        upgraded.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
            const pbr = material as THREE.MeshStandardMaterial;
            expect(pbr.metalness).toBe(0);
            if (pbr.userData.tentUpgrade && !pbr.name.startsWith('Tent_Window')) {
              fabricCount++;
              expect(pbr.map).toBeTruthy();
              expect(pbr.normalMap).toBeTruthy();
              expect(pbr.roughnessMap).toBeTruthy();
              for (const texture of [pbr.map, pbr.normalMap, pbr.roughnessMap]) {
                expect(
                  object.geometry.getAttribute(texture!.channel ? `uv${texture!.channel}` : 'uv'),
                ).toBeTruthy();
              }
            }
          }
        });
        expect(fabricCount).toBeGreaterThan(0);
        const data = bytes(path);
        const json = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
        expect(json.buffers).toHaveLength(1);
        expect(json.buffers[0].uri).toBeUndefined();
        for (const image of json.images) {
          expect(image.uri).toBeUndefined();
          expect(json.bufferViews[image.bufferView].byteLength).toBeGreaterThan(50);
        }
        // Existing colour atlas is preserved byte-for-byte, not replaced with a generic colour.
        const old = bytes(sourcePath);
        const oldJson = JSON.parse(old.toString('utf8', 20, 20 + old.readUInt32LE(12)));
        const oldMat = oldJson.materials[0];
        const newMat = json.materials.find(
          (m: { name?: string }) => m.name === (oldMat.name ?? 'Material_0'),
        );
        const embeddedColor = (blob: Buffer, doc: typeof json, mat: typeof newMat) => {
          const image = doc.images[doc.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source];
          const view = doc.bufferViews[image.bufferView];
          const start = 28 + blob.readUInt32LE(12) + (view.byteOffset ?? 0);
          return blob.subarray(start, start + view.byteLength);
        };
        expect(embeddedColor(data, json, newMat).equals(embeddedColor(old, oldJson, oldMat))).toBe(true);
      } finally {
        disposeObjectTree(source);
        disposeObjectTree(upgraded);
      }
    },
  );

  it.each([
    ...tentLayout.filter(({ model }) => model === 'big2' || model === 'large'),
    ...prototypeTentLayout,
    ...festivalTentLayout,
  ])('$id has a floor above terrain, inside its collider and without grass piercing it', async (config) => {
    const root = await load(catalog.tents[config.model]);
    try {
      const bounds = new THREE.Box3().setFromObject(root);
      if (config.fit === 'exact-source-correction') {
        root.scale.multiply(
          physicalScale(bounds.getSize(new THREE.Vector3()), config.physicalSize, config.fit),
        );
        bounds.setFromObject(root);
      }
      root.scale.multiply(
        physicalScale(bounds.getSize(new THREE.Vector3()), config.physicalSize, config.fit),
      );
      bounds.setFromObject(root);
      const localFloor = root.getObjectByName('Tent_Groundsheet')!;
      const floorY = new THREE.Box3().setFromObject(localFloor).min.y - bounds.min.y;
      const groundOffset = tentTerrainOffset(config, floorY, terrainHeight);
      root.position.set(
        config.position[0],
        -bounds.min.y + groundOffset + terrainHeight(config.position[0], config.position[2]),
        config.position[2],
      );
      root.rotation.y = config.rotationY;
      root.updateMatrixWorld(true);
      const floor = root.getObjectByName('Tent_Groundsheet') as THREE.Mesh;
      expect(floor.userData.tentPart).toBe('groundsheet');
      const position = floor.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(floor.matrixWorld);
        expect(p.y - terrainHeight(p.x, p.z)).toBeGreaterThan(0.015);
        expect(sampleTentGrassMask(p.x, p.z)).toBe(0);
      }
      const ray = new THREE.Raycaster(
        new THREE.Vector3(
          config.position[0],
          terrainHeight(config.position[0], config.position[2]) + 0.7,
          config.position[2],
        ),
        new THREE.Vector3(0, -1, 0),
      );
      expect(ray.intersectObject(floor).length).toBeGreaterThan(0);
    } finally {
      disposeObjectTree(root);
    }
  });

  it('large side window is an actual opening, not a decal on an opaque wall', async () => {
    const root = await load(catalog.tents.large);
    try {
      root.updateMatrixWorld(true);
      // Blender reference coordinates (x, y, z) become glTF (x, z, -y).
      const ray = new THREE.Raycaster(new THREE.Vector3(1, -0.03, 0.18), new THREE.Vector3(-1, 0, 0));
      expect(ray.intersectObject(root, true)[0].object.name).toBe('Tent_Side_Window');
      const front = root.getObjectByName('Tent_Front_Mosquito') as THREE.Mesh;
      const material = front.material as THREE.MeshStandardMaterial;
      expect(material.transparent).toBe(false);
      expect(material.alphaTest).toBe(0.5);
      expect(root.getObjectByName('Tent_Window_Rolled_Cover')).toBeTruthy();
    } finally {
      disposeObjectTree(root);
    }
  });
});

describe('tent grass mask', () => {
  it('excludes rotated tent footprints, leaving the open campsite and remote grass intact', () => {
    for (const tent of allTentLayout) {
      expect(sampleTentGrassMask(tent.position[0], tent.position[2])).toBe(0);
    }
    expect(sampleTentGrassMask(0, 0)).toBe(1);
    expect(sampleTentGrassMask(35, 35)).toBe(1);
    for (let x = -20; x <= 20; x += 0.7) {
      for (let z = -20; z <= 20; z += 0.7) {
        expect(sampleTentGrassMask(x, z)).toBeGreaterThanOrEqual(0);
        expect(sampleTentGrassMask(x, z)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('reference tent prototypes', () => {
  it.each(prototypeTentLayout)(
    '$model is a self-contained, textured and batched GLB with an open entrance',
    async (config) => {
      const path = catalog.tents[config.model];
      const root = await load(path);
      try {
        const data = bytes(path);
        const json = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
        expect(data.length).toBeLessThan(850_000);
        const high = root.getObjectByName('Tent_LOD0')!;
        const low = root.getObjectByName('Tent_LOD1')!;
        expect(high).toBeTruthy();
        expect(low).toBeTruthy();
        expect(triangles(high)).toBeLessThan(18_000);
        expect(triangles(low)).toBeLessThan(triangles(high) * 0.35);
        expect(
          json.nodes.some(
            (node: { extras?: { festivalTentPrototype?: string } }) =>
              node.extras?.festivalTentPrototype === config.model,
          ),
        ).toBe(true);
        expect(json.buffers).toHaveLength(1);
        expect(json.buffers[0].uri).toBeUndefined();
        for (const image of json.images) {
          expect(image.uri).toBeUndefined();
          expect(json.bufferViews[image.bufferView].byteLength).toBeGreaterThan(50);
        }
        let meshes = 0;
        let fabric = 0;
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          meshes++;
          expect(Array.isArray(object.material)).toBe(false);
          const mat = object.material as THREE.MeshStandardMaterial;
          expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
          if (mat.userData.tentUpgrade) {
            fabric++;
            expect(mat.map).toBeTruthy();
            expect(mat.normalMap).toBeTruthy();
            expect(mat.roughnessMap).toBeTruthy();
            for (const texture of [mat.map, mat.normalMap, mat.roughnessMap]) {
              expect(
                object.geometry.getAttribute(texture!.channel ? `uv${texture!.channel}` : 'uv'),
              ).toBeTruthy();
            }
          }
          if (mat.name === 'Tent_Mosquito_Mesh') {
            expect(mat.alphaTest).toBe(0.5);
            expect(mat.transparent).toBe(false);
          }
        });
        expect(meshes).toBeLessThanOrEqual(16);
        expect(fabric).toBeGreaterThan(0);
        root.updateMatrixWorld(true);
        // The front is +Z after glTF Y-up export. No opaque face may block this 0.5 m-high path.
        const ray = new THREE.Raycaster(new THREE.Vector3(0, 0.5, 3), new THREE.Vector3(0, 0, -1), 0, 3);
        expect(ray.intersectObject(root, true)).toHaveLength(0);
      } finally {
        disposeObjectTree(root);
      }
    },
  );

  it('adds four unique, non-overlapping footprints and keeps a walkable approach', () => {
    expect(tentLayout).toHaveLength(15);
    expect(allTentLayout).toHaveLength(19 + festivalTentLayout.length);
    expect(new Set(allTentLayout.map(({ id }) => id)).size).toBe(allTentLayout.length);
    for (const tent of prototypeTentLayout) {
      expect(isOutsideTentColliders(tent.position[0], tent.position[2])).toBe(false);
      expect(isOutsideTentColliders(tent.position[0], 20)).toBe(true);
      const a = tentColliderBounds(tent);
      for (const other of allTentLayout) {
        if (other.id === tent.id) continue;
        const b = tentColliderBounds(other);
        expect(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ).toBe(true);
      }
    }
  });
});

describe('tent distance detail', () => {
  it('family tunnel has real PVC side openings and an arched rear mosquito window', async () => {
    const root = await load(catalog.tents.familyTunnel);
    try {
      const high = root.getObjectByName('Tent_LOD0')!;
      root.updateMatrixWorld(true);
      const side = new THREE.Raycaster(new THREE.Vector3(3, 1.3, 1.6), new THREE.Vector3(-1, 0, 0));
      const sideHit = side.intersectObject(high, true)[0].object as THREE.Mesh;
      const pane = sideHit.material as THREE.MeshStandardMaterial;
      expect(pane.name).toBe('Tunnel_Window_PVC');
      expect(pane.transparent).toBe(true);
      expect(pane.opacity).toBeCloseTo(0.62);
      const rear = new THREE.Raycaster(new THREE.Vector3(0, 1.2, -4), new THREE.Vector3(0, 0, 1));
      const rearHit = rear.intersectObject(high, true)[0].object as THREE.Mesh;
      const net = rearHit.material as THREE.MeshStandardMaterial;
      expect(net.name).toBe('Tent_Mosquito_Mesh');
      expect(net.alphaTest).toBe(0.5);
    } finally {
      disposeObjectTree(root);
    }
  });

  it.each(prototypeTentLayout)(
    '$model switches one level at a time, without changing placement or source',
    async (config) => {
      const source = await load(catalog.tents[config.model]);
      const instance = source.clone(true);
      const other = source.clone(true);
      const before = new THREE.Box3().setFromObject(instance);
      try {
        const lod = attachTentLod(instance)!;
        expect(lod).toBeInstanceOf(THREE.LOD);
        expect(lod.autoUpdate).toBe(true);
        expect(attachTentLod(instance)).toBe(lod);
        expect(attachTentLod(other)).not.toBe(lod);
        expect(source.getObjectByName('TentDistanceLOD')).toBeUndefined();
        expect(new THREE.Box3().setFromObject(instance).equals(before)).toBe(true);
        expect(lod.levels).toHaveLength(2);
        const [high, low] = lod.levels.map(({ object }) => object);
        expect(high.visible).toBe(true);
        expect(low.visible).toBe(false);
        const camera = new THREE.PerspectiveCamera();
        // Test world coordinates, not just the source asset at the origin.
        instance.position.set(22, 0, 24);
        instance.updateMatrixWorld(true);
        const anchor = lod.getWorldPosition(new THREE.Vector3());
        const updateAt = (distance: number) => {
          camera.position.copy(anchor).add(new THREE.Vector3(0, 0, distance));
          camera.updateMatrixWorld(true);
          lod.update(camera);
          expect(Number(high.visible) + Number(low.visible)).toBe(1);
        };
        updateAt(TENT_LOW_DETAIL_DISTANCE + 1);
        expect(low.visible).toBe(true);
        updateAt(TENT_LOW_DETAIL_DISTANCE - 1);
        expect(low.visible).toBe(true); // hysteresis prevents threshold chatter
        updateAt(TENT_LOW_DETAIL_DISTANCE * (1 - TENT_LOD_HYSTERESIS) - 1);
        expect(high.visible).toBe(true);
        // Clones share immutable geometry/materials with the loader cache, not visibility state.
        expect(other.getObjectByName('Tent_LOD0')!.visible).toBe(true);
        const firstMesh = (group: THREE.Object3D) => {
          let found: THREE.Mesh | undefined;
          group.traverse((object) => {
            if (!found && object instanceof THREE.Mesh) found = object;
          });
          return found!;
        };
        expect(firstMesh(instance).geometry).toBe(firstMesh(source).geometry);
        expect(firstMesh(instance).material).toBe(firstMesh(source).material);
        const sharedMaterial = firstMesh(high).material as THREE.Material;
        const disposeSpy = vi.spyOn(sharedMaterial, 'dispose');
        // One scene-tree cleanup, including invisible levels and shared instance materials.
        const scene = new THREE.Group();
        scene.add(instance, other);
        disposeObjectTree(scene);
        expect(disposeSpy).toHaveBeenCalledTimes(1);
        disposeSpy.mockRestore();
      } finally {
        // GPU resources were shared and already disposed by the scene tree above.
        source.clear();
      }
    },
  );

  it('leaves legacy assets and malformed detail pairs alone', () => {
    const root = new THREE.Group();
    const original = new THREE.Group();
    original.name = 'Tent_LOD0';
    root.add(original);
    expect(attachTentLod(root)).toBeNull();
    expect(root.children).toEqual([original]);
  });
});
