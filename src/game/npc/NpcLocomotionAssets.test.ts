import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { describe, expect, it } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { NpcAnimator } from './NpcAnimator';
import { LOCOMOTION_CYCLE_METERS } from './locomotionCalibration';
import { NpcManager } from './NpcManager';
import { NpcNavigationGrid } from './NpcNavigationGrid';

describe('actual NPC locomotion loop continuity', () => {
  it.each(catalog.characters)('$id does not snap backwards when Walk or Run loops', async ({ id }) => {
    const bytes = readFileSync(
      new URL(`../../../public/game-assets/characters/${id}/npc-animations.glb`, import.meta.url),
    );
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-images', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const manager = new NpcManager(
      new THREE.Scene(),
      new Map([[id, gltf]]),
      null,
      new NpcNavigationGrid({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, 1, () => true),
    );
    const fitted = manager.npcs[catalog.characters.findIndex((asset) => asset.id === id)].root.children[0];
    fitted.updateMatrixWorld(true);
    fitted.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox();
    });
    expect(new THREE.Box3().setFromObject(fitted).getSize(new THREE.Vector3()).y).toBeCloseTo(2.45, 3);
    manager.dispose();
    for (const name of ['Walk', 'Run'] as const) {
      const visual = clone(gltf.scene);
      const sourceValues = gltf.animations.map((clip) => clip.tracks.map((track) => [...track.values]));
      const animator = new NpcAnimator(visual, gltf.animations, {
        fadeSeconds: 0,
        minimumStateSeconds: { Idle: 0, Walk: 0, Run: 0 },
      });
      animator.update(0);
      visual.updateMatrixWorld(true);
      const height = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3()).y;
      const clip = gltf.animations.find((animation) => animation.name === name)!;
      const hips = visual.getObjectsByProperty('isBone', true).find((bone) => /hips/i.test(bone.name))!;
      expect(hips).toBeDefined();
      animator.setMovementSpeed(LOCOMOTION_CYCLE_METERS[name] / clip.duration);
      animator.play(name);
      const before = new THREE.Vector3();
      const after = new THREE.Vector3();
      animator.update(clip.duration - 1 / 240);
      hips.getWorldPosition(before);
      animator.update(2 / 240);
      hips.getWorldPosition(after);
      const jumpMeters = (Math.hypot(after.x - before.x, after.z - before.z) * 2.45) / height;
      // Check the rest of several cycles too, not only one seam.
      let largestStep = jumpMeters;
      for (let frame = 0; frame < Math.ceil(clip.duration * 120 * 3); frame += 1) {
        before.copy(after);
        animator.update(1 / 120);
        hips.getWorldPosition(after);
        largestStep = Math.max(
          largestStep,
          (Math.hypot(after.x - before.x, after.z - before.z) * 2.45) / height,
        );
      }
      animator.dispose();
      expect(jumpMeters, `${id}/${name} horizontal loop jump`).toBeLessThan(0.08);
      expect(largestStep, `${id}/${name} continuous horizontal motion`).toBeLessThan(0.08);
      expect(gltf.animations.map((clip) => clip.tracks.map((track) => [...track.values]))).toEqual(
        sourceValues,
      );
    }
  });
});
