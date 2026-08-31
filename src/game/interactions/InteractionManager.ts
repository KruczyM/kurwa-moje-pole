import * as THREE from 'three';
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
    const hit = this.raycaster.intersectObjects(this.roots(), true).find((item) => item.distance < 3.4);
    const next = hit ? this.findRoot(hit.object) : null;
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
