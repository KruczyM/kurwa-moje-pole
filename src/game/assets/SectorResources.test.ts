import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SectorResources } from './SectorResources';

function asset(key = 'material', offset = 0) {
  const image = { close: vi.fn() };
  const texture = new THREE.Texture(image);
  texture.userData.fogImageKey = 'image';
  texture.offset.x = offset;
  const material = new THREE.MeshStandardMaterial({ map: texture });
  material.userData.fogMaterialKey = key;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const disposed = { material: vi.fn(), texture: vi.fn(), geometry: vi.fn() };
  material.addEventListener('dispose', disposed.material);
  texture.addEventListener('dispose', disposed.texture);
  mesh.geometry.addEventListener('dispose', disposed.geometry);
  return { mesh, image, material, texture, disposed };
}
describe('SectorResources', () => {
  it('shares resources between sectors and disposes only at the last release', () => {
    const pool = new SectorResources(),
      a = asset(),
      b = asset();
    pool.acquire(a.mesh);
    pool.acquire(b.mesh);
    expect(b.mesh.material).toBe(a.material);
    expect(b.disposed.material).toHaveBeenCalledOnce();
    expect(b.image.close).toHaveBeenCalledOnce();
    expect(pool.stats).toEqual({ sectors: 2, materials: 1, textures: 1 });
    pool.release(a.mesh);
    expect(a.disposed.texture).not.toHaveBeenCalled();
    pool.release(b.mesh);
    expect(a.disposed.texture).toHaveBeenCalledOnce();
    expect(a.image.close).toHaveBeenCalledOnce();
    expect(pool.stats).toEqual({ sectors: 0, materials: 0, textures: 0 });
    pool.dispose();
    expect(a.image.close).toHaveBeenCalledOnce();
  });
  it('shares images/textures across distinct materials but respects UV transforms', () => {
    const pool = new SectorResources(),
      a = asset('a'),
      b = asset('b'),
      c = asset('c', 0.5);
    pool.acquire(a.mesh);
    pool.acquire(b.mesh);
    pool.acquire(c.mesh);
    expect(b.material.map).toBe(a.texture);
    expect(c.material.map).not.toBe(a.texture);
    expect(pool.stats.textures).toBe(2);
    pool.dispose();
    expect(pool.stats.sectors).toBe(0);
    for (const item of [a, b, c]) expect(item.disposed.geometry).toHaveBeenCalledOnce();
  });
  it('has stable resource counts over repeated load/unload cycles', () => {
    const pool = new SectorResources();
    for (let i = 0; i < 30; i++) {
      const a = asset();
      pool.acquire(a.mesh);
      pool.acquire(a.mesh);
      pool.release(a.mesh);
      expect(pool.stats).toEqual({ sectors: 0, materials: 0, textures: 0 });
    }
  });
});
