import catalog from './assetCatalog.json';

export type CharacterAsset = {
  id: string;
  name: string;
  url: string;
  previewUrl: string;
};

/** Buduje bezpieczny URL do pliku udostępnianego z public/game-assets. */
const gameAsset = (path: string) => `/game-assets/${path.split('/').map(encodeURIComponent).join('/')}`;

/** Jedyny rejestr adresów binarnych zasobów używanych przez klienta. */
export const characterAssets: CharacterAsset[] = catalog.characters.map(({ id, name }) => ({
  id,
  name,
  url: gameAsset(`characters/${id}/npc-animations.glb`),
  previewUrl: gameAsset(`characters/${id}/preview.glb`),
}));

export const environmentAssets = {
  largeTent: gameAsset(catalog.environment.largeTent),
  smallTent: gameAsset(catalog.environment.smallTent),
  flag: gameAsset(catalog.environment.flag),
  speaker: gameAsset(catalog.environment.speaker),
};

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
};

export const effectAssets = {
  lsdOverlays: catalog.effects.lsdOverlays.map(gameAsset),
};

export const musicAsset = gameAsset(catalog.audio.music);
/** Zwraca URL nagrania głosowego o podanej nazwie bez rozszerzenia. */
export const voiceAsset = (name: string) => gameAsset(`${catalog.audio.voiceBase}/${name}.wav`);
