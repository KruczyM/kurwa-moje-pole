import * as THREE from 'three';
import { textureAssets } from '../assets/assetManifest';

/** Używa panoramicznego zdjęcia pola jako tła, bez dodatkowej geometrii sceny. */
export function addHorizonSkybox(scene: THREE.Scene) {
  const texture = new THREE.TextureLoader().load(
    textureAssets.horizon,
    () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
    },
    undefined,
    () => console.error(`Nie udało się wczytać panoramy horyzontu: ${textureAssets.horizon}`),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
}
