import * as THREE from 'three';
import { DEFAULT_GRASS_PRESET, GRASS_PRESETS, type GrassQualityPreset } from '../../grassQuality';

function createGrassGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 9);
  const colors = new Float32Array(count * 9);
  const yaws = new Float32Array(count * 9);
  let seed = 97;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const halfTile = 26.0;
  const tileSize = 52.0;

  for (let i = 0; i < count; i++) {
    const x = rand() * tileSize - halfTile;
    const z = rand() * tileSize - halfTile;
    const yaw = rand() * Math.PI * 2;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    for (let v = 0; v < 3; v++) {
      const o = (i * 3 + v) * 3;
      positions[o] = x;
      positions[o + 1] = 0.012;
      positions[o + 2] = z;
      yaws[o] = sinY;
      yaws[o + 1] = 0;
      yaws[o + 2] = -cosY;
      colors[o] = v === 0 ? 0.1 : 0;
      colors[o + 1] = v === 2 ? 1 : 0;
      colors[o + 2] = v === 1 ? 0.1 : 0;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aYaw', new THREE.BufferAttribute(yaws, 3));
  return geo;
}

export class TutorialTriangleGrass extends THREE.Mesh {
  private time: { value: number };
  private player: { value: THREE.Vector3 };
  private currentPreset: GrassQualityPreset;

  constructor(preset: GrassQualityPreset = DEFAULT_GRASS_PRESET) {
    const config = GRASS_PRESETS[preset] ?? GRASS_PRESETS.high;
    const geo = createGrassGeometry(config.nearBladeCount);
    const time = { value: 0 };
    const player = { value: new THREE.Vector3() };

    const mat = new THREE.ShaderMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: time,
        uPlayerPosition: player,
      },
      vertexShader: `
        attribute vec3 aYaw;
        uniform float uTime;
        uniform vec3 uPlayerPosition;
        varying float vTip;
        varying float vShade;

        float terrain(vec2 p) {
          return 0.18 * sin(p.x * 0.065) * cos(p.y * 0.055) + 0.09 * sin(p.x * 0.19 + p.y * 0.13);
        }

        float campCoverage(vec2 p) {
          float period = 35.0;
          float halfParcel = 15.5;

          float gx = abs(mod(p.x + 3500.0 + 17.5, period) - 17.5);
          float gz = abs(mod(p.y + 3500.0 + 17.5, period) - 17.5);

          if (gx > halfParcel || gz > halfParcel) {
            return 0.0;
          }
          return 1.0;
        }

        void main() {
          vec3 p = position;
          vec2 origin = mod(position.xz - uPlayerPosition.xz + 26.0, 52.0) - 26.0;
          p.xz = uPlayerPosition.xz + origin;

          float cov = campCoverage(p.xz);
          if (cov <= 0.01) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          p.y = terrain(p.xz);

          float tip = color.g;
          float side = color.r > 0.05 ? 1.0 : (color.b > 0.05 ? -1.0 : 0.0);
          float n = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5);
          float h = (0.24 + n * 0.32) * cov;

          p += aYaw * side * 0.010 * (0.3 + 0.7 * cov);
          p.y += tip * h;

          float w = (sin(uTime * 0.72 + p.x * 0.42 + p.z * 0.29) + sin(uTime * 0.31 + p.z * 0.74)) * 0.035 * tip * tip * cov;
          p.x += w;
          p.z += w * 0.6;

          vTip = tip;
          vShade = n;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying float vTip;
        varying float vShade;

        void main() {
          // Rzeczywisty, naturalny kolor trawy - gleboka, ciemna zielen:
          vec3 dark = vec3(0.012, 0.065, 0.020);  // Ciemnozielony cien u nasady
          vec3 mid = vec3(0.035, 0.170, 0.048);   // Naturalna ciemna zielen zdzbla
          vec3 light = vec3(0.085, 0.300, 0.095); // Wierzcholki oswietlone sloncem
          vec3 col = mix(mix(dark, mid, vShade), light, vTip * 0.75);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    super(geo, mat);
    this.name = 'TutorialTriangleGrass';
    this.time = time;
    this.player = player;
    this.currentPreset = preset;
    this.frustumCulled = false;
    this.onBeforeRender = (_renderer, _scene, camera) => {
      this.time.value = performance.now() * 0.001;
      this.player.value.copy(camera.position);
    };
  }

  get preset(): GrassQualityPreset {
    return this.currentPreset;
  }

  setPreset(preset: GrassQualityPreset): void {
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;
    const config = GRASS_PRESETS[preset] ?? GRASS_PRESETS.high;

    const oldGeo = this.geometry;
    this.geometry = createGrassGeometry(config.nearBladeCount);
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

