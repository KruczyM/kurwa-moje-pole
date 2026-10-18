import * as THREE from 'three';
import { ALL_CAMPING_PLOTS, WORLD_LIMIT } from '../../festivalLayout';
import { worldGrassMaskShader, worldGrassMaskUniforms } from '../../grassWorldMask';
import { DEFAULT_GRASS_PRESET, GRASS_PRESETS, type GrassQualityPreset } from '../../grassQuality';

function createDistantGeometry(count: number): THREE.BufferGeometry {
  const extent = WORLD_LIMIT - 0.3;
  const p = new Float32Array(count * 9);
  const c = new Float32Array(count * 9);
  const yaw = new Float32Array(count * 9);
  let seed = 171;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    // Permanent world-space meadow: concentrate the existing budget in populated camps.
    const plot = ALL_CAMPING_PLOTS[i % ALL_CAMPING_PLOTS.length];
    const inCamp = i % 5 !== 0;
    const x = inCamp ? plot.minX + rnd() * (plot.maxX - plot.minX) : rnd() * extent * 2 - extent;
    const z = inCamp ? plot.minZ + rnd() * (plot.maxZ - plot.minZ) : rnd() * extent * 2 - extent;
    const a = rnd() * Math.PI * 2;
    for (let v = 0; v < 3; v++) {
      const o = (i * 3 + v) * 3;
      p[o] = x;
      p[o + 1] = 0;
      p[o + 2] = z;
      yaw[o] = Math.sin(a);
      yaw[o + 1] = 0;
      yaw[o + 2] = -Math.cos(a);
      c[o] = v === 0 ? 0.1 : 0;
      c[o + 1] = v === 2 ? 1 : 0;
      c[o + 2] = v === 1 ? 0.1 : 0;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aYaw', new THREE.BufferAttribute(yaw, 3));
  return g;
}

export class DistantTriangleGrass extends THREE.Mesh {
  private time: { value: number };
  private currentPreset: GrassQualityPreset;

  constructor(preset: GrassQualityPreset = DEFAULT_GRASS_PRESET) {
    const config = GRASS_PRESETS[preset] ?? GRASS_PRESETS.high;
    const g = createDistantGeometry(config.distantBladeCount);
    const time = { value: 0 };

    const m = new THREE.ShaderMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: { uTime: time, ...worldGrassMaskUniforms(), ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
      vertexShader: `
        ${worldGrassMaskShader}
        #include <fog_pars_vertex>
        attribute vec3 aYaw;
        uniform float uTime;
        varying float vTip;

        float terrain(vec2 p) {
          return 0.0;
        }


        void main() {
          vec3 q = position;
          float cov = worldGrassCoverage(q.xz);
          if (cov <= 0.01) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }
          q.y = terrain(q.xz);
          float tip = color.g;
          float side = color.r > 0.05 ? 1.0 : (color.b > 0.05 ? -1.0 : 0.0);
          float h = (0.12 + fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5) * 0.18) * cov;
          q += aYaw * side * 0.055;
          q.y += tip * h;
          float wind = sin(uTime * 0.5 + q.x * 0.2 + q.z * 0.15) * 0.018 * tip * tip;
          q.x += wind;
          q.z += wind * 0.5;
          vTip = tip;
          vec4 mvPosition = modelViewMatrix * vec4(q, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        varying float vTip;
        void main() {
          vec3 dark = vec3(0.014, 0.075, 0.022);
          vec3 light = vec3(0.065, 0.240, 0.080);
          gl_FragColor = vec4(mix(dark, light, vTip), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    super(g, m);
    this.name = 'DistantTriangleGrass';
    this.time = time;
    this.currentPreset = preset;
    this.frustumCulled = false;
    this.onBeforeRender = () => {
      this.time.value = performance.now() * 0.001;
    };
  }

  setPreset(preset: GrassQualityPreset): void {
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;
    const config = GRASS_PRESETS[preset] ?? GRASS_PRESETS.high;

    const oldGeo = this.geometry;
    this.geometry = createDistantGeometry(config.distantBladeCount);
    oldGeo.dispose();
  }

  dispose(): void {
    this.geometry.dispose();
    if (Array.isArray(this.material)) {
      this.material.forEach((m) => m.dispose());
    } else {
      this.material.dispose();
    }
  }
}
