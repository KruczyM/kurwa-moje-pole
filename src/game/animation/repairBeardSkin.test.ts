import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { BEARD_REGIONS, repairBeardSkin } from './repairBeardSkin';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it.each(Object.keys(BEARD_REGIONS))(
  '%s beard follows head and neck without stretching or changing unrelated weights',
  async (id) => {
    const bytes = readFileSync(`public/game-assets/characters/${id}/npc-animations.glb`);
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    const model = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const snapshots = new Map<
      THREE.SkinnedMesh,
      { joints: number[]; weights: number[]; positions: number[] }
    >();
    model.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh)
        snapshots.set(object, {
          joints: Array.from(object.geometry.getAttribute('skinIndex').array),
          weights: Array.from(object.geometry.getAttribute('skinWeight').array),
          positions: Array.from(object.geometry.getAttribute('position').array),
        });
    });
    const selection = repairBeardSkin(model.scene, id);
    expect(selection.size).toBeGreaterThan(0);
    for (const [mesh, vertices] of selection) {
      const head = mesh.skeleton.bones.find((b) => b.name.endsWith('Head'))!;
      const neck = mesh.skeleton.bones.find((b) => b.name.endsWith('Neck'))!;
      expect(neck).toBeDefined();
      const ancestors: THREE.Object3D[] = [];
      head.traverseAncestors((b) => ancestors.push(b));
      expect(ancestors).toContain(neck);
      const indices = mesh.geometry.getAttribute('skinIndex'),
        weights = mesh.geometry.getAttribute('skinWeight');
      const snapshot = snapshots.get(mesh)!;
      expect(vertices.length).toBeGreaterThan(100);
      expect(vertices.length / indices.count).toBeLessThan(0.35);
      expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(snapshot.positions);
      const selected = new Set(vertices);
      let unchanged = true,
        baked = true;
      for (let i = 0; i < indices.count; i++)
        for (let c = 0; c < 4; c++) {
          if (!selected.has(i))
            unchanged &&=
              indices.getComponent(i, c) === snapshot.joints[i * 4 + c] &&
              weights.getComponent(i, c) === snapshot.weights[i * 4 + c];
          else
            baked &&=
              snapshot.joints[i * 4 + c] === (c === 0 ? mesh.skeleton.bones.indexOf(head) : 0) &&
              snapshot.weights[i * 4 + c] === (c === 0 ? 1 : 0);
        }
      expect(unchanged).toBe(true);
      // Verify shipped GLBs, not only the helper: the game needs no repair pass.
      expect(baked).toBe(true);
      mesh.skeleton.update();
      const local = () => {
        const inverse = head.matrixWorld.clone().invert();
        return vertices.map((i) =>
          mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse),
        );
      };
      const baseline = local();
      const height = new THREE.Box3().setFromObject(model.scene).getSize(new THREE.Vector3()).y;
      const h = head.quaternion.clone(),
        n = neck.quaternion.clone();
      for (const angle of [-0.6, 0.35, 0.7]) {
        head.quaternion
          .copy(h)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle));
        neck.quaternion
          .copy(n)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle / 3));
        model.scene.updateMatrixWorld(true);
        mesh.skeleton.update();
        const current = local();
        const error = Math.max(...current.map((v, i) => v.distanceTo(baseline[i]))) / height;
        expect(error).toBeLessThan(1e-5);
      }
      head.quaternion.copy(h);
      neck.quaternion.copy(n);
      model.scene.updateMatrixWorld(true);
    }
    disposeObjectTree(model.scene);
  },
);

it('does not alter characters without an authored beard region', () => {
  expect(repairBeardSkin(new THREE.Group(), 'amper').size).toBe(0);
  expect(repairBeardSkin(new THREE.Group(), 'gruczol').size).toBe(0);
});
