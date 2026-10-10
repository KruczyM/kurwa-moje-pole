import * as THREE from 'three';
import { withinVisualRange, type GraphicsProfile } from './graphicsProfile';

type Entry = {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  radius: number;
  category: 'tents' | 'decorations' | 'vegetation' | 'interactive' | 'landmarks';
  originalShadow: boolean;
  visible: boolean;
};

/** Cached bounds for authored static batches; no per-frame scene traversal or state deletion. */
export class DistanceVisibility {
  private entries: Entry[] = [];
  private elapsed = Infinity;
  constructor(
    root: THREE.Object3D,
    private profile: GraphicsProfile,
  ) {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        object.userData.fogProxy ||
        !object.visible ||
        object instanceof THREE.SkinnedMesh
      )
        return;
      let node: THREE.Object3D | null = object;
      let category: Entry['category'] = 'decorations';
      while (node) {
        if (
          node.userData.authoredDynamic ||
          node.userData.interaction ||
          /^InteractionHitbox/.test(node.name)
        )
          return;
        const kind = String(node.userData.runtimeCategory ?? '');
        const name = String(node.userData.runtimePlacement ?? node.name);
        if (kind === 'Camping') category = 'tents';
        if (kind === 'Passage') category = 'interactive';
        if (/Sunflower|Tree|Bush/.test(name)) category = 'vegetation';
        if (kind === 'Stages' || kind === 'Roads' || /Stage|Tower|Road|Flag|Lidl/.test(name))
          category = 'landmarks';
        node = node.parent;
      }
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      // A mixed batch/large roof must never vanish by its centre before its nearest edge.
      if (sphere.radius > 8 && category === 'decorations') category = 'tents';
      if (/Stage|Tower|Road|Flag|Lidl/.test(object.name)) category = 'landmarks';
      this.entries.push({
        mesh: object,
        center: sphere.center,
        radius: sphere.radius,
        category,
        originalShadow: object.castShadow,
        visible: true,
      });
    });
  }
  setProfile(profile: GraphicsProfile): void {
    this.profile = profile;
    this.elapsed = Infinity;
  }
  update(dt: number, viewer: THREE.Vector3): void {
    this.elapsed += dt;
    if (this.elapsed < this.profile.staticCheckSeconds) return;
    this.elapsed = 0;
    for (const entry of this.entries) {
      const squared = viewer.distanceToSquared(entry.center);
      entry.visible = withinVisualRange(
        squared,
        this.profile[entry.category] + entry.radius,
        entry.visible,
        this.profile.hysteresis,
      );
      entry.mesh.visible = entry.visible;
      entry.mesh.castShadow =
        entry.originalShadow && entry.visible && squared <= (this.profile.shadows + entry.radius) ** 2;
    }
  }
  /** Live-TV pass can temporarily see distant scenery, restoring local culling afterwards. */
  withFullVisibility(render: () => void): void {
    if (!this.profile.mobile) {
      render();
      return;
    }
    for (const entry of this.entries) entry.mesh.visible = true;
    try {
      render();
    } finally {
      for (const entry of this.entries) entry.mesh.visible = entry.visible;
    }
  }
  dispose(): void {
    for (const entry of this.entries) {
      entry.mesh.visible = true;
      entry.mesh.castShadow = entry.originalShadow;
    }
    this.entries.length = 0;
  }
}
