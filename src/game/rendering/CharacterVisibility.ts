import * as THREE from 'three';
import { DESKTOP_GRAPHICS, withinVisualRange, type GraphicsProfile } from './graphicsProfile';

/** Visual state only: never removes actors, snapshots, targets or simulation updates. */
export class CharacterVisibility {
  profile: GraphicsProfile = DESKTOP_GRAPHICS;
  private meshes = new WeakMap<THREE.Object3D, { mesh: THREE.Mesh; shadow: boolean }[]>();
  update(root: THREE.Object3D, viewer: THREE.Vector3): boolean {
    if (!this.profile.mobile) return true;
    const squared = root.position.distanceToSquared(viewer);
    root.visible = withinVisualRange(squared, this.profile.characters, root.visible, this.profile.hysteresis);
    let entries = this.meshes.get(root);
    if (!entries) {
      entries = [];
      root.traverse((node) => {
        if (node instanceof THREE.Mesh) entries!.push({ mesh: node, shadow: node.castShadow });
      });
      this.meshes.set(root, entries);
    }
    const shadow = root.visible && squared <= this.profile.shadows ** 2;
    for (const entry of entries) entry.mesh.castShadow = shadow && entry.shadow;
    return root.visible && squared <= this.profile.animation ** 2;
  }
}
