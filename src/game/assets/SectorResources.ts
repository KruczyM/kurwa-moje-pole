import * as THREE from 'three';

type Ref<T> = { value: T; count: number };
/** Only exported world materials/textures opt in. Each resident sector owns one reference. */
export class SectorResources {
  private materials = new Map<string, Ref<THREE.Material>>();
  private textures = new Map<string, Ref<THREE.Texture>>();
  private roots = new Map<THREE.Object3D, { materials: Set<string>; textures: Set<string> }>();
  private closedImages = new WeakSet<object>();

  private textureKey(texture: THREE.Texture): string | undefined {
    const image = texture.userData.fogImageKey;
    return image
      ? JSON.stringify([
          image,
          texture.colorSpace,
          texture.wrapS,
          texture.wrapT,
          texture.magFilter,
          texture.minFilter,
          texture.channel,
          texture.flipY,
          texture.offset.toArray(),
          texture.repeat.toArray(),
          texture.rotation,
          texture.center.toArray(),
        ])
      : undefined;
  }

  acquire(root: THREE.Object3D): void {
    if (this.roots.has(root)) return;
    const oldMaterials = new Set<THREE.Material>(),
      oldTextures = new Set<THREE.Texture>();
    const usedMaterials = new Set<string>(),
      usedTextures = new Set<string>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const canonical = (material: THREE.Material) => {
        const key = material.userData.fogMaterialKey as string | undefined;
        oldMaterials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) oldTextures.add(value);
        if (!key) return material;
        let record = this.materials.get(key);
        if (!record) {
          for (const [property, value] of Object.entries(material)) {
            if (!(value instanceof THREE.Texture)) continue;
            const textureKey = this.textureKey(value);
            if (!textureKey) continue;
            if (!this.textures.has(textureKey)) this.textures.set(textureKey, { value, count: 0 });
            (material as unknown as Record<string, unknown>)[property] = this.textures.get(textureKey)!.value;
          }
          record = { value: material, count: 0 };
          this.materials.set(key, record);
        }
        usedMaterials.add(key);
        for (const value of Object.values(record.value)) {
          if (value instanceof THREE.Texture) {
            const textureKey = this.textureKey(value);
            if (textureKey) usedTextures.add(textureKey);
          }
        }
        return record.value;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(canonical)
        : canonical(object.material);
    });
    for (const key of usedMaterials) this.materials.get(key)!.count++;
    for (const key of usedTextures) this.textures.get(key)!.count++;
    const retainedMaterials = new Set([...this.materials.values()].map((r) => r.value));
    const retainedTextures = new Set([...this.textures.values()].map((r) => r.value));
    for (const material of oldMaterials)
      if (!retainedMaterials.has(material) && material.userData.fogMaterialKey) material.dispose();
    for (const texture of oldTextures)
      if (!retainedTextures.has(texture) && this.textureKey(texture)) {
        texture.dispose();
        this.closeImage(texture.image);
      }
    this.roots.set(root, { materials: usedMaterials, textures: usedTextures });
  }

  private closeImage(image: unknown): void {
    if (!image || typeof image !== 'object' || this.closedImages.has(image)) return;
    if ([...this.textures.values()].some((record) => record.value.image === image)) return;
    this.closedImages.add(image);
    const bitmap = image as { close?: () => void } | undefined;
    bitmap?.close?.();
  }

  release(root: THREE.Object3D): void {
    const refs = this.roots.get(root);
    if (!refs) return;
    this.roots.delete(root);
    for (const key of refs.materials) {
      const record = this.materials.get(key)!;
      if (--record.count === 0) {
        record.value.dispose();
        this.materials.delete(key);
      }
    }
    for (const key of refs.textures) {
      const record = this.textures.get(key)!;
      if (--record.count === 0) {
        this.textures.delete(key);
        record.value.dispose();
        this.closeImage(record.value.image);
      }
    }
    const geometries = new Set<THREE.BufferGeometry>(),
      privateMaterials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        if (!material.userData.fogMaterialKey) privateMaterials.add(material);
    });
    geometries.forEach((g) => g.dispose());
    privateMaterials.forEach((m) => m.dispose());
    root.removeFromParent();
    root.clear();
  }

  dispose(): void {
    for (const root of [...this.roots.keys()]) this.release(root);
  }
  get stats() {
    return { sectors: this.roots.size, materials: this.materials.size, textures: this.textures.size };
  }
}
