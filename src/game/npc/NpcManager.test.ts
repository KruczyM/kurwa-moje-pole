import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NpcManager } from './NpcManager';
import { INTERACTION_LAYER } from '../interactions/InteractionManager';

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

  it('adds a stable interaction hitbox independent of the animated mesh pose', () => {
    const scene = new THREE.Scene();
    const models = new Map([['amper', animatedScaleAsset()]]);
    const manager = new NpcManager(scene, models, null, () => true);
    const npc = manager.npcs[0];
    const hitbox = npc.root.getObjectByName('NpcInteractionHitbox') as THREE.Mesh;

    expect(hitbox).toBeInstanceOf(THREE.Mesh);
    expect(hitbox.userData.interactionRoot).toBe(npc.root);
    expect((hitbox.material as THREE.MeshBasicMaterial).opacity).toBe(0);
    expect(hitbox.layers.isEnabled(INTERACTION_LAYER)).toBe(true);
    manager.dispose();
  });

  it('accelerates a walking NPC instead of applying its full speed in one frame', () => {
    const manager = new NpcManager(new THREE.Scene(), new Map(), null, () => true);
    const npc = manager.npcs.find((candidate) => !candidate.stationary)!;
    manager.npcs.forEach((candidate, index) => candidate.root.position.set(100 + index * 3, 0, 100));
    npc.root.position.set(0, 0, 0);
    npc.target.set(10, 0, 0);
    npc.wait = 0;

    manager.update(0.1, 0);
    expect(npc.speed).toBeCloseTo(0.18, 5);
    expect(npc.root.position.x).toBeCloseTo(0.018, 5);

    manager.update(0.1, 0.1);
    expect(npc.speed).toBeCloseTo(0.36, 5);
    expect(npc.root.position.x).toBeCloseTo(0.054, 5);
    manager.dispose();
  });
});
