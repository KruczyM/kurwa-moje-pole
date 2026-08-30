import * as THREE from 'three';

const HORIZON_URL =
  '/assets/textures/leafy_grass/HdrOutdoorFieldBaseballDayClear001/HdrOutdoorFieldBaseballDayClear001_JPG_2K.JPG';

/** Uses the equirectangular field photo as a background, never as a dome mesh. */
export function addHorizonSkybox(scene: THREE.Scene) {
  const texture = new THREE.TextureLoader().load(
    HORIZON_URL,
    () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
    },
    undefined,
    () => console.error(`Nie udało się wczytać panoramy horyzontu: ${HORIZON_URL}`),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
}
