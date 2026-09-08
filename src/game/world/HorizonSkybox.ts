import * as THREE from 'three';
import { textureAssets } from '../assets/assetManifest';

export type SkyboxPeriod = 'day' | 'evening' | 'night';
export type SkyboxVariant = SkyboxPeriod | 'nebula';

/** Dobiera porę skyboxa z lokalnej godziny urządzenia. */
export function skyboxPeriodForHour(hour: number): SkyboxPeriod {
  if (hour >= 6 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** Losuje zwykłe nocne niebo lub nebulę z równym prawdopodobieństwem. */
export function skyboxVariantForPeriod(period: SkyboxPeriod, randomValue: number): SkyboxVariant {
  if (period !== 'night') return period;
  return randomValue < 0.5 ? 'night' : 'nebula';
}

/** Zarządza cubemapą nieba i zmienia ją po przekroczeniu granicy pory dnia. */
export class TimeOfDaySkybox {
  private period?: SkyboxPeriod;
  private texture?: THREE.CubeTexture;
  private nextCheckAt = 0;
  private requestToken = 0;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly now: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
  ) {
    this.update(true);
  }

  /** Sprawdza lokalny czas najwyżej raz na minutę i ładuje właściwy zestaw sześciu ścian. */
  update(force = false) {
    if (this.disposed) return;
    const now = this.now();
    if (!force && now.getTime() < this.nextCheckAt) return;
    this.nextCheckAt = now.getTime() + 60_000;
    const period = skyboxPeriodForHour(now.getHours());
    if (period === this.period) return;
    this.period = period;
    this.load(period);
  }

  /** Podmienia tło dopiero po pełnym wczytaniu cubemapy, aby uniknąć czarnej klatki. */
  private load(period: SkyboxPeriod) {
    const token = ++this.requestToken;
    const variant = skyboxVariantForPeriod(period, this.random());
    new THREE.CubeTextureLoader().load(
      textureAssets.skyboxes[variant],
      (loaded) => {
        if (this.disposed || token !== this.requestToken) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        const previous = this.texture;
        this.texture = loaded;
        this.scene.background = loaded;
        previous?.dispose();
      },
      undefined,
      () => {
        if (token === this.requestToken) {
          console.error(`Nie udało się wczytać wariantu skyboxa: ${variant}`);
          this.period = undefined;
        }
      },
    );
  }

  /** Anuluje spóźnione odpowiedzi i zwalnia teksturę cubemapy. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.requestToken++;
    if (this.scene.background === this.texture) this.scene.background = null;
    this.texture?.dispose();
    this.texture = undefined;
  }
}

/**
 * Cylindryczna panorama dalekiego horyzontu (drzewa i pole).
 * Łagodne wygaszanie krawędzi (alpha fade) góry i dołu eliminuje efekt widocznej
 * kopuły/odciętego cylindra, płynnie łącząc krajobraz ze skyboxem i mgłą.
 */
export class HorizonPanorama {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private disposed = false;

  constructor(texture?: THREE.Texture | null) {
    const radius = 85;
    const height = 34;
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);

    if (texture) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    const uniforms = {
      map: { value: texture ?? null },
      ...THREE.UniformsLib.fog,
    };

    const vertexShader = `
      varying vec2 vUv;
      #include <fog_pars_vertex>

      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `;

    const fragmentShader = `
      uniform sampler2D map;
      varying vec2 vUv;
      #include <fog_pars_fragment>

      void main() {
        vec4 tex = texture2D(map, vUv);
        // Płynne przenikanie:
        // Dół (vUv.y 0.0 - 0.16) łagodnie wyłania się z terenu i traw
        float bottomFade = smoothstep(0.0, 0.16, vUv.y);
        // Góra (vUv.y 0.68 - 0.96) miękko wtapia się w niebo skyboxa
        float topFade = 1.0 - smoothstep(0.68, 0.96, vUv.y);
        float alpha = bottomFade * topFade;
        gl_FragColor = vec4(tex.rgb, alpha);
        #include <fog_fragment>
      }
    `;

    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    // Ustawienie wysokości środka cylindra tak, aby linia drzew wypadała na wysokości oczu/horyzontu
    this.mesh.position.y = 7.5;
    this.mesh.renderOrder = -1;
  }

  /** Podąża za kamerą w osiach X i Z, tworząc złudzenie nieskończonej odległości horyzontu. */
  update(cameraPosition: THREE.Vector3) {
    if (this.disposed) return;
    this.mesh.position.x = cameraPosition.x;
    this.mesh.position.z = cameraPosition.z;
  }

  setTexture(texture: THREE.Texture) {
    if (this.disposed) return;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.material.uniforms.map.value = texture;
    this.material.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
