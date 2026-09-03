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
  previewUrl: gameAsset(`characters/${id}/preview.glb`),
}));

export const environmentAssets = {
  flag: gameAsset(catalog.environment.flag),
  chair: gameAsset(catalog.environment.chair),
  speaker: gameAsset(catalog.environment.speaker),
  toilet: gameAsset(catalog.environment.toilet),
};

export const tentAssets = Object.fromEntries(
  Object.entries(catalog.tents).map(([id, path]) => [id, gameAsset(path)]),
) as Record<keyof typeof catalog.tents, string>;

export const interactiveAssets = {
  table: gameAsset(catalog.interactives.table),
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
