import * as THREE from 'three';

type MeshMaterial = THREE.Material | THREE.Material[];

/** Sprawdza, czy obiekt lub jego przodek jest wykluczony z cyfrowego wireframe Matrix. */
function isExcluded(object: THREE.Object3D): boolean {
  if (object.userData.fogProxy) return true;
  let current: THREE.Object3D | null = object;
  while (current) {
    if (
      !current.visible ||
      current.userData.excludeMatrixWireframe ||
      current.userData.excludeMushroomWireframe
    ) {
      return true;
    }
    current = current.parent;
  }
  return object.name.startsWith('InteractionHitbox_');
}

/**
 * Zmienia materiały obiektów w scenie na zielony cyfrowy wireframe w szczycie fazy Matrix.
 * Gwarantuje pełne przywrócenie oryginalnych materiałów po zakończeniu fazy lub zniszczeniu.
 */
export class MatrixWireframeEffect {
  private visible = false;
  private originals = new Map<THREE.Mesh, MeshMaterial>();
  private wireMaterials = new Set<THREE.Material>();
  private lastAlpha = 0;

  constructor(private scene: THREE.Scene) {}

  get isWireframeVisible(): boolean {
    return this.visible;
  }

  /**
   * Aktualizuje stan siatki geometrycznej w oparciu o poziom alfa fazy Matrix.
   * @param active Czy faza Matrix jest aktywna i powinna generować wireframe.
   * @param alpha Poziom widoczności od 0.0 do 1.0.
   * @param reduceMotion Czy ruch/błyski są ograniczone.
   */
  update(active: boolean, alpha: number, reduceMotion: boolean) {
    // Siatka pojawia się tylko przy wyższych poziomach intensywności Matrix i gdy nie włączono reduceMotion
    const shouldBeVisible = active && !reduceMotion && alpha >= 0.35;
    this.lastAlpha = alpha;

    if (shouldBeVisible !== this.visible) {
      this.visible = shouldBeVisible;
      if (this.visible) {
        this.apply();
      } else {
        this.restore();
      }
    } else if (this.visible && Math.abs(alpha - this.lastAlpha) > 0.05) {
      // Dynamiczna aktualizacja przezroczystości wireframe
      const targetOpacity = Math.min(0.85, Math.max(0.2, alpha * 0.75));
      this.wireMaterials.forEach((mat) => {
        mat.opacity = targetOpacity;
      });
    }
  }

  private apply() {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || isExcluded(mesh) || this.originals.has(mesh)) return;

      const originalMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (originalMaterials.every((m) => m.transparent && m.opacity <= 0.01)) return;

      this.originals.set(mesh, mesh.material);

      const targetOpacity = Math.min(0.85, Math.max(0.2, this.lastAlpha * 0.75));
      const replacements = originalMaterials.map(() => {
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x00ff77),
          wireframe: true,
          transparent: true,
          opacity: targetOpacity,
          depthTest: true,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
        this.wireMaterials.add(material);
        return material;
      });

      mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];
    });
  }

  releaseSubtree(root: THREE.Object3D) {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const original = this.originals.get(mesh);
      if (!original) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (this.wireMaterials.delete(material)) material.dispose();
      }
      mesh.material = original;
      this.originals.delete(mesh);
    });
  }

  private restore() {
    this.originals.forEach((material, mesh) => {
      mesh.material = material;
    });
    this.originals.clear();

    this.wireMaterials.forEach((material) => material.dispose());
    this.wireMaterials.clear();
  }

  /** Czyści wszystkie nałożone materiały i przywraca stan bazowy sceny. */
  dispose() {
    this.visible = false;
    this.restore();
  }
}
