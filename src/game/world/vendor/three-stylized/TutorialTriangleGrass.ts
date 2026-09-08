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
  private innerRadius: { value: number };
  private outerRadius: { value: number };
  private baseWidth: { value: number };
  private minHeight: { value: number };
  private heightRange: { value: number };
  private currentPreset: GrassQualityPreset;

  constructor(preset: GrassQualityPreset = DEFAULT_GRASS_PRESET) {
    const config = GRASS_PRESETS[preset];
    const geo = createGrassGeometry(config.nearBladeCount);
    const time = { value: 0 };
    const player = { value: new THREE.Vector3() };
    const innerRadius = { value: config.innerRadius };
    const outerRadius = { value: config.outerRadius };
    const baseWidth = { value: config.baseWidth };
    const minHeight = { value: config.minHeight };
    const heightRange = { value: config.maxHeight - config.minHeight };

    const mat = new THREE.ShaderMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: time,
        uPlayerPosition: player,
        uInnerRadius: innerRadius,
        uOuterRadius: outerRadius,
        uBaseWidth: baseWidth,
        uMinHeight: minHeight,
        uHeightRange: heightRange,
      },
      vertexShader: `
        attribute vec3 aYaw;
        uniform float uTime;
        uniform vec3 uPlayerPosition;
        uniform float uInnerRadius;
        uniform float uOuterRadius;
        uniform float uBaseWidth;
        uniform float uMinHeight;
        uniform float uHeightRange;
        varying float vTip;
        varying float vShade;

        float terrain(vec2 p) {
          return 0.18 * sin(p.x * 0.065) * cos(p.y * 0.055) + 0.09 * sin(p.x * 0.19 + p.y * 0.13);
        }

        void main() {
          vec3 p = position;
          vec2 origin = mod(position.xz - uPlayerPosition.xz + 26.0, 52.0) - 26.0;
          p.xz = uPlayerPosition.xz + origin;
          p.y = terrain(p.xz);

          float dist = length(origin);
          float fade = 1.0 - smoothstep(uInnerRadius, uOuterRadius, dist);

          float tip = color.g;
          float side = color.r > 0.05 ? 1.0 : (color.b > 0.05 ? -1.0 : 0.0);
          float n = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5);
          float h = (uMinHeight + n * uHeightRange) * fade;

          p += aYaw * side * (uBaseWidth * fade);
          p.y += tip * h;

          float w = (sin(uTime * 0.72 + p.x * 0.42 + p.z * 0.29) + sin(uTime * 0.31 + p.z * 0.74)) * 0.025 * tip * tip * fade;
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
          vec3 dark = vec3(0.018, 0.12, 0.045);
          vec3 mid = vec3(0.040, 0.28, 0.090);
          vec3 light = vec3(0.150, 0.450, 0.095);
          vec3 col = mix(mix(dark, mid, vShade), light, vTip * 0.72);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    super(geo, mat);
    this.name = 'TutorialTriangleGrass';
    this.time = time;
    this.player = player;
    this.innerRadius = innerRadius;
    this.outerRadius = outerRadius;
    this.baseWidth = baseWidth;
    this.minHeight = minHeight;
    this.heightRange = heightRange;
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
    const config = GRASS_PRESETS[preset];

    this.innerRadius.value = config.innerRadius;
    this.outerRadius.value = config.outerRadius;
    this.baseWidth.value = config.baseWidth;
    this.minHeight.value = config.minHeight;
    this.heightRange.value = config.maxHeight - config.minHeight;

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
