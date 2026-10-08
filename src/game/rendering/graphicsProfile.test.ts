import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  MOBILE_GRAPHICS,
  DESKTOP_GRAPHICS,
  selectGraphicsProfile,
  withinVisualRange,
} from './graphicsProfile';
import { CharacterVisibility } from './CharacterVisibility';
import { DistanceVisibility } from './DistanceVisibility';

describe('mobile visual policy', () => {
  it('keeps desktop unchanged and selects conservative mobile quality', () => {
    expect(selectGraphicsProfile({ coarse: true, touchPoints: 5, width: 390, height: 844 })).toBe(
      MOBILE_GRAPHICS.low,
    );
    expect(selectGraphicsProfile({ coarse: false, touchPoints: 5, width: 1440, height: 900 })).toBe(
      DESKTOP_GRAPHICS,
    );
    expect(selectGraphicsProfile({ coarse: false, touchPoints: 0, width: 1440, height: 900 })).toBe(
      DESKTOP_GRAPHICS,
    );
    expect(
      selectGraphicsProfile({ coarse: true, touchPoints: 5, width: 390, height: 844, deviceMemory: 4 }),
    ).toBe(MOBILE_GRAPHICS.low);
    expect(selectGraphicsProfile({ coarse: true, touchPoints: 5, width: 844, height: 390 }, 'high')).toBe(
      MOBILE_GRAPHICS.high,
    );
  });
  it('uses hysteresis without oscillating at the cutoff', () => {
    expect(withinVisualRange(105 ** 2, 100, true, 8)).toBe(true);
    expect(withinVisualRange(105 ** 2, 100, false, 8)).toBe(false);
    expect(withinVisualRange(109 ** 2, 100, true, 8)).toBe(false);
  });
  it('hides visuals, retains logical transforms, and resumes when nearby', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.castShadow = true;
    root.add(mesh);
    root.position.x = 200;
    const visibility = new CharacterVisibility();
    visibility.profile = MOBILE_GRAPHICS.normal;
    expect(visibility.update(root, new THREE.Vector3())).toBe(false);
    expect(root.visible).toBe(false);
    expect(root.position.x).toBe(200);
    expect(root.children).toHaveLength(1);
    expect(visibility.update(root, new THREE.Vector3(200, 0, 0))).toBe(true);
    expect(root.visible).toBe(true);
    expect(mesh.castShadow).toBe(true);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
  it('throttles static checks, restores TV pass, excludes dynamic interactions', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.position.x = 200;
    mesh.castShadow = true;
    root.add(mesh);
    const interaction = mesh.clone();
    interaction.userData.interaction = 'speaker';
    root.add(interaction);
    const visibility = new DistanceVisibility(root, MOBILE_GRAPHICS.normal);
    visibility.update(1, new THREE.Vector3());
    expect(mesh.visible).toBe(false);
    expect(interaction.visible).toBe(true);
    expect(() =>
      visibility.withFullVisibility(() => {
        expect(mesh.visible).toBe(true);
        throw new Error('render');
      }),
    ).toThrow();
    expect(mesh.visible).toBe(false);
    visibility.update(0.01, new THREE.Vector3(200, 0, 0));
    expect(mesh.visible).toBe(false);
    visibility.update(0.3, new THREE.Vector3(200, 0, 0));
    expect(mesh.visible).toBe(true);
    visibility.dispose();
    expect(mesh.castShadow).toBe(true);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
