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

  it.each([
    ['joint', new THREE.Vector3(2.2, 0.35, 0.35)],
    ['cocaine', new THREE.Vector3(0.55, 1.8, 0.2)],
    ['mdma', new THREE.Vector3(1.1, 0.45, 0.8)],
    ['mushrooms', new THREE.Vector3(1.6, 1.2, 1.4)],
    ['lsd', new THREE.Vector3(0.08, 1.5, 1.1)],
  ])('keeps the whole %s model inside both portrait and landscape previews', (_, size) => {
    const bounds = new THREE.Box3(size.clone().multiplyScalar(-0.5), size.clone().multiplyScalar(0.5));

    for (const aspect of [360 / 640, 1, 640 / 360]) {
      const distance = inspectCameraDistance(bounds, aspect, 35);
      const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
      const verticalHalfFov = THREE.MathUtils.degToRad(35) / 2;
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
      const requiredDistance = radius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));

      expect(distance).toBeGreaterThan(requiredDistance);
      expect(Number.isFinite(distance)).toBe(true);
    }
  });
});
