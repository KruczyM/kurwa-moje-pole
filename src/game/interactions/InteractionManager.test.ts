import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
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
});
