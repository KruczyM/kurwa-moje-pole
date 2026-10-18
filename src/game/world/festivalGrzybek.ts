import * as THREE from 'three';

export const GRZYBEK_SITE = {
  id: 'grzybek',
  label: 'Grzybek Wodny — Chłodzenie',
  x: 160,
  y: 0,
  z: -8,
  waterHeight: 4.8,
  coolingRadius: 5.5,
  poleRadius: 0.35,
} as const;

export function isInGrzybekCoolingZone(x: number, z: number): boolean {
  const dx = x - GRZYBEK_SITE.x;
  const dz = z - GRZYBEK_SITE.z;
  return dx * dx + dz * dz <= GRZYBEK_SITE.coolingRadius * GRZYBEK_SITE.coolingRadius;
}

export function distanceToGrzybek(x: number, z: number): number {
  const dx = x - GRZYBEK_SITE.x;
  const dz = z - GRZYBEK_SITE.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function createDropTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(235, 245, 255, 0.95)');
    gradient.addColorStop(0.3, 'rgba(180, 220, 255, 0.6)');
    gradient.addColorStop(0.7, 'rgba(140, 195, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(120, 180, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export class GrzybekWaterParticles {
  public readonly points: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly count: number;

  constructor(count = 600) {
    this.count = count;
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.resetParticle(i, Math.random());
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const texture = typeof document !== 'undefined' ? createDropTexture() : new THREE.Texture();
    this.material = new THREE.PointsMaterial({
      size: 0.25,
      map: texture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xcfe8ff,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.position.set(GRZYBEK_SITE.x, GRZYBEK_SITE.y, GRZYBEK_SITE.z);
    this.points.frustumCulled = false;
  }

  private resetParticle(index: number, initialProgress = 0): void {
    const i3 = index * 3;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.8 + Math.random() * 1.4;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    const vy = 0.5 + Math.random() * 0.8;

    const t = initialProgress * 1.5;
    const x = vx * t;
    const z = vz * t;
    const y = Math.max(0, GRZYBEK_SITE.waterHeight + vy * t - 0.5 * 9.81 * t * t);

    this.positions[i3] = x;
    this.positions[i3 + 1] = y;
    this.positions[i3 + 2] = z;

    this.velocities[i3] = vx;
    this.velocities[i3 + 1] = vy - 9.81 * t;
    this.velocities[i3 + 2] = vz;
  }

  public update(delta: number): void {
    const dt = Math.min(delta, 0.1);
    const pos = this.positions;
    const vel = this.velocities;
    const gravity = -9.81;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      vel[i3 + 1] += gravity * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;

      if (pos[i3 + 1] <= 0) {
        this.resetParticle(i, 0);
      }
    }

    const attr = this.geometry.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    if (this.material.map) this.material.map.dispose();
    this.material.dispose();
  }
}
