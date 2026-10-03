import catalog from './assetCatalog.json';

export type CharacterAsset = {
  id: string;
  name: string;
  url: string;
  previewUrl: string;
};

/** Buduje bezpieczny URL zasobu, uwzględniając podkatalog używany przez GitHub Pages. */
const gameAsset = (path: string) => {
  const url = `${import.meta.env.BASE_URL}game-assets/${path.split('/').map(encodeURIComponent).join('/')}`;
  const version = import.meta.env.VITE_ASSET_VERSION;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
};

/** Jedyny rejestr adresów binarnych zasobów używanych przez klienta. */
export const characterAssets: CharacterAsset[] = catalog.characters.map(({ id, name }) => ({
  id,
  name,
  url: gameAsset(`characters/${id}/npc-animations.glb`),
  previewUrl: gameAsset(
    `characters/${id}/${id === 'klatwa' ? 'new-preview-animations.glb' : id === 'amper' || id === 'zawor' ? 'preview.glb' : 'npc-animations.glb'}`,
  ),
}));

/** Background crowd assets are separate from selectable, animated player characters. */
export const festivalNpcAssets = catalog.festivalNpcs.map(({ id, name, path }) => ({
  id: `festival:${id}`,
  name,
  url: gameAsset(path),
}));

export const festivalMotionBankUrl = gameAsset('animations/festival-motion-bank.glb');

export const environmentAssets = {
  flag: gameAsset(catalog.environment.flag),
  chair: gameAsset(catalog.environment.chair),
  speaker: gameAsset(catalog.environment.speaker),
  toilet: gameAsset(catalog.environment.toilet),
  lidlRockShop: gameAsset(catalog.environment.lidlRockShop),
  allegroWheel: gameAsset(catalog.environment.allegroWheel),
  marketStalls: gameAsset(catalog.environment.marketStalls),
  festivalZones: gameAsset(catalog.environment.festivalZones),
  mainStage: gameAsset(catalog.environment.mainStage),
  smallStage: gameAsset(catalog.environment.smallStage),
  festivalGate: gameAsset(catalog.environment.festivalGate),
  festivalSignpost: gameAsset(catalog.environment.festivalSignpost),
  fohTower: gameAsset(catalog.environment.fohTower),
  delayTower: gameAsset(catalog.environment.delayTower),
  mudBath: gameAsset(catalog.environment.mudBath),
  fireTruckOsp: gameAsset(catalog.environment.fireTruckOsp),
  waterCurtain: gameAsset(catalog.environment.waterCurtain),
  patrolTent: gameAsset(catalog.environment.patrolTent),
  krishnaVillage: gameAsset(catalog.environment.krishnaVillage),
  trashCorral: gameAsset(catalog.environment.trashCorral),
  grzybek: gameAsset(catalog.environment.grzybek),
  washTaps: gameAsset(catalog.environment.washTaps),
  toitoiRow: gameAsset(catalog.environment.toitoiRow),
  fieldShowers: gameAsset(catalog.environment.fieldShowers),
  crowdBarrier: gameAsset(catalog.environment.crowdBarrier),
  festivalFoodTent: gameAsset(catalog.environment.festivalFoodTent),
  foodtruckFrytki: gameAsset(catalog.environment.foodtruckFrytki),
  foodtruckChurros: gameAsset(catalog.environment.foodtruckChurros),
  foodtruckBurger: gameAsset(catalog.environment.foodtruckBurger),
  foodtruckMakarun: gameAsset(catalog.environment.foodtruckMakarun),
  rollbarLech: gameAsset(catalog.environment.rollbarLech),
  sunflower: gameAsset(catalog.environment.sunflower),
};

export const tentAssets = Object.fromEntries(
  Object.entries(catalog.tents).map(([id, path]) => [id, gameAsset(path)]),
) as Record<keyof typeof catalog.tents, string>;

export const interactiveAssets = {
  table: gameAsset(catalog.interactives.table),
  cigarette: gameAsset(catalog.interactives.cigarette),
  joint: gameAsset(catalog.interactives.joint),
  cocaine: gameAsset(catalog.interactives.cocaine),
  mdma: gameAsset(catalog.interactives.mdma),
  mushrooms: gameAsset(catalog.interactives.mushrooms),
  lsd: gameAsset(catalog.interactives.lsd),
};

export const textureAssets = {
  grass: {
    color: gameAsset(catalog.textures.grass.color),
    normal: gameAsset(catalog.textures.grass.normal),
    roughness: gameAsset(catalog.textures.grass.roughness),
  },
  horizon: gameAsset(catalog.textures.horizon),
  skyboxes: {
    day: catalog.textures.skyboxes.day.map(gameAsset),
    evening: catalog.textures.skyboxes.evening.map(gameAsset),
    night: catalog.textures.skyboxes.night.map(gameAsset),
    nebula: catalog.textures.skyboxes.nebula.map(gameAsset),
  },
};

export const effectAssets = {
  lsdOverlays: catalog.effects.lsdOverlays.map(gameAsset),
};

export const musicAsset = gameAsset(catalog.audio.music);
/** Zwraca URL nagrania głosowego o podanej nazwie bez rozszerzenia. */
export const voiceAsset = (name: string) => gameAsset(`${catalog.audio.voiceBase}/${name}.wav`);
