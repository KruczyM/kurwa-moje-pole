export type CharacterAsset = {
  id: string;
  name: string;
  url: string;
  previewUrl: string;
};

const gameAsset = (path: string) =>
  `/game-assets/${path.split('/').map(encodeURIComponent).join('/')}`;

const characters: ReadonlyArray<[string, string]> = [
  ['amper', 'Amper'],
  ['antena', 'Antena'],
  ['gruczol', 'Gruczoł'],
  ['klatwa', 'Klątwa'],
  ['krwiak', 'Krwiak'],
  ['pien', 'Pień'],
  ['pierscien', 'Pierścień'],
  ['zawor', 'Zawór'],
];

/** Jedyny rejestr adresów binarnych zasobów używanych przez klienta. */
export const characterAssets: CharacterAsset[] = characters.map(([id, name]) => ({
  id,
  name,
  url: gameAsset(`characters/${id}/npc-animations.glb`),
  previewUrl: gameAsset(`characters/${id}/preview.glb`),
}));

export const environmentAssets = {
  largeTent: gameAsset('world/tents/main.glb'),
  smallTent: gameAsset('world/tents/small.glb'),
  flag: gameAsset('world/flag.glb'),
  speaker: gameAsset('props/speaker.glb'),
};

export const interactiveAssets = {
  table: gameAsset('interactables/table.glb'),
  joint: gameAsset('interactables/joint.glb'),
  cocaine: gameAsset('interactables/cocaine.glb'),
  mdma: gameAsset('interactables/mdma.glb'),
  mushrooms: gameAsset('interactables/mushrooms.glb'),
  lsd: gameAsset('interactables/lsd.glb'),
};

export const textureAssets = {
  grass: {
    color: gameAsset('textures/grass/color.jpg'),
    normal: gameAsset('textures/grass/normal.jpg'),
    roughness: gameAsset('textures/grass/roughness.jpg'),
  },
  horizon: gameAsset('textures/horizon/field.jpg'),
};

export const musicAsset = gameAsset('audio/camp-track.mp4');
