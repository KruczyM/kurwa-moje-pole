import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { repairDraftArmSkin } from './repairDraftArmSkin';
import { shoulderRepairAssets } from './shoulderRepairCatalog';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it.each(shoulderRepairAssets)(
  '$id shipped sleeves follow their local arm, not the head or torso',
  async ({ path }) => {
    const bytes = readFileSync(`public/game-assets/${path}`);
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    const model = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const before = new Map<THREE.SkinnedMesh, number[]>();
    let checked = 0,
      valid = true;
    model.scene.traverse((o) => {
      if (!(o instanceof THREE.SkinnedMesh)) return;
      const names = o.skeleton.bones.map((b) => b.name.replace(/^mixamorig[:_]?/, ''));
      const points = o.skeleton.boneInverses.map((m) =>
        new THREE.Vector3().setFromMatrixPosition(m.clone().invert()),
      );
      const weights = o.geometry.getAttribute('skinWeight'),
        indices = o.geometry.getAttribute('skinIndex');
      before.set(o, Array.from(weights.array));
      const p = new THREE.Vector3(),
        pos = o.geometry.getAttribute('position');
      const neck = points[names.indexOf('Neck')],
        foot = points[names.indexOf('LeftFoot')],
        scale = neck.distanceTo(foot);
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix);
        const side = p.x >= neck.x ? 'Left' : 'Right',
          arm = points[names.indexOf(side + 'Arm')];
        const x = Math.abs(p.x - neck.x);
        const elbow = points[names.indexOf(side + 'ForeArm')];
        if (x < Math.abs(elbow.x - neck.x) * 1.1 || Math.abs(p.y - arm.y) > scale * 0.1) continue;
        checked++;
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          const w = weights.getComponent(i, c);
          sum += w;
          if (w > 1e-6)
            valid &&= [side + 'Arm', side + 'ForeArm', side + 'Hand'].includes(
              names[indices.getComponent(i, c)],
            );
        }
        valid &&= Math.abs(sum - 1) < 1e-6;
      }
    });
    expect(checked).toBeGreaterThan(100);
    expect(valid).toBe(true);
    // This is an offline final pass from immutable backups, not a runtime pass.
    // Reapplying a partial boundary blend would intentionally blend twice.
    for (const [mesh] of before) {
      const w = mesh.geometry.getAttribute('skinWeight');
      for (let i = 0; i < w.count; i++)
        expect(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i)).toBeCloseTo(1, 5);
    }
    disposeObjectTree(model.scene);
  },
);

it('leaves non-draft rigs alone', () => {
  const root = new THREE.Group(),
    mesh = new THREE.SkinnedMesh();
  mesh.skeleton = new THREE.Skeleton([]);
  root.add(mesh);
  expect(repairDraftArmSkin(root)).toBe(0);
});

it('keeps the inner clavicle on the torso in the upper-chest profile', () => {
  const names = ['Spine2', 'Neck', 'LeftFoot', 'LeftArm', 'LeftForeArm', 'LeftHand'];
  const bones = Array.from({ length: 22 }, (_, i) => {
    const bone = new THREE.Bone();
    bone.name = names[i] ?? `unused${i}`;
    return bone;
  });
  const points = [
    [0, 1.4, 0],
    [0, 1.6, 0],
    [0, 0, 0],
    [0.4, 1.6, 0],
    [0.8, 1.6, 0],
    [1.1, 1.6, 0],
  ];
  const inverses = bones.map((_, i) =>
    new THREE.Matrix4().makeTranslation(...((points[i] ?? [0, 0, 0]) as [number, number, number])).invert(),
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0.34, 1.6, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([3, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry);
  mesh.skeleton = new THREE.Skeleton(bones, inverses);
  repairDraftArmSkin(mesh, true);
  const indices = geometry.getAttribute('skinIndex');
  const weights = geometry.getAttribute('skinWeight');
  expect(indices.getX(0)).toBe(0);
  expect(weights.getX(0)).toBeCloseTo(1, 5);
  geometry.dispose();
  mesh.skeleton.dispose();
});
