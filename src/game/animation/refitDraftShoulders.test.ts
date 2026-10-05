import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { shoulderRepairAssets, shoulderLiftForAsset } from './shoulderRepairCatalog';
import { disposeObjectTree } from '../lifecycle/disposeThree';

async function load(path: string) {
  const b = readFileSync(path),
    l = new GLTFLoader();
  l.register(() => ({ name: 'images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const g = await l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
  });
  return g;
}
it.each(shoulderRepairAssets)(
  '$id has narrower shoulder pivots without altering the neutral mesh',
  async ({ id, path }) => {
    const source = await load(`source-assets/rigged-festival/${id}/t-pose.glb`),
      result = await load(`public/game-assets/${path}`);
    const meshes = (root: THREE.Object3D) => {
      const out: THREE.SkinnedMesh[] = [];
      root.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) out.push(o);
      });
      return out;
    };
    const originals = meshes(source.scene),
      current = meshes(result.scene);
    expect(current.length).toBe(originals.length);
    for (let m = 0; m < current.length; m++) {
      const src = originals[m],
        dst = current[m];
      const count = src.geometry.getAttribute('position').count;
      expect(dst.geometry.getAttribute('position').count).toBe(count);
      let max = 0;
      for (let i = 0; i < count; i++) {
        const a = src.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(src.matrixWorld),
          b = dst.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(dst.matrixWorld);
        max = Math.max(max, a.distanceTo(b));
      }
      expect(max).toBeLessThan(1e-4);
      const lift = shoulderLiftForAsset(id);
      const height = new THREE.Box3().setFromObject(source.scene).getSize(new THREE.Vector3()).y;
      for (const side of ['Left', 'Right']) {
        const old = src.skeleton.bones.find((b) => b.name.endsWith(side + 'Arm'))!,
          bone = dst.skeleton.bones.find((b) => b.name.endsWith(side + 'Arm'))!;
        expect(
          bone.getWorldPosition(new THREE.Vector3()).x / old.getWorldPosition(new THREE.Vector3()).x,
        ).toBeCloseTo(0.75, 4);
        expect(
          bone.getWorldPosition(new THREE.Vector3()).y - old.getWorldPosition(new THREE.Vector3()).y,
        ).toBeCloseTo(height * lift, 4);
      }
    }
    const mixer = new THREE.AnimationMixer(result.scene);
    for (const name of ['Idle', 'Walk', 'Run']) {
      const clip = result.animations.find((c) => c.name === name)!;
      expect(clip).toBeDefined();
      mixer.clipAction(clip).play();
      for (const t of [0, 0.25, 0.6]) {
        mixer.setTime(t);
        result.scene.updateMatrixWorld(true);
        for (const mesh of current)
          for (const bone of mesh.skeleton.bones.filter((b) =>
            /(?:Left|Right)(?:Arm|ForeArm|Hand)$/.test(b.name),
          )) {
            const positionTrack = clip.tracks.find((track) => track.name === bone.name + '.position');
            expect(positionTrack).toBeDefined();
            for (let i = 3; i < positionTrack!.values.length; i++)
              expect(positionTrack!.values[i]).toBeCloseTo(positionTrack!.values[i % 3], 5);
          }
      }
      mixer.stopAllAction();
    }
    mixer.uncacheRoot(result.scene);
    disposeObjectTree(source.scene);
    disposeObjectTree(result.scene);
  },
);

it('Korba clavicle edges no longer stretch almost fourfold in Idle', async () => {
  const model = await load('public/game-assets/characters/korba/npc-animations.glb');
  const mixer = new THREE.AnimationMixer(model.scene);
  mixer.clipAction(model.animations.find((clip) => clip.name === 'Idle')!).play();
  mixer.update(0.4);
  model.scene.updateMatrixWorld(true);
  let maxRatio = 0,
    checked = 0;
  model.scene.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    mesh.skeleton.update();
    const p = mesh.geometry.getAttribute('position'),
      index = mesh.geometry.index!;
    for (let n = 0; n < index.count; n += 3)
      for (let c = 0; c < 3; c++) {
        const i = index.getX(n + c),
          j = index.getX(n + ((c + 1) % 3));
        const a = new THREE.Vector3().fromBufferAttribute(p, i),
          b = new THREE.Vector3().fromBufferAttribute(p, j);
        if (a.y < 1.3 || a.y > 1.8 || Math.abs(a.x) < 0.2 || Math.abs(a.x) > 0.7 || a.z < -0.1) continue;
        const rest = a.distanceTo(b);
        if (rest < 0.003) continue;
        const deformed = mesh
          .getVertexPosition(i, new THREE.Vector3())
          .distanceTo(mesh.getVertexPosition(j, new THREE.Vector3()));
        maxRatio = Math.max(maxRatio, deformed / rest);
        checked++;
      }
  });
  expect(checked).toBeGreaterThan(100);
  expect(maxRatio).toBeLessThan(3.0); // previous shipped profile: 3.7593, relaxed shoulder transition: 2.956
  mixer.stopAllAction();
  mixer.uncacheRoot(model.scene);
  disposeObjectTree(model.scene);
});
