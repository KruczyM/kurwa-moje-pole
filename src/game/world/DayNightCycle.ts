/**
 * DayNightCycle — Płynny cykl dobowy i oświetlenie nocne festiwalu Pol'and'Rock
 * Steruje pozycją i barwą słońca (DirectionalLight), światłem rozproszonym (HemisphereLight),
 * mgłą (Fog), cubemapą (TimeOfDaySkybox), klimatycznymi lampkami obozowymi (fairy lights)
 * oraz latarką czołową gracza (SpotLight na klawiszu L).
 */

import * as THREE from 'three';
import type { TimeOfDaySkybox, SkyboxPeriod } from './HorizonSkybox';
import type { FestivalStageEffects } from './festivalStageEffects';

export interface DayNightCycleOptions {
  cycleDurationSec?: number; // Domyślnie 900 s (15 minut)
  initialTime?: number;      // 0..1 (0.35 = poranek ~8:30)
  autoAdvance?: boolean;
}

export interface DayNightLightingState {
  timeOfDay: number;
  period: SkyboxPeriod;
  sunPosition: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientSkyColor: THREE.Color;
  ambientGroundColor: THREE.Color;
  ambientIntensity: number;
  fogColor: THREE.Color;
  fairyLightsIntensity: number;
  isFlashlightOn: boolean;
}

export class DayNightCycle {
  public timeOfDay: number; // 0.0 do 1.0 (0.0 = północ, 0.25 = świt, 0.5 = południe, 0.75 = zachód)
  public cycleDurationSec: number;
  public autoAdvance: boolean;

  private period: SkyboxPeriod = 'day';
  private headlamp: THREE.SpotLight | null = null;
  private headlampTarget: THREE.Object3D | null = null;
  private isFlashlightOn = false;

  private fairyLightsGroup = new THREE.Group();
  private fairyPointLights: THREE.PointLight[] = [];
  private fairyBulbMaterials: THREE.MeshStandardMaterial[] = [];
  private fairyGeometries: THREE.BufferGeometry[] = [];

  private camera: THREE.Camera | null = null;

