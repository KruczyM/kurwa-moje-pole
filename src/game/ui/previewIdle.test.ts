import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { characterAssets } from '../assets/assetManifest';
import { startPreviewIdle } from './previewIdle';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it.each(characterAssets)(
  '$name preview starts with hands below the upper arms, not in T-pose',
  async (asset) => {
    const path = decodeURIComponent(asset.previewUrl.split('game-assets/')[1].split('?')[0]);
    const bytes = readFileSync(new URL(`../../../public/game-assets/${path}`, import.meta.url));
    if (asset.id === 'klatwa') expect(path).toBe('characters/klatwa/new-preview-animations.glb');
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    const model = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    if (asset.id === 'zawor') {
      expect(path).toBe('characters/zawor/preview.glb');
      expect(model.animations).toHaveLength(0);
      expect(model.scene.getObjectsByProperty('isSkinnedMesh', true)).toHaveLength(0);
      expect(new THREE.Box3().setFromObject(model.scene).isEmpty()).toBe(false);
      disposeObjectTree(model.scene);
      return;
    }
    const mixer = startPreviewIdle(model.scene, model.animations);
    const bones = model.scene.getObjectsByProperty('isBone', true);
    const bounds = new THREE.Box3().setFromObject(model.scene);
    const height = bounds.max.y - bounds.min.y;
    for (const [side, suffix] of [
      ['Left', 'L'],
      ['Right', 'R'],
    ]) {
      const hand = bones.find(
        (b) =>
          b.name.endsWith(`${side}Hand`) ||
          b.name === THREE.PropertyBinding.sanitizeNodeName(`hand.${suffix}`),
      );
      const arm = bones.find(
        (b) =>
          b.name.endsWith(`${side}Arm`) ||
          b.name === THREE.PropertyBinding.sanitizeNodeName(`upper_arm.${suffix}`),
      );
      expect(hand).toBeDefined();
      expect(arm).toBeDefined();
      for (const delta of [0, 0.4, 0.6]) {
        mixer.update(delta);
        model.scene.updateMatrixWorld(true);
        const drop =
          arm!.getWorldPosition(new THREE.Vector3()).y - hand!.getWorldPosition(new THREE.Vector3()).y;
        expect(drop / height, `${asset.name}/${side}`).toBeGreaterThan(0.12);
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(model.scene);
    disposeObjectTree(model.scene);
  },
);

it('starts preview with preferred clip (e.g. Walk) on repeat when requested', async () => {
  const bytes = readFileSync(
    new URL('../../../public/game-assets/characters/zawor/npc-animations.glb', import.meta.url),
  );
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const model = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const mixer = startPreviewIdle(model.scene, model.animations, 'Walk');
  const walk = model.animations.find((c) => c.name === 'Walk')!;
  expect(walk).toBeDefined();
  expect(mixer.clipAction(walk).isRunning()).toBe(true);
  expect(mixer.clipAction(walk).loop).toBe(THREE.LoopRepeat);
  mixer.stopAllAction();
  mixer.uncacheRoot(model.scene);
  disposeObjectTree(model.scene);
});
