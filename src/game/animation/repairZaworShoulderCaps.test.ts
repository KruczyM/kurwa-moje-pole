import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { refitZaworCapPivots, repairZaworShoulderCaps } from './repairZaworShoulderCaps';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it('Zawor cap repair preserves neutral geometry and weights outside the shoulder band', async () => {
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
  const box = new THREE.Box3().setFromObject(model.scene),
    height = box.max.y - box.min.y;
  const snapshots = meshes.map((mesh) => ({
    points: Array.from({ length: mesh.geometry.getAttribute('position').count }, (_, i) =>
      mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
    ),
    weights: mesh.geometry.getAttribute('skinWeight').array.slice(),
    joints: mesh.geometry.getAttribute('skinIndex').array.slice(),
    arm: mesh.skeleton.bones.find((b) => b.name.endsWith('LeftArm'))!.getWorldPosition(new THREE.Vector3()),
  }));
  refitZaworCapPivots(model);
  expect(repairZaworShoulderCaps(model.scene)).toBeGreaterThan(100);
  let protectedVertices = 0,
    maxNeutralError = 0;
  meshes.forEach((mesh, m) => {
    const w = mesh.geometry.getAttribute('skinWeight'),
      j = mesh.geometry.getAttribute('skinIndex');
    const arm = mesh.skeleton.bones
      .find((b) => b.name.endsWith('LeftArm'))!
      .getWorldPosition(new THREE.Vector3());
    expect((snapshots[m].arm.x - arm.x) / height).toBeCloseTo(0.025, 5);
    snapshots[m].points.forEach((p, i) => {
      maxNeutralError = Math.max(
        maxNeutralError,
        mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(p) / height,
      );
      const y = (p.y - box.min.y) / height;
      if (y > 0.76 || y < 0.56) {
        protectedVertices++;
        for (let c = 0; c < 4; c++) {
          expect(w.getComponent(i, c)).toBe(snapshots[m].weights[i * 4 + c]);
          expect(j.getComponent(i, c)).toBe(snapshots[m].joints[i * 4 + c]);
        }
      }
      expect([0, 1, 2, 3].reduce((s, c) => s + w.getComponent(i, c), 0)).toBeCloseTo(1, 5);
    });
  });
  expect(protectedVertices).toBeGreaterThan(100);
  expect(maxNeutralError).toBeLessThan(1e-5);
  disposeObjectTree(model.scene);
}, 20000);
