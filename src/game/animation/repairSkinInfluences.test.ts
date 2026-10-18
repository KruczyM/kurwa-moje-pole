import * as THREE from 'three';
import { expect, it } from 'vitest';
import { repairSkinInfluences } from './repairSkinInfluences';

function fixture() {
  const rig = new THREE.Group();
  const specs: [string, number, number][] = [
    ['Hips', 0, 1],
    ['Spine', 0, 1.3],
    ['Neck', 0, 2],
    ['Head', 0, 2.2],
    ['LeftArm', 0.5, 1.8],
    ['RightArm', -0.5, 1.8],
    ['LeftHand', 1.5, 1.8],
    ['LeftFoot', 0.2, 0],
  ];
  const bones = specs.map(([name, x, y]) => {
    const b = new THREE.Bone();
    b.name = `mixamorig${name}`;
    b.position.set(x, y, 0);
    rig.add(b);
    return b;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 1.4, 0, 0, 2.35, 0, 1.4, 1.85, 0], 3),
  );
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute([6, 0, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0], 4),
  );
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
  );
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  rig.add(mesh);
  rig.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return { rig, bones, mesh };
}

it('removes a hand influence from torso fabric without altering the skeleton or mesh', () => {
  const { mesh, bones } = fixture();
  const positions = [...mesh.geometry.getAttribute('position').array];
  const transforms = bones.map((b) => b.matrixWorld.toArray());
  expect(repairSkinInfluences(mesh)).toBeGreaterThan(0);
  const j = mesh.geometry.getAttribute('skinIndex'),
    w = mesh.geometry.getAttribute('skinWeight');
  let handWeight = 0;
  for (let c = 0; c < 4; c++) if (j.getComponent(0, c) === 6) handWeight += w.getComponent(0, c);
  expect(handWeight).toBe(0);
  expect(j.getX(1)).toBe(3); // cranium follows Head
  expect(w.getX(1)).toBe(1);
  expect(j.getX(2)).toBe(6); // elevated T-pose sleeve is not captured by Head
  expect(w.getX(2)).toBe(1);
  expect([...mesh.geometry.getAttribute('position').array]).toEqual(positions);
  expect(bones.map((b) => b.matrixWorld.toArray())).toEqual(transforms);
});
