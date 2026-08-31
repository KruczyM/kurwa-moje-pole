import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NpcManager } from './NpcManager';

/** Buduje minimalny asset, którego rozmiar zmienia się dopiero po uruchomieniu Idle. */
function animatedScaleAsset(): GLTF {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = 'animated-mesh';
  scene.add(mesh);
  const idle = new THREE.AnimationClip('Idle', 1, [
    new THREE.VectorKeyframeTrack('animated-mesh.scale', [0, 1], [100, 100, 100, 100, 100, 100]),
  ]);
  return { scene, animations: [idle] } as GLTF;
}

describe('NpcManager', () => {
  it('fits a character after applying its initial animated pose', () => {
    const scene = new THREE.Scene();
    const models = new Map([['amper', animatedScaleAsset()]]);
    const manager = new NpcManager(scene, models, null, () => true);
    const visual = manager.npcs[0].root.children[0];
    const height = new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3()).y;

    expect(height).toBeCloseTo(2.45, 4);
    manager.dispose();
  });
});
