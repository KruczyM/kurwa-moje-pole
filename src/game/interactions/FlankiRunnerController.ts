import * as THREE from 'three';

export type RunnerState =
  'idle_at_base' | 'running_to_can' | 'righting_can' | 'running_back' | 'crossed_line';

export interface FlankiRunnerConfig {
  id: string;
  name: string;
  team: 'A' | 'B';
  baseLineZ: number; // e.g. -20 for team A, -32 for team B
  basePosition: THREE.Vector3;
  runSpeed?: number; // m/s, default 5.5
  rightingDuration?: number; // seconds, default 0.35
  mesh?: THREE.Object3D;
  onCanRighted?: () => void;
  onStopCalled?: (runnerName: string) => void;
}

export class FlankiRunnerController {
  public id: string;
  public name: string;
  public readonly team: 'A' | 'B';
  public readonly baseLineZ: number;
  public readonly basePosition: THREE.Vector3;
  public readonly currentPosition = new THREE.Vector3();

  private state: RunnerState = 'idle_at_base';
  private runSpeed: number;
  private rightingDuration: number;
  private rightingTimer = 0;
  private targetCanPos = new THREE.Vector3();

  public mesh?: THREE.Object3D;
  public onCanRighted?: () => void;
  public onStopCalled?: (runnerName: string) => void;

  constructor(config: FlankiRunnerConfig) {
    this.id = config.id;
    this.name = config.name;
    this.team = config.team;
    this.baseLineZ = config.baseLineZ;
    this.basePosition = config.basePosition.clone();
    this.currentPosition.copy(this.basePosition);
    this.runSpeed = config.runSpeed ?? 5.5;
    this.rightingDuration = config.rightingDuration ?? 0.35;
    this.mesh = config.mesh;
    this.onCanRighted = config.onCanRighted;
    this.onStopCalled = config.onStopCalled;

    this.syncMesh();
  }

  public getState(): RunnerState {
    return this.state;
  }

  public isRunning(): boolean {
    return this.state === 'running_to_can' || this.state === 'righting_can' || this.state === 'running_back';
  }

  public startRun(canPosition: THREE.Vector3): void {
    this.targetCanPos.copy(canPosition);
    this.state = 'running_to_can';
    this.rightingTimer = 0;
  }

  public update(delta: number): void {
    if (delta <= 0) return;

    if (this.state === 'running_to_can') {
      const dir = new THREE.Vector3().subVectors(this.targetCanPos, this.currentPosition);
      dir.y = 0; // horizontal move
      const dist = dir.length();
      const step = this.runSpeed * delta;

      if (dist <= step || dist < 0.25) {
        this.currentPosition.x = this.targetCanPos.x;
        this.currentPosition.z = this.targetCanPos.z;
        this.state = 'righting_can';
        this.rightingTimer = 0;
      } else {
        dir.normalize();
        this.currentPosition.addScaledVector(dir, step);
        this.rotateMeshTowards(this.targetCanPos);
      }
      this.syncMesh();
      return;
    }

    if (this.state === 'righting_can') {
      this.rightingTimer += delta;
      if (this.rightingTimer >= this.rightingDuration) {
        this.onCanRighted?.();
        this.state = 'running_back';
      }
      return;
    }

    if (this.state === 'running_back') {
      const dir = new THREE.Vector3().subVectors(this.basePosition, this.currentPosition);
      dir.y = 0;
      const dist = dir.length();
      const step = this.runSpeed * delta;

      // Check if runner crossed the team line
      const crossed =
        this.team === 'A'
          ? this.currentPosition.z >= this.baseLineZ
          : this.currentPosition.z <= this.baseLineZ;

      if (crossed || dist <= step) {
        this.currentPosition.copy(this.basePosition);
        this.state = 'crossed_line';
        this.syncMesh();
        this.onStopCalled?.(this.name);
      } else {
        dir.normalize();
        this.currentPosition.addScaledVector(dir, step);
        this.rotateMeshTowards(this.basePosition);
        this.syncMesh();
      }
    }
  }

  private rotateMeshTowards(target: THREE.Vector3): void {
    if (!this.mesh) return;
    const dx = target.x - this.currentPosition.x;
    const dz = target.z - this.currentPosition.z;
    if (Math.hypot(dx, dz) > 0.05) {
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  private syncMesh(): void {
    if (!this.mesh) return;
    this.mesh.position.copy(this.currentPosition);
  }

  public reset(): void {
    this.state = 'idle_at_base';
    this.currentPosition.copy(this.basePosition);
    this.rightingTimer = 0;
    this.syncMesh();
  }

  setNetworkState(state: RunnerState) {
    this.state = state;
  }

  updateHumanPosition(position: THREE.Vector3): void {
    if (!this.isRunning()) return;
    this.currentPosition.copy(position);
    if (
      this.state === 'running_back' &&
      (this.team === 'A' ? position.z >= this.baseLineZ : position.z <= this.baseLineZ)
    ) {
      this.state = 'crossed_line';
      this.onStopCalled?.(this.name);
    }
  }

  pickUpCan(): boolean {
    if (
      this.state !== 'running_to_can' ||
      Math.hypot(this.currentPosition.x - this.targetCanPos.x, this.currentPosition.z - this.targetCanPos.z) >
        1.4
    )
      return false;
    this.onCanRighted?.();
    this.state = 'running_back';
    return true;
  }
}
