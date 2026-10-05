import * as THREE from 'three';

const INTERACTION_DISTANCE = 3.4;
const NPC_INTERACTION_DISTANCE = 4.5;
const MINIMUM_FACING_DOT = 0.35;
export const INTERACTION_LAYER = 2;

/** Dodaje warstwę raycastu interakcji do wskazanego drzewa bez wyłączania renderowania. */
export function enableInteractionLayer(root: THREE.Object3D) {
  root.traverse((object) => object.layers.enable(INTERACTION_LAYER));
}

export class InteractionManager {
  private static readonly _screenCenter = new THREE.Vector2(0, 0);
  private static readonly _faceNormal = new THREE.Vector3();
  private static readonly _faceQuat = new THREE.Quaternion();
  private static readonly _faceTarget = new THREE.Vector3();
  private static readonly _faceCam = new THREE.Vector3();

  private raycaster = new THREE.Raycaster();
  private target: THREE.Object3D | null = null;
  private readonly hits: THREE.Intersection[] = [];

  constructor(
    private readonly camera: THREE.Camera,
    private readonly roots: () => THREE.Object3D[],
  ) {
    this.raycaster.layers.set(INTERACTION_LAYER);
  }
  /** Wykonuje raycast ze środka ekranu i aktualizuje najbliższy cel interakcji. */
  update() {
    this.raycaster.setFromCamera(InteractionManager._screenCenter, this.camera);
    let next: THREE.Object3D | null = null;
    this.hits.length = 0;
    this.raycaster.intersectObjects(this.roots(), true, this.hits);
    for (const hit of this.hits) {
      const root = this.findRoot(hit.object);
      if (!root) continue;
      if (!root.visible) continue;
      if (!this.facesCamera(root)) continue;
      const distance =
        root.userData.interaction.kind === 'npc' ? NPC_INTERACTION_DISTANCE : INTERACTION_DISTANCE;
      if (hit.distance <= distance) {
        next = root;
        break;
      }
    }
    // Entry zones must also work while standing inside their invisible hitbox.
    // Only explicitly marked attractions opt in; ordinary items still require aim.
    if (!next) {
      const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
      let nearest = Infinity;
      for (const root of this.roots()) {
        const radius = root.userData.entryRadius as number | undefined;
        if (!radius || !root.visible || !root.userData.interaction) continue;
        const position = root.getWorldPosition(new THREE.Vector3());
        const distance = Math.hypot(position.x - cameraPosition.x, position.z - cameraPosition.z);
        if (distance <= radius && Math.abs(cameraPosition.y - position.y) <= 3 && distance < nearest) {
          next = root;
          nearest = distance;
        }
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
    const normal = InteractionManager._faceNormal
      .fromArray(facing)
      .applyQuaternion(root.getWorldQuaternion(InteractionManager._faceQuat));
    const target = root.getWorldPosition(InteractionManager._faceTarget);
    const camera = this.camera.getWorldPosition(InteractionManager._faceCam);
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
    this.hits.length = 0;
  }
  /** Czyści stan menedżera przed usunięciem sceny. */
  dispose() {
    this.clear();
  }
}
