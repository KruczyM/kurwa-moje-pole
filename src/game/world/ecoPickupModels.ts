import * as THREE from 'three';
import { ecoPickupKind } from '../interactions/ecoChallenge';

export function ecoModelName(id: string): string {
  if (!id.startsWith('eco_')) return 'EcoCan';
  const index = Number(id.slice(4)),
    kind = ecoPickupKind(index);
  if (kind === 'speed') return 'EcoIceCream';
  if (kind === 'bundle') return 'EcoBurger';
  return index % 12 === 8 ? 'EcoBag' : ['EcoCan', 'EcoBottle', 'EcoPaper'][index % 3];
}

/** Shared geometry; private materials keep hover highlights isolated. No new loader. */
export function createEcoPickupModel(
  source: THREE.Object3D | undefined,
  id: string,
): THREE.Object3D | undefined {
  const template = source?.getObjectByName(ecoModelName(id));
  if (!template) return undefined;
  const instance = new THREE.Group();
  instance.name = `EcoPickup_${id}`;
  instance.userData.ecoModel = ecoModelName(id);
  const model = template.clone(true);
  model.position.set(0, 0, 0);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
  instance.add(model);
  // The model export is grounded. Deterministic facing variations cost no animation.
  const index = Number(id.match(/\d+/)?.[0] ?? 0);
  instance.rotation.y = index * 2.399963;
  return instance;
}
