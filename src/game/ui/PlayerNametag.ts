import * as THREE from 'three';

export interface PlayerNametagOptions {
  nickname: string;
  characterName: string;
  maxDistance?: number;
  fadeStartDistance?: number;
  heightOffset?: number;
}

export interface NametagProjection {
  visible: boolean;
  x: number;
  y: number;
  opacity: number;
  distance: number;
}

export function projectNametagPosition(
  worldPosition: THREE.Vector3,
  camera: THREE.Camera,
  viewport: { width: number; height: number },
  options: {
    heightOffset?: number;
    maxDistance?: number;
    fadeStartDistance?: number;
  } = {},
): NametagProjection {
  const heightOffset = options.heightOffset ?? 2.15;
  const maxDistance = options.maxDistance ?? 25;
  const fadeStartDistance = options.fadeStartDistance ?? 18;

  const target = worldPosition.clone();
  target.y += heightOffset;

  const distance = camera.position.distanceTo(target);
  if (distance > maxDistance) {
    return { visible: false, x: 0, y: 0, opacity: 0, distance };
  }

  target.project(camera);

  // Za kamerą (z > 1.0 w NDC):
  if (target.z > 1.0) {
    return { visible: false, x: 0, y: 0, opacity: 0, distance };
  }

  const x = (target.x * 0.5 + 0.5) * viewport.width;
  const y = (-(target.y * 0.5) + 0.5) * viewport.height;

  let opacity = 1.0;
  if (distance > fadeStartDistance) {
    const t = (distance - fadeStartDistance) / (maxDistance - fadeStartDistance);
    opacity = Math.max(0, 1.0 - t);
  }

  return { visible: true, x, y, opacity, distance };
}

export class PlayerNametag {
  readonly element?: HTMLDivElement;
  private nickname: string;
  private characterName: string;
  private readonly maxDistance: number;
  private readonly fadeStartDistance: number;
  private readonly heightOffset: number;

  constructor(options: PlayerNametagOptions, container?: HTMLElement) {
    this.nickname = options.nickname;
    this.characterName = options.characterName;
    this.maxDistance = options.maxDistance ?? 25;
    this.fadeStartDistance = options.fadeStartDistance ?? 18;
    this.heightOffset = options.heightOffset ?? 2.15;

    if (typeof document !== 'undefined') {
      this.element = document.createElement('div');
      this.element.className = 'player-nametag';
      this.renderContent();

      const parent = container ?? document.body;
      parent?.appendChild(this.element);
    }
  }

  getNickname(): string {
    return this.nickname;
  }

  getCharacterName(): string {
    return this.characterName;
  }

  setNickname(nickname: string): void {
    if (this.nickname === nickname) return;
    this.nickname = nickname;
    this.renderContent();
  }

  private renderContent(): void {
    if (!this.element) return;
    this.element.textContent = this.nickname;
    this.element.title = `${this.nickname} (${this.characterName})`;
  }

  update(worldPosition: THREE.Vector3, camera: THREE.Camera): void {
    if (!this.element) return;

    const viewport = {
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    };

    const projection = projectNametagPosition(worldPosition, camera, viewport, {
      heightOffset: this.heightOffset,
      maxDistance: this.maxDistance,
      fadeStartDistance: this.fadeStartDistance,
    });

    if (!projection.visible) {
      this.element.style.display = 'none';
      return;
    }

    this.element.style.display = 'block';
    this.element.style.left = `${projection.x}px`;
    this.element.style.top = `${projection.y}px`;
    this.element.style.opacity = projection.opacity.toFixed(2);
  }

  dispose(): void {
    this.element?.remove();
  }
}
