import * as THREE from 'three';

const INTERACTION_DISTANCE = 3.4;
const NPC_INTERACTION_DISTANCE = 4.5;
const MINIMUM_FACING_DOT = 0.35;

export class InteractionManager {
  private raycaster = new THREE.Raycaster();
  private target: THREE.Object3D | null = null;
  constructor(
    private readonly camera: THREE.Camera,
    private readonly roots: () => THREE.Object3D[],
  ) {}
  /** Wykonuje raycast ze środka ekranu i aktualizuje najbliższy cel interakcji. */
  update() {
    this.raycaster.setFromCamera(new THREE.Vector2(), this.camera);
    let next: THREE.Object3D | null = null;
    for (const hit of this.raycaster.intersectObjects(this.roots(), true)) {
      const root = this.findRoot(hit.object);
      if (!root) continue;
      if (!this.facesCamera(root)) continue;
      const distance =
        root.userData.interaction.kind === 'npc' ? NPC_INTERACTION_DISTANCE : INTERACTION_DISTANCE;
      if (hit.distance <= distance) {
        next = root;
        break;
      }
    }
    if (next !== this.target) {
      if (this.target) this.highlight(this.target, false);
      this.target = next;
      if (this.target) this.highlight(this.target, true);
    }
    return this.target?.userData.interaction || null;
  }
  /** Zwraca dane bieżącej interakcji bez wykonywania nowego raycastu. */
  get current() {
    return this.target?.userData.interaction || null;
  }
  /** Wspina się po rodzicach mesha do obiektu posiadającego dane interakcji. */
  private findRoot(object: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current && !current.userData.interaction) current = current.parent;
    return current;
  }
  /** Odrzuca kierunkową interakcję oglądaną od tyłu, np. przez ścianę toi-toia. */
  private facesCamera(root: THREE.Object3D) {
    const facing = root.userData.interactionFacing as number[] | undefined;
    if (!facing) return true;
    const normal = new THREE.Vector3()
      .fromArray(facing)
      .applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    const target = root.getWorldPosition(new THREE.Vector3());
    const camera = this.camera.getWorldPosition(new THREE.Vector3());
    return normal.dot(camera.sub(target).normalize()) >= MINIMUM_FACING_DOT;
  }
  /** Włącza lub wyłącza delikatne podświetlenie materiałów celu. */
  private highlight(root: THREE.Object3D, on: boolean) {
    root.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissive.setHex(on ? 0x233c16 : 0);
        material.emissiveIntensity = on ? 0.25 : 0;
      }
    });
  }
  /** Usuwa zaznaczenie i czyści aktualny cel. */
  clear() {
    if (this.target) this.highlight(this.target, false);
    this.target = null;
  }
  /** Czyści stan menedżera przed usunięciem sceny. */
  dispose() {
    this.clear();
  }
}
