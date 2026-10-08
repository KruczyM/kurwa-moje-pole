import * as THREE from 'three';

export async function loadInBatches<T>(
  items: readonly T[],
  concurrency: number,
  load: (item: T) => Promise<unknown>,
) {
  concurrency = Math.max(1, Math.floor(concurrency) || 1);
  for (let index = 0; index < items.length; index += concurrency) {
    await Promise.all(items.slice(index, index + concurrency).map(load));
    if (index + concurrency < items.length) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Resize before any renderer upload. Shared images are converted once, not once per material. */
export function limitTextureResolution(root: THREE.Object3D, maximum: number): void {
  const images = new WeakMap<object, HTMLCanvasElement>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) {
    const image = texture.image as CanvasImageSource & { width: number; height: number; close?: () => void };
    if (!image || typeof image !== 'object') continue;
    const previous = images.get(image);
    if (previous) {
      texture.image = previous;
      texture.needsUpdate = true;
      continue;
    }
    const width = image.width,
      height = image.height;
    if (
      !(width > maximum || height > maximum) ||
      texture instanceof THREE.DataTexture ||
      texture instanceof THREE.CompressedTexture
    )
      continue;
    const canvas = document.createElement('canvas');
    const scale = maximum / Math.max(width, height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) continue;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    images.set(image, canvas);
    texture.image = canvas;
    texture.needsUpdate = true;
    // GLTFParser may retain the old bitmap; release its decoded pixel backing after conversion.
    if (typeof image.close === 'function') image.close();
  }
}
