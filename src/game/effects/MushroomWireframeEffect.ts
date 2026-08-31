import * as THREE from 'three';

type MeshMaterial = THREE.Material | THREE.Material[];

/** Short, irregular-looking windows; intentionally not a continuous wireframe. */
export function mushroomWireframePulseAt(time: number) {
  const phase = ((time % 4.8) + 4.8) % 4.8;
  return (
    (phase >= 0.55 && phase < 0.78) || (phase >= 2.16 && phase < 2.48) || (phase >= 3.92 && phase < 4.08)
  );
}

/** Sprawdza, czy obiekt lub jego rodzic jest wyłączony z wizji wireframe. */
function isExcluded(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.excludeMushroomWireframe) return true;
    current = current.parent;
  }
  return object.name.startsWith('InteractionHitbox_');
}

export class MushroomWireframeEffect {
  private elapsed = 0;
  private wasActive = false;
  private visible = false;
  private originals = new Map<THREE.Mesh, MeshMaterial>();
  private wireMaterials = new Set<THREE.Material>();

  constructor(private scene: THREE.Scene) {}

  /** Steruje krótkimi impulsami wireframe zgodnie z fazą efektu i dostępnością. */
  update(active: boolean, dt: number, intensity: number, reduceMotion: boolean) {
    if (active && !this.wasActive) this.elapsed = 0;
    this.wasActive = active;
    if (!active || reduceMotion || intensity < 0.15) {
      this.setVisible(false);
      return;
    }
    this.elapsed += dt;
    this.setVisible(mushroomWireframePulseAt(this.elapsed));
  }

  /** Przełącza materiały tylko wtedy, gdy widoczność impulsu faktycznie się zmieniła. */
  private setVisible(visible: boolean) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (visible) this.apply();
    else this.restore();
  }

  /** Zamienia materiały sceny na addytywne, widoczne przez obiekty siatki. */
  private apply() {
    let colorIndex = 0;
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || isExcluded(mesh) || this.originals.has(mesh)) return;
      const originalMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (originalMaterials.every((material) => material.transparent && material.opacity <= 0.01)) return;
      this.originals.set(mesh, mesh.material);
      const replacements = originalMaterials.map(() => {
        const color = new THREE.Color().setHSL((0.43 + colorIndex++ * 0.137) % 1, 0.95, 0.65);
        const material = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.72,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
        this.wireMaterials.add(material);
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];
    });
  }

  /** Przywraca dokładne materiały źródłowe i zwalnia tymczasowe wireframe. */
  private restore() {
    this.originals.forEach((material, mesh) => {
      mesh.material = material;
    });
    this.originals.clear();
    this.wireMaterials.forEach((material) => material.dispose());
    this.wireMaterials.clear();
  }

  /** Kończy efekt i gwarantuje przywrócenie sceny. */
  dispose() {
    this.visible = false;
    this.wasActive = false;
    this.restore();
  }
}
