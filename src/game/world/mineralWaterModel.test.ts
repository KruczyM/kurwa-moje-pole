import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import catalog from '../assets/assetCatalog.json';
import { itemPresentation } from '../interactions/itemPresentationConfig';
import { interactivePbrProfile } from '../rendering/pbrMaterials';

it('registers a real, labelled, lightweight water bottle with upright table presentation', async () => {
  const bytes = readFileSync(
    new URL(`../../../public/game-assets/${catalog.interactives.water}`, import.meta.url),
  );
  expect(bytes.byteLength).toBeLessThan(150000);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  expect(gltf.scene.getObjectByName('MineralWaterBottle')).toBeDefined();
  expect(gltf.scene.getObjectByName('Woda_label')).toBeDefined();
  const box = new THREE.Box3().setFromObject(gltf.scene),
    size = box.getSize(new THREE.Vector3());
  expect(box.min.y).toBeCloseTo(0, 5);
  expect(size.y).toBeGreaterThan(0.5);
  expect(itemPresentation.water.tableRotation[0]).toBe(0);
  expect(interactivePbrProfile('water')).toBe('plastic');
});
