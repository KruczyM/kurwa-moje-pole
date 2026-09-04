import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyPbrMaterialPolicy, interactivePbrProfile, PBR_SURFACE_LIMITS } from './pbrMaterials';

describe('PBR material policy', () => {
  it('uses sRGB for Base Color and linear space for material data maps', () => {
    const color = new THREE.Texture();
    const normal = new THREE.Texture();
    const roughness = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({
      map: color,
      normalMap: normal,
      roughnessMap: roughness,
    });
    const root = new THREE.Mesh(new THREE.BoxGeometry(), material);

    const audit = applyPbrMaterialPolicy(root, 'fabric');

    expect(color.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(normal.colorSpace).toBe(THREE.NoColorSpace);
    expect(roughness.colorSpace).toBe(THREE.NoColorSpace);
    expect(audit).toMatchObject({ meshes: 1, materials: 1, colorTextures: 1, dataTextures: 2 });
  });

  it('removes accidental metallic defaults from skin and cloth without replacing authored maps', () => {
    const characterMaterial = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 1 });
    const character = new THREE.Mesh(new THREE.BoxGeometry(), characterMaterial);
    applyPbrMaterialPolicy(character, 'character');
    expect(characterMaterial.roughness).toBe(PBR_SURFACE_LIMITS.character.roughness[1]);
    expect(characterMaterial.metalness).toBe(PBR_SURFACE_LIMITS.character.metalness[1]);

    const metallicRoughness = new THREE.Texture();
    const authored = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 1 });
    authored.roughnessMap = metallicRoughness;
    authored.metalnessMap = metallicRoughness;
    applyPbrMaterialPolicy(new THREE.Mesh(new THREE.BoxGeometry(), authored), 'fabric');
    expect(authored.roughness).toBe(1);
    expect(authored.metalness).toBe(1);
    expect(metallicRoughness.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('assigns stable profiles to approved interactive props', () => {
    expect(interactivePbrProfile('table')).toBe('wood');
    expect(interactivePbrProfile('mdma')).toBe('plastic');
    expect(interactivePbrProfile('mushrooms')).toBe('organic');
    expect(interactivePbrProfile('lsd')).toBe('paper');
  });
});
