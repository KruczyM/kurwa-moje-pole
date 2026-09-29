import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  characterAssets,
  festivalNpcAssets,
  festivalMotionBankUrl,
  environmentAssets,
  interactiveAssets,
  tentAssets,
  textureAssets,
} from './assetManifest';
import type { TentModelId } from '../world/campLayout';
import { FestivalMotionBank } from '../animation/FestivalMotionBank';
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
  characters: Map<string, GLTF>;
  tents: Map<TentModelId, GLTF>;
  flag: GLTF | null;
  chair: GLTF | null;
  speaker: GLTF | null;
  toilet: GLTF | null;
  lidlRockShop: GLTF | null;
  allegroWheel: GLTF | null;
  marketStalls: GLTF | null;
  festivalZones: GLTF | null;
  mainStage: GLTF | null;
  smallStage: GLTF | null;
  festivalGate: GLTF | null;
  festivalSignpost: GLTF | null;
  fohTower: GLTF | null;
  delayTower: GLTF | null;
  mudBath: GLTF | null;
  fireTruckOsp: GLTF | null;
  waterCurtain: GLTF | null;
  patrolTent: GLTF | null;
  krishnaVillage: GLTF | null;
  trashCorral: GLTF | null;
  grzybek: GLTF | null;
  washTaps: GLTF | null;
  toitoiRow: GLTF | null;
  fieldShowers: GLTF | null;
  crowdBarrier: GLTF | null;
  festivalFoodTent: GLTF | null;
  foodtruckFrytki: GLTF | null;
  foodtruckChurros: GLTF | null;
  foodtruckBurger: GLTF | null;
  foodtruckMakarun: GLTF | null;
  rollbarLech: GLTF | null;
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
  constructor(
    private progress: (message: string) => void,
    private error: (message: string) => void,
    private motionBankUrl: string | null = festivalMotionBankUrl,
  ) {}

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

  /** Stream the large crowd after startup, using the same cache and at most two decoders. */
  async loadFestivalNpcs(
    accept: (asset: (typeof festivalNpcAssets)[number], model: GLTF) => boolean,
    cancelled: () => boolean,
  ) {
    const motionBank = await this.loadMotionBank();
    let next = 0;
    let loaded = 0;
    let failed = 0;
    const worker = async () => {
      while (!cancelled() && next < festivalNpcAssets.length) {
        const asset = festivalNpcAssets[next++];
        const model = await this.load(asset.url, asset.name, 'character');
        if (!model) {
          failed++;
          continue;
        }
        if (!cancelled()) motionBank?.apply(model);
        if (cancelled() || !accept(asset, model)) {
          disposeObjectTree(model.scene);
          this.cache.delete(asset.url);
        } else loaded++;
      }
    };
    await Promise.all([worker(), worker()]);
    return { loaded, failed, total: festivalNpcAssets.length };
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
      interactables = new Map<string, GLTF>(),
      tents = new Map<TentModelId, GLTF>();
    const motionBank = await this.loadMotionBank();
    await Promise.all(
      characterAssets.map(async (asset) => {
        const gltf = await this.load(asset.url, asset.name, 'character');
        if (gltf) characters.set(asset.id, motionBank?.apply(gltf) ?? gltf);
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
    const [
      flag,
      chair,
      speaker,
      toilet,
      lidlRockShop,
      allegroWheel,
      marketStalls,
      festivalZones,
      mainStage,
      smallStage,
      festivalGate,
      festivalSignpost,
      fohTower,
      delayTower,
      mudBath,
      fireTruckOsp,
      waterCurtain,
      patrolTent,
      krishnaVillage,
      trashCorral,
      grzybek,
      washTaps,
      toitoiRow,
      fieldShowers,
      crowdBarrier,
      festivalFoodTent,
      foodtruckFrytki,
      foodtruckChurros,
      foodtruckBurger,
      foodtruckMakarun,
      rollbarLech,
    ] = await Promise.all([
      this.load(environmentAssets.flag, 'maszt z flagą', 'fabric'),
      this.load(environmentAssets.chair, 'krzesło campingowe', 'mixed'),
      this.load(environmentAssets.speaker, 'głośnik', 'plastic'),
      this.load(environmentAssets.toilet, 'toi-toi wcTron', 'plastic'),
      this.load(environmentAssets.lidlRockShop, 'Lidl Rock Shop', 'mixed'),
      this.load(environmentAssets.allegroWheel, 'młyn Allegro', 'mixed'),
      this.load(environmentAssets.marketStalls, 'stoiska pasażu handlowego', 'mixed'),
      this.load(environmentAssets.festivalZones, 'strefy festiwalowe i scena Pomorza', 'mixed'),
      this.load(environmentAssets.mainStage, 'Duża Scena — model roboczy', 'mixed'),
      this.load(environmentAssets.smallStage, 'Mała Scena — model roboczy', 'mixed'),
      this.load(environmentAssets.festivalGate, 'Brama Festiwalowa', 'mixed'),
      this.load(environmentAssets.festivalSignpost, 'Drogowskaz Festiwalowy', 'mixed'),
      this.load(environmentAssets.fohTower, 'Wieża FOH', 'mixed'),
      this.load(environmentAssets.delayTower, 'Wieża Nagłośnieniowa Delay', 'mixed'),
      this.load(environmentAssets.mudBath, 'Kąpiel Błotna', 'mixed'),
      this.load(environmentAssets.fireTruckOsp, 'Wóz Strażacki OSP', 'mixed'),
      this.load(environmentAssets.waterCurtain, 'Kurtyna Wodna', 'mixed'),
      this.load(environmentAssets.patrolTent, 'Namiot Pokojowego Patrolu', 'mixed'),
      this.load(environmentAssets.krishnaVillage, 'Wioska Kryszny', 'mixed'),
      this.load(environmentAssets.trashCorral, 'Zagroda Odpadów', 'mixed'),
      this.load(environmentAssets.grzybek, 'Grzybek Wodny', 'mixed'),
      this.load(environmentAssets.washTaps, 'Krany Festiwalowe', 'mixed'),
      this.load(environmentAssets.toitoiRow, 'Rząd Toi-Toi', 'mixed'),
      this.load(environmentAssets.fieldShowers, 'Prysznice Polowe', 'mixed'),
      this.load(environmentAssets.crowdBarrier, 'Barierka koncertowa', 'mixed'),
      this.load(environmentAssets.festivalFoodTent, 'Wielki Namiot Gastronomiczny', 'mixed'),
      this.load(environmentAssets.foodtruckFrytki, 'Foodtruck Frytki Belgijskie', 'mixed'),
      this.load(environmentAssets.foodtruckChurros, 'Foodtruck Churros', 'mixed'),
      this.load(environmentAssets.foodtruckBurger, 'Foodtruck Burger', 'mixed'),
      this.load(environmentAssets.foodtruckMakarun, 'Foodtruck Makarun', 'mixed'),
      this.load(environmentAssets.rollbarLech, 'Rollbar Piwo Lech', 'mixed'),
    ]);
    const [grassColor, grassNormal, grassRoughness, horizon] = await Promise.all([
      this.loadTexture(textureAssets.grass.color, 'tekstura trawy (kolor)', THREE.SRGBColorSpace),
      this.loadTexture(textureAssets.grass.normal, 'tekstura trawy (normal)', THREE.NoColorSpace),
      this.loadTexture(textureAssets.grass.roughness, 'tekstura trawy (roughness)', THREE.NoColorSpace),
      this.loadTexture(textureAssets.horizon, 'panorama horyzontu', THREE.SRGBColorSpace),
    ]);
    return {
      characters,
      tents,
      flag,
      chair,
      speaker,
      toilet,
      lidlRockShop,
      allegroWheel,
      marketStalls,
      festivalZones,
      mainStage,
      smallStage,
      festivalGate,
      festivalSignpost,
      fohTower,
      delayTower,
      mudBath,
      fireTruckOsp,
      waterCurtain,
      patrolTent,
      krishnaVillage,
      trashCorral,
      grzybek,
      washTaps,
      toitoiRow,
      fieldShowers,
      crowdBarrier,
      festivalFoodTent,
      foodtruckFrytki,
      foodtruckChurros,
      foodtruckBurger,
      foodtruckMakarun,
      rollbarLech,
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