  // Wektory i kolory robocze (brak alokacji w update)
  private readonly _sunDir = new THREE.Vector3();
  private readonly _sunCol = new THREE.Color();
  private readonly _skyCol = new THREE.Color();
  private readonly _groundCol = new THREE.Color();
  private readonly _fogCol = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sun: THREE.DirectionalLight,
    private readonly ambientLight: THREE.HemisphereLight,
    private readonly skybox?: TimeOfDaySkybox,
    private readonly fog?: THREE.Fog,
    private readonly stageEffects?: FestivalStageEffects,
    options: DayNightCycleOptions = {},
  ) {
    this.timeOfDay = options.initialTime ?? 0.35; // Domyślnie piękny słoneczny poranek
    this.cycleDurationSec = options.cycleDurationSec ?? 900;
    this.autoAdvance = options.autoAdvance ?? true;

    this.initFairyLights();
    this.applyLighting();
  }

  /**
   * Podpina kamerę gracza i tworzy latarkę czołową (SpotLight).
   */
  attachCamera(camera: THREE.Camera): void {
    this.camera = camera;

    // Latarka czołowa gracza
    const spot = new THREE.SpotLight(0xfff5e6, 0, 42, Math.PI / 6.5, 0.45, 1.2);
    spot.position.set(0, 0, 0);

    const target = new THREE.Object3D();
    target.position.set(0, 0, -15);
    camera.add(target);
    spot.target = target;
    camera.add(spot);

    this.headlamp = spot;
    this.headlampTarget = target;
    this.headlamp.intensity = this.isFlashlightOn ? 3.0 : 0;
  }

  /**
   * Tworzy dekoracyjne łańcuchy lampek obozowych (fairy lights) nad namiotami #KurwaMojePole.
   */
  private initFairyLights(): void {
    this.fairyLightsGroup.name = 'Camp_Fairy_Lights';

    // Kolory lampek festiwalowych (ciepły żółty, pomarańczowy, różowy, cyan)
    const bulbColors = [0xffd152, 0xff7a36, 0xf43f5e, 0x38bdf8, 0xa855f7, 0x22c55e];

    // Rozmieszczenie żaróweczek wokół plandeki i stołu obozowego
    const bulbPositions: [number, number, number][] = [
      [-3.5, 2.4, -2.5],
      [-2.0, 2.5, -2.8],
      [-0.5, 2.6, -2.9],
      [1.0, 2.5, -2.8],
      [2.5, 2.4, -2.5],
      [3.0, 2.3, -1.0],
      [2.8, 2.2, 0.8],
      [1.5, 2.3, 2.0],
      [0.0, 2.4, 2.2],
      [-1.5, 2.3, 2.0],
      [-2.8, 2.2, 0.8],
      [-3.2, 2.3, -1.0],
    ];

    const bulbGeom = new THREE.SphereGeometry(0.1, 8, 8);
    this.fairyGeometries.push(bulbGeom);

    for (let i = 0; i < bulbPositions.length; i++) {
      const color = bulbColors[i % bulbColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.1,
        roughness: 0.2,
      });
      this.fairyBulbMaterials.push(mat);

      const bulb = new THREE.Mesh(bulbGeom, mat);
      const [bx, by, bz] = bulbPositions[i];
      bulb.position.set(bx, by, bz);
      this.fairyLightsGroup.add(bulb);
    }

    // 3 delikatne punkty świetlne doświetlające stół i namioty w nocy
    const pointPos: [number, number, number][] = [
      [-1.8, 2.2, -1.5],
      [1.5, 2.2, -1.5],
      [0.0, 2.2, 1.2],
    ];

    for (const [px, py, pz] of pointPos) {
      const pl = new THREE.PointLight(0xffaa44, 0, 9, 1.5);
      pl.position.set(px, py, pz);
      this.fairyPointLights.push(pl);
      this.fairyLightsGroup.add(pl);
    }

    this.scene.add(this.fairyLightsGroup);
  }

  /**
   * Przełącza latarkę czołową gracza (klawisz L).
   */
  toggleFlashlight(): boolean {
    this.isFlashlightOn = !this.isFlashlightOn;
    if (this.headlamp) {
      this.headlamp.intensity = this.isFlashlightOn ? 3.0 : 0;
    }
    return this.isFlashlightOn;
  }

  getFlashlightState(): boolean {
    return this.isFlashlightOn;
  }

  /**
   * Zmienia porę dnia na kolejną (np. klawiszem dev P).
   * Przeskakuje do: Dzień (0.35) -> Zachód (0.75) -> Noc (0.95) -> Świt (0.25).
   */
  advancePeriod(): SkyboxPeriod {
    if (this.timeOfDay < 0.25 || this.timeOfDay >= 0.85) {
      this.timeOfDay = 0.35; // Dzień
    } else if (this.timeOfDay < 0.70) {
      this.timeOfDay = 0.76; // Zachód
    } else {
      this.timeOfDay = 0.95; // Noc
    }
    this.applyLighting();
    return this.period;
  }

  /**
   * Ustawia konkretną porę dnia [0..1].
   */
  setTimeOfDay(time: number): void {
    this.timeOfDay = ((time % 1) + 1) % 1;
    this.applyLighting();
  }

  getPeriod(): SkyboxPeriod {
    return this.period;
  }

  isNight(): boolean {
    return this.period === 'night';
  }

  /**
   * Aktualizuje pozycje świateł, intensywności i porę dnia.
   */
  update(dt: number): void {
    if (this.autoAdvance && this.cycleDurationSec > 0) {
      this.timeOfDay = (this.timeOfDay + dt / this.cycleDurationSec) % 1.0;
    }
    this.applyLighting();
  }

  /**
   * Przelicza parametry oświetlenia i mgły dla bieżącej wartości `timeOfDay`.
   */
  private applyLighting(): void {
    const t = this.timeOfDay;

    // Wyznaczamy okres skyboxa
    const newPeriod: SkyboxPeriod =
      t >= 0.22 && t < 0.70 ? 'day' : t >= 0.70 && t < 0.85 ? 'evening' : 'night';

    if (newPeriod !== this.period) {
      this.period = newPeriod;
      this.skybox?.setPeriod(newPeriod);
    }

    // Wyliczamy kąt słońca
    // t = 0.25 (wschód, kąt = 0), t = 0.5 (południe, kąt = PI/2), t = 0.75 (zachód, kąt = PI)
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle) * 35;
    const sunX = Math.cos(sunAngle) * 45;
    const sunZ = Math.sin(sunAngle * 0.5) * 15;

    this.sun.position.set(sunX, Math.max(-10, sunHeight), sunZ);

    if (sunHeight > 8) {
      // Pełny dzień
      this.sun.color.setHex(0xffe0b0);
      this.sun.intensity = 3.2;
      this.ambientLight.color.setHex(0xb9dcff);
      this.ambientLight.groundColor.setHex(0x4b3c23);
      this.ambientLight.intensity = 1.7;

      if (this.fog) {
        this.fog.color.setHex(0x8da1b5);
        this.fog.near = 100;
        this.fog.far = 380;
      }

      this.setFairyLightsIntensity(0);
    } else if (sunHeight > -2) {
      // Zachód / Świt (złota godzina)
      const blend = Math.max(0, (sunHeight + 2) / 10);
      this._sunCol.setHex(0xff6e26).lerp(new THREE.Color(0xffe0b0), blend);
      this.sun.color.copy(this._sunCol);
      this.sun.intensity = 0.8 + blend * 2.0;

      this._skyCol.setHex(0xff9966).lerp(new THREE.Color(0xb9dcff), blend);
      this._groundCol.setHex(0x4a2a22).lerp(new THREE.Color(0x4b3c23), blend);
      this.ambientLight.color.copy(this._skyCol);
      this.ambientLight.groundColor.copy(this._groundCol);
      this.ambientLight.intensity = 0.8 + blend * 0.8;

      if (this.fog) {
        this._fogCol.setHex(0x754854).lerp(new THREE.Color(0x8da1b5), blend);
        this.fog.color.copy(this._fogCol);
        this.fog.near = 70 + blend * 30;
        this.fog.far = 280 + blend * 100;
      }

      this.setFairyLightsIntensity(1.0 - blend);
    } else {
      // Noc
      this.sun.color.setHex(0x38558a); // Zimne światło księżyca
      this.sun.intensity = 0.35;

      this.ambientLight.color.setHex(0x152238);
      this.ambientLight.groundColor.setHex(0x0a101d);
      this.ambientLight.intensity = 0.45;

      if (this.fog) {
        this.fog.color.setHex(0x0c121d);
        this.fog.near = 40;
        this.fog.far = 220;
      }

      this.setFairyLightsIntensity(1.5);
    }
  }

  private setFairyLightsIntensity(intensity: number): void {
    for (const pl of this.fairyPointLights) {
      pl.intensity = intensity;
    }
    for (const mat of this.fairyBulbMaterials) {
      mat.emissiveIntensity = Math.max(0.1, intensity * 1.8);
    }
  }

  /**
   * Zwraca stan oświetlenia do testów i HUD.
   */
  getState(): DayNightLightingState {
    return {
      timeOfDay: this.timeOfDay,
      period: this.period,
      sunPosition: this.sun.position.clone(),
      sunColor: this.sun.color.clone(),
      sunIntensity: this.sun.intensity,
      ambientSkyColor: this.ambientLight.color.clone(),
      ambientGroundColor: this.ambientLight.groundColor.clone(),
      ambientIntensity: this.ambientLight.intensity,
      fogColor: this.fog ? this.fog.color.clone() : new THREE.Color(),
      fairyLightsIntensity: this.fairyPointLights[0]?.intensity ?? 0,
      isFlashlightOn: this.isFlashlightOn,
    };
  }

  dispose(): void {
    this.scene.remove(this.fairyLightsGroup);
    if (this.camera && this.headlamp) {
      this.camera.remove(this.headlamp);
    }
    if (this.camera && this.headlampTarget) {
      this.camera.remove(this.headlampTarget);
    }
    for (const geom of this.fairyGeometries) geom.dispose();
    for (const mat of this.fairyBulbMaterials) mat.dispose();
    this.fairyGeometries = [];
    this.fairyBulbMaterials = [];
    this.fairyPointLights = [];
  }
}
