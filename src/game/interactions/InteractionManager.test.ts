import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { InteractionManager } from './InteractionManager';

/** Buduje niewidoczny cel ustawiony przed kamerą, tak jak hitbox postaci w grze. */
function target(kind: 'npc' | 'item', z: number) {
  const root = new THREE.Group();
  root.position.z = z;
  root.userData.interaction = kind === 'npc' ? { kind, name: 'Amper' } : { kind, itemId: 'joint' };
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 0.8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  );
  root.add(hitbox);
  return root;
}

describe('InteractionManager', () => {
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
