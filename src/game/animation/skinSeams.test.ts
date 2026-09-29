import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { repairSkinSeams } from './repairSkinSeams';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it('keeps coincident vertices together while walking on every rig', async () => {
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const assets = [...catalog.characters, ...catalog.festivalNpcs];
  expect(assets).toHaveLength(107);
  for (const asset of assets) {
    const path = 'path' in asset ? asset.path : `characters/${asset.id}/npc-animations.glb`;
    const bytes = readFileSync(new URL(`../../../public/game-assets/${path}`, import.meta.url));
    const model = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    repairSkinSeams(model.scene);
    const mixer = new THREE.AnimationMixer(model.scene);
    mixer.clipAction(model.animations.find((clip) => clip.name === 'Walk')!).play();
    mixer.update(0.37);
    model.scene.updateMatrixWorld(true);
    model.scene.traverse((object) => {
      if (!(object instanceof THREE.SkinnedMesh)) return;
      object.skeleton.update();
      const p = object.geometry.getAttribute('position'),
        w = object.geometry.getAttribute('skinWeight');
      const groups = new Map<string, number>();
      let maximumWeightError = 0;
      let maximumGap = 0;
      for (let i = 0; i < p.count; i++) {
        maximumWeightError = Math.max(
          maximumWeightError,
          Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1),
        );
        const key = `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
        const other = groups.get(key);
        if (other === undefined) {
          groups.set(key, i);
          continue;
        }
        const a = object.getVertexPosition(i, new THREE.Vector3());
        const b = object.getVertexPosition(other, new THREE.Vector3());
        maximumGap = Math.max(maximumGap, a.distanceTo(b));
      }
      expect(maximumWeightError, `${asset.id}: unnormalized weights`).toBeLessThan(1e-5);
      expect(maximumGap, `${asset.id}: split seam`).toBeLessThan(1e-6);
    });
    mixer.stopAllAction();
    mixer.uncacheRoot(model.scene);
    disposeObjectTree(model.scene);
  }
}, 60000);

it('preserves texture seams and nearby separate geometry', () => {
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry());
  const g = mesh.geometry;
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0.001, 0, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 0.5, 0.5], 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  g.setIndex([0, 1, 2]);
  const positions = [...g.getAttribute('position').array];
  const uv = [...g.getAttribute('uv').array];
  expect(repairSkinSeams(mesh)).toBe(2);
  expect(repairSkinSeams(mesh)).toBe(0);
  expect([...g.getAttribute('position').array]).toEqual(positions);
  expect([...g.getAttribute('uv').array]).toEqual(uv);
  expect([...g.index!.array]).toEqual([0, 1, 2]);
  expect(g.getAttribute('skinIndex').getX(2)).toBe(2);
  g.dispose();
});
