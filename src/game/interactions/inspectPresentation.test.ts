import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { centerInspectModel, inspectCameraDistance } from './inspectPresentation';

describe('centerInspectModel', () => {
  it('rotates a model with an off-centre origin around its geometric centre', () => {
    const model = new THREE.Group();
    const geometry = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.2));
    geometry.position.set(4, 1, -2);
    model.add(geometry);

    const { pivot } = centerInspectModel(model, 0.1);
    pivot.rotation.y = Math.PI / 2;
    pivot.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(pivot).getCenter(new THREE.Vector3());

    expect(center.x).toBeCloseTo(0, 6);
    expect(center.y).toBeCloseTo(0.1, 6);
    expect(center.z).toBeCloseTo(0, 6);
  });

  it('moves the camera farther away for a narrow preview without clipping the model', () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-1, -0.5, -0.25), new THREE.Vector3(1, 0.5, 0.25));
    const wide = inspectCameraDistance(bounds, 16 / 9, 35);
    const narrow = inspectCameraDistance(bounds, 9 / 16, 35);

    expect(narrow).toBeGreaterThan(wide);
    expect(wide).toBeGreaterThan(0);
  });
});
