import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { characterAssets, environmentAssets, interactiveAssets } from './assetManifest';
export type LoadedAssets = {
  characters: Map<string, GLTF>;
  largeTent: GLTF | null;
  smallTent: GLTF | null;
  flag: GLTF | null;
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
  private load(url: string, label: string) {
    if (!this.cache.has(url))
      this.cache.set(
        url,
        this.loader
          .loadAsync(url)
          .then((value) => {
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
      interactables = new Map<string, GLTF>();
    await Promise.all(
      characterAssets.map(async (asset) => {
        const gltf = await this.load(asset.url, asset.name);
        if (gltf) characters.set(asset.id, gltf);
      }),
    );
    await Promise.all(
      Object.entries(interactiveAssets).map(async ([id, url]) => {
        const gltf = await this.load(url, id);
        if (gltf) interactables.set(id, gltf);
      }),
    );
    const [largeTent, smallTent, flag, speaker, toilet] = await Promise.all([
      this.load(environmentAssets.largeTent, 'duży namiot'),
      this.load(environmentAssets.smallTent, 'mały namiot'),
      this.load(environmentAssets.flag, 'maszt z flagą'),
      this.load(environmentAssets.speaker, 'głośnik'),
      this.load(environmentAssets.toilet, 'toi-toi wcTron'),
    ]);
    return { characters, largeTent, smallTent, flag, speaker, toilet, interactables, errors };
  }
}
