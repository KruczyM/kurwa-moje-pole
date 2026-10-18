import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import catalog from '../assets/assetCatalog.json';
import { findRigBone } from '../animation/rigBones';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import { canAnimateUseSequence, ItemUseSequence } from './ItemUseSequence';
import { itemUseSequenceConfig } from './itemUseSequenceConfig';
import { attachUseProp } from './itemUseProp';
import { createProceduralUseClip } from './itemUseMotion';

/** Real GLTFLoader, meshes, skin and clips; only browser image decoding is stubbed in Node. */
async function loadAsset(path: string) {
  const file = readFileSync(new URL(`../../../public/game-assets/${path}`, import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test-textures', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
}

describe('item use on the shipped character rigs', () => {
  const props = new Map<string, THREE.Object3D>();
  beforeAll(async () => {
    for (const id of ['cigarette', 'joint', 'cocaine', 'mushrooms', 'mdma', 'lsd']) {
      props.set(id, (await loadAsset(`interactables/${id}.glb`)).scene);
    }
  });
  afterAll(() => props.forEach(disposeObjectTree));
  it.each(catalog.characters)(
    '$id keeps its skinned character and visible hand prop for each gesture',
    async ({ id }) => {
      const character = await loadAsset(`characters/${id}/npc-animations.glb`);
      expect(canAnimateUseSequence(character)).toBe(true);
      const originalHand = findRigBone(character.scene, 'mixamorig:RightHand')!;
      // This is what the old name-only fixture failed to exercise.
      expect(originalHand.name).toBe('mixamorigRightHand');
      const originalQuaternion = originalHand.quaternion.clone();
      for (const effect of ['Papieros', 'Joint', 'Kreska', 'Grzyb', 'Piwo', 'MDMA', 'LSD'] as const) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
        camera.position.set(0, 1.9, 0);
        const sequence = new ItemUseSequence(scene, camera, character, props, () => true);
        sequence.start(effect, 0);
        const root = scene.getObjectByName('PlayerUseSequence')!;
        const hand = findRigBone(root, 'mixamorig:RightHand')!;
        const head = findRigBone(root, 'mixamorig:Head')!;
        const prop = root.getObjectByName('UseProp')!;
        expect(prop.parent).toBe(hand);
        const startHand = hand.getWorldPosition(new THREE.Vector3());
        const startHead = head.getWorldPosition(new THREE.Vector3());
        let propMesh: THREE.Mesh | undefined;
        prop.traverse((object) => {
          if ((object as THREE.Mesh).isMesh) propMesh = object as THREE.Mesh;
        });
        const geometryDispose = vi.spyOn(propMesh!.geometry, 'dispose');
        const marker = itemUseSequenceConfig[effect].effectMarker;
        expect(sequence.update(marker).activateEffect).toBe(true);
        root.updateMatrixWorld(true);
        let skinnedMeshes = 0;
        root.traverse((object) => {
          if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes++;
          expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        });
        expect(skinnedMeshes).toBeGreaterThan(0);
        expect(prop.visible).toBe(true);
        const size = new THREE.Box3().setFromObject(prop).getSize(new THREE.Vector3());
        const worldSize = Math.max(size.x, size.y, size.z);
        expect(worldSize).toBeGreaterThan(itemUseSequenceConfig[effect].propSize * 0.6);
        expect(worldSize).toBeLessThan(itemUseSequenceConfig[effect].propSize * 1.8);
        const raisedHand = hand.getWorldPosition(new THREE.Vector3());
        const raisedHead = head.getWorldPosition(new THREE.Vector3());
        expect(raisedHand.distanceTo(startHand)).toBeGreaterThan(0.07);
        expect(raisedHand.distanceTo(raisedHead)).toBeLessThan(startHand.distanceTo(startHead));
        expect(prop.getWorldPosition(new THREE.Vector3()).distanceTo(raisedHand)).toBeLessThan(0.4);
        expect(sequence.update(0).activateEffect).toBe(false);
        expect(sequence.update(-1).activateEffect).toBe(false);
        expect(sequence.update(Number.NaN).activateEffect).toBe(false);
        sequence.update(0.2);
        expect(prop.visible).toBe(!itemUseSequenceConfig[effect].consumeProp);
        sequence.cancel();
        expect(geometryDispose).toHaveBeenCalledTimes(1);
        expect(root.parent).toBeNull();
        expect(originalHand.quaternion.toArray()).toEqual(originalQuaternion.toArray());
        expect(originalHand.getObjectByName('UseProp')).toBeUndefined();
      }
      disposeObjectTree(character.scene);
    },
    20000,
  );

  it('centers rotated, offset GLB props at the grip and leaves cached resources intact', () => {
    const character = new THREE.Group();
    character.scale.setScalar(200);
    const armature = new THREE.Group();
    armature.scale.setScalar(0.01);
    const hand = new THREE.Bone();
    hand.name = 'mixamorigRightHand';
    character.add(armature);
    armature.add(hand);
    const source = new THREE.Group();
    source.position.set(4, -3, 2);
    source.rotation.x = 0.3;
    source.scale.setScalar(2);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.2), new THREE.MeshStandardMaterial());
    mesh.position.set(2, 5, -1);
    source.add(mesh);
    const disposed = vi.spyOn(mesh.geometry, 'dispose');
    const initial = source.toJSON();
    const prop = attachUseProp(character, source, 'Joint')!;
    const center = new THREE.Box3().setFromObject(prop).getCenter(new THREE.Vector3());
    expect(center.distanceTo(prop.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6);
    const size = new THREE.Box3().setFromObject(prop).getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(itemUseSequenceConfig.Joint.propSize, 5);
    disposeObjectTree(character);
    expect(disposed).not.toHaveBeenCalled();
    expect(source.toJSON()).toEqual(initial);
    disposeObjectTree(source);
  });

  it('starts/ends without pose snaps and is independent of delta-time partitioning', async () => {
    const character = await loadAsset('characters/amper/npc-animations.glb');
    const scenes = [new THREE.Scene(), new THREE.Scene()];
    const sequences = scenes.map((scene) => {
      const camera = new THREE.PerspectiveCamera();
      camera.position.y = 1.9;
      const sequence = new ItemUseSequence(scene, camera, character, props, () => true);
      sequence.start('Papieros', 0.75);
      return sequence;
    });
    const visual = scenes[0].getObjectByName('PlayerUseSequence')!.children[0];
    // Removing the prop here keeps this direct clip check focused on the rig's own bounds.
    const prop = visual.getObjectByName('UseProp')!;
    prop.removeFromParent();
    const clip = createProceduralUseClip(visual, 'Papieros')!;
    for (const track of clip.tracks) {
      expect(Array.from(track.values.slice(0, 4))).toEqual([0, 0, 0, 1]);
      expect(Array.from(track.values.slice(-4))).toEqual([0, 0, 0, 1]);
      for (let offset = 4; offset < track.values.length; offset += 4) {
        const previous = new THREE.Quaternion().fromArray(track.values, offset - 4).normalize();
        const current = new THREE.Quaternion().fromArray(track.values, offset).normalize();
        expect(previous.angleTo(current)).toBeLessThan(0.22);
      }
    }
    sequences[0].update(1.8);
    for (let i = 0; i < 60; i++) sequences[1].update(0.03);
    for (const name of [
      'mixamorig:RightArm',
      'mixamorig:RightForeArm',
      'mixamorig:RightHand',
      'mixamorig:Head',
    ]) {
      const a = findRigBone(scenes[0], name)!;
      const b = findRigBone(scenes[1], name)!;
      expect(
        a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3())),
      ).toBeLessThan(1e-6);
    }
    sequences.forEach((sequence) => sequence.dispose());
    disposeObjectTree(prop);
    disposeObjectTree(character.scene);
  });
});
