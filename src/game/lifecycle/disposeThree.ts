import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const textureKeys = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'anisotropyMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularColorMap',
  'specularIntensityMap',
  'thicknessMap',
  'transmissionMap',
] as const;

/** Klonuje model statyczny wraz z prywatnymi geometriami, materiałami i teksturami. */
export function cloneDisposableModel(source: THREE.Object3D) {
  const model = source.clone(true);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clones = materials.map((material) => {
      const copy = material.clone();
      for (const key of textureKeys) {
        const texture = (copy as unknown as Record<string, unknown>)[key];
        if (texture instanceof THREE.Texture)
          (copy as unknown as Record<string, unknown>)[key] = texture.clone();
      }
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
  });
  return model;
}

/** Skeleton-safe instance with resources detached from the cached GLTF source. */
export function cloneDisposableSkinnedModel(source: THREE.Object3D) {
  const model = cloneSkinned(source);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clonedMaterials = sourceMaterials.map((material) => {
      const copy = material.clone();
      for (const key of textureKeys) {
        const texture = (copy as unknown as Record<string, unknown>)[key];
        if (texture instanceof THREE.Texture)
          (copy as unknown as Record<string, unknown>)[key] = texture.clone();
      }
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0];
  });
  return model;
}

/** Zwalnia bez duplikacji wszystkie zasoby GPU znalezione w drzewie obiektu. */
export function disposeObjectTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>(),
    skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const skinned = mesh as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) skeletons.add(skinned.skeleton);
    geometries.add(mesh.geometry);
    const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    values.forEach((material) => {
      materials.add(material);
      for (const key of textureKeys) {
        const texture = (material as unknown as Record<string, unknown>)[key];
        if (texture instanceof THREE.Texture) textures.add(texture);
      }
    });
  });
  textures.forEach((texture) => texture.dispose());
  skeletons.forEach((skeleton) => skeleton.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  root.clear();
}
