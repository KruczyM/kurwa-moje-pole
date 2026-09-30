import * as THREE from 'three';
import { type InspectableItemId } from './itemConfig';
import { itemPresentation } from './itemPresentationConfig';
import { centerInspectModel, inspectCameraDistance } from './inspectPresentation';
import { InspectControls } from './InspectControls';
import { cloneDisposableModel, disposeObjectTree } from '../lifecycle/disposeThree';
import { configureColorPipeline } from '../rendering/colorPipeline';

export interface ItemInspectControllerOptions {
  canvas?: HTMLCanvasElement | null;
  getPropModel: (id: string) => THREE.Object3D | undefined;
}

/**
 * Kontroler podglądu 3D inspekcji przedmiotów.
 * Odpowiada za dedykowaną scenę, kamerę, oświetlenie, obrót i dopasowanie skali oglądanego obiektu.
 */
export class ItemInspectController {
  private canvas: HTMLCanvasElement | null = null;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private model?: THREE.Object3D;
  private pivot?: THREE.Group;
  private controls?: InspectControls;
  private cameraBaseDistance = 1;
  private activeId?: string;
  private readonly getPropModel: (id: string) => THREE.Object3D | undefined;

  constructor(options: ItemInspectControllerOptions) {
    this.canvas =
      options.canvas ??
      (typeof document !== 'undefined'
        ? document.querySelector<HTMLCanvasElement>('#inspect-canvas')
        : null);
    this.getPropModel = options.getPropModel;
  }

  get activeItemId(): string | undefined {
    return this.activeId;
  }

  get isOpen(): boolean {
    return Boolean(this.activeId);
  }

  private initRenderer(): void {
    if (this.renderer || !this.canvas) return;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
      });
      this.renderer.setPixelRatio(
        Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, 2),
      );
      configureColorPipeline(this.renderer, 'itemInspect');
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x09070f);
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
      this.scene.add(new THREE.HemisphereLight(0xbdd8ff, 0x241630, 2.2));
      const light = new THREE.DirectionalLight(0xffffff, 2.5);
      light.position.set(2, 3, 3);
      this.scene.add(light);
      this.controls = new InspectControls(this.canvas);
    } catch {
      // Ignoruj błędy inicjalizacji w środowiskach bez WebGL (np. unit testy w Node)
    }
  }

  show(id: string): void {
    this.clearModel();
    this.initRenderer();
    this.controls?.reset();

    const source = this.getPropModel(id);
    this.model = source
      ? cloneDisposableModel(source)
      : new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.5),
          new THREE.MeshStandardMaterial({ color: 0xa8e04a }),
        );
    const presentation = itemPresentation[id as InspectableItemId];
    if (presentation) {
      this.model.rotation.set(...presentation.inspectRotation);
      const box = new THREE.Box3().setFromObject(this.model);
      const dimensions = box.getSize(new THREE.Vector3());
      this.model.scale.setScalar(
        presentation.inspectSize / Math.max(0.01, dimensions.x, dimensions.y, dimensions.z),
      );
      const centered = centerInspectModel(this.model, presentation.inspectOffsetY);
      this.pivot = centered.pivot;
    } else {
      this.pivot = new THREE.Group();
      this.pivot.add(this.model);
    }

    this.scene?.add(this.pivot);
    this.activeId = id;
    this.resize();
  }

  resize(): void {
    if (!this.renderer || !this.camera || !this.pivot || !this.canvas) return;
    const width = Math.max(1, Math.round(this.canvas.clientWidth || 360));
    const height = Math.max(1, Math.round(this.canvas.clientHeight || 280));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.pivot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.pivot);
    this.cameraBaseDistance = inspectCameraDistance(
      bounds,
      this.camera.aspect,
      this.camera.fov,
    );
    this.camera.position.set(0, 0, this.cameraBaseDistance);
    this.camera.lookAt(0, 0, 0);
  }

  update(dt: number): void {
    if (!this.activeId || !this.renderer || !this.scene || !this.camera) return;
    this.controls?.update(dt);
    if (this.pivot && this.controls) {
      this.pivot.rotation.set(this.controls.pitch, this.controls.yaw, 0);
      this.camera.position.z = this.cameraBaseDistance * this.controls.distanceScale;
    }
    this.renderer.render(this.scene, this.camera);
  }

  clearModel(): void {
    if (this.pivot) {
      this.scene?.remove(this.pivot);
      disposeObjectTree(this.pivot);
    }
    this.model = undefined;
    this.pivot = undefined;
  }

  close(): void {
    this.activeId = undefined;
    this.clearModel();
  }

  dispose(): void {
    this.close();
    this.controls?.dispose();
    if (this.scene) disposeObjectTree(this.scene);
    this.renderer?.dispose();
    this.renderer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.controls = undefined;
    this.cameraBaseDistance = 1;
    this.activeId = undefined;
  }
}
