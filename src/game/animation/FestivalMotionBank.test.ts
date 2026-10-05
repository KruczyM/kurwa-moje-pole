import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { FestivalMotionBank } from './FestivalMotionBank';
import manifest from './festivalMotionManifest.json';
import catalog from '../assets/assetCatalog.json';
import { disposeObjectTree } from '../lifecycle/disposeThree';

async function load(path: string) {
  const bytes = readFileSync(new URL(`../../../public/game-assets/${path}`, import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

describe('downloaded festival motions', () => {
  it('ignores invalid pose metadata and accepts an explicit lowered-arm correction', async () => {
    const source = await load('animations/festival-motion-bank.glb');
    const bank = new FestivalMotionBank(source);
    const bind = async (value: unknown) => {
      const model = await load('characters/amper/npc-animations.glb');
      model.scene.userData.armPoseCorrectionRadians = value;
      bank.apply(model);
      const values = model.animations
        .find((clip) => clip.name === 'Idle')!
        .tracks.find((track) => /LeftArm\.quaternion$/.test(track.name))!
        .values.slice();
      disposeObjectTree(model.scene);
      return values;
    };
    const baseline = await bind(undefined);
    for (const invalid of [NaN, Infinity, -1, Math.PI, '1']) expect(await bind(invalid)).toEqual(baseline);
    const corrected = await bind(THREE.MathUtils.degToRad(66));
    expect(corrected.every(Number.isFinite)).toBe(true);
    expect(corrected).not.toEqual(baseline);
    disposeObjectTree(source.scene);
  }, 30000);
  it('accounts for all downloads and retargets every rig without invalid tracks or exploding poses', async () => {
    expect(manifest.files).toHaveLength(75);
    expect(manifest.clips).toHaveLength(72);
    const source = await load('animations/festival-motion-bank.glb');
    expect(source.animations.map((clip) => clip.name).sort()).toEqual(manifest.clips);
    const bank = new FestivalMotionBank(source);
    const assets = [
      ...[...catalog.characters, ...catalog.stagedCharacters].map((asset) => ({
        ...asset,
        path: `characters/${asset.id}/npc-animations.glb`,
      })),
      ...catalog.festivalNpcs,
    ];
    for (const asset of assets) {
      const model = await load(asset.path);
      bank.apply(model);
      const clips = model.animations;
      bank.apply(model);
      expect(model.animations).toBe(clips);
      expect(clips.map((clip) => clip.name)).toEqual(
        expect.arrayContaining([
          'Idle',
          'Walk',
          'Run',
          'LieDown',
          'LayingIdle',
          'SittingIdle',
          'Waving',
          'LeftStrafe',
          'WalkingVariant',
        ]),
      );
      for (const clip of clips)
        for (const track of clip.tracks) {
          expect(track.values.every(Number.isFinite), `${asset.id}/${clip.name}`).toBe(true);
          expect(track.validate(), `${asset.id}/${clip.name}/${track.name}`).toBe(true);
        }
      const mixer = new THREE.AnimationMixer(model.scene);
      for (const name of [
        'Idle',
        'Walk',
        'Run',
        'Waving',
        'LayingIdle',
        'StandUpFromLaying',
        'LieDown',
        'SittingIdle',
      ]) {
        const clip = clips.find((candidate) => candidate.name === name)!;
        mixer.clipAction(clip).play();
        mixer.update(clip.duration / 2);
        model.scene.updateMatrixWorld(true);
        model.scene.traverse((object) => {
          if (!(object instanceof THREE.SkinnedMesh)) return;
          object.skeleton.update();
          const count = object.geometry.getAttribute('position').count;
          for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 30))) {
            const p = object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld);
            expect(p.toArray().every(Number.isFinite), `${asset.id}/${name}`).toBe(true);
            expect(p.length(), `${asset.id}/${name}: exploding skin`).toBeLessThan(10);
          }
        });
        mixer.stopAllAction();
      }
      mixer.uncacheRoot(model.scene);
      disposeObjectTree(model.scene);
    }
    disposeObjectTree(source.scene);
  }, 180000);
});
