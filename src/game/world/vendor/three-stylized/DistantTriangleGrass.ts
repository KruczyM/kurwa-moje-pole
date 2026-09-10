import * as THREE from 'three';
import { DEFAULT_GRASS_PRESET, GRASS_PRESETS, type GrassQualityPreset } from '../../grassQuality';

function createDistantGeometry(count: number): THREE.BufferGeometry {
  const extent = 58.5;
  const p = new Float32Array(count * 9);
  const c = new Float32Array(count * 9);
  const yaw = new Float32Array(count * 9);
  let seed = 171;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const x = rnd() * extent * 2 - extent;
    const z = rnd() * extent * 2 - extent;
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
      uniforms: { uTime: time },
      vertexShader: `
        attribute vec3 aYaw;
        uniform float uTime;
        varying float vTip;

        float terrain(vec2 p) {
          return 0.18 * sin(p.x * 0.065) * cos(p.y * 0.055) + 0.09 * sin(p.x * 0.19 + p.y * 0.13);
        }

        float campCoverage(vec2 p) {
          if (abs(p.x) <= 17.5 && abs(p.y) <= 17.5) {
            if (length(p) < 2.6) return 0.0;
            if (abs(p.x) < 0.9) return 0.0;
            if (p.y >= -7.2 && p.y <= -4.6) return 0.0;
            if (p.y >= 1.0 && p.y <= 3.0) return 0.0;
            if (p.y >= 7.0 && p.y <= 8.4) return 0.0;
            if (abs(p.x) >= 14.2 || abs(p.y) >= 14.2) return 0.0;
            return 1.0;
          float period = 35.0;
          float halfParcel = 15.5;

          float gx = abs(mod(p.x + 3500.0 + 17.5, period) - 17.5);
          float gz = abs(mod(p.y + 3500.0 + 17.5, period) - 17.5);

          if (gx > halfParcel || gz > halfParcel) {
            return 0.0;
          }
          float period = 15.5;
          float roadWidth = 3.8;
          float mx = mod(p.x + 1550.0, period);
          float my = mod(p.y + 1550.0, period);
          if (mx < roadWidth || my < roadWidth) return 0.0;
          return 1.0;
        }

        void main() {
          vec3 q = position;
          float cov = campCoverage(q.xz);
          if (cov <= 0.01) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }
          q.y = terrain(q.xz);
          float tip = color.g;
          float side = color.r > 0.05 ? 1.0 : (color.b > 0.05 ? -1.0 : 0.0);
          float h = (0.12 + fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5) * 0.18) * cov;
          q += aYaw * side * 0.007;
          q.y += tip * h;
          float wind = sin(uTime * 0.5 + q.x * 0.2 + q.z * 0.15) * 0.018 * tip * tip;
          q.x += wind;
          q.z += wind * 0.5;
          vTip = tip;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
        }
      `,
      fragmentShader: `
        varying float vTip;
        void main() {
          vec3 dark = vec3(0.014, 0.075, 0.022);
          vec3 light = vec3(0.065, 0.240, 0.080);
          gl_FragColor = vec4(mix(dark, light, vTip), 1.0);
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

