import * as THREE from 'three';
import { expect, it } from 'vitest';
import { SpeakerIndicator } from './SpeakerIndicator';
import { disposeObjectTree } from '../lifecycle/disposeThree';

it('starts as a small green minus and changes to plus only when on', () => {
  const marker = new SpeakerIndicator();
  expect(marker.userData.symbol).toBe('-');
  expect(marker.children[1].visible).toBe(false);
  marker.update(true, new THREE.Vector3(2, 1.9, 3));
  expect(marker.userData.symbol).toBe('+');
  expect(marker.children[1].visible).toBe(true);
  const mesh = marker.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  expect(mesh.geometry.parameters.width).toBe(0.2);
  expect(mesh.material.color.getHex()).toBe(0x65ff18);
  marker.update(false);
  expect(marker.children[1].visible).toBe(false);
  disposeObjectTree(marker);
});
