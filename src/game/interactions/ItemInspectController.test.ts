import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ItemInspectController } from './ItemInspectController';

describe('ItemInspectController', () => {
  it('initializes with no active item', () => {
    const controller = new ItemInspectController({
      canvas: null,
      getPropModel: () => undefined,
    });
    expect(controller.activeItemId).toBeUndefined();
    expect(controller.isOpen).toBe(false);
  });

  it('sets active item on show and cleans up on close', () => {
    const dummyProp = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const controller = new ItemInspectController({
      canvas: null,
      getPropModel: (id) => (id === 'Piwo' ? dummyProp : undefined),
    });

    controller.show('Piwo');
    expect(controller.activeItemId).toBe('Piwo');
    expect(controller.isOpen).toBe(true);

    controller.close();
    expect(controller.activeItemId).toBeUndefined();
    expect(controller.isOpen).toBe(false);
  });

  it('safely handles update and resize without canvas/renderer', () => {
    const controller = new ItemInspectController({
      canvas: null,
      getPropModel: () => undefined,
    });

    controller.show('Joint');
    expect(() => controller.update(0.016)).not.toThrow();
    expect(() => controller.resize()).not.toThrow();
    expect(() => controller.dispose()).not.toThrow();
  });
});
