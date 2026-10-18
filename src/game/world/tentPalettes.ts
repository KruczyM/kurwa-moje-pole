import * as THREE from 'three';
import { CAMP_PALETTES, type CampPalette } from './festivalCamping';

/** Per-world palette cache: share geometry/maps, clone only the two authored fabric materials. */
export class TentPaletteCache {
  private materials = new Map<CampPalette, Map<THREE.Material, THREE.Material>>();

  apply(instance: THREE.Object3D, palette?: CampPalette): void {
    if (!palette) return;
    const colors = CAMP_PALETTES[palette];
    let variants = this.materials.get(palette);
    if (!variants) {
      variants = new Map();
      this.materials.set(palette, variants);
    }
    const recolor = (source: THREE.Material) => {
      const role: unknown = source.userData.tentFabricRole;
      if (!(source instanceof THREE.MeshStandardMaterial) || (role !== 'fly' && role !== 'accent'))
        return source;
      let variant = variants!.get(source);
      if (!variant) {
        const copy = source.clone();
        copy.color.set(colors[role]);
        copy.name = `${source.name}_${palette}`;
        variants!.set(source, copy);
        variant = copy;
      }
      return variant;
    };
    instance.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material)
        ? object.material.map(recolor)
        : recolor(object.material);
    });
  }

  /** GPU cleanup belongs to disposeObjectTree(scene), including hidden LODs. */
  clear(): void {
    this.materials.clear();
  }
}
