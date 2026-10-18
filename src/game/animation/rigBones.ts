import * as THREE from 'three';

/** GLTFLoader sanitizes ':' in node names, but preserves the source name in userData. */
export function findRigBone(root: THREE.Object3D, name: string) {
  const sanitized = THREE.PropertyBinding.sanitizeNodeName(name);
  let match: THREE.Object3D | undefined;
  root.traverse((object) => {
    if (!match && (object.name === name || object.name === sanitized || object.userData.name === name)) {
      match = object;
    }
  });
  return match;
}
