import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { loadInBatches, limitTextureResolution } from './mobileAssetPolicy';

afterEach(() => vi.unstubAllGlobals());
describe('mobile asset memory policy', () => {
  it('limits concurrent parsing and retains every requested asset', async () => {
    let active = 0,
      peak = 0;
    const loaded: number[] = [];
    await loadInBatches([1, 2, 3, 4], 1, async (value) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      loaded.push(value);
      active--;
    });
    expect(peak).toBe(1);
    expect(loaded).toEqual([1, 2, 3, 4]);
  });
  it('resizes shared images once, preserving materials, alpha and color space policy', () => {
    const draw = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: draw }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const image = { width: 1024, height: 512, close: vi.fn() };
    const map = new THREE.Texture(image),
      normal = new THREE.Texture(image);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map, normalMap: normal, transparent: true });
    const root = new THREE.Mesh(new THREE.BoxGeometry(), material);
    limitTextureResolution(root, 256);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(image.close).toHaveBeenCalledTimes(1);
    expect(map.image).toBe(normal.image);
    expect(canvas).toMatchObject({ width: 256, height: 128 });
    expect(map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(material.transparent).toBe(true);
    root.geometry.dispose();
    material.dispose();
    map.dispose();
    normal.dispose();
  });
});
