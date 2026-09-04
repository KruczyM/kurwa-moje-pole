import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { characterAssets, environmentAssets, interactiveAssets, tentAssets } from './assetManifest';
import type { TentModelId } from '../world/campLayout';
import {
  applyPbrMaterialPolicy,
  interactivePbrProfile,
  type PbrSurfaceProfile,
} from '../rendering/pbrMaterials';
export type LoadedAssets = {
  characters: Map<string, GLTF>;
  tents: Map<TentModelId, GLTF>;
  flag: GLTF | null;
  chair: GLTF | null;
  speaker: GLTF | null;
  toilet: GLTF | null;
  interactables: Map<string, GLTF>;
  errors: string[];
};
export class AssetLoader {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<GLTF | null>>();
  constructor(
    private progress: (message: string) => void,
    private error: (message: string) => void,
  ) {}
  /** Ładuje pojedynczy GLB, buforuje Promise i zamienia błąd na kontrolowane `null`. */
  private load(url: string, label: string, profile: PbrSurfaceProfile) {
    if (!this.cache.has(url))
      this.cache.set(
        url,
        this.loader
          .loadAsync(url)
          .then((value) => {
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
  async loadAll(): Promise<LoadedAssets> {
    const errors: string[] = [];
    const original = this.error;
    this.error = (m) => {
      errors.push(m);
      original(m);
    };
    const characters = new Map<string, GLTF>(),
      interactables = new Map<string, GLTF>(),
      tents = new Map<TentModelId, GLTF>();
    await Promise.all(
      characterAssets.map(async (asset) => {
        const gltf = await this.load(asset.url, asset.name, 'character');
        if (gltf) characters.set(asset.id, gltf);
      }),
    );
    await Promise.all(
      Object.entries(interactiveAssets).map(async ([id, url]) => {
        const gltf = await this.load(url, id, interactivePbrProfile(id));
        if (gltf) interactables.set(id, gltf);
      }),
    );
    await Promise.all(
      Object.entries(tentAssets).map(async ([id, url]) => {
        const gltf = await this.load(url, `namiot ${id}`, 'fabric');
        if (gltf) tents.set(id as TentModelId, gltf);
      }),
    );
    const [flag, chair, speaker, toilet] = await Promise.all([
      this.load(environmentAssets.flag, 'maszt z flagą', 'fabric'),
      this.load(environmentAssets.chair, 'krzesło campingowe', 'mixed'),
      this.load(environmentAssets.speaker, 'głośnik', 'plastic'),
      this.load(environmentAssets.toilet, 'toi-toi wcTron', 'plastic'),
    ]);
    return { characters, tents, flag, chair, speaker, toilet, interactables, errors };
  }
}
