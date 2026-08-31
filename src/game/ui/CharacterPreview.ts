import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { characterAssets } from '../assets/assetManifest';
import { cloneDisposableSkinnedModel, disposeObjectTree } from '../lifecycle/disposeThree';
import { calculatePreviewLayout, previewBoundsFit } from './previewLayout';

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
  private token = 0;
  private clock = new THREE.Clock();
  private frame = 0;
  private observer: ResizeObserver;
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
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setClearAlpha(0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = null;
    this.camera.position.z = 1_000;
    this.scene.add(new THREE.HemisphereLight(0xd9ecff, 0x25152f, 2.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2, 4, 4);
    this.scene.add(key);
    this.onContextLost = (event) => {
      event.preventDefault();
      this.onStatus({
        state: 'error',
        message: 'Podgląd 3D został zatrzymany przez przeglądarkę. Menu nadal działa.',
      });
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.observer = new ResizeObserver(() => this.resize());
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
      let source = this.cache.get(key);
      if (!source) {
        source = await this.loadWithTimeout(asset.previewUrl || asset.url);
        if (this.disposed || token !== this.token) {
          disposeObjectTree(source.scene);
          return;
        }
        this.cache.set(key, source);
      }
      if (this.disposed || token !== this.token) return;
      this.replaceModel(name, source);
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
  private replaceModel(name: string, source: Cached) {
    const model = cloneDisposableSkinnedModel(source.scene);
    const group = new THREE.Group();
    group.add(model);
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) {
      disposeObjectTree(group);
      throw new Error('model nie zawiera widocznej geometrii');
    }
    const layout = this.calculateLayout(bounds);

    this.mixer?.stopAllAction();
    if (this.current) {
      this.scene.remove(this.current);
      disposeObjectTree(this.current);
    }
    this.current = group;
    this.currentModel = model;
    this.currentName = name;
    this.bounds = bounds;
    this.boundsCheckElapsed = 0;
    this.mixer = new THREE.AnimationMixer(model);
    const idle =
      source.animations.find((clip) => /^idle(?: neutral)?$/i.test(clip.name)) ||
      source.animations.find((clip) => /idle/i.test(clip.name)) ||
      source.animations[0];
    if (idle) this.mixer.clipAction(idle).reset().play();
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.fitToLayer();
  }

  /** Aktualizuje Idle, kontroluje bounds i renderuje następną klatkę podglądu. */
  private draw = () => {
    if (this.disposed) return;
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
