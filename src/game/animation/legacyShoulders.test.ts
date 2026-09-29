import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { FestivalMotionBank } from './FestivalMotionBank';
import { refitDraftShoulders } from './refitDraftShoulders';
import { disposeObjectTree } from '../lifecycle/disposeThree';

async function load(path: string) {
  const bytes = readFileSync(`public/game-assets/${path}`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

it.each(['pien', 'zawor'])('%s legacy rig is unchanged without explicit opt-in', async (id) => {
  const model = await load(`characters/${id}/npc-animations.glb`);
  const before = model.scene.getObjectsByProperty('isBone', true).map((b) => b.position.toArray());
  refitDraftShoulders(model, 0.045);
  expect(model.scene.getObjectsByProperty('isBone', true).map((b) => b.position.toArray())).toEqual(before);
  disposeObjectTree(model.scene);
});

it('Ambona arm-pose correction changes arm tracks but not the face or legs', async () => {
  const donor = await load('animations/festival-motion-bank.glb');
  const bank = new FestivalMotionBank(donor);
  const corrected = await load('characters/ambona/npc-animations.glb');
  const unchanged = await load('characters/ambona/npc-animations.glb');
  expect(corrected.scene.userData.armPoseCorrectionRadians).toBe(Math.PI / 6);
  delete unchanged.scene.userData.armPoseCorrectionRadians;
  bank.apply(corrected);
  bank.apply(unchanged);
  for (const name of ['Idle', 'Walk', 'Run']) {
    const a = corrected.animations.find((c) => c.name === name)!;
    const b = unchanged.animations.find((c) => c.name === name)!;
    for (const track of a.tracks) {
      expect(track.values.every(Number.isFinite)).toBe(true);
      const original = b.tracks.find((t) => t.name === track.name)!;
      if (/Head|Neck|Spine|Leg|Foot|Hips/.test(track.name)) expect(track.values).toEqual(original.values);
      if (/LeftArm\.quaternion$/.test(track.name)) expect(track.values).not.toEqual(original.values);
    }
  }
  for (const model of [donor, corrected, unchanged]) disposeObjectTree(model.scene);
});
