import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { shoulderRepairAssets } from './shoulderRepairCatalog';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it.each(shoulderRepairAssets)('$id face follows Head without changing its shape', async ({ id, path }) => {
  const base = process.env.HEAD_TEST_SOURCE ?? 'public/game-assets';
  const bytes = readFileSync(`${base}/${path}`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const model = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model.scene.updateMatrixWorld(true);
  const height = new THREE.Box3().setFromObject(model.scene).getSize(new THREE.Vector3()).y;
  let checked = 0,
    maxError = 0,
    maxWrongWeight = 0;
  const mixer = new THREE.AnimationMixer(model.scene);
  const samples: { mesh: THREE.SkinnedMesh; head: number; vertices: number[] }[] = [];
  model.scene.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    const head = mesh.skeleton.bones.findIndex((b) => /(?:^|mixamorig[:_]?)Head$/.test(b.name));
    const origin = new THREE.Vector3().setFromMatrixPosition(
      mesh.skeleton.boneInverses[head].clone().invert(),
    );
    const p = mesh.geometry.getAttribute('position'),
      j = mesh.geometry.getAttribute('skinIndex'),
      w = mesh.geometry.getAttribute('skinWeight');
    const point = new THREE.Vector3(),
      vertices: number[] = [];
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(mesh.bindMatrix);
      const jawFloor =
        origin.y - height * 0.04 + height * 0.1 * ((point.x - origin.x) / (height * 0.16)) ** 2;
      const sideCheek =
        (id === 'hemoroid' || id === 'chlebak') &&
        point.y >= jawFloor + height * 0.012 &&
        Math.abs(point.x - origin.x) <= height * 0.18;
      if (
        !sideCheek &&
        (point.y < origin.y - height * 0.02 ||
          Math.abs(point.x - origin.x) > height * 0.115 ||
          point.z - origin.z < height * 0.07)
      )
        continue;
      vertices.push(i);
      checked++;
      for (let c = 0; c < 4; c++)
        if (j.getComponent(i, c) !== head) maxWrongWeight = Math.max(maxWrongWeight, w.getComponent(i, c));
    }
    samples.push({ mesh, head, vertices: vertices.filter((_, i) => i % 17 === 0) });
  });
  for (const clipName of ['Idle', 'Walk', 'Run']) {
    const clip = model.animations.find((c) => c.name === clipName)!;
    expect(clip).toBeDefined();
    mixer.clipAction(clip).play();
    for (const time of [0, 0.3, 0.7]) {
      mixer.setTime(time);
      model.scene.updateMatrixWorld(true);
      for (const { mesh, head, vertices } of samples) {
        mesh.skeleton.update();
        const transform = new THREE.Matrix4().multiplyMatrices(
          mesh.skeleton.bones[head].matrixWorld,
          mesh.skeleton.boneInverses[head],
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
  expect(checked).toBeGreaterThan(20);
  expect(maxWrongWeight).toBeLessThan(1e-6);
  expect(maxError).toBeLessThan(1e-5);
  mixer.uncacheRoot(model.scene);
  disposeObjectTree(model.scene);
});
