import * as THREE from 'three';
import { stepFlankiBall } from './FlankiPhysics';

export interface TrajectoryPoint {
  position: THREE.Vector3;
  time: number;
}

export interface FlankiAimConfig {
  gravity?: number; // default 9.81 m/s^2
  minSpeed?: number; // default 5.0 m/s
  maxSpeed?: number; // default 16.0 m/s
  sweetSpotMin?: number; // default 0.70
  sweetSpotMax?: number; // default 0.85
  pointCount?: number; // default 24
}

export class FlankiAiming {
  readonly gravity: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly sweetSpotMin: number;
  readonly sweetSpotMax: number;
  readonly pointCount: number;

  readonly trajectoryMesh: THREE.Points;
  private readonly positionsAttribute: THREE.BufferAttribute;
  private readonly colorsAttribute: THREE.BufferAttribute;

  constructor(config?: FlankiAimConfig) {
    this.gravity = config?.gravity ?? 9.81;
    this.minSpeed = config?.minSpeed ?? 5.0;
    this.maxSpeed = config?.maxSpeed ?? 16.0;
    this.sweetSpotMin = config?.sweetSpotMin ?? 0.7;
    this.sweetSpotMax = config?.sweetSpotMax ?? 0.85;
    this.pointCount = config?.pointCount ?? 24;

    // Utwórz Three.js Points z neonowo-żółtymi punktami trajektorii
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.pointCount * 3);
    const colors = new Float32Array(this.pointCount * 3);

    for (let i = 0; i < this.pointCount; i++) {
      // Domyślny kolor fluorescencyjny żółto-seledynowy
      colors[i * 3 + 0] = 0.85;
      colors[i * 3 + 1] = 1.0;
      colors[i * 3 + 2] = 0.1;
    }

    this.positionsAttribute = new THREE.BufferAttribute(positions, 3);
    this.colorsAttribute = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('position', this.positionsAttribute);
    geometry.setAttribute('color', this.colorsAttribute);

    const material = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        'void main() {\n if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;',
      );
    };
    material.customProgramCacheKey = () => 'flanki-round-trajectory';

    this.trajectoryMesh = new THREE.Points(geometry, material);
    this.trajectoryMesh.name = 'Flanki_Trajectory_Arc';
    this.trajectoryMesh.visible = false;
  }

  /**
   * Oblicza wektor prędkości początkowej na podstawie punktu startowego, docelowego i siły rzutu (0..1).
   */
  public calculateLaunchVelocity(origin: THREE.Vector3, target: THREE.Vector3, power: number): THREE.Vector3 {
    const clampedPower = THREE.MathUtils.clamp(power, 0, 1);
    const speed = this.minSpeed + (this.maxSpeed - this.minSpeed) * clampedPower;

    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const horizontalDist = Math.hypot(dx, dz);

    // Kąt wzniesienia rzutu balistycznego (ok. 18-24 stopnie w zależności od siły)
    const pitch = THREE.MathUtils.degToRad(20);
    const vHorizontal = speed * Math.cos(pitch);
    const vY = speed * Math.sin(pitch);

    const dirX = horizontalDist > 0.001 ? dx / horizontalDist : 0;
    const dirZ = horizontalDist > 0.001 ? dz / horizontalDist : -1;

    return new THREE.Vector3(dirX * vHorizontal, vY, dirZ * vHorizontal);
  }

  /**
   * Generuje dyskretne punkty trajektorii balistycznej pod wpływem grawitacji.
   */
  public computeTrajectory(
    origin: THREE.Vector3,
    initialVelocity: THREE.Vector3,
    stepCount: number,
    timeStep = 0.05,
    floorY = -100,
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const current = origin.clone();
    const vel = initialVelocity.clone();

    for (let i = 0; i < stepCount; i++) {
      points.push(current.clone());
      stepFlankiBall(current, vel, timeStep, this.gravity);

      if (current.y < floorY) {
        current.y = floorY;
        points.push(current.clone());
        break;
      }
    }
    return points;
  }

  /**
   * Aktualizuje geometrię punktów łuku trajektorii w Three.js.
   */
  public updateTrajectoryMesh(
    origin: THREE.Vector3,
    velocity: THREE.Vector3,
    floorY: number,
    power: number,
  ): void {
    const points = this.computeTrajectory(origin, velocity, this.pointCount + 3, 0.04, floorY).slice(3);
    if (points.length === 0) {
      this.hideTrajectory();
      return;
    }
    const isSweet = power >= this.sweetSpotMin && power <= this.sweetSpotMax;

    for (let i = 0; i < this.pointCount; i++) {
      const pt = i < points.length ? points[i] : points[points.length - 1];
      this.positionsAttribute.setXYZ(i, pt.x, pt.y, pt.z);

      // Punkty stają się bardziej intensywne i seledynowe w Sweet Spot
      if (isSweet) {
        this.colorsAttribute.setXYZ(i, 0.2, 1.0, 0.3); // Soczysta zieleń idealnego rzutu
      } else if (power > this.sweetSpotMax) {
        this.colorsAttribute.setXYZ(i, 1.0, 0.3, 0.2); // Czerwień - za mocny rzut
      } else {
        this.colorsAttribute.setXYZ(i, 1.0, 0.9, 0.2); // Żółty - za słaby rzut
      }
    }

    this.positionsAttribute.needsUpdate = true;
    this.colorsAttribute.needsUpdate = true;
    this.trajectoryMesh.visible = true;
    this.trajectoryMesh.geometry.computeBoundingSphere();
  }

  public hideTrajectory(): void {
    this.trajectoryMesh.visible = false;
  }

  public isSweetSpot(power: number): boolean {
    return power >= this.sweetSpotMin && power <= this.sweetSpotMax;
  }

  public dispose(): void {
    this.trajectoryMesh.geometry.dispose();
    if (Array.isArray(this.trajectoryMesh.material)) {
      this.trajectoryMesh.material.forEach((m) => m.dispose());
    } else {
      this.trajectoryMesh.material.dispose();
    }
  }
}
