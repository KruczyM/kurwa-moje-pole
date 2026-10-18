import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { rigidPropAssets } from './repairNpcProps';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it.each(rigidPropAssets)('$id prop stays rigid during animation', async ({ id, path }) => {
  const bytes = readFileSync(`${process.env.PROP_TEST_SOURCE ?? 'public/game-assets'}/${path}`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const model = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model.scene.updateMatrixWorld(true);
  const samples: { mesh: THREE.SkinnedMesh; hand: number; vertices: number[] }[] = [];
  let edgeChecked = 0;
  model.scene.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    const hand = mesh.skeleton.bones.findIndex((b) => /RightHand$/.test(b.name));
    const positions = mesh.geometry.getAttribute('position');
    const vertices: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      // Board's inward edge was missed by the first mask: explicitly cover it.
      const selected = id.startsWith('034')
        ? p.x < -0.46 && p.y > 1.76 && p.z > 0.3
        : p.x < -0.65 && p.y > 1.8;
      if (!selected) continue;
      vertices.push(i);
      if (id.startsWith('034') && p.x > -0.5) edgeChecked++;
    }
    samples.push({ mesh, hand, vertices });
    if (id.startsWith('042')) {
      const head = mesh.skeleton.bones.findIndex((b) => /(?:^|mixamorig[:_]?)Head$/.test(b.name));
      const hair: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        if (p.y > 1.71 && Math.abs(p.x) < 0.59) hair.push(i);
      }
      expect(hair.length).toBeGreaterThan(100);
      samples.push({ mesh, hand: head, vertices: hair });
    }
  });
  expect(samples.reduce((n, s) => n + s.vertices.length, 0)).toBeGreaterThan(20);
  if (id.startsWith('034')) expect(edgeChecked).toBeGreaterThan(0);
  const mixer = new THREE.AnimationMixer(model.scene);
  let maxError = 0;
  for (const name of ['Idle', 'Walk', 'Run']) {
    const clip = model.animations.find((c) => c.name === name);
    expect(clip).toBeDefined();
    mixer.clipAction(clip!).play();
    for (const time of [0, 0.3, 0.7]) {
      mixer.setTime(time);
      model.scene.updateMatrixWorld(true);
      for (const { mesh, hand, vertices } of samples) {
        mesh.skeleton.update();
        const transform = new THREE.Matrix4().multiplyMatrices(
          mesh.skeleton.bones[hand].matrixWorld,
          mesh.skeleton.boneInverses[hand],
        );
        for (const i of vertices) {
          const expected = new THREE.Vector3()
            .fromBufferAttribute(mesh.geometry.getAttribute('position'), i)
            .applyMatrix4(mesh.bindMatrix)
            .applyMatrix4(transform)
            .applyMatrix4(mesh.bindMatrixInverse);
          maxError = Math.max(maxError, expected.distanceTo(mesh.getVertexPosition(i, new THREE.Vector3())));
        }
      }
    }
    mixer.stopAllAction();
  }
  expect(maxError).toBeLessThan(1e-5);
  mixer.uncacheRoot(model.scene);
  disposeObjectTree(model.scene);
});
