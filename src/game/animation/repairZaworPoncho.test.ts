import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { repairZaworPoncho } from './repairZaworPoncho';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it('poncho correction preserves the neutral mesh, head and free hands', async () => {
  const b = readFileSync('public/game-assets/characters/zawor/npc-animations.glb');
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const model = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  model.scene.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  model.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) {
      o.skeleton.update();
      meshes.push(o);
    }
  });
  const box = new THREE.Box3().setFromObject(model.scene);
  const height = box.max.y - box.min.y;
  const before = meshes.map((mesh) => ({
    points: Array.from({ length: mesh.geometry.getAttribute('position').count }, (_, i) =>
      mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
    ),
    joints: mesh.geometry.getAttribute('skinIndex').array.slice(),
    weights: mesh.geometry.getAttribute('skinWeight').array.slice(),
  }));
  repairZaworPoncho(model.scene);
  let protectedCount = 0;
  meshes.forEach((mesh, m) => {
    const j = mesh.geometry.getAttribute('skinIndex'),
      w = mesh.geometry.getAttribute('skinWeight');
    before[m].points.forEach((p, i) => {
      expect(
        mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(p) / height,
      ).toBeLessThan(1e-5);
      const y = (p.y - box.min.y) / height;
      const x = Math.abs(p.x - (box.min.x + box.max.x) / 2) / height;
      if (y > 0.7 || x > 0.34) {
        protectedCount++;
        for (let c = 0; c < 4; c++) {
          expect(j.getComponent(i, c)).toBe(before[m].joints[i * 4 + c]);
          expect(w.getComponent(i, c)).toBe(before[m].weights[i * 4 + c]);
        }
      }
      expect([0, 1, 2, 3].reduce((s, c) => s + w.getComponent(i, c), 0)).toBeCloseTo(1, 5);
    });
  });
  expect(protectedCount).toBeGreaterThan(100);
  disposeObjectTree(model.scene);
});
