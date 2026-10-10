import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  characterAssets,
  festivalNpcAssets,
  festivalMotionBankUrl,
  environmentAssets,
  interactiveAssets,
  authoredFestivalUrl,
  fogWorldBaseUrl,
  textureAssets,
  ecoPickupModelsUrl,
} from './assetManifest';
import { FestivalMotionBank } from '../animation/FestivalMotionBank';
import { SectorResources } from './SectorResources';
import { repairSkinSeams } from '../animation/repairSkinSeams';
import { disposeObjectTree } from '../lifecycle/disposeThree';
import {
  applyPbrMaterialPolicy,
  interactivePbrProfile,
  type PbrSurfaceProfile,
} from '../rendering/pbrMaterials';

export type WorldTextures = {
  grassColor: THREE.Texture | null;
  grassNormal: THREE.Texture | null;
  grassRoughness: THREE.Texture | null;
  horizon: THREE.Texture | null;
};

export type LoadedAssets = {
  fogTrial?: boolean;
  ecoPickups?: GLTF | null;
  characters: Map<string, GLTF>;
  authoredFestival: GLTF;
  speaker: GLTF | null;
  beerCan: GLTF | null;
  interactables: Map<string, GLTF>;
  textures: WorldTextures;
  errors: string[];
};
export class AssetLoader {
  private loader = new GLTFLoader();
  private textureLoader = new THREE.TextureLoader();
  private cache = new Map<string, Promise<GLTF | null>>();
  private textureCache = new Map<string, Promise<THREE.Texture | null>>();
  private motionBank?: Promise<FestivalMotionBank | null>;
  readonly sectorResources = new SectorResources();
  private fogDisposed = false;
  constructor(
    private progress: (message: string) => void,
    private error: (message: string) => void,
    private motionBankUrl: string | null = festivalMotionBankUrl,
    private fogTrial = false,
  ) {}

  async loadWorldSector(url: string): Promise<THREE.Object3D | null> {
    const model = await this.load(url, 'Sektor festiwalu', 'mixed');
    if (model) {
      this.sectorResources.acquire(model.scene);
      if (this.fogDisposed) {
        this.releaseWorldSector(url, model.scene);
        return null;
      }
    }
    return model?.scene ?? null;
  }
  releaseWorldSector(url: string, root: THREE.Object3D): void {
    this.cache.delete(url);
    this.sectorResources.release(root);
  }
  disposeFogWorld(): void {
    this.fogDisposed = true;
    this.sectorResources.dispose();
  }

  private loadMotionBank() {
    if (!this.motionBank)
      this.motionBank = this.motionBankUrl
        ? this.load(this.motionBankUrl, 'Animacje festiwalowe', 'character')
            .then((source) => {
              if (!source) return null;
              return new FestivalMotionBank(source);
            })
            .catch((error) => {
              this.error(`Nie udało się przygotować animacji: ${String(error)}`);
              return null;
            })
        : Promise.resolve(null);
    return this.motionBank;
  }

  /** Stream or preload the large crowd, using the same cache and bounded concurrency. */
  async loadFestivalNpcs(
    accept: (asset: (typeof festivalNpcAssets)[number], model: GLTF) => boolean,
    cancelled: () => boolean,
    onProgress?: (loaded: number, total: number, name: string) => void,
    concurrency = 2,
  ) {
    const motionBank = await this.loadMotionBank();
    let next = 0;
    let loaded = 0;
    let failed = 0;
    const total = festivalNpcAssets.length;
    const worker = async () => {
      while (!cancelled() && next < festivalNpcAssets.length) {
        const asset = festivalNpcAssets[next++];
        const model = await this.load(asset.url, asset.name, 'character');
        if (!model) {
          failed++;
          onProgress?.(loaded, total, asset.name);
          continue;
        }
        if (!cancelled()) motionBank?.apply(model);
        if (cancelled() || !accept(asset, model)) {
          disposeObjectTree(model.scene);
          this.cache.delete(asset.url);
        } else {
          loaded++;
        }
        onProgress?.(loaded, total, asset.name);
      }
    };
    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(workers);
    return { loaded, failed, total };
  }
  /** Ładuje pojedynczy GLB, buforuje Promise i zamienia błąd na kontrolowane `null`. */
  private load(url: string, label: string, profile: PbrSurfaceProfile) {
    if (!this.cache.has(url))
      this.cache.set(
        url,
        this.loader
          .loadAsync(url)
          .then((value) => {
            if (profile === 'character') repairSkinSeams(value.scene);
            applyPbrMaterialPolicy(value.scene, profile);
            this.progress(`Załadowano: ${label}`);
            return value;
          })
          .catch(() => {
            const message = `Nie udało się wczytać: ${url}`;
            this.error(message);
            return null;
          }),
      );
    return this.cache.get(url)!;
  }
  /** Równolegle ładuje wszystkie modele wymagane do zbudowania sceny gry. */

