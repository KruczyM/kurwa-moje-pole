import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { enableInteractionLayer, INTERACTION_LAYER, InteractionManager } from './InteractionManager';

/** Buduje niewidoczny cel ustawiony przed kamerą, tak jak hitbox postaci w grze. */
function target(kind: 'npc' | 'item', z: number, itemId = 'joint') {
  const root = new THREE.Group();
  root.position.z = z;
  root.userData.interaction = kind === 'npc' ? { kind, name: 'Amper' } : { kind, itemId };
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  );
  root.add(hitbox);
  enableInteractionLayer(root);
  return root;
}

describe('InteractionManager', () => {
  it('allows entry inside an explicit attraction zone without aiming at its surface', () => {
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    camera.position.y = 1.9;
    const entry = new THREE.Object3D();
    entry.userData.interaction = { kind: 'flanki' };
    entry.userData.entryRadius = 3.5;
    entry.position.set(2, 1, 0);
    entry.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const manager = new InteractionManager(camera, () => [entry]);
    expect(manager.update()).toEqual({ kind: 'flanki' });
    camera.position.x = 10;
    camera.updateMatrixWorld(true);
    expect(manager.update()).toBeNull();
    manager.dispose();
  });
  it('uses a dedicated interaction layer without disabling the render layer', () => {
    const item = target('item', -2);

    expect(item.layers.isEnabled(0)).toBe(true);
    expect(item.layers.isEnabled(INTERACTION_LAYER)).toBe(true);
    expect(item.children[0].layers.isEnabled(INTERACTION_LAYER)).toBe(true);
  });

  it('detects an NPC through its transparent hitbox at conversational distance', () => {
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const npc = target('npc', -4.4);
    npc.updateMatrixWorld(true);
    const interactions = new InteractionManager(camera, () => [npc]);

    expect(interactions.update()).toEqual({ kind: 'npc', name: 'Amper' });
    interactions.dispose();
  });

  it('does not extend the longer NPC range to ordinary items', () => {
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const item = target('item', -4.4);
    item.updateMatrixWorld(true);
    const interactions = new InteractionManager(camera, () => [item]);

    expect(interactions.update()).toBeNull();
    interactions.dispose();
  });

  it('selects the nearest visible item instead of an item hidden behind it', () => {
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const front = target('item', -1.8, 'joint');
    const rear = target('item', -2.6, 'lsd');
    front.updateMatrixWorld(true);
    rear.updateMatrixWorld(true);
    const interactions = new InteractionManager(camera, () => [rear, front]);

    expect(interactions.update()).toEqual({ kind: 'item', itemId: 'joint' });
    front.visible = false;
    expect(interactions.update()).toEqual({ kind: 'item', itemId: 'lsd' });
    interactions.dispose();
  });

  it('detects an item from a raised camera and an oblique viewing angle', () => {
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    camera.position.set(1, 1.6, 1);
    camera.lookAt(0, 0.4, -1);
    camera.updateMatrixWorld(true);
    const item = target('item', -1, 'mushrooms');
    item.updateMatrixWorld(true);
    const interactions = new InteractionManager(camera, () => [item]);

    expect(interactions.update()).toEqual({ kind: 'item', itemId: 'mushrooms' });
    interactions.dispose();
  });

  it('allows a directional interaction only from its front side', () => {
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const entrance = target('item', -2);
    entrance.userData.interactionFacing = [0, 0, 1];
    entrance.updateMatrixWorld(true);
    const interactions = new InteractionManager(camera, () => [entrance]);

    expect(interactions.update()).toEqual({ kind: 'item', itemId: 'joint' });
    interactions.clear();
    camera.position.z = -4;
    camera.rotation.y = Math.PI;
    camera.updateMatrixWorld(true);
    expect(interactions.update()).toBeNull();

    interactions.clear();
    camera.position.set(2, 0, -2);
    camera.rotation.y = Math.PI / 2;
    camera.updateMatrixWorld(true);
    expect(interactions.update()).toBeNull();
    interactions.dispose();
  });

  it('reuses static Vector2, Vector3, and Quaternion instances during update', () => {
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    const entrance = target('item', -2);
    entrance.userData.interactionFacing = [0, 0, 1];
    entrance.updateMatrixWorld(true);
    const interactions = new InteractionManager(camera, () => [entrance]);

    const imAny = InteractionManager as unknown as {
      _screenCenter: THREE.Vector2;
      _faceNormal: THREE.Vector3;
      _faceQuat: THREE.Quaternion;
      _faceTarget: THREE.Vector3;
      _faceCam: THREE.Vector3;
    };

    expect(imAny._screenCenter).toBeInstanceOf(THREE.Vector2);
    expect(imAny._faceNormal).toBeInstanceOf(THREE.Vector3);
    expect(imAny._faceQuat).toBeInstanceOf(THREE.Quaternion);
    expect(imAny._faceTarget).toBeInstanceOf(THREE.Vector3);
    expect(imAny._faceCam).toBeInstanceOf(THREE.Vector3);

    const raycaster = (interactions as unknown as { raycaster: THREE.Raycaster }).raycaster;
    const raycasterSpy = vi.spyOn(raycaster, 'setFromCamera');
    const posSpy = vi.spyOn(entrance, 'getWorldPosition');
    const quatSpy = vi.spyOn(entrance, 'getWorldQuaternion');
    const camPosSpy = vi.spyOn(camera, 'getWorldPosition');

    interactions.update();

    expect(raycasterSpy).toHaveBeenCalledWith(imAny._screenCenter, camera);
    expect(posSpy).toHaveBeenCalledWith(imAny._faceTarget);
    expect(quatSpy).toHaveBeenCalledWith(imAny._faceQuat);
    expect(camPosSpy).toHaveBeenCalledWith(imAny._faceCam);

    interactions.dispose();
  });
});
