import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFlankiActor } from './FlankiActors';
import { FlankiGame } from './FlankiGame';
import { flankiPitchGrassCoverage } from './FlankiPhysics';

describe('Flanki real actors and pitch', () => {
  const model = () =>
    ({
      scene: new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()),
      ),
      animations: [],
    }) as unknown as GLTF;
  it('uses the cached model at player height and never substitutes primitive NPCs when it is missing', () => {
    const source = model();
    const actor = createFlankiActor('kobra', new Map([['kobra', source]]));
    expect(actor.root.children[0]).not.toBe(source.scene);
    const box = new THREE.Box3().setFromObject(actor.root);
    expect(box.max.y - box.min.y).toBeCloseTo(2.45);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.x - box.min.x).toBeCloseTo((2.45 / 2) * 0.86);
    expect(source.scene.scale.x).toBe(1);
    const mesh = actor.root.getObjectByProperty('isMesh', true) as THREE.Mesh;
    expect(mesh.geometry).toBe((source.scene.children[0] as THREE.Mesh).geometry);
    expect(createFlankiActor('missing', new Map()).root.children).toHaveLength(0);
    actor.animator?.dispose();
  });
  it('does not dispose shared character/can geometry and materials when a match world is removed', () => {
    const source = model();
    const mesh = source.scene.children[0] as THREE.Mesh;
    const disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    const characters = new Map(['kobra', 'dziaslo', 'antena', 'pien', 'chlebak'].map((id) => [id, source]));
    const game = new FlankiGame({ characterModels: characters, beerCanModel: source });
    game.dispose();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();
    expect(source.scene.children).toHaveLength(1);
  });
  it('removes tall grass over the entire pitch without clearing surrounding camps', () => {
    expect(flankiPitchGrassCoverage(0, -26)).toBe(0);
    expect(flankiPitchGrassCoverage(3.4, -32)).toBe(0);
    expect(flankiPitchGrassCoverage(3.4, -20)).toBe(0);
    expect(flankiPitchGrassCoverage(4, -26)).toBe(1);
    expect(flankiPitchGrassCoverage(0, 0)).toBe(1);
  });

  it('anchors feet when a clip overwrites the fitted scene translation', () => {
    const source = model();
    source.scene.name = 'Rig';
    source.scene.children[0].position.y = 1;
    const foot = new THREE.Bone();
    foot.name = 'mixamorigLeftFoot';
    foot.position.y = 0.2;
    source.scene.add(foot);
    source.animations = [
      new THREE.AnimationClip('Idle', 1, [
        new THREE.VectorKeyframeTrack('Rig.position', [0, 1], [0, 0, 0, 0, 1, 0]),
      ]),
    ];
    const actor = createFlankiActor('kobra', new Map([['kobra', source]]));
    actor.animator?.update(0.5);
    expect(new THREE.Box3().setFromObject(actor.root, true).min.y).toBeGreaterThan(0.3);
    actor.groundFeet();
    expect(new THREE.Box3().setFromObject(actor.root, true).min.y).toBeCloseTo(0);
    actor.animator?.dispose();
  });
});