  /** Ładuje pojedynczą teksturę 2D, konfiguruje przestrzeń barw i buforuje Promise. */
  private loadTexture(
    url: string,
    label: string,
    colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
  ): Promise<THREE.Texture | null> {
    if (!this.textureCache.has(url)) {
      this.textureCache.set(
        url,
        this.textureLoader
          .loadAsync(url)
          .then((texture) => {
            texture.colorSpace = colorSpace;
            this.progress(`Załadowano: ${label}`);
            return texture;
          })
          .catch(() => {
            const message = `Nie udało się wczytać tekstury: ${url}`;
            this.error(message);
            return null;
          }),
      );
    }
    return this.textureCache.get(url)!;
  }

  /** Równolegle ładuje wszystkie modele i tekstury wymagane do zbudowania sceny gry. */
  async loadAll(): Promise<LoadedAssets> {
    const errors: string[] = [];
    const original = this.error;
    this.error = (m) => {
      errors.push(m);
      original(m);
    };
    const characters = new Map<string, GLTF>(),
      interactables = new Map<string, GLTF>();
    const motionBank = await this.loadMotionBank();
    const loadCharacter = async (asset: (typeof characterAssets)[number]) => {
      const gltf = await this.load(asset.url, asset.name, 'character');
      if (gltf) characters.set(asset.id, motionBank?.apply(gltf) ?? gltf);
    };
    if (this.fogTrial) for (const asset of characterAssets) await loadCharacter(asset);
    else await Promise.all(characterAssets.map(loadCharacter));
    await Promise.all(
      Object.entries(interactiveAssets).map(async ([id, url]) => {
        const gltf = await this.load(url, id, interactivePbrProfile(id));
        if (gltf) interactables.set(id, gltf);
      }),
    );
    const [authoredFestival, speaker, beerCan, ecoPickups] = await Promise.all([
      this.load(this.fogTrial ? fogWorldBaseUrl : authoredFestivalUrl, 'Świat festiwalu z Blendera', 'mixed'),
      this.load(environmentAssets.speaker, 'głośnik', 'plastic'),
      this.load(environmentAssets.beerCan, 'puszka piwa Woodstock', 'mixed'),
      this.load(ecoPickupModelsUrl, 'Modele Eko i przekąsek', 'mixed'),
    ]);
    if (!authoredFestival)
      throw new Error(
        'Nie udało się załadować świata z Blendera. Ponownie wyeksportuj authored-festival.glb.',
      );
    if (this.fogTrial) {
      this.sectorResources.acquire(authoredFestival.scene);
      if (this.fogDisposed) this.releaseWorldSector(fogWorldBaseUrl, authoredFestival.scene);
    }
    const [grassColor, grassNormal, grassRoughness, horizon] = await Promise.all([
      this.loadTexture(textureAssets.grass.color, 'tekstura trawy (kolor)', THREE.SRGBColorSpace),
      this.loadTexture(textureAssets.grass.normal, 'tekstura trawy (normal)', THREE.NoColorSpace),
      this.loadTexture(textureAssets.grass.roughness, 'tekstura trawy (roughness)', THREE.NoColorSpace),
      this.fogTrial
        ? null
        : this.loadTexture(textureAssets.horizon, 'panorama horyzontu', THREE.SRGBColorSpace),
    ]);
    return {
      fogTrial: this.fogTrial,
      characters,
      authoredFestival,
      speaker,
      beerCan,
      ecoPickups,
      interactables,
      textures: {
        grassColor,
        grassNormal,
        grassRoughness,
        horizon,
      },
      errors,
    };
  }
}
