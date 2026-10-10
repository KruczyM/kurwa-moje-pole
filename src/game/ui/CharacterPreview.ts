import * as THREE from 'three';
import { browserGraphicsProfile, savedMobileQuality } from '../rendering/graphicsProfile';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { characterAssets } from '../assets/assetManifest';
import { cloneDisposableSkinnedModel, disposeObjectTree } from '../lifecycle/disposeThree';
import { calculatePreviewLayout, previewBoundsFit } from './previewLayout';
import { applyPbrMaterialPolicy } from '../rendering/pbrMaterials';
import { configureColorPipeline } from '../rendering/colorPipeline';
import { repairSkinSeams } from '../animation/repairSkinSeams';
import { startPreviewIdle } from './previewIdle';
import { amperPreviewPose } from './amperPreviewPose';

type Cached = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
type PreviewStatus = { state: 'ready' | 'error'; message?: string };
const LOAD_TIMEOUT_MS = 15_000;

/** Transparent start-screen model layer with bounds-safe responsive framing. */
export class CharacterPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5_000);
  private current?: THREE.Group;
  private currentModel?: THREE.Object3D;
  private currentName = '';
  private mixer?: THREE.AnimationMixer;
  private cache = new Map<string, Cached>();
  private pending = new Map<string, Promise<Cached>>();
  private token = 0;
  private clock = new THREE.Clock();
  private frame = 0;
  private observer: ResizeObserver;
  private resizePending = false;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private viewportDpr = 0;
  private bounds?: THREE.Box3;
  private boundsCheckElapsed = 0;
  private disposed = false;
  private readonly onContextLost: (event: Event) => void;

  constructor(
    private layer: HTMLElement,
    private onStatus: (status: PreviewStatus) => void = () => undefined,
  ) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    layer.append(canvas);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setClearAlpha(0);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, browserGraphicsProfile(savedMobileQuality()).dprCap),
    );
    configureColorPipeline(this.renderer, 'characterPreview');
    this.scene.background = null;
    this.camera.position.z = 1_000;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8b718f, 3.4));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 4);
    key.position.set(3, 5, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8e8ff, 2.2);
    fill.position.set(-4, 2, 5);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffdfc7, 1.5);
    rim.position.set(2, 3, -4);
    this.scene.add(rim);
    this.onContextLost = (event) => {
      event.preventDefault();
      this.onStatus({
        state: 'error',
        message: 'Podgląd 3D został zatrzymany przez przeglądarkę. Menu nadal działa.',
      });
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    // Writing canvas size inside the observer can trigger a Safari ResizeObserver loop.
    // Coalesce into the existing preview loop, without adding another animation frame loop.
    this.observer = new ResizeObserver(() => {
      this.resizePending = true;
    });
    this.observer.observe(layer);
    this.resize();
    this.draw();
  }

  /** Ładuje lub pobiera z cache wybraną postać i bezpiecznie podmienia podgląd. */
  async show(name: string) {
    const asset = characterAssets.find((character) => character.name === name);
    if (!asset || this.disposed) return;
    const token = ++this.token;
    const key = `${asset.id}:${asset.previewUrl || asset.url}`;

    try {
      const source = await this.cachedSource(key, asset.previewUrl || asset.url);
      if (this.disposed || token !== this.token) return;
      let reference: Cached | undefined;
      // Korba keeps the static donor pose in the main menu.
      if (asset.id === 'korba') {
        const amper = characterAssets.find((character) => character.id === 'amper')!;
        const referenceKey = `${amper.id}:${amper.previewUrl || amper.url}`;
        reference = await this.cachedSource(referenceKey, amper.previewUrl || amper.url);
      }
      if (this.disposed || token !== this.token) return;
      this.replaceModel(name, source, reference);
      this.onStatus({ state: 'ready' });
    } catch (error) {
      if (this.disposed || token !== this.token) return;
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`Nie udało się załadować podglądu ${name}: ${reason}`);
      this.onStatus({
        state: 'error',
        message: `Podgląd postaci „${name}” jest niedostępny. Możesz wybrać inną postać lub wejść do gry.`,
      });
    }
  }

  /** Ładuje GLB z limitem czasu oraz sprzątaniem spóźnionej odpowiedzi. */
  private cachedSource(key: string, url: string): Promise<Cached> {
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    let pending = this.pending.get(key);
    if (!pending) {
      pending = this.loadWithTimeout(url)
        .then((source) => {
          if (this.disposed) {
            disposeObjectTree(source.scene);
            throw new Error('Preview disposed');
          }
          this.cache.set(key, source);
          return source;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, pending);
    }
    return pending;
  }

  private loadWithTimeout(url: string): Promise<Cached> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        settled = true;
        reject(new Error(`przekroczono limit ${LOAD_TIMEOUT_MS / 1_000} s`));
      }, LOAD_TIMEOUT_MS);
      new GLTFLoader().load(
        url,
        (gltf) => {
          if (settled) {
            disposeObjectTree(gltf.scene);
            return;
          }
          settled = true;
          window.clearTimeout(timeout);
          repairSkinSeams(gltf.scene);
          applyPbrMaterialPolicy(gltf.scene, 'character');
          resolve({ scene: gltf.scene, animations: gltf.animations });
        },
        undefined,
        (error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          reject(error);
        },
      );
    });
  }

  /** Klonuje model, uruchamia Idle i oblicza pierwsze bezpieczne kadrowanie. */
  private replaceModel(name: string, source: Cached, reference?: Cached) {
    const model = cloneDisposableSkinnedModel(source.scene);
    const group = new THREE.Group();
    group.add(model);
    const assetId = characterAssets.find((asset) => asset.name === name)?.id;
    let clips = source.animations;
    if (reference) {
      clips = [amperPreviewPose(model, reference.scene, reference.animations, assetId)];
    }
    // Zawor's original preview is an unskinned mesh: no pose/weight deformation.
    const mixer = assetId === 'zawor' ? new THREE.AnimationMixer(model) : startPreviewIdle(model, clips);
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      disposeObjectTree(group);
      throw new Error('model nie zawiera widocznej geometrii');
    }
    const layout = this.calculateLayout(bounds);

    this.mixer?.stopAllAction();
    if (this.currentModel) this.mixer?.uncacheRoot(this.currentModel);
    if (this.current) {
      this.scene.remove(this.current);
      disposeObjectTree(this.current);
    }
    this.current = group;
    this.currentModel = model;
    this.currentName = name;
    this.bounds = bounds;
    this.boundsCheckElapsed = 0;
    this.mixer = mixer;
    this.scene.add(group);
    this.applyLayout(layout);
  }

  /** Przelicza responsywny układ dla bieżącego rozmiaru warstwy. */
  private calculateLayout(bounds: THREE.Box3) {
    const width = Math.max(1, this.layer.clientWidth);
    const height = Math.max(1, this.layer.clientHeight);
    return calculatePreviewLayout({ width, height }, { min: bounds.min, max: bounds.max });
  }

  /** Nakłada skalę, pozycję i frustum kamery na aktywny model. */
  private applyLayout(layout: ReturnType<typeof calculatePreviewLayout>) {
    if (!this.current || !this.bounds) return;
    this.camera.left = layout.camera.left;
    this.camera.right = layout.camera.right;
    this.camera.top = layout.camera.top;
    this.camera.bottom = layout.camera.bottom;
    this.camera.updateProjectionMatrix();
    this.current.scale.setScalar(layout.scale);
    this.current.position.set(layout.position.x, layout.position.y, layout.position.z);
    const viewport = { width: this.layer.clientWidth, height: this.layer.clientHeight };
    if (!previewBoundsFit(viewport, { min: this.bounds.min, max: this.bounds.max }, layout)) {
      console.error('CharacterPreview: model nie mieści się w bezpiecznym obszarze.');
    }
  }

  /** Ponownie dopasowuje model po zmianie rozmiaru lub bounding boxu. */
  private fitToLayer() {
    if (!this.current || !this.bounds) return;
    this.applyLayout(this.calculateLayout(this.bounds));
  }

  /** Rozszerza bounds o deformacje animowanego skina i koryguje przeskalowanie. */
  private includeAnimatedBounds() {
    if (!this.current || !this.currentModel || !this.bounds) return;
    this.currentModel.traverse((object) => {
      const mesh = object as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) mesh.computeBoundingBox();
    });
    this.current.updateWorldMatrix(true, true);
    const animatedBounds = new THREE.Box3().setFromObject(this.currentModel);
    animatedBounds.applyMatrix4(this.current.matrixWorld.clone().invert());
    if (animatedBounds.isEmpty()) return;

    const previous = this.bounds.clone();
    const expanded = this.bounds.clone().union(animatedBounds);
    if (expanded.equals(previous)) return;
    const oldSize = previous.getSize(new THREE.Vector3());
    const newSize = expanded.getSize(new THREE.Vector3());
    const growth = Math.max(
      newSize.x / Math.max(oldSize.x, 1e-6),
      newSize.y / Math.max(oldSize.y, 1e-6),
      newSize.z / Math.max(oldSize.z, 1e-6),
    );
    this.bounds.copy(expanded);
    this.fitToLayer();
    if (growth > 1.25) {
      console.warn(
        `CharacterPreview: skorygowano powiększony model „${this.currentName}” (${growth.toFixed(2)}×).`,
      );
    }
  }

  /** Dopasowuje renderer do fizycznego rozmiaru przezroczystej warstwy. */
  private resize() {
    const rect = this.layer.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, browserGraphicsProfile(savedMobileQuality()).dprCap);
    if (width === this.viewportWidth && height === this.viewportHeight && dpr === this.viewportDpr) return;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.viewportDpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.fitToLayer();
  }

  /** Aktualizuje Idle, kontroluje bounds i renderuje następną klatkę podglądu. */
  private draw = () => {
    if (this.disposed) return;
    if (this.resizePending) {
      this.resizePending = false;
      this.resize();
    }
    this.frame = requestAnimationFrame(this.draw);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.mixer?.update(delta);
    this.boundsCheckElapsed += delta;
    if (this.boundsCheckElapsed >= 0.5) {
      this.boundsCheckElapsed = 0;
      this.includeAnimatedBounds();
    }
    this.renderer.render(this.scene, this.camera);
  };

  /** Zatrzymuje podgląd i zwalnia modele, cache, renderer oraz obserwatory. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.token++;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.mixer?.stopAllAction();
    if (this.current) disposeObjectTree(this.current);
    this.current = undefined;
    this.currentModel = undefined;
    this.cache.forEach((source) => disposeObjectTree(source.scene));
    this.cache.clear();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.layer.replaceChildren();
  }
}
