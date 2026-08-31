import * as THREE from 'three';

export type CenteredInspectModel = {
  pivot: THREE.Group;
  dimensions: THREE.Vector3;
};

/**
 * Umieszcza geometryczny środek modelu na osi osobnego pivota. Dzięki temu
 * modele z originem na krawędzi, takie jak LSD, obracają się wokół środka.
 */
export function centerInspectModel(model: THREE.Object3D, offsetY: number): CenteredInspectModel {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const dimensions = box.getSize(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y += -center.y + offsetY;
  model.position.z -= center.z;

  const pivot = new THREE.Group();
  pivot.name = 'InspectRotationPivot';
  pivot.add(model);
  return { pivot, dimensions };
}
