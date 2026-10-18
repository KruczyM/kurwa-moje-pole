import * as THREE from 'three';
import { circleTouchesFootprint } from './tentFootprint';

export type WorldCollider =
  | { x: number; z: number; r: number }
  | { box: THREE.Box3; enabled?: () => boolean; points?: { x: number; z: number }[] };

/**
 * Siatka podziału przestrzennego (Spatial Hash Grid) dla kolizji obiektów świata gry.
 * Zapewnia czas sprawdzania kolizji O(1) zamiast O(N), drastycznie redukując obciążenie CPU
 * przy poruszaniu się gracza i dziesiątek NPC.
 */
export class ColliderSpatialGrid {
  private readonly cellSize: number;
  private readonly cells = new Map<string, WorldCollider[]>();
  private readonly allColliders: WorldCollider[] = [];

  constructor(cellSize = 16) {
    this.cellSize = cellSize;
  }

  get colliders(): readonly WorldCollider[] {
    return this.allColliders;
  }

  add(collider: WorldCollider): void {
    this.allColliders.push(collider);
    const bounds = this.getColliderBounds(collider);
    const minCellX = Math.floor(bounds.minX / this.cellSize);
    const maxCellX = Math.floor(bounds.maxX / this.cellSize);
    const minCellZ = Math.floor(bounds.minZ / this.cellSize);
    const maxCellZ = Math.floor(bounds.maxZ / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = `${cx},${cz}`;
        let list = this.cells.get(key);
        if (!list) {
          list = [];
          this.cells.set(key, list);
        }
        list.push(collider);
      }
    }
  }

  hasCollision(x: number, z: number, radius: number): boolean {
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellZ = Math.floor((z - radius) / this.cellSize);
    const maxCellZ = Math.floor((z + radius) / this.cellSize);

    // Najczęstszy przypadek: zapytanie w całości mieści się w pojedynczej komórce siatki
    if (minCellX === maxCellX && minCellZ === maxCellZ) {
      const cell = this.cells.get(`${minCellX},${minCellZ}`);
      if (!cell) return false;
      return this.checkColliders(cell, x, z, radius);
    }

    // Przypadek graniczny: zapytanie przecina krawędź między komórkami
    const checked = new Set<WorldCollider>();
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cell = this.cells.get(`${cx},${cz}`);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const collider = cell[i];
          if (checked.has(collider)) continue;
          checked.add(collider);
          if (this.collidesWith(collider, x, z, radius)) return true;
        }
      }
    }
    return false;
  }

  private checkColliders(colliders: WorldCollider[], x: number, z: number, radius: number): boolean {
    for (let i = 0; i < colliders.length; i++) {
      if (this.collidesWith(colliders[i], x, z, radius)) return true;
    }
    return false;
  }

  private collidesWith(collider: WorldCollider, x: number, z: number, radius: number): boolean {
    if ('enabled' in collider && collider.enabled && !collider.enabled()) return false;
    if ('box' in collider) {
      if (collider.points) return circleTouchesFootprint(x, z, radius, collider.points);
      return (
        x > collider.box.min.x - radius &&
        x < collider.box.max.x + radius &&
        z > collider.box.min.z - radius &&
        z < collider.box.max.z + radius
      );
    }
    return Math.hypot(x - collider.x, z - collider.z) < collider.r + radius;
  }

  private getColliderBounds(collider: WorldCollider): {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    if ('box' in collider) {
      return {
        minX: collider.box.min.x,
        maxX: collider.box.max.x,
        minZ: collider.box.min.z,
        maxZ: collider.box.max.z,
      };
    }
    return {
      minX: collider.x - collider.r,
      maxX: collider.x + collider.r,
      minZ: collider.z - collider.r,
      maxZ: collider.z + collider.r,
    };
  }

  clear(): void {
    this.cells.clear();
    this.allColliders.length = 0;
  }
}
