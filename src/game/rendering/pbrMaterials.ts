import * as THREE from 'three';

export type PbrSurfaceProfile = 'character' | 'fabric' | 'plastic' | 'paper' | 'organic' | 'wood' | 'mixed';

type SurfaceLimits = {
  roughness: readonly [minimum: number, maximum: number];
  metalness: readonly [minimum: number, maximum: number];
};

export type PbrAudit = {
  meshes: number;
  materials: number;
  adjustedMaterials: number;
  colorTextures: number;
  dataTextures: number;
};

export const PBR_SURFACE_LIMITS: Record<PbrSurfaceProfile, SurfaceLimits> = {
  character: { roughness: [0.55, 0.9], metalness: [0, 0.04] },
  fabric: { roughness: [0.68, 0.98], metalness: [0, 0.04] },
  plastic: { roughness: [0.32, 0.78], metalness: [0, 0.05] },
  paper: { roughness: [0.72, 1], metalness: [0, 0.02] },
  organic: { roughness: [0.68, 0.96], metalness: [0, 0.02] },
  wood: { roughness: [0.62, 0.94], metalness: [0, 0.03] },
  mixed: { roughness: [0.25, 1], metalness: [0, 1] },
};

const COLOR_TEXTURE_KEYS = ['map', 'emissiveMap'] as const;
const DATA_TEXTURE_KEYS = [
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const;

/** Zwraca profil powierzchni dla rekwizytu ładowanego z katalogu interakcji. */
export function interactivePbrProfile(id: string): PbrSurfaceProfile {
  if (id === 'table') return 'wood';
  if (id === 'mdma' || id === 'cocaine') return 'plastic';
  if (id === 'mushrooms') return 'organic';
  return 'paper';
}

/** Ustawia przestrzeń barw tekstury i informuje, czy wartość została zmieniona. */
function setTextureColorSpace(texture: THREE.Texture | null, colorSpace: THREE.ColorSpace) {
  if (!texture || texture.colorSpace === colorSpace) return false;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return true;
}

/** Stosuje profil PBR do jednego materiału Standard/Physical bez nadpisywania map danych. */
function configureMaterial(material: THREE.Material, profile: PbrSurfaceProfile) {
  if (!(material instanceof THREE.MeshStandardMaterial)) return { changed: false, color: 0, data: 0 };

  let changed = false;
  const colorTextures = new Set<THREE.Texture>();
  const dataTextures = new Set<THREE.Texture>();
  for (const key of COLOR_TEXTURE_KEYS) {
    const texture = material[key];
    if (!texture) continue;
    colorTextures.add(texture);
    changed = setTextureColorSpace(texture, THREE.SRGBColorSpace) || changed;
  }
  for (const key of DATA_TEXTURE_KEYS) {
    const texture = material[key];
    if (!texture) continue;
    dataTextures.add(texture);
    changed = setTextureColorSpace(texture, THREE.NoColorSpace) || changed;
  }

  const limits = PBR_SURFACE_LIMITS[profile];
  if (!material.roughnessMap) {
    const roughness = THREE.MathUtils.clamp(material.roughness, ...limits.roughness);
    changed = changed || roughness !== material.roughness;
    material.roughness = roughness;
  }
  if (!material.metalnessMap) {
    const metalness = THREE.MathUtils.clamp(material.metalness, ...limits.metalness);
    changed = changed || metalness !== material.metalness;
    material.metalness = metalness;
  }
  if (changed) material.needsUpdate = true;
  return { changed, color: colorTextures.size, data: dataTextures.size };
}

/** Normalizuje materiały całego GLB i zwraca liczbowy raport używany przez testy oraz debug. */
export function applyPbrMaterialPolicy(root: THREE.Object3D, profile: PbrSurfaceProfile): PbrAudit {
  const materials = new Set<THREE.Material>();
  let meshes = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    values.forEach((material) => materials.add(material));
  });

  let adjustedMaterials = 0;
  let colorTextures = 0;
  let dataTextures = 0;
  materials.forEach((material) => {
    const result = configureMaterial(material, profile);
    if (result.changed) adjustedMaterials += 1;
    colorTextures += result.color;
    dataTextures += result.data;
  });
  return { meshes, materials: materials.size, adjustedMaterials, colorTextures, dataTextures };
}
