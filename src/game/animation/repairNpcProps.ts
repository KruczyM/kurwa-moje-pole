import * as THREE from 'three';
import catalog from '../assets/assetCatalog.json';

export const rigidPropAssets = catalog.festivalNpcs.filter((asset) => /^(034|042)_/.test(asset.id));

/** Authored masks in the neutral 2.45 m source coordinates. These props are
 * on the character's Right side; their upper parts must not follow Head.
 * Do not extend to guitars/other poses without reviewing their geometry. */
export function repairNpcProps(root: THREE.Object3D, id: string) {
  const number = Number(id.split('_')[0]);
  if (number !== 34 && number !== 42) return 0;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const scale = 2.45 / (box.max.y - box.min.y);
  let changed = 0;
  root.traverse((mesh) => {
    if (!(mesh instanceof THREE.SkinnedMesh)) return;
    const hand = mesh.skeleton.bones.findIndex((bone) => /RightHand$/.test(bone.name));
    const head = mesh.skeleton.bones.findIndex((bone) => /(?:^|mixamorig[:_]?)Head$/.test(bone.name));
    if (hand < 0) throw new Error(`Missing prop attachment joint: ${id}`);
    const positions = mesh.geometry.getAttribute('position'),
      joints = mesh.geometry.getAttribute('skinIndex'),
      weights = mesh.geometry.getAttribute('skinWeight');
    const p = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const x = p.x * scale,
        y = (p.y - box.min.y) * scale;
      const upper = x < (number === 34 ? -0.45 : -0.6) && y > 1.66;
      const handle = x < -0.88 && y > 1.22;
      // 042's short curls sit above the collar but inherited arm weights.
      // Keep this measured mask local: long hair needs a different profile.
      const shortHair = number === 42 && y > 1.7 && Math.abs(x) < 0.6;
      if (!upper && !handle && !shortHair) continue;
      const joint = upper || handle ? hand : head;
      if (joint < 0) throw new Error(`Missing attachment joint: ${id}`);
      for (let c = 0; c < 4; c++) {
        joints.setComponent(i, c, c === 0 ? joint : 0);
        weights.setComponent(i, c, c === 0 ? 1 : 0);
      }
      changed++;
    }
    joints.needsUpdate = true;
    weights.needsUpdate = true;
  });
  return changed;
}
