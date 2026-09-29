import * as THREE from 'three';

export interface ToiToiDoorRecord {
  id: string;
  label: string;
  isOpen: boolean;
  interactionMesh: THREE.Object3D;
  doorWing: THREE.Object3D | null;
  baseRotationY: number;
  openAngle: number;
  currentAngle: number;
  targetAngle: number;
  entryCollider?: THREE.Box3;
}

export class ToiToiDoorController {
  private doors: Map<string, ToiToiDoorRecord> = new Map();

  public registerDoor(record: {
    id: string;
    label: string;
    interactionMesh: THREE.Object3D;
    doorWing?: THREE.Object3D | null;
    baseRotationY?: number;
    openAngle?: number;
    isOpen?: boolean;
    entryCollider?: THREE.Box3;
  }): void {
    const isOpen = record.isOpen ?? false;
    const openAngle = record.openAngle ?? Math.PI * 0.52; // ~95 deg
    const baseRotationY = record.baseRotationY ?? 0;
    this.doors.set(record.id, {
      id: record.id,
      label: record.label,
      isOpen,
      interactionMesh: record.interactionMesh,
      doorWing: record.doorWing ?? null,
      baseRotationY,
      openAngle,
      currentAngle: isOpen ? openAngle : 0,
      targetAngle: isOpen ? openAngle : 0,
      entryCollider: record.entryCollider,
    });
  }

  public getDoor(id: string): ToiToiDoorRecord | undefined {
    return this.doors.get(id);
  }

  public getAllRecords(): ToiToiDoorRecord[] {
    return Array.from(this.doors.values());
  }

  public toggle(id: string): boolean {
    const door = this.doors.get(id);
    if (!door) return false;
    door.isOpen = !door.isOpen;
    door.targetAngle = door.isOpen ? door.openAngle : 0;
    return door.isOpen;
  }

  public open(id: string): void {
    const door = this.doors.get(id);
    if (!door) return;
    door.isOpen = true;
    door.targetAngle = door.openAngle;
  }

  public close(id: string): void {
    const door = this.doors.get(id);
    if (!door) return;
    door.isOpen = false;
    door.targetAngle = 0;
  }

  public update(delta: number): void {
    const speed = 6.0;
    for (const door of this.doors.values()) {
      if (Math.abs(door.currentAngle - door.targetAngle) > 0.001) {
        const step = speed * delta;
        if (door.targetAngle > door.currentAngle) {
          door.currentAngle = Math.min(door.currentAngle + step, door.targetAngle);
        } else {
          door.currentAngle = Math.max(door.currentAngle - step, door.targetAngle);
        }
        if (door.doorWing) {
          door.doorWing.rotation.y = door.baseRotationY + door.currentAngle;
        }
      }
    }
  }

  public dispose(): void {
    this.doors.clear();
  }
}
