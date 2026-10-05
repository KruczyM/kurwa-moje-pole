import { expect, it } from 'vitest';
import * as THREE from 'three';
import { keepFlankiSkinsVisible } from './FlankiSkinVisibility';

it('keeps running skins visible without disabling culling for unrelated objects, and restores on release', () => {
  const root = new THREE.Group();
  const skin = new THREE.SkinnedMesh();
  const alreadyUnculled = new THREE.SkinnedMesh();
  alreadyUnculled.frustumCulled = false;
  const prop = new THREE.Mesh();
  root.add(skin, alreadyUnculled, prop);
  const restore = keepFlankiSkinsVisible(root);
  expect(skin.frustumCulled).toBe(false);
  expect(prop.frustumCulled).toBe(true);
  restore();
  restore();
  expect(skin.frustumCulled).toBe(true);
  expect(alreadyUnculled.frustumCulled).toBe(false);
});
