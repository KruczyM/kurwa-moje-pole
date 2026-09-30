import * as THREE from 'three';

export type StageEffectsConfig = {
  stageX: number;
  stageY: number;
  stageZ: number;
  stageRotationY: number;
};

export const DEFAULT_STAGE_CONFIG: StageEffectsConfig = {
  stageX: 216,
  stageY: 0,
  stageZ: 18,
  stageRotationY: -Math.PI / 2,
};

export class FestivalStageEffects {
  public readonly group = new THREE.Group();
  private spotCones: THREE.Mesh[] = [];
  private laserBeams: THREE.Mesh[] = [];
  private spotOrigins: THREE.Vector3[] = [];
  private spotBaseAngles: number[] = [];
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private elapsedTime = 0;

  constructor(config: StageEffectsConfig = DEFAULT_STAGE_CONFIG) {
    this.group.name = 'Festival_Stage_Effects';
    this.initMovingSpots(config);
    this.initSkyLasers(config);
  }

  private initMovingSpots(config: StageEffectsConfig): void {
    // 6 moving head spot beams suspended from front stage roof truss
    const numSpots = 6;
    const trussY = config.stageY + 15.5;

    const colors = [
      0x06b6d4, // Cyan
      0xf43f5e, // Rose
      0xeab308, // Gold
      0x8b5cf6, // Violet
      0x10b981, // Emerald
      0xf97316, // Orange
    ];

    const coneGeom = new THREE.ConeGeometry(3.5, 38.0, 16, 1, true);
    coneGeom.translate(0, -19.0, 0); // Origin at apex
    coneGeom.rotateX(Math.PI / 2); // Point along +Z initially
    this.geometries.push(coneGeom);

    for (let i = 0; i < numSpots; i++) {
      const t = (i / (numSpots - 1)) - 0.5; // -0.5 to 0.5
      // Along stage width (perpendicular to facing): stage width is Z axis when facing -X
      const spotZ = config.stageZ + t * 24.0;
      const spotX = config.stageX - 2.0;
      const origin = new THREE.Vector3(spotX, trussY, spotZ);
      this.spotOrigins.push(origin);
      this.spotBaseAngles.push(t * 0.6);

      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.materials.push(mat);

      const cone = new THREE.Mesh(coneGeom, mat);
      cone.position.copy(origin);
      this.group.add(cone);
      this.spotCones.push(cone);
    }
  }

  private initSkyLasers(config: StageEffectsConfig): void {
    // 4 intense laser beams shooting from stage roof into the night sky
    const laserColors = [0x22c55e, 0x06b6d4, 0x06b6d4, 0x22c55e]; // Green & Cyan
    const laserGeom = new THREE.CylinderGeometry(0.06, 0.25, 160.0, 8, 1, true);
    laserGeom.translate(0, 80.0, 0); // Origin at base
    this.geometries.push(laserGeom);

    const laserOffsets = [-12.0, -4.0, 4.0, 12.0];
    const roofY = config.stageY + 19.5;

    for (let i = 0; i < 4; i++) {
      const lz = config.stageZ + laserOffsets[i];
      const lx = config.stageX;

      const mat = new THREE.MeshBasicMaterial({
        color: laserColors[i],
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.materials.push(mat);

      const laser = new THREE.Mesh(laserGeom, mat);
      laser.position.set(lx, roofY, lz);
      // Fan outward into sky
      laser.rotation.z = Math.PI / 2 + 0.15; // Point mainly up, slightly forward
      laser.rotation.x = laserOffsets[i] * 0.02; // Fan outward
      this.group.add(laser);
      this.laserBeams.push(laser);
    }
  }

  public update(delta: number): void {
    this.elapsedTime += delta;
    const t = this.elapsedTime;

    // Animate moving spot beams with sinusoidal sweep over audience
    for (let i = 0; i < this.spotCones.length; i++) {
      const cone = this.spotCones[i];
      const origin = this.spotOrigins[i];
      const baseAngle = this.spotBaseAngles[i];

      // Pan (left-right sweep) and Tilt (up-down sweep)
      const pan = baseAngle + 0.45 * Math.sin(t * 1.2 + i * 0.8);
      const tilt = -0.55 + 0.25 * Math.cos(t * 0.9 + i * 0.5);

      // Target position in front of stage (towards -X)
      const dist = 32.0;
      const targetX = origin.x - dist * Math.cos(tilt) * Math.cos(pan);
      const targetY = Math.max(0.2, origin.y + dist * Math.sin(tilt));
      const targetZ = origin.z + dist * Math.sin(pan);

      cone.lookAt(targetX, targetY, targetZ);
    }

    // Subtle breathing/scan on sky lasers
    for (let i = 0; i < this.laserBeams.length; i++) {
      const laser = this.laserBeams[i];
      const sweep = 0.08 * Math.sin(t * 1.5 + i * 1.1);
      laser.rotation.y = sweep;
    }
  }

  public dispose(): void {
    for (const geom of this.geometries) geom.dispose();
    for (const mat of this.materials) mat.dispose();
    this.geometries = [];
    this.materials = [];
    this.spotCones = [];
    this.laserBeams = [];
    this.spotOrigins = [];
  }
}
