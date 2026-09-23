import * as THREE from 'three';

export const WORLD_GRASS_MASK_EXTENT = 58.8;
export const WORLD_GRASS_MASK_SIZE = 512;

/** World-space mask shared by moving near grass and the static distant layer. */
export function createGrassWorldMask(sample: (x: number, z: number) => number) {
  const size = WORLD_GRASS_MASK_SIZE;
  const step = (WORLD_GRASS_MASK_EXTENT * 2) / size;
  const data = new Uint8Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = -WORLD_GRASS_MASK_EXTENT + (column + 0.5) * step;
      const z = -WORLD_GRASS_MASK_EXTENT + (row + 0.5) * step;
      let coverage = 1;
      // Conservative footprint includes the texel edge and blade sway.
      for (const dx of [-step / 2 - 0.08, 0, step / 2 + 0.08])
        for (const dz of [-step / 2 - 0.08, 0, step / 2 + 0.08])
          coverage = Math.min(coverage, sample(x + dx, z + dz));
      data[row * size + column] = Math.round(THREE.MathUtils.clamp(coverage, 0, 1) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export const worldGrassMaskShader = `
  uniform sampler2D uWorldGrassMask;
  uniform float uWorldGrassMaskEnabled;
  float worldGrassCoverage(vec2 p) {
    if (uWorldGrassMaskEnabled < 0.5) return 1.0;
    vec2 uv = (p + ${WORLD_GRASS_MASK_EXTENT.toFixed(1)}) / ${(WORLD_GRASS_MASK_EXTENT * 2).toFixed(1)};
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
    return texture2D(uWorldGrassMask, uv).r;
  }
`;

export function worldGrassMaskUniforms() {
  return { uWorldGrassMask: { value: null as THREE.Texture | null }, uWorldGrassMaskEnabled: { value: 0 } };
}

export function bindGrassWorldMask(mesh: THREE.Mesh, texture: THREE.Texture) {
  const material = mesh.material as THREE.ShaderMaterial;
  material.uniforms.uWorldGrassMask.value = texture;
  material.uniforms.uWorldGrassMaskEnabled.value = 1;
}
