import * as THREE from 'three';
import { terrainHeight } from './terrainHeight';
import { enableInteractionLayer } from '../interactions/InteractionManager';

export interface CampfireConfig {
  position?: [x: number, y: number, z: number];
  lightIntensity?: number;
  lightDistance?: number;
}

export interface CampfireLogSeat {
  id: string;
  position: THREE.Vector3;
  rotationY: number;
}

/**
 * Campfire — Klimatyczne ognisko obozowe z kręgiem kamieni, polanami drewna,
 * migoczącym płomieniem, ciepłym oświetleniem PointLight i pniakami do siedzenia.
 */
export class Campfire {
  readonly root = new THREE.Group();
  private fireMesh: THREE.Mesh;
  private emberMesh: THREE.Mesh;
  private light: THREE.PointLight;
  private baseLightIntensity: number;
  private timeAccumulator = 0;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  readonly logSeats: CampfireLogSeat[] = [];

  constructor(config: CampfireConfig = {}) {
    this.root.name = 'Campfire';
    const x = config.position ? config.position[0] : 5.5;
    const z = config.position ? config.position[2] : -3.0;
    const y = config.position ? config.position[1] : terrainHeight(x, z);
    this.root.position.set(x, y, z);

    this.baseLightIntensity = config.lightIntensity ?? 3.5;

    // 1. Popielisko (ciemna wypalona ziemia)
    const ashGeo = new THREE.CircleGeometry(0.85, 16);
    ashGeo.rotateX(-Math.PI / 2);
    const ashMat = new THREE.MeshStandardMaterial({
      color: 0x1a1816,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ash = new THREE.Mesh(ashGeo, ashMat);
    ash.position.y = 0.02;
    this.root.add(ash);
    this.geometries.push(ashGeo);
    this.materials.push(ashMat);

    // 2. Krąg kamieni wokół ogniska (10 kamieni)
    const stoneCount = 10;
    const stoneRadius = 0.72;
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x4a4744,
      roughness: 0.9,
    });
    this.materials.push(stoneMat);

    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2;
      const sX = Math.cos(angle) * stoneRadius;
      const sZ = Math.sin(angle) * stoneRadius;
      const stoneGeo = new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.03);
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(sX, 0.08, sZ);
      stone.rotation.set(angle, angle * 0.5, 0);
      this.root.add(stone);
      this.geometries.push(stoneGeo);
    }

    // 3. Drewniane polana w ognisku
    const logMat = new THREE.MeshStandardMaterial({
      color: 0x3d2716,
      roughness: 0.85,
    });
    this.materials.push(logMat);

    const logCount = 5;
    for (let i = 0; i < logCount; i++) {
      const angle = (i / logCount) * Math.PI * 2;
      const logGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.65, 6);
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(Math.cos(angle) * 0.18, 0.15, Math.sin(angle) * 0.18);
      log.rotation.set(0.65, angle + 0.4, 0.4);
      this.root.add(log);
      this.geometries.push(logGeo);
    }

    // 4. Płomienie ogniska (stylizowany mesh płomienia z emissive)
    const fireGeo = new THREE.ConeGeometry(0.35, 0.85, 7);
    fireGeo.translate(0, 0.42, 0);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.88,
    });
    this.fireMesh = new THREE.Mesh(fireGeo, fireMat);
    this.root.add(this.fireMesh);
    this.geometries.push(fireGeo);
    this.materials.push(fireMat);

    // 5. Rdzeń płomienia (jasnożółty środek)
    const emberGeo = new THREE.ConeGeometry(0.2, 0.55, 6);
    emberGeo.translate(0, 0.28, 0);
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.95,
    });
    this.emberMesh = new THREE.Mesh(emberGeo, emberMat);
    this.root.add(this.emberMesh);
    this.geometries.push(emberGeo);
    this.materials.push(emberMat);

    // 6. Ciepłe światło PointLight
    this.light = new THREE.PointLight(0xff7a22, this.baseLightIntensity, config.lightDistance ?? 16, 1.5);
    this.light.position.set(0, 0.45, 0);
    this.light.name = 'Campfire_PointLight';
    this.root.add(this.light);

    // 7. Pniaki do siedzenia w kręgu wokół ogniska (3 pniaki/ławki)
    this.initLogSeats(x, y, z);
  }

  private initLogSeats(originX: number, originY: number, originZ: number): void {
    const seatDist = 2.1;
    const seatAngles = [0, 2.1, 4.2]; // ~120 stopni rozstawienia wokół ogniska
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4e3524,
      roughness: 0.8,
    });
    this.materials.push(woodMat);

    seatAngles.forEach((angle, index) => {
      const lx = Math.cos(angle) * seatDist;
      const lz = Math.sin(angle) * seatDist;
      const seatId = `Campfire_Seat_${index + 1}`;

      const logGroup = new THREE.Group();
      logGroup.name = seatId;
      logGroup.position.set(lx, 0, lz);

      // Kłoda leżąca poziomo na ziemi jako ławka
      const logBenchGeo = new THREE.CylinderGeometry(0.22, 0.24, 1.25, 8);
      logBenchGeo.rotateZ(Math.PI / 2);
      const logBench = new THREE.Mesh(logBenchGeo, woodMat);
      logBench.position.y = 0.22;
      logGroup.add(logBench);
      this.geometries.push(logBenchGeo);

      // Obróć w stronę ogniska
      const rotY = Math.atan2(-lx, -lz);
      logGroup.rotation.y = rotY;

      // Zapisz pozycję świata do logSeats
      const worldPos = new THREE.Vector3(originX + lx, originY, originZ + lz);
      this.logSeats.push({
        id: seatId,
        position: worldPos,
        rotationY: rotY + Math.PI,
      });

      // Zarejestruj interakcję siedzenia
      logGroup.userData.interaction = {
        kind: 'seat',
        seatId,
        position: [worldPos.x, worldPos.y, worldPos.z],
        rotationY: rotY + Math.PI,
      };
      enableInteractionLayer(logGroup);

      this.root.add(logGroup);
    });
  }

  /**
   * Płynna animacja migotania płomieni i pulsującego światła.
   */
  public update(dt: number): void {
    this.timeAccumulator += dt;
    const t = this.timeAccumulator;

    // Organiczne migotanie światła oparte na sumie fal harmonicznych
    const flicker =
      Math.sin(t * 8.3) * 0.15 +
      Math.sin(t * 14.7) * 0.1 +
      Math.sin(t * 22.1) * 0.05 +
      (Math.random() - 0.5) * 0.06;

    this.light.intensity = Math.max(0.5, this.baseLightIntensity * (1 + flicker));

    // Animacja pulsowania meshy płomieni
    const flameScaleY = 1.0 + Math.sin(t * 10.5) * 0.18 + Math.cos(t * 17.2) * 0.1;
    const flameScaleXZ = 1.0 + Math.sin(t * 12.0) * 0.12;
    this.fireMesh.scale.set(flameScaleXZ, flameScaleY, flameScaleXZ);
    this.fireMesh.rotation.y = t * 1.5;

    const emberScale = 1.0 + Math.sin(t * 15.0) * 0.15;
    this.emberMesh.scale.set(emberScale, flameScaleY * 0.95, emberScale);
  }

  public setLightEnabled(enabled: boolean): void {
    this.light.visible = enabled;
  }

  public get position(): THREE.Vector3 {
    return this.root.position;
  }

  public dispose(): void {
    this.root.removeFromParent();
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.geometries = [];
    this.materials = [];
  }
}
