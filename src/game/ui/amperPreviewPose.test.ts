import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { amperPreviewPose } from './amperPreviewPose';
import { startPreviewIdle } from './previewIdle';
import { disposeObjectTree } from '../lifecycle/disposeThree';

async function load(path: string) {
  const b = readFileSync('public/game-assets/characters/' + path);
  const l = new GLTFLoader();
  l.register(() => ({ name: 'images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
it.each(['zawor', 'korba'])(
  '%s menu keeps straight relaxed arms without changing source clips',
  async (id) => {
    const donor = await load('amper/preview.glb'),
      model = await load(id + '/npc-animations.glb');
    const original = model.animations.map((c) => JSON.stringify(THREE.AnimationClip.toJSON(c)));
    const donorOriginal = donor.scene.getObjectsByProperty('isBone', true).map((b) => b.quaternion.toArray());
    model.scene.updateMatrixWorld(true);
    const restWorld = new Map(
      model.scene
        .getObjectsByProperty('isBone', true)
        .map((b) => [b, b.getWorldQuaternion(new THREE.Quaternion())]),
    );
    const clip = amperPreviewPose(model.scene, donor.scene, donor.animations, id);
    expect(donor.scene.getObjectsByProperty('isBone', true).map((b) => b.quaternion.toArray())).toEqual(
      donorOriginal,
    );
    const a = startPreviewIdle(model.scene, [clip]),
      b = startPreviewIdle(donor.scene, donor.animations);
    for (const time of [0, 0.4, 2]) {
      a.setTime(time);
      model.scene.updateMatrixWorld(true);
      for (const [side, suffix] of [
        ['Left', 'L'],
        ['Right', 'R'],
      ]) {
        const target = (name: string) =>
          model.scene.getObjectsByProperty('isBone', true).find((o) => o.name.endsWith(side + name))!;
        const source = (name: string) =>
          donor.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name + '.' + suffix))!;
        const direction = (x: THREE.Object3D, y: THREE.Object3D) =>
          y.getWorldPosition(new THREE.Vector3()).sub(x.getWorldPosition(new THREE.Vector3())).normalize();
        const expected = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          THREE.MathUtils.degToRad((side === 'Left' ? -1 : 1) * (id === 'zawor' ? 85 : 80)),
        );
        for (const part of ['Arm', 'ForeArm', 'Hand']) {
          const bone = target(part);
          const delta = bone
            .getWorldQuaternion(new THREE.Quaternion())
            .multiply(restWorld.get(bone)!.clone().invert());
          expect(delta.normalize().angleTo(expected)).toBeLessThan(1e-4);
        }
        expect(
          direction(target('UpLeg'), target('Leg')).dot(direction(source('thigh'), source('shin'))),
        ).toBeGreaterThan(0.9999);
        if (id === 'zawor')
          expect(
            target('Foot')
              .getWorldQuaternion(new THREE.Quaternion())
              .normalize()
              .angleTo(restWorld.get(target('Foot'))!.clone().normalize()),
          ).toBeLessThan(1e-4);
      }
    }
    expect(model.animations.map((c) => JSON.stringify(THREE.AnimationClip.toJSON(c)))).toEqual(original);
    a.stopAllAction();
    b.stopAllAction();
    a.uncacheRoot(model.scene);
    b.uncacheRoot(donor.scene);
    disposeObjectTree(model.scene);
    disposeObjectTree(donor.scene);
  },
);
